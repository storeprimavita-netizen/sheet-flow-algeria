"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { requireAdminProfile } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import { ACCOUNT_KINDS, transferAgrees, type AccountKind } from "@/lib/ledger";

import type { UpdateResult } from "@/app/(app)/app/catalog/products/actions";

function revalidate() {
  revalidatePath("/app/money/accounts");
  revalidatePath("/app/money/overview");
}

const accountSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1),
  low_balance_threshold: z.coerce.number().min(0).max(9_999_999_999.99),
  is_active: z.literal("on").optional().transform((v) => v === "on"),
});

export async function saveAccount(formData: FormData): Promise<UpdateResult> {
  const { workspaceId } = await requireAdminProfile();
  const t = await getTranslations("accounts.errors");
  const values = Object.fromEntries(formData);
  if (!values.id) return { ok: false, error: t("systemOnly") };
  const parsed = accountSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: t("invalidInput") };
  const { id, ...input } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.from("accounts").update(input)
    .eq("id", id).eq("workspace_id", workspaceId).select("id").maybeSingle();
  if (error || !data) return { ok: false, error: t("saveFailed") };

  revalidate();
  return { ok: true };
}

const amount = z.number().positive().lt(100_000_000_000_000);
const day = z.iso.date();
const note = z.string().trim().max(2000).optional();

type ErrorKey =
  | "invalidInput" | "entryFailed" | "transferFailed" | "reverseFailed" | "postFailed" | "remapFailed" | "staleMapping";

async function fail(key: ErrorKey): Promise<UpdateResult> {
  const t = await getTranslations("accounts.errors");
  return { ok: false, error: t(key) };
}

async function done(error: unknown, key: ErrorKey): Promise<UpdateResult> {
  if (error) return fail(key);
  revalidate();
  return { ok: true };
}

/** Ids of the workspace's system accounts, resolved server-side. */
async function systemAccounts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
): Promise<Partial<Record<AccountKind, string>>> {
  const { data } = await supabase.from("accounts").select("id, kind")
    .eq("workspace_id", workspaceId).in("kind", [...ACCOUNT_KINDS]);
  return Object.fromEntries((data ?? []).map((a) => [a.kind, a.id]));
}

const entrySchema = z.object({
  account_id: z.uuid(),
  occurred_on: day,
  direction: z.enum(["in", "out"]),
  amount,
  category_id: z.uuid().optional(),
  note,
  request_key: z.uuid(),
});

export async function saveEntry(input: z.input<typeof entrySchema>): Promise<UpdateResult> {
  await requireAdminProfile();
  const parsed = entrySchema.safeParse(input);
  if (!parsed.success) return fail("invalidInput");
  const v = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("append_account_entry", {
    p_account_id: v.account_id,
    p_occurred_on: v.occurred_on,
    p_direction: v.direction,
    p_amount: v.amount,
    p_request_key: v.request_key,
    p_category_id: v.category_id,
    p_note: v.note,
  });
  return done(error, "entryFailed");
}

const transferSchema = z.object({
  from: z.enum(["dzd", "usdt"]),
  occurred_on: day,
  amount_out: amount,
  amount_in: amount,
  rate: z.number().positive().lt(100_000_000),
  note,
  request_key: z.uuid(),
}).refine((v) => transferAgrees(v.from === "dzd" ? "DZD" : "USDT", v.amount_out, v.amount_in, v.rate));

export async function transferFunds(input: z.input<typeof transferSchema>): Promise<UpdateResult> {
  const { workspaceId } = await requireAdminProfile();
  const parsed = transferSchema.safeParse(input);
  if (!parsed.success) return fail("invalidInput");
  const v = parsed.data;

  const supabase = await createClient();
  const ids = await systemAccounts(supabase, workspaceId);
  const from = ids[v.from];
  const to = ids[v.from === "dzd" ? "usdt" : "dzd"];
  if (!from || !to) return fail("transferFailed");
  const { error } = await supabase.rpc("transfer_account_funds", {
    p_from_account_id: from,
    p_to_account_id: to,
    p_occurred_on: v.occurred_on,
    p_amount_out: v.amount_out,
    p_amount_in: v.amount_in,
    p_rate_dzd: v.rate,
    p_note: v.note,
    p_request_key: v.request_key,
  });
  return done(error, "transferFailed");
}

const payoutSchema = z.object({ occurred_on: day, amount, note, request_key: z.uuid() });

/** ZR → DZD: the same DZD amount leaves one account and enters the other. */
export async function markPayoutTaken(input: z.input<typeof payoutSchema>): Promise<UpdateResult> {
  const { workspaceId } = await requireAdminProfile();
  const parsed = payoutSchema.safeParse(input);
  if (!parsed.success) return fail("invalidInput");
  const v = parsed.data;

  const supabase = await createClient();
  const ids = await systemAccounts(supabase, workspaceId);
  if (!ids.zr || !ids.dzd) return fail("transferFailed");
  const { error } = await supabase.rpc("transfer_account_funds", {
    p_from_account_id: ids.zr,
    p_to_account_id: ids.dzd,
    p_occurred_on: v.occurred_on,
    p_amount_out: v.amount,
    p_amount_in: v.amount,
    p_note: v.note,
    p_request_key: v.request_key,
  });
  return done(error, "transferFailed");
}

const reverseSchema = z.object({ entry_id: z.uuid(), occurred_on: day, note, request_key: z.uuid() });

export async function reverseEntry(input: z.input<typeof reverseSchema>): Promise<UpdateResult> {
  await requireAdminProfile();
  const parsed = reverseSchema.safeParse(input);
  if (!parsed.success) return fail("invalidInput");
  const v = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("reverse_account_entry", {
    p_entry_id: v.entry_id,
    p_occurred_on: v.occurred_on,
    p_note: v.note,
    p_request_key: v.request_key,
  });
  return done(error, "reverseFailed");
}

const conversionsSchema = z.record(
  z.string().regex(/^(opening|topup|entry|expense|ad_spend):[0-9a-f-]{36}$/),
  z.object({ amount, evidence: z.string().trim().min(1).max(2000) }),
);
const postSchema = z.object({
  mappings: z.record(z.uuid(), z.object({ kind: z.enum(ACCOUNT_KINDS), conversions: conversionsSchema })),
});

export async function postLegacy(input: z.input<typeof postSchema>): Promise<UpdateResult> {
  await requireAdminProfile();
  const parsed = postSchema.safeParse(input);
  if (!parsed.success) return fail("invalidInput");

  const supabase = await createClient();
  const { error } = await supabase.rpc("post_legacy_accounts", { p_mappings: parsed.data.mappings });
  return done(error, "postFailed");
}

const remapSchema = z.object({
  legacy_account_id: z.uuid(),
  expected_mapping_id: z.uuid(),
  kind: z.enum(ACCOUNT_KINDS),
  conversions: conversionsSchema,
});

export async function remapLegacy(input: z.input<typeof remapSchema>): Promise<UpdateResult> {
  await requireAdminProfile();
  const parsed = remapSchema.safeParse(input);
  if (!parsed.success) return fail("invalidInput");
  const v = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("remap_legacy_account", {
    p_legacy_account_id: v.legacy_account_id,
    p_expected_mapping_id: v.expected_mapping_id,
    p_kind: v.kind,
    p_conversions: v.conversions,
  });
  // 00085 raises this wording when the mapping on screen is no longer current.
  return done(error, error?.message.includes("current legacy mapping") ? "staleMapping" : "remapFailed");
}
