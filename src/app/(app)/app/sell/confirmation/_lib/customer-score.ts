import { z } from "zod";

export const scoreStates = ["new", "unscored", "neutral", "warning", "high"] as const;
export const scoreReasons = ["no_history", "unscored", "no_adverse_signal", "returned", "cancelled", "no_answer"] as const;

export const scoreSummary = z.object({
  score: z.number().min(0).max(100).nullable(),
  state: z.enum(scoreStates),
  reason: z.enum(scoreReasons),
  total: z.number().int().nonnegative(),
  returned: z.number(),
  cancelled: z.number(),
  noAnswer: z.number(),
});
export type ScoreSummary = z.infer<typeof scoreSummary>;

const orderStatuses = {
  confirmation: z.string(),
  delivery: z.string(),
};
const customer = scoreSummary.extend({
  id: z.uuid(),
  delivered: z.number(),
  lastAt: z.string().nullable(),
  confirmation: orderStatuses.confirmation.nullable(),
  delivery: orderStatuses.delivery.nullable(),
  productOrders: z.number().nullable(),
  deliveryRate: z.number().min(0).max(1).nullable(),
  lifetime: z.number().nullable().optional(),
});
const snapshot = z.object({
  scope: z.enum(["workspace", "visible"]),
  customer: customer.nullable(),
  related: z.array(z.object({
    id: z.uuid(), seq: z.number().int(), at: z.string().nullable(), ...orderStatuses,
  })).max(5),
  hasMore: z.boolean(),
});

export type CustomerScore = z.infer<typeof snapshot>;
export type CustomerScoreResult =
  | { status: "ready"; data: CustomerScore }
  | { status: "empty" | "error" };

export function customerScoreScope(userId: string, workspaceId: string, role: string) {
  return `${userId}:${workspaceId}:${role}`;
}

export function parseCustomerScore(data: unknown, admin: boolean): CustomerScoreResult {
  if (data === null) return { status: "empty" };
  const result = snapshot.safeParse(data);
  if (!result.success || result.data.scope !== (admin ? "workspace" : "visible")) return { status: "error" };
  if (!admin && result.data.customer) delete result.data.customer.lifetime;
  return { status: "ready", data: result.data };
}
