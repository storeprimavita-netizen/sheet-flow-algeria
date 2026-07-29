"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/** Textarea that grows with its content. Forwards its ref (e.g. to read `.value` imperatively for a bulk-paste apply button). */
export const AutoTextarea = React.forwardRef<
  HTMLTextAreaElement,
  {
    name?: string;
    defaultValue?: string;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
    id?: string;
    minRows?: number;
  }
>(function AutoTextarea({ name, defaultValue, placeholder, disabled, className, id, minRows = 2 }, forwardedRef) {
  const innerRef = React.useRef<HTMLTextAreaElement>(null);
  React.useImperativeHandle(forwardedRef, () => innerRef.current as HTMLTextAreaElement);

  function resize(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }

  React.useEffect(() => {
    if (innerRef.current) resize(innerRef.current);
  }, []);

  return (
    <textarea
      ref={innerRef}
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
});
