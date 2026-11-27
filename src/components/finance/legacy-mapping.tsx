"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { formatAccountAmount, formatDate } from "@/lib/format";
import {
  ACCOUNT_KINDS, exactAmount, kindCurrency, needsConversion, type AccountKind, type LegacyAccount,
} from "@/lib/ledger";
import { Field } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EnumSelect } from "@/components/fields/enum-select";
import { NumberField } from "@/components/fields/number-field";
import { postLegacy, remapLegacy } from "@/app/(app)/app/money/accounts/actions";
import { useLedgerSubmit } from "./use-ledger-submit";

type Conversion = { amount: number | null; evidence: string };
type Draft = { kind: AccountKind | null; conversions: Record<string, Conversion> };

/** Only the sources that need one are sent: the database rejects a spare conversion. */
function conversionsFor(account: LegacyAccount, draft: Draft) {
  const out: Record<string, { amount: number; evidence: string }> = {};
  let complete = draft.kind !== null;
  for (const source of account.sources) {
    if (!draft.kind || !needsConversion(source, draft.kind)) continue;
    const c = draft.conversions[source.source_key];
    if (c?.amount && c.evidence.trim()) out[source.source_key] = { amount: c.amount, evidence: c.evidence.trim() };
    else complete = false;
  }
  return { conversions: out, complete };
}

const blockedBy = (account: LegacyAccount) =>
  !account.posted && account.invalid_links
    ? ("invalidLinks" as const)
    : account.sources.some((s) => s.direct_debit_posting) ? ("directDebit" as const) : null;

