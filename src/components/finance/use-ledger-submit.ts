"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import type { UpdateResult } from "@/app/(app)/app/catalog/products/actions";

/**
 * Submit for money writes. The request key stays the same while the input is
 * unchanged (a retry writes no second row) and is new after success or an edit;
 * the in-flight ref swallows a double click before React re-renders.
 */
export function useLedgerSubmit() {
  const t = useTranslations();
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const inFlight = React.useRef(false);
  const request = React.useRef<{ signature: string; key: string } | null>(null);

  async function submit(
    input: unknown,
    action: (requestKey: string) => Promise<UpdateResult>,
    onSuccess?: () => void,
    successMessage = t("common.updated"),
  ) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    const signature = JSON.stringify(input);
    if (request.current?.signature !== signature) request.current = { signature, key: crypto.randomUUID() };
    try {
      const res = await action(request.current.key);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      request.current = null;
      toast.success(successMessage);
      onSuccess?.();
      router.refresh();
    } catch {
      toast.error(t("common.error"));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return { busy, submit };
}
