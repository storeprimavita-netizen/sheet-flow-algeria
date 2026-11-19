import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { RateBar, RateCell } from "./rate-bar";

const STATUS = /bg-(success|warning|danger)/;

describe("RateBar / RateCell matured", () => {
  test("matured=false has no success/warning/danger class at any value", () => {
    for (const pct of [0, 20, 55, 90, 100]) {
      expect(renderToStaticMarkup(<RateBar pct={pct} matured={false} />)).not.toMatch(STATUS);
      expect(renderToStaticMarkup(<RateCell pct={pct} label={`${pct}%`} matured={false} />)).not.toMatch(STATUS);
    }
  });
  test("matured (default) keeps the threshold colors", () => {
    expect(renderToStaticMarkup(<RateBar pct={90} />)).toContain("bg-success");
    expect(renderToStaticMarkup(<RateBar pct={50} />)).toContain("bg-warning");
    expect(renderToStaticMarkup(<RateBar pct={10} matured />)).toContain("bg-danger");
  });
});

describe("RateCell unmatured hint", () => {
  test("renders a marker with the reason (sr-only) only when unmatured", () => {
    expect(renderToStaticMarkup(<RateCell pct={0} label="—" matured={false} hint="Not enough data yet" />)).toContain(">Not enough data yet<");
    expect(renderToStaticMarkup(<RateCell pct={50} label="50%" hint="Not enough data yet" />)).not.toContain("Not enough data yet");
  });
});