function AccountMapping({
  account,
  draft,
  onChange,
  names,
  children,
}: {
  account: LegacyAccount;
  draft: Draft;
  onChange: (draft: Draft) => void;
  names: Record<AccountKind, string>;
  children?: React.ReactNode;
}) {
  const t = useTranslations("accounts.legacy");
  const id = React.useId();
  const blocked = blockedBy(account);
  const kinds = ACCOUNT_KINDS.filter((k) => !account.posted || k !== account.previous_kind);

  function setConversion(key: string, patch: Partial<Conversion>) {
    const current = draft.conversions[key] ?? { amount: null, evidence: "" };
    onChange({ ...draft, conversions: { ...draft.conversions, [key]: { ...current, ...patch } } });
  }

  return (
    <li className="space-y-3 rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-medium"><bdi>{account.name}</bdi></h3>
        <span className="num text-sm text-muted-foreground">
          {account.posted
            ? t("current", { name: account.previous_kind ? names[account.previous_kind] : "—" })
            : t("oldBalance", { amount: formatAccountAmount(account.balance, account.currency) })}
        </span>
      </div>
      <Field label={account.posted ? t("moveTo") : t("kind")} htmlFor={`${id}-kind`} className="max-w-xs">
        <EnumSelect id={`${id}-kind`} value={draft.kind ?? ""} placeholder={t("chooseKind")}
          // A new destination changes the currency, so typed conversions no longer apply.
          onChange={(v) => onChange({ kind: ACCOUNT_KINDS.find((k) => k === v) ?? null, conversions: {} })}
          options={kinds.map((k) => ({ value: k, label: names[k] }))} />
      </Field>
      {blocked ? <p role="alert" className="text-sm text-danger">{t(blocked)}</p> : null}

      {account.sources.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noSources")}</p>
      ) : (
        <ul className="max-h-96 divide-y divide-border overflow-y-auto text-sm">
          {account.sources.map((s) => {
            const convert = draft.kind !== null && needsConversion(s, draft.kind);
            const exact = draft.kind ? exactAmount(s, draft.kind) : null;
            const key = `${id}-${s.source_key}`;
            return (
              <li key={s.source_key} className="space-y-2 py-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-muted-foreground">
                    {t(`source.${s.source_type}`)} · <span className="num">{formatDate(s.occurred_on)}</span>
                  </span>
                  <span className="num">
                    {t(s.direction)} · {formatAccountAmount(Math.abs(s.amount), s.currency)}
                    {draft.kind && exact !== null ? ` → ${formatAccountAmount(exact, kindCurrency(draft.kind))}` : ""}
                  </span>
                </div>
                {convert ? (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-[12rem_1fr]">
                    <Field label={t("converted")} htmlFor={`${key}-amount`}>
                      <NumberField key={draft.kind} id={`${key}-amount`} defaultValue={draft.conversions[s.source_key]?.amount}
                        unit={kindCurrency(draft.kind!) === "DZD" ? "DA" : "USDT"}
                        onChange={(amount) => setConversion(s.source_key, { amount })} />
                    </Field>
                    <Field label={t("evidence")} htmlFor={`${key}-evidence`}>
                      <Input id={`${key}-evidence`} value={draft.conversions[s.source_key]?.evidence ?? ""} maxLength={2000}
                        autoComplete="off" onChange={(e) => setConversion(s.source_key, { evidence: e.target.value })} />
                    </Field>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {children}
    </li>
  );
}

export function LegacyMapping({ accounts, names }: { accounts: LegacyAccount[]; names: Record<AccountKind, string> }) {
  const t = useTranslations("accounts.legacy");
  const tActions = useTranslations("actions");
  const { busy, submit } = useLedgerSubmit();
  const [drafts, setDrafts] = React.useState<Record<string, Draft>>({});
  const [confirming, setConfirming] = React.useState(false);

  const draftOf = (a: LegacyAccount): Draft =>
    drafts[a.account_id] ?? { kind: a.posted ? null : a.proposed_kind, conversions: {} };
  const update = (a: LegacyAccount) => (draft: Draft) => setDrafts((d) => ({ ...d, [a.account_id]: draft }));
  const forget = (a: LegacyAccount) => setDrafts(({ [a.account_id]: _, ...rest }) => rest);

  const pending = accounts.filter((a) => !a.posted);
  const posted = accounts.filter((a) => a.posted);
  const ready = pending.every((a) => !blockedBy(a) && conversionsFor(a, draftOf(a)).complete);

  function postAll() {
    const input = {
      mappings: Object.fromEntries(pending.map((a) => {
        const draft = draftOf(a);
        return [a.account_id, { kind: draft.kind!, conversions: conversionsFor(a, draft).conversions }];
      })),
    };
    submit(input, () => postLegacy(input), () => setConfirming(false), t("posted"));
  }

  function remap(a: LegacyAccount) {
    const draft = draftOf(a);
    const input = {
      legacy_account_id: a.account_id,
      expected_mapping_id: a.previous_mapping_id!,
      kind: draft.kind!,
      conversions: conversionsFor(a, draft).conversions,
    };
    submit(input, () => remapLegacy(input), () => forget(a), t("remapped"));
  }

  return (
    <section id="legacy" className="card-surface scroll-mt-20 space-y-4 rounded-xl p-5">
      <div>
        <h2 className="text-sm font-semibold">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>

      {pending.length ? (
        <div className="space-y-3">
          <ul className="space-y-3">
            {pending.map((a) => (
              <AccountMapping key={a.account_id} account={a} draft={draftOf(a)} onChange={update(a)} names={names} />
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" onClick={() => setConfirming(true)} disabled={busy || !ready}>{t("postAll")}</Button>
            {ready ? null : <p className="text-xs text-muted-foreground">{t("incomplete")}</p>}
          </div>
        </div>
      ) : null}

      {posted.length ? (
        <ul className="space-y-3">
          {posted.map((a) => {
            const draft = draftOf(a);
            const can = draft.kind !== null && !blockedBy(a) && conversionsFor(a, draft).complete && a.previous_mapping_id !== null;
            return (
              <AccountMapping key={`${a.account_id}:${a.previous_mapping_id}`} account={a} draft={draft} onChange={update(a)} names={names}>
                <Button type="button" variant="outline" size="sm" disabled={busy || !can} onClick={() => remap(a)}>
                  {t("remap")}
                </Button>
              </AccountMapping>
            );
          })}
        </ul>
      ) : null}

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("postTitle")}</DialogTitle>
            <DialogDescription>{t("postBody")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setConfirming(false)}>{tActions("cancel")}</Button>
            <Button type="button" onClick={postAll} disabled={busy || !ready}>{t("postAll")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
