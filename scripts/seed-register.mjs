// Lets plain `node` run scripts that import server modules: Next resolves the
// "server-only" marker package internally, Node does not. Same mapping as
// vitest.config.ts. Usage:
//   node --import ./scripts/seed-register.mjs --env-file=.env.local scripts/seed-dev.ts
import { registerHooks } from "node:module";
import { pathToFileURL } from "node:url";
import path from "node:path";

const empty = pathToFileURL(
  path.resolve(import.meta.dirname, "../node_modules/next/dist/compiled/server-only/empty.js"),
).href;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") return { url: empty, shortCircuit: true };
    return nextResolve(specifier, context);
  },
});
