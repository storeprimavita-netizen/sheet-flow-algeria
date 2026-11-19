import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { parseDeliveryCsv } from "./delivery-prices";

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
