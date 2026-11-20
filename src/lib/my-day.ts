import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";
import { ACTIONABLE_CONFIRMATION, ACTIONABLE_DELIVERY } from "@/lib/statuses";

/** Agent "My day" (D86): read-only counts and rows, session client only. No money, no cost, no rates. */
export type MyDay =
  | { kind: "confirmation"; queue: number; numbers: { confirmed: number; cancelled: number; callAgain: number; handled: number } }
  | { kind: "delivery"; queue: number; numbers: { delivered: number; returned: number } };

export type MyDayData = MyDay & {
  tasks: { id: string; title: string; dueDate: string | null; status: string }[];
  nextMeeting: { id: string; title: string; scheduledAt: string } | null;
};

const ALGIERS_OFFSET_MS = 3_600_000; // Africa/Algiers is UTC+1 all year (no DST)

/** Start of "today" in Africa/Algiers, as an ISO instant. */
export function algiersDayStart(now: Date = new Date()): string {
  const local = new Date(now.getTime() + ALGIERS_OFFSET_MS);
  local.setUTCHours(0, 0, 0, 0);
  return new Date(local.getTime() - ALGIERS_OFFSET_MS).toISOString();
}

export type HistoryRow = { order_id: string; to_status: string; created_at: string };

/** Each order counts once, under my last change today: confirmed / cancelled / to call again (anything else). */
export function countMyChanges(rows: HistoryRow[]) {
  const last = new Map<string, HistoryRow>();
  for (const r of rows) {
    const prev = last.get(r.order_id);
    if (!prev || r.created_at >= prev.created_at) last.set(r.order_id, r);
  }
  let confirmed = 0;
  let cancelled = 0;
  let callAgain = 0;
  for (const { to_status } of last.values()) {
    if (to_status === "confirmed") confirmed++;
    else if (to_status === "cancelled") cancelled++;
    else callAgain++;
  }
  return { confirmed, cancelled, callAgain, handled: confirmed + cancelled + callAgain };
}

export async function getMyDay(
  supabase: SupabaseClient<Database>,
  userId: string,
  role: "confirmation_agent" | "delivery_agent",
): Promise<MyDayData> {
  const since = algiersDayStart();
  const orders = () => supabase.from("orders").select("*", { count: "exact", head: true });

  const [tasks, meeting, mine] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, title, due_date, status")
      .eq("owner", userId)
      .neq("status", "done")
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(5),
    supabase
      .from("meetings")
      .select("id, title, scheduled_at")
      .eq("status", "planned")
      .gte("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    role === "confirmation_agent"
      ? Promise.all([
          orders().in("confirmation_status", ACTIONABLE_CONFIRMATION),
          supabase
            .from("order_status_history")
            .select("order_id, to_status, created_at")
            .eq("actor", userId)
            .eq("stage", "confirmation")
            .gte("created_at", since)
            .limit(5000),
        ])
      : Promise.all([
          orders().eq("confirmation_status", "confirmed").in("delivery_status", ACTIONABLE_DELIVERY),
          orders().eq("assigned_delivery_agent", userId).eq("delivery_status", "delivered").gte("updated_at", since),
          orders().eq("assigned_delivery_agent", userId).eq("delivery_status", "returned").gte("updated_at", since),
        ]),
  ]);

  // A failed read must show the section error state (reason + retry), not a calm page of zeros.
  const failed = [tasks.error, meeting.error, ...(mine as { error: unknown }[]).map((r) => r.error)].find(Boolean);
  if (failed) throw new Error("my-day: query failed");

  const extras = {
    tasks: (tasks.data ?? []).map((r) => ({ id: r.id, title: r.title, dueDate: r.due_date, status: r.status })),
    nextMeeting: meeting.data ? { id: meeting.data.id, title: meeting.data.title, scheduledAt: meeting.data.scheduled_at } : null,
  };
  if (role === "confirmation_agent") {
    const [queue, history] = mine as [{ count: number | null }, { data: HistoryRow[] | null }];
    return { kind: "confirmation", queue: queue.count ?? 0, numbers: countMyChanges(history.data ?? []), ...extras };
  }
  const [queue, delivered, returned] = mine as { count: number | null }[];
  return {
    kind: "delivery",
    queue: queue.count ?? 0,
    numbers: { delivered: delivered.count ?? 0, returned: returned.count ?? 0 },
    ...extras,
  };
}
