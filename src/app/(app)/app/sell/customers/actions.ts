"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { requireAdminProfile } from "@/lib/rbac";
import { SUPPLIER_TYPES } from "@/lib/enums";

const optionalText = z.string().trim().optional().transform((v) => v || null);

// ---------------------------------------------------------------------------
// Suppliers (`contacts` table) — admin only.
// ---------------------------------------------------------------------------
const contactSchema = z.object({
  name: z.string().trim().min(1),
  type: z.enum(SUPPLIER_TYPES),
  phone: optionalText,
  location: optionalText,
  notes: optionalText,
});

export async function saveContact(id: string | null, formData: FormData) {
  const { workspaceId } = await requireAdminProfile();
  const input = contactSchema.parse({
    name: formData.get("name"),
    type: formData.get("type"),
    phone: formData.get("phone"),
    location: formData.get("location"),
    notes: formData.get("notes"),
  });

  const supabase = await createClient();
  const patch = {
    workspace_id: workspaceId,
    name: input.name,
    type: input.type,
    phones: input.phone ? [input.phone] : [],
    location: input.location,
    notes: input.notes,
  };

  if (id) {
    const { error } = await supabase.from("contacts").update(patch).eq("id", id).eq("workspace_id", workspaceId);
    if (error) throw new Error(error.message);
    revalidatePath(`/app/money/suppliers/${id}`);
  } else {
    const { error } = await supabase.from("contacts").insert(patch);
    if (error) throw new Error(error.message);
  }

  revalidatePath("/app/money/suppliers");
  if (!id) redirect("/app/money/suppliers");
}

// ---------------------------------------------------------------------------
// Customers (`customers` table) — auto-created from orders; admin can only
// edit the profile fields (name/wilaya/commune/notes), never create/delete.
// ---------------------------------------------------------------------------
const customerSchema = z.object({
  name: z.string().trim().min(1),
  wilaya_code: z.preprocess((v) => {
    const s = String(v ?? "").trim();
    return s === "" ? null : Number(s);
  }, z.number().int().nullable()),
  commune: optionalText,
  notes: optionalText,
});

export async function saveCustomer(id: string, formData: FormData) {
  const { workspaceId } = await requireAdminProfile();
  const input = customerSchema.parse({
    name: formData.get("name"),
    wilaya_code: formData.get("wilaya_code"),
    commune: formData.get("commune"),
    notes: formData.get("notes"),
  });

  const supabase = await createClient();
  const { error } = await supabase.from("customers").update(input).eq("id", id).eq("workspace_id", workspaceId);
  if (error) throw new Error(error.message);
  revalidatePath(`/app/sell/customers/${id}`);
}
