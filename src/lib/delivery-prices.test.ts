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
  describe("hostile fee parts (P1-7-F)", () => {
    const one = (custom: string) => parseDeliveryCsv(`${H}DZ,8-Béchar,,,rate,,${custom}\n`);
    it.each(["abc", "-5", ""])("home:%s|home:720 leaves home null, second stays stop-desk", (bad) => {
      const r = one(`${HOME}:${bad}|${HOME}:720`);
      expect(r.wilayas[0]).toMatchObject({ home: null, stopdesk: 720, priced: false });
      expect(r.warnings.map((w) => w.type)).toContain("repeated_label");
    });
    it("home:720|home:0 keeps home, warns zero", () => {
      const r = one(`${HOME}:720|${HOME}:0`);
      expect(r.wilayas[0]).toMatchObject({ home: 720, stopdesk: null, priced: true });
      expect(r.warnings.map((w) => w.type)).toEqual(["repeated_label", "zero_price"]);
    });
    it("home:0|home:0 stays unpriced", () => {
      const r = one(`${HOME}:0|${HOME}:0`);
      expect(r.wilayas[0]).toMatchObject({ home: null, stopdesk: null, priced: false });
    });
    it("colon-less part warns", () => {
      const r = one(`${HOME} 1350|${HOME}:720`);
      expect(r.warnings[0].type).toBe("malformed_row");
      expect(r.wilayas[0]).toMatchObject({ home: null, stopdesk: 720, priced: false });
    });
    it.each(["0x10", "1e3"])("rejects %s", (bad) => {
      const r = one(`${HOME}:${bad}|${DESK}:500`);
      expect(r.wilayas[0].home).toBeNull();
      expect(r.warnings.map((w) => w.type)).toContain("malformed_row");
    });
    it("1350|720|500 keeps first stop-desk price and warns", () => {
      const r = one(`${HOME}:1350|${HOME}:720|${HOME}:500`);
      expect(r.wilayas[0]).toMatchObject({ home: 1350, stopdesk: 720 });
      expect(r.warnings.map((w) => w.type)).toEqual(["repeated_label", "repeated_label"]);
    });
  });
  it("first of two home labels at 0 never turns the second into the home price (Béchar)", () => {
    const r = parseDeliveryCsv(`${H}DZ,8-Béchar,,,rate,,${HOME}:0|${HOME}:720\n`);
    expect(r.wilayas[0]).toMatchObject({ home: null, stopdesk: 720, priced: false, stopdeskAvailable: false });
    expect(r.warnings.map((w) => w.type)).toEqual(["zero_price", "repeated_label", "unknown_label"]);
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
  it("fixture: 4 unpriced and 2 home-only wilayas parse together with the priced ones", () => {
    const rows = [
      `DZ,1-Adrar,,,rate,,${HOME}:1400|${DESK}:970`,
      `DZ,2-Chlef,,,rate,,${HOME}:700`,
      `DZ,3-Laghouat,,,rate,,${HOME}:800`,
      `DZ,33-Illizi,,,extra,,`,
      `DZ,37-Tindouf,,,extra,,`,
      `DZ,50-Bordj,,,extra,,`,
      `DZ,52-Beni Abbes,,,extra,,`,
    ].join("\n");
    const r = parseDeliveryCsv(`${H}${rows}\n`);
    expect(r.wilayas).toHaveLength(7);
    expect(r.wilayas.filter((w) => !w.priced).map((w) => w.code)).toEqual([33, 37, 50, 52]);
    expect(r.wilayas.filter((w) => w.priced && !w.stopdeskAvailable).map((w) => w.code)).toEqual([2, 3]);
    expect(r.wilayas[0]).toMatchObject({ priced: true, stopdeskAvailable: true });
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

describe("a price of 0 is never offered (D62)", () => {
  it("home :0 means no price, with a warning", () => {
    const r = parseDeliveryCsv(`${H}DZ,2-Chlef,,,rate,,${HOME}:0|${DESK}:400\n`);
    expect(r.wilayas[0]).toMatchObject({ priced: false, stopdeskAvailable: false });
    expect(r.warnings.some((w) => w.type === "zero_price" && w.code === 2)).toBe(true);
  });
  it("stop-desk :0 means home only, with a warning", () => {
    const r = parseDeliveryCsv(`${H}DZ,2-Chlef,,,rate,,${HOME}:500|${DESK}:0\n`);
    expect(r.wilayas[0]).toMatchObject({ priced: true, home: 500, stopdeskAvailable: false });
    expect(r.warnings.some((w) => w.type === "zero_price")).toBe(true);
  });
});

describe("diffDeliveryPrices", () => {
  const stored = (o: Partial<StoredWilayaFee> = {}): StoredWilayaFee => ({
    wilaya_code: 1, home_fee: 1400, stopdesk_fee: 970, priced: true, stopdesk_available: true, stop_shipping: false, communes: ["Adrar"], ...o,
  });
  const parsed = parseDeliveryCsv(`${H}DZ,1-Adrar,,,rate,,${HOME}:1400|${DESK}:970\nDZ,1-Adrar,Adrar,,,,\nDZ,33-Illizi,,,extra,,\n`);
  it("unchanged when equal; lists absent wilayas", () => {
    const d = diffDeliveryPrices(parsed, [stored(), stored({ wilaya_code: 33, priced: false, stopdesk_available: false, communes: [] }), stored({ wilaya_code: 5 })]);
    expect(d.rows.map((r) => r.changed)).toEqual([false, false]);
    expect(d.absent).toEqual([5]);
  });
  it("detects a changed fee and flags unpriced wilaya with stop_shipping off", () => {
    const d = diffDeliveryPrices(parsed, [stored({ home_fee: 1 }), stored({ wilaya_code: 33 })]);
    expect(d.rows[0].changed).toBe(true);
    expect(d.unpricedNotStopped).toEqual([33]);
  });
  it("a commune spelling change with the same count counts as changed", () => {
    const d = diffDeliveryPrices(parsed, [stored({ communes: ["Adrare"] }), stored({ wilaya_code: 33, priced: false, stopdesk_available: false, communes: [] })]);
    expect(d.rows.map((r) => r.changed)).toEqual([true, false]);
  });
  it("commune-only change lists the added and removed names", () => {
    const d = diffDeliveryPrices(parsed, [stored({ communes: ["Old"] }), stored({ wilaya_code: 33, priced: false, stopdesk_available: false, communes: [] })]);
    expect(d.rows[0]).toMatchObject({ changed: true, communesAdded: ["Adrar"], communesRemoved: ["Old"] });
    expect(d.rows[1]).toMatchObject({ communesAdded: [], communesRemoved: [] });
  });
  it("payload mirrors the parse", () => {
    expect(toApplyPayload(parsed).wilayas[1]).toMatchObject({ code: 33, priced: false, home_fee: null });
  });
});
