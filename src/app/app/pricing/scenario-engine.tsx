"use client";

import { useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/field";
import { Badge } from "@/components/ui/badge";
import {
  PRICING_FIELDS,
  SCENARIO_SLUGS,
  computeScenario,
  type PricingInputs,
  type ScenarioSlug,
} from "@/lib/pricing";
import { formatCurrency } from "@/lib/format";

type Status = "idle" | "saving" | "saved" | "error";
const GROUPS = ["funnel", "perOrder", "fixed"] as const;

/** Shared by the general planner (productId = null) and each product page. */
export function ScenarioEngine({
  productId,
  initial,
}: {
  productId: string | null;
  initial: Record<ScenarioSlug, PricingInputs>;
}) {
  const t = useTranslations();
  const [scenarios, setScenarios] = useState(initial);
  const [status, setStatus] = useState<Status>("idle");
  const latest = useRef(scenarios);
  latest.current = scenarios;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function set(slug: ScenarioSlug, key: keyof PricingInputs, raw: string) {
    const n = Number(raw);
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
    let q = supabase
      .from("pricing_scenarios")
      .select("id,slug")
      .in("slug", [...SCENARIO_SLUGS]);
    q = productId === null ? q.is("product_id", null) : q.eq("product_id", productId);
    const { data: existing } = await q;
    const bySlug = new Map((existing ?? []).map((r) => [r.slug, r.id]));

    const results = await Promise.all(
      SCENARIO_SLUGS.map((slug) => {
        const inputs = latest.current[slug];
        const id = bySlug.get(slug);
        return id
          ? supabase.from("pricing_scenarios").update({ inputs }).eq("id", id)
          : supabase
              .from("pricing_scenarios")
              .insert({ product_id: productId, slug, inputs });
      }),
    );
    setStatus(results.some((r) => r.error) ? "error" : "saved");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {status === "saving" ? <Badge variant="secondary">{t("actions.saving")}</Badge> : null}
        {status === "saved" ? <Badge variant="outline">{t("common.updated")}</Badge> : null}
        {status === "error" ? <Badge variant="destructive">{t("common.error")}</Badge> : null}
        <span>{t("pricing.autosave")}</span>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {SCENARIO_SLUGS.map((slug) => (
          <ScenarioCard
            key={slug}
            slug={slug}
            inputs={scenarios[slug]}
            onChange={(k, v) => set(slug, k, v)}
          />
        ))}
      </div>
    </div>
  );
}

function ScenarioCard({
  slug,
  inputs,
  onChange,
}: {
  slug: ScenarioSlug;
  inputs: PricingInputs;
  onChange: (key: keyof PricingInputs, value: string) => void;
}) {
  const t = useTranslations();
  const r = useMemo(() => computeScenario(inputs), [inputs]);
  const profitable = r.net_profit_per_order >= 0;

  return (
    <div className="glass-card space-y-4 rounded-xl p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{t(`pricing.scenario.${slug}`)}</h3>
        <Badge variant={profitable ? "default" : "destructive"}>
          {profitable ? t("pricing.profit") : t("pricing.loss")}
        </Badge>
      </div>

      {/* highlights */}
      <div className="grid grid-cols-2 gap-2">
        <Metric label={t("pricing.netOrder")} value={formatCurrency(r.net_profit_per_order)} accent />
        <Metric label={t("pricing.netMonth")} value={formatCurrency(r.net_profit_per_month)} accent />
      </div>

      {/* derived breakdown */}
      <div className="space-y-1 border-y border-border py-3 text-xs">
        <Row label={t("pricing.confirmation_cost_da")} value={fmt(r.confirmation_cost_da)} />
        <Row label={t("pricing.delivery_cost_da")} value={fmt(r.delivery_cost_da)} />
        <Row label={t("pricing.confirmed_day")} value={`${fmt(r.confirmed_per_day)} / ${fmt(r.confirmed_per_month)}`} />
        <Row label={t("pricing.delivered_day")} value={`${fmt(r.delivered_per_day)} / ${fmt(r.delivered_per_month)}`} />
        <Row label={t("pricing.returns_fee")} value={fmt(r.returns_fee)} />
        <Row label={t("pricing.other_fee")} value={fmt(r.other_fee_per_order)} />
        <Row label={t("pricing.cost_order")} value={formatCurrency(r.cost_per_order)} strong />
        <Row label={t("pricing.netDay")} value={formatCurrency(r.net_profit_per_day)} />
      </div>

      {/* inputs */}
      {GROUPS.map((g) => (
        <div key={g} className="space-y-2">
          <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {t(`pricing.groups.${g}`)}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {PRICING_FIELDS.filter((f) => f.group === g).map((f) => (
              <Field key={f.key} label={t(`pricing.fields.${f.key}`)} htmlFor={`${slug}_${f.key}`}>
                <Input
                  id={`${slug}_${f.key}`}
                  type="number"
                  step="any"
                  min="0"
                  value={inputs[f.key] ?? 0}
                  onChange={(e) => onChange(f.key, e.target.value)}
                  className="text-xs"
                />
              </Field>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

const fmt = (n: number) =>
  n.toLocaleString("en-US", { maximumFractionDigits: 2 });

function Metric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg bg-muted/40 p-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={accent ? "text-sm font-bold text-gradient" : "text-sm font-semibold"}>{value}</div>
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
