import * as React from "react";

import { cn } from "@/lib/utils";
import type { StatusToken } from "@/lib/statuses";

/** Static token→class map so Tailwind sees the literal class names. */
export const TOKEN_CLASS: Record<StatusToken, string> = {
  neutral: "text-neutral bg-neutral-bg",
  success: "text-success bg-success-bg",
  warning: "text-warning bg-warning-bg",
  danger: "text-danger bg-danger-bg",
  info: "text-info bg-info-bg",
  indigo: "text-indigo bg-indigo-bg",
  cyan: "text-cyan bg-cyan-bg",
  violet: "text-violet bg-violet-bg",
  orange: "text-orange bg-orange-bg",
  rose: "text-rose bg-rose-bg",
};

/** Static token→solid-fill class map (dots, bars, map cells — full-strength color, not the soft tint). */
export const TOKEN_DOT_CLASS: Record<StatusToken, string> = {
  neutral: "bg-neutral",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
  indigo: "bg-indigo",
  cyan: "bg-cyan",
  violet: "bg-violet",
  orange: "bg-orange",
  rose: "bg-rose",
};

/** Small vivid swatch for select options/legends that don't warrant a full Chip pill. */
export function ColorDot({ token, className }: { token: StatusToken; className?: string }) {
  return <span className={cn("inline-block h-2.5 w-2.5 shrink-0 rounded-full", TOKEN_DOT_CLASS[token], className)} aria-hidden />;
}

/**
 * Shared base for status pills and user-created option chips: tinted bg +
 * strong fg from one token palette. Optional leading dot / icon.
 */
export function Chip({
  token = "neutral",
  size = "md",
  dot = false,
  icon,
  className,
  children,
}: {
  token?: StatusToken;
  size?: "sm" | "md";
  dot?: boolean;
  icon?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium",
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm",
        TOKEN_CLASS[token],
        className,
      )}
    >
      {dot ? <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden /> : null}
      {icon}
      {children}
    </span>
  );
}
