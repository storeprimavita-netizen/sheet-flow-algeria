import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { diffDeliveryPrices, parseDeliveryCsv, toApplyPayload, type StoredWilayaFee } from "./delivery-prices";

const H = "Country_code,Region,City,Area,Rate_or_extra,Cost,Custom_rates\r\n";
const HOME = "توصيل للمنزل";
const DESK = "توصيل للمكتب";

describe("parseDeliveryCsv", () => {
  it("parses labels, BOM and CRLF", () => {
    const r = parseDeliveryCsv(
      `﻿${H}DZ,1-Adrar,,,rate,,${HOME}:1400|${DESK}:970\r\nDZ,1-Adrar,Adrar,,,,\r\n`,
    );
    expect(r.wilayas).toEqual([
      { code: 1, fileName: "Adrar", home: 1400, stopdesk: 970, priced: true, stopdeskAvailable: true, communes: ["Adrar"] },
    ]);
  });
  it("handles office-first order", () => {
    const r = parseDeliveryCsv(`${H}DZ,1-Adrar,,,rate,,${DESK}:970|${HOME}:1400\n`);
    expect(r.wilayas[0]).toMatchObject({ home: 1400, stopdesk: 970 });
  });
  it("marks home-only", () => {
    const r = parseDeliveryCsv(`${H}DZ,2-Chlef,,,rate,,${HOME}:700\n`);
    expect(r.wilayas[0]).toMatchObject({ home: 700, stopdesk: null, priced: true, stopdeskAvailable: false });
  });
  it("marks extra as unpriced", () => {
    const r = parseDeliveryCsv(`${H}DZ,33-Illizi,,,extra,,\n`);
    expect(r.wilayas[0]).toMatchObject({ priced: false, stopdeskAvailable: false, home: null });
  });
  it("repeated home label becomes stop-desk with a warning (Béchar)", () => {
    const r = parseDeliveryCsv(`${H}DZ,8-Béchar,,,rate,,${HOME}:1350|${HOME}:720\n`);
    expect(r.wilayas[0]).toMatchObject({ home: 1350, stopdesk: 720 });
    expect(r.warnings.map((w) => w.type)).toEqual(["repeated_label"]);
  });
  it("quoted comma and duplicate communes", () => {
    const r = parseDeliveryCsv(
      `${H}DZ,1-Adrar,,,rate,,${HOME}:1\nDZ,1-Adrar,"Ain, X",,,,\nDZ,1-Adrar," ain,  x ",,,,\nDZ,1-Adrar,"Ain,  X",,,,\n`,
    );
    expect(r.wilayas[0].communes).toEqual(["Ain, X"]);
    expect(r.warnings.some((w) => w.type === "duplicate_commune")).toBe(true);
  });
  it("warns on a malformed row without throwing", () => {
    const r = parseDeliveryCsv(`${H}garbage\nDZ,99-X,,,rate,,\n`);
    expect(r.wilayas).toEqual([]);
    expect(r.warnings).toHaveLength(2);
  });
  const real = "prices/Algeria_numbered.csv";
  it.skipIf(!(() => { try { readFileSync(real); return true; } catch { return false; } })())(
    "local file: 58 wilayas, 4 unpriced",
    () => {
      const r = parseDeliveryCsv(readFileSync(real, "utf8"));
      expect(r.wilayas).toHaveLength(58);
      expect(r.wilayas.filter((w) => !w.priced)).toHaveLength(4);
    },
  );
});

describe("diffDeliveryPrices", () => {
  const stored = (o: Partial<StoredWilayaFee> = {}): StoredWilayaFee => ({
    wilaya_code: 1, home_fee: 1400, stopdesk_fee: 970, priced: true, stopdesk_available: true, stop_shipping: false, communes: 1, ...o,
  });
  const parsed = parseDeliveryCsv(`${H}DZ,1-Adrar,,,rate,,${HOME}:1400|${DESK}:970\nDZ,1-Adrar,Adrar,,,,\nDZ,33-Illizi,,,extra,,\n`);
  it("unchanged when equal; lists absent wilayas", () => {
    const d = diffDeliveryPrices(parsed, [stored(), stored({ wilaya_code: 33, priced: false, stopdesk_available: false, communes: 0 }), stored({ wilaya_code: 5 })]);
    expect(d.rows.map((r) => r.changed)).toEqual([false, false]);
    expect(d.absent).toEqual([5]);
  });
  it("detects a changed fee and flags unpriced wilaya with stop_shipping off", () => {
    const d = diffDeliveryPrices(parsed, [stored({ home_fee: 1 }), stored({ wilaya_code: 33 })]);
    expect(d.rows[0].changed).toBe(true);
    expect(d.unpricedNotStopped).toEqual([33]);
  });
  it("payload mirrors the parse", () => {
    expect(toApplyPayload(parsed).wilayas[1]).toMatchObject({ code: 33, priced: false, home_fee: null });
  });
});
