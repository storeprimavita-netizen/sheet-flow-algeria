"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Re-runs this page's server queries in place (router.refresh), instead of a same-URL link. */
export function RetryButton({ label }: { label: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button type="button" variant="ghost" size="sm" className="max-sm:min-h-11" disabled={pending} onClick={() => start(() => router.refresh())}>
      <RefreshCw className={pending ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
      {label}
    </Button>
  );
}
