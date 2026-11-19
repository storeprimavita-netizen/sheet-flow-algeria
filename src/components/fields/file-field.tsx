"use client";

import * as React from "react";

/**
 * File picker: the native input stays (platform behaviour, a11y, keyboard) but is visually hidden;
 * a translated button and the chosen file name are shown instead of the browser's English text.
 */
export function FileField({
  accept,
  onFile,
  disabled,
  id,
  buttonLabel,
  emptyLabel,
  fileName,
  "aria-describedby": describedBy,
}: {
  accept?: string;
  onFile: (file: File | null) => void;
  disabled?: boolean;
  id?: string;
  buttonLabel: string;
  emptyLabel: string;
  /** name of the file already chosen, if any */
  fileName?: string | null;
  "aria-describedby"?: string;
}) {
  const auto = React.useId();
  const inputId = id ?? auto;
  return (
    <div className="flex min-w-0 items-center gap-3 text-sm">
      <input
        id={inputId}
        type="file"
        accept={accept}
        disabled={disabled}
        aria-describedby={describedBy}
        onChange={(e) => {
          onFile(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
        className="peer sr-only"
      />
      <label
        htmlFor={inputId}
        className="cursor-pointer rounded-md border border-input px-3 py-1.5 font-medium text-foreground hover:bg-accent peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-disabled:cursor-not-allowed peer-disabled:opacity-50"
      >
        {buttonLabel}
      </label>
      <bdi className="min-w-0 truncate text-muted-foreground">{fileName || emptyLabel}</bdi>
    </div>
  );
}
