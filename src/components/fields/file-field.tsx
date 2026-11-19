"use client";

import * as React from "react";

/** Native file picker (keeps platform behaviour and a11y), themed with tokens. */
export function FileField({
  accept,
  onFile,
  disabled,
  id,
  "aria-describedby": describedBy,
}: {
  accept?: string;
  onFile: (file: File | null) => void;
  disabled?: boolean;
  id?: string;
  "aria-describedby"?: string;
}) {
  return (
    <input
      id={id}
      type="file"
      accept={accept}
      disabled={disabled}
      aria-describedby={describedBy}
      onChange={(e) => {
        onFile(e.target.files?.[0] ?? null);
        e.target.value = "";
      }}
      className="block w-full cursor-pointer text-sm text-muted-foreground file:me-3 file:cursor-pointer file:rounded-md file:border file:border-input file:bg-transparent file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground hover:file:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
    />
  );
}
