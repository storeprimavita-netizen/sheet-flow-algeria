/**
 * Pure parser for the owner's `Algeria_numbered.csv` delivery price file.
 * No I/O. One row per wilaya carries the prices (`rate` / `extra`), the rows
 * after it carry commune names.
 */

export type DeliveryWarningType =
  | "repeated_label"
  | "duplicate_commune"
  | "malformed_row"
  | "unknown_label"
  | "duplicate_wilaya";

export type DeliveryWarning = {
  type: DeliveryWarningType;
  /** Wilaya code, or null when the row has none. */
  code: number | null;
  text: string;
};

export type ParsedWilaya = {
  code: number;
  /** Name as written in the file (the app's own name wins in the UI). */
  fileName: string;
  home: number | null;
  stopdesk: number | null;
  /** false = the file marks the wilaya `extra` (no price, no shipping). */
  priced: boolean;
  /** false = only a home price was found. */
  stopdeskAvailable: boolean;
  communes: string[];
};

export type ParsedDeliveryCsv = {
  wilayas: ParsedWilaya[];
  warnings: DeliveryWarning[];
};

const HOME = "توصيل للمنزل";
const DESK = "توصيل للمكتب";

const norm = (s: string) => s.normalize("NFC").trim();

/** Minimal RFC 4180 tokenizer: quotes, escaped quotes, CRLF, BOM. */
export function tokenizeCsv(input: string): string[][] {
  const text = input.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((c) => c !== "")) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((c) => c !== "")) rows.push(row);
  return rows;
}

export function normalizeCommuneName(s: string): string {
  return s.normalize("NFC").trim().replace(/\s+/g, " ");
}

function labelKind(label: string): "home" | "desk" | null {
  const l = norm(label);
  if (l === HOME) return "home";
  if (l === DESK) return "desk";
  if (l.includes("منزل")) return "home";
  if (l.includes("مكتب")) return "desk";
  return null;
}

export function parseDeliveryCsv(input: string): ParsedDeliveryCsv {
  const rows = tokenizeCsv(input);
  const warnings: DeliveryWarning[] = [];
  const byCode = new Map<number, ParsedWilaya>();
  const seen = new Map<number, Set<string>>();

  for (let n = 1; n < rows.length; n++) {
    const r = rows[n];
    const m = /^\s*(\d{1,2})\s*-\s*(.+?)\s*$/.exec(r[1] ?? "");
    const code = m ? Number(m[1]) : NaN;
    if (!m || code < 1 || code > 58 || r.length < 5) {
      warnings.push({
        type: "malformed_row",
        code: null,
        text: `line ${n + 1}`,
      });
      continue;
    }
    const kind = (r[4] ?? "").trim().toLowerCase();
    if (kind === "rate" || kind === "extra") {
      if (byCode.has(code)) {
        warnings.push({ type: "duplicate_wilaya", code, text: m[2] });
        continue;
      }
      const w: ParsedWilaya = {
        code,
        fileName: norm(m[2]),
        home: null,
        stopdesk: null,
        priced: kind === "rate",
        stopdeskAvailable: false,
        communes: [],
      };
      if (kind === "rate") {
        for (const part of (r[6] ?? "").split("|")) {
          const i = part.lastIndexOf(":");
          if (i < 0) continue;
          const label = part.slice(0, i);
          const fee = Number(part.slice(i + 1).trim());
          if (!Number.isFinite(fee) || fee < 0 || part.slice(i + 1).trim() === "") {
            warnings.push({ type: "malformed_row", code, text: part });
            continue;
          }
          let k = labelKind(label);
          if (!k) {
            warnings.push({ type: "unknown_label", code, text: norm(label) });
            continue;
          }
          if (k === "home" && w.home !== null) {
            // Same label twice (Béchar 1350|720): second one is stop-desk.
            k = "desk";
            warnings.push({ type: "repeated_label", code, text: norm(label) });
          }
          if (k === "home") w.home = fee;
          else w.stopdesk = fee;
        }
        if (w.home === null && w.stopdesk === null) w.priced = false;
        w.stopdeskAvailable = w.priced && w.stopdesk !== null;
        if (w.priced && w.home === null) {
          // Office-only wilaya: no home price, so it cannot ship.
          w.priced = false;
          w.stopdeskAvailable = false;
          warnings.push({ type: "unknown_label", code, text: "no home price" });
        }
      }
      byCode.set(code, w);
      seen.set(code, new Set());
      continue;
    }
    // Commune row.
    const target = byCode.get(code) ?? null;
    const name = normalizeCommuneName(r[2] ?? "");
    if (!target || !name) {
      if (name) warnings.push({ type: "malformed_row", code, text: name });
      continue;
    }
    const key = name.toLocaleLowerCase("en");
    const set = seen.get(code)!;
    if (set.has(key)) {
      warnings.push({ type: "duplicate_commune", code, text: name });
      continue;
    }
    set.add(key);
    target.communes.push(name);
  }
  return { wilayas: [...byCode.values()].sort((a, b) => a.code - b.code), warnings };
}

