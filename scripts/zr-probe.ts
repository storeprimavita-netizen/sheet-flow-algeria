/**
 * READ-ONLY ZR Express probe — closes the "unverified" items in
 * docs/ZR_EXPRESS_API_AUDIT.md §7. Makes only GET / POST …/search calls
 * (never creates, updates, accepts or deletes anything), sequentially.
 *
 * Usage (credentials stay in your shell, never printed or stored):
 *   ZR_TENANT_ID=… ZR_API_KEY=… node scripts/zr-probe.ts
 *
 * Output is shape-only: HTTP status, field names/types, enum-like values
 * (states, payment status, transaction type) and balance totals. Customer
 * names, phones, addresses and tracking numbers are never printed.
 * Paste the output into the chat (or the audit doc) to unlock the Finance work.
 */
const BASE = "https://api.zrexpress.app/api/v1";
const tenant = process.env.ZR_TENANT_ID;
const key = process.env.ZR_API_KEY;
if (!tenant || !key) {
  console.error("Set ZR_TENANT_ID and ZR_API_KEY in the environment.");
  process.exit(1);
}

type Json = Record<string, unknown>;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function call(label: string, path: string, body?: Json): Promise<unknown> {
  await sleep(400); // docs publish no rate limit — stay gentle
  const res = await fetch(`${BASE}${path}`, {
    method: body ? "POST" : "GET",
    headers: { "X-Tenant": tenant!, "X-Api-Key": key!, "Content-Type": "application/json", Accept: "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  console.log(`\n## ${label}  [${body ? "POST" : "GET"} ${path}] → HTTP ${res.status}`);
  if (!res.ok) {
    console.log(`   error body (first 200 chars): ${text.slice(0, 200).replace(/[A-Za-z0-9_-]{30,}/g, "<redacted>")}`);
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    console.log("   (non-JSON response)");
    return null;
  }
}

const shape = (o: unknown): string =>
  o && typeof o === "object"
    ? Object.entries(o as Json).map(([k, v]) => `${k}:${Array.isArray(v) ? "array" : v === null ? "null" : typeof v}`).join(", ")
    : String(o);
const distinct = (xs: unknown[]) => [...new Set(xs.map(String))].sort();
const items = (r: unknown): Json[] => ((r as { items?: Json[] } | null)?.items ?? []) as Json[];

// 1) balance — the four undocumented fields
const bal = await call("Supplier balance", "/supplier-payment/supplier-balance");
if (bal) console.log("   ", JSON.stringify(bal));

const stats = await call("Transactions stats", "/supplier-payment/stats/current-supplier");
if (stats) console.log("   ", JSON.stringify(stats));

// 2) workflow states (authoritative list incl. return/refund states)
const wf = await call("Workflows", "/workflows/search", { pageNumber: 1, pageSize: 50 });
for (const w of items(wf)) {
  const states = (w.states ?? []) as Json[];
  console.log(`   workflow "${w.name}": ${states.map((s) => `${s.slug}(${s.name})`).join(" → ")}`);
}

// 3) supplier payments (remittances)
const pays = await call("Supplier payments", "/supplier-payment/search", { pageNumber: 1, pageSize: 20, orderBy: ["createdAt desc"] });
const pl = items(pays);
console.log(`   total payments: ${(pays as Json | null)?.totalCount ?? "?"}; fields: ${pl[0] ? shape(pl[0]) : "(none)"}`);
console.log(`   distinct status values: ${JSON.stringify(distinct(pl.map((p) => p.status)))}`);
console.log(`   accepted: ${pl.filter((p) => p.acceptedAt).length}/${pl.length}`);
for (const p of pl.slice(0, 5)) console.log(`   - ${p.createdAt} amount=${p.amount} status=${p.status} acceptedAt=${p.acceptedAt ?? "null"} delivered=${p.totalParcelsDelivered} cancelled=${p.totalParcelsCancelled}`);

// 4) line items of the most recent payment
if (pl[0]?.id) {
  const tx = await call("Payment lines (latest payment)", `/treasury-transactions/search/supplier-payment/by-supplier-payment/${pl[0].id}`, { pageNumber: 1, pageSize: 50 });
  const t = items(tx);
  console.log(`   lines: ${(tx as Json | null)?.totalCount ?? "?"}; fields: ${t[0] ? shape(t[0]) : "(none)"}`);
  console.log(`   distinct line types: ${JSON.stringify(distinct(t.map((x) => x.type)))}`);
  const sum = t.reduce((s, x) => s + Number(x.amount ?? 0), 0);
  console.log(`   sum of first ${t.length} line amounts: ${sum} vs payment amount: ${pl[0].amount}`);
}

// 5) parcels — state distribution + which money/state fields exist
const parcels = await call("Parcels (latest 100)", "/parcels/search", { pageNumber: 1, pageSize: 100, orderBy: ["createdAt desc"] });
const pc = items(parcels);
console.log(`   total parcels: ${(parcels as Json | null)?.totalCount ?? "?"}; fields: ${pc[0] ? shape(pc[0]) : "(none)"}`);
const byState: Record<string, number> = {};
for (const p of pc) {
  const s = (p.state as Json | undefined)?.name as string | undefined;
  byState[s ?? "(none)"] = (byState[s ?? "(none)"] ?? 0) + 1;
}
console.log(`   by state (latest ${pc.length}): ${JSON.stringify(byState)}`);
console.log(`   distinct paymentMethod: ${JSON.stringify(distinct(pc.map((p) => p.paymentMethod)))}; isReturn true: ${pc.filter((p) => p.isReturn).length}`);

// 6) customers — confirm there is no reliability/history field
const cust = await call("Customers (1)", "/customers/search", { pageNumber: 1, pageSize: 1 });
console.log(`   fields: ${items(cust)[0] ? shape(items(cust)[0]) : "(none)"}`);

console.log("\nDone. Nothing was created, changed or accepted.");
