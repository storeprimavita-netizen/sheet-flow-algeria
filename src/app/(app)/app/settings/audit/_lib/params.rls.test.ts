import { execFileSync } from "node:child_process";
import { describe, expect, test } from "vitest";
import { DB_CONTAINER, dbContainerUp as dbUp } from "@/lib/test-db";
import { AUDITED_TABLES } from "./params";


describe.skipIf(!dbUp)("AUDITED_TABLES vs live triggers", () => {
  test("list equals tables with an audit_row trigger", () => {
    const out = execFileSync(
      "docker",
      ["exec", "-i", DB_CONTAINER, "psql", "-U", "postgres", "-d", "postgres", "-At", "-c",
        "select distinct event_object_table from information_schema.triggers where action_statement like '%audit_row%' order by 1"],
      { encoding: "utf8" },
    );
    expect(out.trim().split("\n").sort()).toEqual([...AUDITED_TABLES].sort());
  });
});
