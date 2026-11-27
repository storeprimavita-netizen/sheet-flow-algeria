/** Debounced search text <-> URL param, with no React and no Next import.
 * The box knows which address changes are its own writes (they never touch the
 * text or the waiting write); every other change of the address wins over
 * unsent typing. */

export type SearchSync = {
  type(text: string): void;
  seen(queryString: string, inherited: string): void;
  mergeInto(params: URLSearchParams): void;
  /** the trimmed text in the box */
  text(): string;
  /** the newest query string this box knows of (last write it sent, else the address) */
  latest(): string;
  cancel(): void;
};

type Options = {
  /** called with the new query string (no leading "?") */
  write: (queryString: string) => void;
  /** called when an outside change replaces the text in the box */
  onText: (text: string) => void;
  param?: string;
  clearedMarker?: string;
  delay?: number;
  initialText?: string;
};

function pairKey(qs: string): string {
  return [...new URLSearchParams(qs).entries()]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join("&");
}

export function createSearchSync({ write, onText, param = "q", clearedMarker, delay = 300, initialText = "" }: Options): SearchSync {
  let text = initialText;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastQs: string | null = null;
  let lastInherited = "";
  let sent: string[] = [];

  const shownIn = (params: URLSearchParams) => {
    const u = params.get(param);
    return u === null ? lastInherited : u === clearedMarker ? "" : u;
  };

  /** puts the box text into params by the rule; false when nothing needed to change */
  function apply(params: URLSearchParams): boolean {
    const trimmed = text.trim();
    if (trimmed === shownIn(params)) return false;
    if (trimmed) params.set(param, trimmed);
    else if (lastInherited && clearedMarker) params.set(param, clearedMarker);
    else params.delete(param);
    return true;
  }

  const fire = () => {
    timer = null;
    const params = new URLSearchParams(sent.at(-1) ?? lastQs ?? "");
    if (!apply(params)) return;
    params.delete("page");
    const qs = params.toString();
    sent.push(qs);
    write(qs);
  };

  const stop = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };

  return {
    type(next) {
      text = next;
      stop();
      timer = setTimeout(fire, delay);
    },
    seen(queryString, inherited) {
      if (lastQs === null) {
        lastQs = queryString;
        lastInherited = inherited;
        return;
      }
      if (queryString === lastQs && inherited === lastInherited) return;
      lastQs = queryString;
      lastInherited = inherited;
      const key = pairKey(queryString);
      const i = sent.findIndex((s) => pairKey(s) === key);
      if (i >= 0) {
        sent = sent.slice(i + 1);
        return;
      }
      stop();
      sent = [];
      text = shownIn(new URLSearchParams(queryString));
      onText(text);
    },
    mergeInto(params) {
      apply(params);
      params.delete("page");
      stop();
      sent.push(params.toString());
    },
    text: () => text.trim(),
    latest: () => sent.at(-1) ?? lastQs ?? "",
    cancel: stop,
  };
}

/** true only for a plain primary click that opens another address of this site in the same tab */
export function leavesAddress(
  link: { href: string; target: string; download: boolean },
  event: { button: number; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean },
  currentHref: string,
): boolean {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  if (link.download || (link.target !== "" && link.target !== "_self")) return false;
  try {
    const to = new URL(link.href, currentHref);
    const from = new URL(currentHref);
    if (to.origin !== from.origin || (to.protocol !== "http:" && to.protocol !== "https:")) return false;
    return to.pathname + to.search !== from.pathname + from.search;
  } catch {
    return false;
  }
}
