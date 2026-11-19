"use client";

import { useEffect } from "react";

/**
 * Next 16 ignores a not-found segment's metadata and re-applies the layout title after hydration,
 * so set the title and keep it while this component is mounted.
 */
export function DocumentTitle({ title }: { title: string }) {
  useEffect(() => {
    const apply = () => {
      if (document.title !== title) document.title = title;
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.head, { subtree: true, childList: true, characterData: true });
    return () => observer.disconnect();
  }, [title]);
  return null;
}
