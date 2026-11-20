"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";

import { createClient } from "@/lib/supabase/client";

// ponytail: poll every 20s rather than a Supabase realtime subscription — no
// publication/channel wiring, and it never re-sorts the queue under the cursor
// (the point of the pill). Swap to postgres_changes if sub-20s latency matters.
const POLL_MS = 20_000;

/** "N new orders" pill — appears when webhook orders land after page load. */
export function NewOrdersPill() {
  const t = useTranslations();
  const router = useRouter();
  const since = React.useRef(new Date().toISOString());
  const [count, setCount] = React.useState(0);

  React.useEffect(() => {
    const supabase = createClient();
    let active = true;
    async function check() {
      const { count: c } = await supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .neq("confirmation_status", "confirmed")
        .gt("created_at", since.current);
      if (active && c != null) setCount(c);
    }
    const id = setInterval(check, POLL_MS);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  if (count === 0) return null;

  return (
    <button
      type="button"
      onClick={() => {
        since.current = new Date().toISOString();
        setCount(0);
        router.refresh();
      }}
      className="flex w-full items-center justify-center gap-2 rounded-lg bg-info-bg py-2 text-sm font-medium text-info transition-colors hover:brightness-105"
    >
      <Sparkles className="h-4 w-4" />
      {t("orders.newOrders", { count })}
    </button>
  );
}
