"use client";

import * as React from "react";
import { useLocale } from "next-intl";

import { resolveStatusLabel, type StatusLabelOverrides } from "@/lib/status-label";
import type { StatusKind } from "@/lib/statuses";

const StatusLabelsContext = React.createContext<StatusLabelOverrides | null>(null);

/** Mounted only inside /app (never login, store or tracking): without it every label is the default. */
export function StatusLabelsProvider({ overrides, children }: { overrides: StatusLabelOverrides; children: React.ReactNode }) {
  return <StatusLabelsContext.Provider value={overrides}>{children}</StatusLabelsContext.Provider>;
}

/** `(kind, key, fallback) => displayed label`; plain text, no ICU. */
export function useStatusLabel() {
  const overrides = React.useContext(StatusLabelsContext);
  const locale = useLocale();
  return React.useCallback(
    (kind: StatusKind, key: string, fallback: string) => resolveStatusLabel(overrides, kind, key, locale, fallback),
    [overrides, locale],
  );
}
