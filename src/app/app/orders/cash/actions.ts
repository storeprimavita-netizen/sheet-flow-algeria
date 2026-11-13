"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { getUser, requireAdminProfile as adminProfile } from "@/lib/rbac";

const optionalText = z.string().trim().optional().transform((v) => v || null);

const recordSchema = z.object({
  amount_dzd: z.coerce.number().min(0),
  note: optionalText,
});

export async function recordCashCollection(orderId: string, formData: FormData) {
  orderId = z.string().uuid().parse(orderId);
  const { workspaceId } = await adminProfile();
  const input = recordSchema.parse({
    amount_dzd: formData.get("amount_dzd"),
    note: formData.get("note"),
  });

  const supabase = await createClient();
  const user = await getUser();
  const { error } = await supabase.from("cash_collections").insert({
    workspace_id: workspaceId,
    order_id: orderId,
    amount_dzd: input.amount_dzd,
    note: input.note,
    created_by: user?.id ?? null,
  });
  // 23505 = cash_collections_order_uidx: double-click / second tab -> idempotent no-op.
  if (error && error.code !== "23505") throw new Error(error.message);
  revalidatePath("/app/orders/cash");
}

const depositSchema = z.object({ reference: optionalText });

export async function markDeposited(collectionId: string, formData: FormData) {
  collectionId = z.string().uuid().parse(collectionId);
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
