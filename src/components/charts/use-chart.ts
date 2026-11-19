"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";

import type { Pt } from "./types";

export const useIsRtl = () => useLocale() === "ar";

/** Width of the container in px (SSR default 640); the plot is drawn at real size so text never scales. */
export function useChartWidth(ref: React.RefObject<HTMLElement | null>, initial = 640) {
  const [w, setW] = useState(initial);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setW(Math.max(240, Math.round(el.clientWidth)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

type Pos = { s: number; i: number };
type Shown = Pos & { x: number; y: number; width: number };

/**
 * Roving-tabindex navigation over a series x index grid of points (null = no point).
 * Left/Right move along the axis (flipped in RTL), Up/Down switch series, Home/End jump,
 * Escape closes the tooltip, Enter follows the point's link natively. Hover or focus shows
 * the tooltip; a touch tap pins it until an outside tap or Escape.
 */
export function useChartNav(grid: (Pt | null)[][], rtl: boolean, axis: "x" | "y" = "x") {
  const boxRef = useRef<HTMLDivElement>(null);
  const [cur, setCur] = useState<Pos | null>(null);
  const [shown, setShown] = useState<Shown | null>(null);
  const [pinned, setPinned] = useState(false);
  const lastPointer = useRef<string>("mouse");

  const first = (): Pos | null => {
    for (let s = 0; s < grid.length; s++) for (let i = 0; i < grid[s].length; i++) if (grid[s][i]) return { s, i };
    return null;
  };
  const roving = cur && grid[cur.s]?.[cur.i] ? cur : first();

  const show = useCallback((s: number, i: number, el: Element) => {
    const box = boxRef.current;
    if (!box) return;
    const b = box.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    setShown({ s, i, x: r.left - b.left + r.width / 2, y: r.top - b.top, width: b.width });
  }, []);

  const dismiss = useCallback(() => {
    setPinned(false);
    setShown(null);
  }, []);

  useEffect(() => {
    if (!pinned) return;
    const onDown = (e: PointerEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) dismiss();
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [pinned, dismiss]);

  const focusPt = (s: number, i: number) => {
    const el = boxRef.current?.querySelector<HTMLElement>(`[data-pt="${s}-${i}"]`);
    el?.focus();
  };

  const step = (from: Pos, ds: number, di: number): Pos => {
    let { s, i } = from;
    const n = grid.length;
    // walk until a real point is found; stay put at the edge
    for (let guard = 0; guard < 4096; guard++) {
      s += ds;
      i += di;
      if (s < 0 || s >= n || i < 0 || i >= (grid[s]?.length ?? 0)) return from;
      if (grid[s][i]) return { s, i };
    }
    return from;
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const at = roving;
    if (!at) return;
    if (e.key === "Escape") {
      dismiss();
      return;
    }
    const flip = rtl ? -1 : 1;
    let next: Pos | null = null;
    if (axis === "x") {
      if (e.key === "ArrowRight") next = step(at, 0, flip);
      else if (e.key === "ArrowLeft") next = step(at, 0, -flip);
      else if (e.key === "ArrowUp") next = step(at, -1, 0);
      else if (e.key === "ArrowDown") next = step(at, 1, 0);
    } else if (e.key === "ArrowDown") next = step(at, 0, 1);
    else if (e.key === "ArrowUp") next = step(at, 0, -1);
    if (e.key === "Home" || e.key === "End") {
      const row = grid[at.s] ?? [];
      const idx = row.map((p, i) => (p ? i : -1)).filter((i) => i >= 0);
      if (idx.length) next = { s: at.s, i: e.key === "Home" ? idx[0] : idx[idx.length - 1] };
    }
    if (next) {
      e.preventDefault();
      focusPt(next.s, next.i);
    }
  };

  /** Props for the focusable element (an `<a>`) of point (s, i). */
  const bind = (s: number, i: number) => ({
    tabIndex: roving && roving.s === s && roving.i === i ? 0 : -1,
    "data-pt": `${s}-${i}`,
    onFocus: (e: React.FocusEvent) => {
      setCur({ s, i });
      show(s, i, e.currentTarget);
    },
    onBlur: () => {
      if (!pinned) setShown(null);
    },
    onPointerDown: (e: React.PointerEvent) => {
      lastPointer.current = e.pointerType;
    },
    onPointerEnter: (e: React.PointerEvent) => {
      if (e.pointerType === "mouse" && !pinned) show(s, i, e.currentTarget);
    },
    onPointerLeave: (e: React.PointerEvent) => {
      if (e.pointerType === "mouse" && !pinned) setShown(null);
    },
    onClick: (e: React.MouseEvent) => {
      // a touch tap pins the tooltip (its link drills); keyboard Enter (detail 0) and mouse follow the link
      if (lastPointer.current === "touch" && e.detail !== 0) {
        e.preventDefault();
        setCur({ s, i });
        show(s, i, e.currentTarget);
        setPinned(true);
      }
    },
  });

  const point = shown ? grid[shown.s]?.[shown.i] ?? null : null;
  return { boxRef, bind, onKeyDown, show, shown, point, pinned, dismiss };
}
