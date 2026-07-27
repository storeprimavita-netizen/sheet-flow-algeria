"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/** Textarea that grows with its content. */
export function AutoTextarea({
  name,
  defaultValue,
  placeholder,
  disabled,
  className,
  id,
  minRows = 2,
}: {
  name?: string;
  defaultValue?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  minRows?: number;
}) {
  const ref = React.useRef<HTMLTextAreaElement>(null);

  function resize(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }

  React.useEffect(() => {
    if (ref.current) resize(ref.current);
  }, []);

  return (
    <textarea
      ref={ref}
      id={id}
      name={name}
      rows={minRows}
      defaultValue={defaultValue}
      placeholder={placeholder}
      disabled={disabled}
      onInput={(e) => resize(e.currentTarget)}
      className={cn(
        "flex w-full resize-none overflow-hidden rounded-md border border-input bg-transparent px-3 py-2 text-sm leading-relaxed shadow-sm transition-colors placeholder:text-faint focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
    />
  );
}
