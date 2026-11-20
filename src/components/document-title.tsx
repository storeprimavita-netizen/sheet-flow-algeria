"use client";

import { useEffect } from "react";

/**
 * Next 16 ignores a not-found segment's metadata and re-applies the layout title after hydration,
 * so set the title and keep it while this component is mounted on the same page.
 */
export function DocumentTitle({ title }: { title: string }) {
  useEffect(() => {
    let mounted = true;
    const path = location.pathname;
    const apply = () => {
      // a queued mutation callback can run after unmount or after navigating away: never touch the next page's title
      if (!mounted || location.pathname !== path) return;
      if (document.title !== title) document.title = title;
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.head, { subtree: true, childList: true, characterData: true });
    return () => {
      mounted = false;
      observer.disconnect();
    };
  }, [title]);
  return null;
}
