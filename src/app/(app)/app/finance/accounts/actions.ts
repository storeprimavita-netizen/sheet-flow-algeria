"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdminProfile } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";

import type { UpdateResult } from "@/app/(app)/app/products/actions";

import { CURRENCY_CODES } from "@/lib/enums";

const accountSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  currency: z.enum(CURRENCY_CODES),
  opening_balance: z.coerce.number().min(0),
  low_balance_threshold: z.coerce.number().min(0),
  is_active: z.string().transform((v) => v === "on"),
});

export async function saveAccount(formData: FormData): Promise<UpdateResult> {
  const { workspaceId } = await requireAdminProfile();
  const parsed = accountSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { id, ...input } = parsed.data;

  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("accounts").update(input).eq("id", id).eq("workspace_id", workspaceId)
    : await supabase.from("accounts").insert({ workspace_id: workspaceId, ...input });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/app/finance/accounts");
  revalidatePath("/app/finance/overview");
  return { ok: true };
}

const topupSchema = z.object({
  account_id: z.string().uuid(),
  amount: z.coerce.number().positive(),
  occurred_on: z.string().min(1),
  note: z.string().optional(),
});

export async function saveTopup(formData: FormData): Promise<UpdateResult> {
  const { workspaceId } = await requireAdminProfile();
  const parsed = topupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("account_topups")
    .insert({ workspace_id: workspaceId, ...parsed.data });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/app/finance/accounts");
  revalidatePath("/app/finance/overview");
  return { ok: true };
}
