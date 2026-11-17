// Fails when src/messages/en.json and ar.json do not have the same key set.
// Every user-visible string must exist in both locales (AGENTS.md).
import { readFileSync } from "node:fs";

const keys = (o, p = "") =>
  Object.entries(o).flatMap(([k, v]) =>
    v && typeof v === "object" ? keys(v, `${p}${k}.`) : [`${p}${k}`],
  );
const load = (l) => new Set(keys(JSON.parse(readFileSync(`src/messages/${l}.json`, "utf8"))));
const en = load("en");
const ar = load("ar");
const missingAr = [...en].filter((k) => !ar.has(k));
const missingEn = [...ar].filter((k) => !en.has(k));
if (missingAr.length || missingEn.length) {
  if (missingAr.length) console.log(`missing in ar.json (${missingAr.length}): ${missingAr.slice(0, 8).join(", ")}`);
  if (missingEn.length) console.log(`missing in en.json (${missingEn.length}): ${missingEn.slice(0, 8).join(", ")}`);
  process.exit(1);
}
console.log(`${en.size} keys in both locales`);
