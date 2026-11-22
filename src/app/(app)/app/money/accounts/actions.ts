"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { requireAdminProfile } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";

import type { UpdateResult } from "@/app/(app)/app/catalog/products/actions";

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

  revalidatePath("/app/money/accounts");
  revalidatePath("/app/money/overview");
  return { ok: true };
}

const topupSchema = z.object({
  account_id: z.string().uuid(),
  amount: z.coerce.number().positive().lt(100_000_000_000_000),
  occurred_on: z.iso.date(),
  note: z.string().max(2000).optional(),
  request_key: z.string().uuid().optional(),
});

export async function saveTopup(formData: FormData): Promise<UpdateResult> {
  await requireAdminProfile();
  const t = await getTranslations("accounts.errors");
  const parsed = topupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: t("invalidInput") };
  const { account_id, amount, occurred_on, note, request_key } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("append_account_entry", {
    p_account_id: account_id,
    p_amount: amount,
    p_occurred_on: occurred_on,
    p_direction: "in",
    p_note: note,
    p_request_key: request_key,
  });
  if (error) return { ok: false, error: t("topupFailed") };

  revalidatePath("/app/money/accounts");
  revalidatePath("/app/money/overview");
  return { ok: true };
}
