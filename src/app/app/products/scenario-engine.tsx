"use client";

import { useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { createClient } from "@/lib/supabase/client";
import { Field } from "@/components/field";
import { Chip } from "@/components/ui/chip";
import { MoneyField } from "@/components/fields/money-field";
import { PercentField } from "@/components/fields/percent-field";
import {
  PRICING_FIELDS,
  SCENARIO_SLUGS,
  breakEvenDeliveryPct,
  computeScenario,
  type PricingInputs,
  type ScenarioResult,
  type ScenarioSlug,
} from "@/lib/pricing";
import type { RealPricing } from "@/lib/pricing-real";
import { formatCurrency } from "@/lib/format";

type Status = "idle" | "saving" | "saved" | "error";
const GROUPS = ["funnel", "perOrder", "fixed"] as const;

/** Shared by the general planner (productId = null) and each product's Pricing tab. */
export function ScenarioEngine({
  workspaceId,
  productId,
  initial,
  real,
}: {
  workspaceId: string;
  productId: string | null;
  initial: Record<ScenarioSlug, PricingInputs>;
  real?: RealPricing;
}) {
  const t = useTranslations();
  const [scenarios, setScenarios] = useState(initial);
  const [status, setStatus] = useState<Status>("idle");
  const latest = useRef(scenarios);
  latest.current = scenarios;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function set(slug: ScenarioSlug, key: keyof PricingInputs, n: number) {
    const value = Number.isFinite(n) ? n : 0;
    setScenarios((s) => ({ ...s, [slug]: { ...s[slug], [key]: value } }));
    setStatus("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(save, 700);
  }

  async function save() {
    const supabase = createClient();
    // The unique indexes are partial (product_id null vs not-null), so a plain
    // ON CONFLICT can't infer them — resolve insert-vs-update per slug instead.
    let q = supabase.from("product_scenarios").select("id,slug").in("slug", [...SCENARIO_SLUGS]);
    q = productId === null ? q.is("product_id", null) : q.eq("product_id", productId);
    const { data: existing } = await q;
    const bySlug = new Map((existing ?? []).map((r) => [r.slug, r.id]));

    const results = await Promise.all(
      SCENARIO_SLUGS.map((slug) => {
        const inputs = latest.current[slug];
        const id = bySlug.get(slug);
        return id
          ? supabase.from("product_scenarios").update({ inputs }).eq("id", id)
          : supabase
              .from("product_scenarios")
              .insert({ workspace_id: workspaceId, product_id: productId, slug, inputs });
      }),
    );
    setStatus(results.some((r) => r.error) ? "error" : "saved");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {status === "saving" ? <Chip token="neutral" size="sm">{t("actions.saving")}</Chip> : null}
        {status === "saved" ? <Chip token="success" size="sm">{t("common.updated")}</Chip> : null}
        {status === "error" ? <Chip token="danger" size="sm">{t("common.error")}</Chip> : null}
        <span>{t("pricing.autosave")}</span>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {SCENARIO_SLUGS.map((slug) => (
          <ScenarioCard
            key={slug}
            id={slug}
            title={t(`pricing.scenario.${slug}`)}
            inputs={scenarios[slug]}
            onChange={(k, v) => set(slug, k, v)}
          />
        ))}
        {real ? (
          <ScenarioCard id="real" title={t("pricing.real")} inputs={real.inputs} noData={!real.hasData} />
        ) : null}
      </div>
    </div>
  );
}

function ScenarioCard({
  id,
  title,
  inputs,
  onChange,
  noData,
}: {
  id: string;
  title: string;
  inputs: PricingInputs;
  onChange?: (key: keyof PricingInputs, value: number) => void;
  noData?: boolean;
}) {
  const t = useTranslations();
  const r: ScenarioResult | null = useMemo(() => (noData ? null : computeScenario(inputs)), [inputs, noData]);
  const profitable = (r?.net_profit_per_order ?? 0) >= 0;
  // No sale price or rates → every line is 0 and "0 ≥ 0" would read as Profit
  // with a ≥0.5% break-even. Call it incomplete instead of a false verdict.
  const incomplete = !inputs.sale_price || !inputs.confirmation_pct || !inputs.delivery_pct;
  const breakEven = useMemo(() => (noData || incomplete ? null : breakEvenDeliveryPct(inputs)), [inputs, noData, incomplete]);

  return (
    <div className="card-surface space-y-4 rounded-xl p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        {r ? (
          <Chip token={incomplete ? "neutral" : profitable ? "success" : "danger"} size="sm">
            {incomplete ? t("pricing.incomplete") : profitable ? t("pricing.profit") : t("pricing.loss")}
          </Chip>
        ) : null}
      </div>

      {/* highlights */}
      <div className="grid grid-cols-2 gap-2">
        <Metric label={t("pricing.netOrder")} value={incomplete ? "—" : formatCurrency(r?.net_profit_per_order ?? null)} accent />
        <Metric label={t("pricing.netMonth")} value={incomplete ? "—" : formatCurrency(r?.net_profit_per_month ?? null)} accent />
      </div>

      {/* break-even delivery rate */}
      {r && !incomplete ? (
        <div className="rounded-lg bg-muted/40 p-2 text-xs">
          {breakEven === null ? (
            <span className="text-danger">{t("pricing.breakEvenNever")}</span>
          ) : (
            <span className={inputs.delivery_pct >= breakEven ? "text-success" : "text-warning"}>
              {t("pricing.breakEven", { pct: breakEven })}
            </span>
          )}
        </div>
      ) : null}

      {/* derived breakdown */}
      <div className="space-y-1 border-y border-border py-3 text-xs">
        <Row label={t("pricing.confirmation_cost_da")} value={fmt(r?.confirmation_cost_da)} />
        <Row label={t("pricing.delivery_cost_da")} value={fmt(r?.delivery_cost_da)} />
        <Row
          label={t("pricing.confirmed_day")}
          value={r ? `${fmt(r.confirmed_per_day)} / ${fmt(r.confirmed_per_month)}` : "—"}
        />
        <Row
          label={t("pricing.delivered_day")}
          value={r ? `${fmt(r.delivered_per_day)} / ${fmt(r.delivered_per_month)}` : "—"}
        />
        <Row label={t("pricing.returns_fee")} value={fmt(r?.returns_fee)} />
        <Row label={t("pricing.other_fee")} value={fmt(r?.other_fee_per_order)} />
        <Row label={t("pricing.cost_order")} value={formatCurrency(r?.cost_per_order ?? null)} strong />
        <Row label={t("pricing.netDay")} value={formatCurrency(r?.net_profit_per_day ?? null)} />
      </div>

      {/* inputs — read-only cards (the Real column) have none to edit */}
      {onChange
        ? GROUPS.map((g) => (
            <div key={g} className="space-y-2">
              <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {t(`pricing.groups.${g}`)}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {PRICING_FIELDS.filter((f) => f.group === g).map((f) => (
                  <Field key={f.key} label={t(`pricing.fields.${f.key}`)} htmlFor={`${id}_${f.key}`}>
                    {f.percent ? (
                      <PercentField
                        id={`${id}_${f.key}`}
                        defaultValue={inputs[f.key]}
                        onChange={(v) => onChange(f.key, v ?? 0)}
                      />
                    ) : (
                      <MoneyField
                        id={`${id}_${f.key}`}
                        defaultValue={inputs[f.key]}
                        currency={f.euro ? "EUR" : "DZD"}
                        rate={inputs.euro_price}
                        onChange={(v) => onChange(f.key, v)}
                      />
                    )}
                  </Field>
                ))}
              </div>
            </div>
          ))
        : null}
    </div>
  );
}

const fmt = (n: number | null | undefined) =>
  n == null ? "—" : n.toLocaleString("en-US", { maximumFractionDigits: 2 }).replace(/,/g, "\u00a0");

function Metric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg bg-muted/40 p-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={accent ? "text-sm font-bold text-foreground" : "text-sm font-semibold"}>{value}</div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={strong ? "font-semibold" : ""}>{value}</span>
    </div>
  );
}
