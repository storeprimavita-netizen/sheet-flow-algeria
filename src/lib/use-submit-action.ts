"use client";

import * as React from "react";

/**
 * Submit handler for a form driven by `useActionState`. React 19 resets a form after its
 * `action` runs even when the action returns an error, and Radix Switch / Select follow that
 * reset, so a refused save would wipe what was typed. Posting through `onSubmit` never resets.
 */
export function useSubmitAction(formAction: (fd: FormData) => void) {
  return React.useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      React.startTransition(() => formAction(fd));
    },
    [formAction],
  );
}
