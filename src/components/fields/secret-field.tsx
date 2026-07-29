"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";

import { Input } from "@/components/ui/input";

/**
 * Password input with a reveal toggle for the value being typed this session
 * — never pre-filled from a stored secret (those are never sent to the
 * client at all, see `settings/page.tsx`).
 */
export function SecretField({
  name,
  id,
  placeholder,
  showLabel,
  hideLabel,
}: {
  name: string;
  id?: string;
  placeholder?: string;
  showLabel?: string;
  hideLabel?: string;
}) {
  const [show, setShow] = React.useState(false);

  return (
    <div className="relative">
      <Input id={id} name={name} type={show ? "text" : "password"} placeholder={placeholder} className="pe-9" />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? (hideLabel ?? "Hide") : (showLabel ?? "Show")}
        className="absolute end-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}
