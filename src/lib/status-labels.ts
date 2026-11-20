import "server-only";
import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { STATUS_KINDS, type StatusKind } from "@/lib/statuses";
import type { StatusLabelOverrides } from "@/lib/status-label";

/**
 * This workspace's display-label overrides for system statuses (RLS: any role
 * reads). Per-request `cache()` only: the data is per workspace, so it must
 * never go through a cross-request cache. Any failure means "no overrides".
 */
export const getStatusLabelOverrides = cache(async (): Promise<StatusLabelOverrides> => {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("status_label_overrides").select("kind, status_key, label_en, label_ar");
    if (error || !data) return {};
    const out = new Map<StatusKind, Map<string, { en: string | null; ar: string | null }>>();
    for (const r of data) {
      if (!Object.hasOwn(STATUS_KINDS, r.kind)) continue;
      const kind = r.kind as StatusKind;
      if (!Object.hasOwn(STATUS_KINDS[kind], r.status_key)) continue; // stale key of a removed status
      const m = out.get(kind) ?? new Map();
      m.set(r.status_key, { en: r.label_en, ar: r.label_ar });
      out.set(kind, m);
    }
    const plain: StatusLabelOverrides = {};
    for (const [k, m] of out) plain[k] = Object.fromEntries(m);
    return plain;
  } catch {
    return {};
  }
});
