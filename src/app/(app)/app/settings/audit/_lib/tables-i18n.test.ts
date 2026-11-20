import { describe, expect, test } from "vitest";
import en from "@/messages/en.json";
import ar from "@/messages/ar.json";
import { AUDITED_TABLES } from "./params";

describe("audit table labels", () => {
  test.each([["en", en], ["ar", ar]] as const)("%s has a label for every audited table", (_l, m) => {
    const tables = m.audit.tables as Record<string, string>;
    for (const n of AUDITED_TABLES) expect(tables[n], n).toBeTruthy();
    expect(Object.keys(tables).sort()).toEqual([...AUDITED_TABLES].sort());
  });
});