// ---------------------------------------------------------------------------
// Diff against the stored fees (pure; the server action feeds it rows)
// ---------------------------------------------------------------------------
export type StoredWilayaFee = {
  wilaya_code: number;
  home_fee: number;
  stopdesk_fee: number;
  priced: boolean;
  stopdesk_available: boolean;
  stop_shipping: boolean;
  /** Stored commune count. */
  communes: number;
};

export type DeliveryDiffRow = {
  code: number;
  fileName: string;
  changed: boolean;
  before: Pick<StoredWilayaFee, "home_fee" | "stopdesk_fee" | "priced" | "stopdesk_available"> | null;
  after: { home_fee: number | null; stopdesk_fee: number | null; priced: boolean; stopdesk_available: boolean };
  communesBefore: number;
  communesAfter: number;
  warnings: DeliveryWarning[];
};

export type DeliveryDiff = {
  rows: DeliveryDiffRow[];
  /** Stored wilayas the file does not list; they keep their manual fees. */
  absent: number[];
  /** Warnings not tied to a wilaya row (malformed lines etc.). */
  fileWarnings: DeliveryWarning[];
  /** Unpriced in the file while the manual stop_shipping flag is still off. */
  unpricedNotStopped: number[];
};

export function diffDeliveryPrices(parsed: ParsedDeliveryCsv, stored: StoredWilayaFee[]): DeliveryDiff {
  const byCode = new Map(stored.map((s) => [s.wilaya_code, s]));
  const unpricedNotStopped: number[] = [];
  const rows = parsed.wilayas.map((w): DeliveryDiffRow => {
    const cur = byCode.get(w.code) ?? null;
    // An unpriced wilaya keeps its stored fees; home-only keeps the stop-desk fee.
    const home = w.priced ? w.home : (cur?.home_fee ?? null);
    const desk = w.priced && w.stopdeskAvailable ? w.stopdesk : (cur?.stopdesk_fee ?? null);
    const changed =
      !cur ||
      cur.priced !== w.priced ||
      cur.stopdesk_available !== w.stopdeskAvailable ||
      (w.priced && cur.home_fee !== w.home) ||
      (w.priced && w.stopdeskAvailable && cur.stopdesk_fee !== w.stopdesk) ||
      cur.communes !== w.communes.length;
    if (!w.priced && cur && !cur.stop_shipping) unpricedNotStopped.push(w.code);
    return {
      code: w.code,
      fileName: w.fileName,
      changed,
      before: cur && {
        home_fee: cur.home_fee,
        stopdesk_fee: cur.stopdesk_fee,
        priced: cur.priced,
        stopdesk_available: cur.stopdesk_available,
      },
      after: { home_fee: home, stopdesk_fee: desk, priced: w.priced, stopdesk_available: w.stopdeskAvailable },
      communesBefore: cur?.communes ?? 0,
      communesAfter: w.communes.length,
      warnings: parsed.warnings.filter((x) => x.code === w.code),
    };
  });
  const listed = new Set(parsed.wilayas.map((w) => w.code));
  return {
    rows,
    absent: stored.map((s) => s.wilaya_code).filter((c) => !listed.has(c)),
    fileWarnings: parsed.warnings.filter((x) => x.code === null || !listed.has(x.code)),
    unpricedNotStopped,
  };
}

/** Shape the `apply_delivery_prices` RPC expects. */
export function toApplyPayload(parsed: ParsedDeliveryCsv) {
  return {
    wilayas: parsed.wilayas.map((w) => ({
      code: w.code,
      priced: w.priced,
      stopdesk_available: w.stopdeskAvailable,
      home_fee: w.home,
      stopdesk_fee: w.stopdesk,
      communes: w.communes,
    })),
  };
}
