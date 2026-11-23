"use server";

import { z } from "zod";
import { getProfile, getUser } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import { customerScoreScope, parseCustomerScore, type CustomerScoreResult } from "./_lib/customer-score";

const input = z.object({ orderId: z.uuid(), scope: z.string().max(128) });

export async function loadCustomerScore(raw: unknown): Promise<CustomerScoreResult> {
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { status: "error" };
  const [profile, user] = await Promise.all([getProfile(), getUser()]);
  if (!user || !profile || !profile.workspaceId ||
      (profile.role !== "admin" && profile.role !== "confirmation_agent") ||
      parsed.data.scope !== customerScoreScope(user.id, profile.workspaceId, profile.role)) {
    return { status: "error" };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("confirmation_customer_score", { p_order_id: parsed.data.orderId });
  return error ? { status: "error" } : parseCustomerScore(data, profile.role === "admin");
}
