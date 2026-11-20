/** Debounced search text <-> URL param, with no React and no Next import.
 * The box knows which address changes are its own writes (they never touch the
 * text or the waiting write); every other change of the address wins over
 * unsent typing. */

export type SearchSync = {
  type(text: string): void;
  seen(queryString: string, inherited: string): void;
  mergeInto(params: URLSearchParams): void;
  /** the user activated something else on the page: give its address change time to arrive before the waiting write fires */
  hold(): void;
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
  holdDelay?: number;
  initialText?: string;
};

function pairKey(qs: string): string {
  return [...new URLSearchParams(qs).entries()]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join("&");
}

export function createSearchSync({ write, onText, param = "q", clearedMarker, delay = 300, holdDelay = 5000, initialText = "" }: Options): SearchSync {
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
    const params = new URLSearchParams(lastQs ?? "");
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
    hold() {
      if (!timer) return;
      stop();
      timer = setTimeout(fire, holdDelay);
    },
    cancel: stop,
  };
}
