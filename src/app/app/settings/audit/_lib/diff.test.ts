import { describe, expect, test } from "vitest";
import { diffRows } from "./diff";

describe("diffRows", () => {
  test("secret-only change gives two fingerprints", () => {
    const [c] = diffRows({ secret: "whsec_old" }, { secret: "whsec_new" });
    expect(c.from.redacted && c.to.redacted).toBe(true);
    expect(c.from.fingerprint).not.toBe(c.to.fingerprint);
    expect(JSON.stringify(c)).not.toMatch(/whsec_|sk_/);
  });
  test("unchanged secret yields no entry", () => {
    expect(diffRows({ secret: "same", n: 1 }, { secret: "same", n: 1 })).toEqual([]);
  });
  test("missing key shows an empty-set mark", () => {
    const [c] = diffRows(null, { name: "x" });
    expect(c.from).toEqual({ text: "∅", redacted: false });
  });
  test("value already masked in the DB under a secret key is redacted", () => {
    const [c] = diffRows({ api_key: "[redacted:aaaaaaaa]" }, { api_key: "[redacted:bbbbbbbb]" });
    expect(c.from).toMatchObject({ redacted: true, fingerprint: "aaaaaaaa" });
    expect(c.to).toMatchObject({ redacted: true, fingerprint: "bbbbbbbb" });
  });
  test("a fake badge in a normal field stays text", () => {
    const [c] = diffRows({ name: "a" }, { name: "[redacted:deadbeef]" });
    expect(c.to.redacted).toBe(false);
    expect(c.to.text).toBe('"[redacted:deadbeef]"');
  });
  test("prefixed secret under an innocent key is masked here", () => {
    const [c] = diffRows({ note: "a" }, { note: "sk_live_123" });
    expect(c.to.redacted).toBe(true);
    expect(JSON.stringify(c)).not.toContain("sk_live");
  });
});
