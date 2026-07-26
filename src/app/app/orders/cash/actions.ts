"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { requireAdminProfile as adminProfile } from "@/lib/rbac";

const optionalText = z.string().trim().optional().transform((v) => v || null);

const recordSchema = z.object({
  amount_dzd: z.coerce.number().min(0),
  note: optionalText,
});

export async function recordCashCollection(orderId: string, formData: FormData) {
  const { workspaceId } = await adminProfile();
  const input = recordSchema.parse({
    amount_dzd: formData.get("amount_dzd"),
    note: formData.get("note"),
  });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("cash_collections").insert({
    workspace_id: workspaceId,
    order_id: orderId,
    amount_dzd: input.amount_dzd,
    note: input.note,
    created_by: user?.id ?? null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/app/orders/cash");
}

const depositSchema = z.object({ reference: optionalText });

export async function markDeposited(collectionId: string, formData: FormData) {
  await adminProfile();
  const input = depositSchema.parse({ reference: formData.get("reference") });

  const supabase = await createClient();
  const { error } = await supabase
    .from("cash_collections")
    .update({
      status: "deposited",
      deposited_on: new Date().toISOString().slice(0, 10),
      reference: input.reference,
    })
    .eq("id", collectionId);
  if (error) throw new Error(error.message);
  revalidatePath("/app/orders/cash");
}
