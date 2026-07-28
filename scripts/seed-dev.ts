/**
 * Deterministic dev-only seed. NEVER run against a project that isn't local
 * (refuses unless NEXT_PUBLIC_SUPABASE_URL looks like localhost, or --force
 * is passed). Fixed seed ⇒ same row counts/relationships every run against a
 * fresh DB, so the numbers this produces are checkable by hand.
 *
 * Usage: node --env-file=.env.local scripts/seed-dev.ts
 *        (or point env at a local stack: node --env-file=.env.seed.local scripts/seed-dev.ts)
 *
 * Run natively — Node 20+ strips TS types, no ts-node/tsx needed. Only
 * `import type` may cross the `@/` alias (erased at load, never resolved);
 * anything imported at runtime here uses a relative path.
 */
import { createAdminClient } from "../src/lib/supabase/admin.ts";
import { upsertCustomerFromOrder } from "../src/lib/customers.ts";
import { DEFAULT_INPUTS, seedForProduct, type PricingInputs } from "../src/lib/pricing.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!/localhost|127\.0\.0\.1/.test(url) && !process.argv.includes("--force")) {
  console.error(
    `Refusing to seed a non-local project (NEXT_PUBLIC_SUPABASE_URL=${url || "<unset>"}). Pass --force to override.`,
  );
  process.exit(1);
}

// index-based +/-pct variance (cycles over 5 steps) — deterministic like
// everything else here, no RNG needed for cosmetic amount texture.
const vary = (base: number, pct: number, i: number) => Math.round(base * (1 + pct * ((i % 5) - 2) / 2));
const daysAgoIso = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
const dateOnly = (iso: string) => iso.slice(0, 10);

const EUR_RATE = 260;
const USD_RATE = 240;

const ADMIN_EMAIL = "admin@seed.mnw";
const CONF_EMAIL = "confirmation@seed.mnw";
const DELIV_EMAIL = "delivery@seed.mnw";
const SEED_PASSWORD = "SeedDev!2026";

const TOP_WILAYAS = [16, 31, 25, 19, 9, 6, 23, 13, 27, 35, 42, 15];

const CUSTOMER_NAMES = [
  "Amina Belkacem", "Youcef Haddad", "Nadia Cherif", "Karim Boudiaf", "Sarah Meziane",
  "Omar Talbi", "Lina Ferhat", "Riad Benali", "Yasmine Zerrouki", "Sofiane Bouzid",
  "Imane Kaci", "Bilal Rahmani", "Chaima Ould Ali", "Walid Saadi", "Meriem Guerroudj",
  "Adel Bensalem", "Hana Djelloul", "Fares Amrani", "Rania Bouchama", "Anis Khiar",
  "Sabrina Larbi", "Hamza Zidane", "Ines Bouzidi", "Nassim Cherfaoui", "Amel Toumi",
];

const PRODUCTS = [
  {
    name: "Robe Zahra", category: "Robes", fabric: "Soie", sale_price: 4900,
    sourcing_cost: 2500, sourcing_currency: "DZD" as const, fx_rate: 1,
  },
  {
    name: "Ensemble Lina", category: "Ensembles", fabric: "Coton", sale_price: 5400,
    sourcing_cost: 12, sourcing_currency: "EUR" as const, fx_rate: EUR_RATE,
  },
  {
    name: "Abaya Noor", category: "Abayas", fabric: "Crêpe", sale_price: 6200,
    sourcing_cost: 3200, sourcing_currency: "DZD" as const, fx_rate: 1,
  },
  {
    name: "Jupe Amel", category: "Jupes", fabric: "Denim", sale_price: 3200,
    sourcing_cost: 10, sourcing_currency: "USD" as const, fx_rate: USD_RATE,
  },
  {
    name: "Veste Sarah", category: "Vestes", fabric: "Laine", sale_price: 7800,
    sourcing_cost: 22, sourcing_currency: "EUR" as const, fx_rate: EUR_RATE,
  },
];

type Admin = Awaited<ReturnType<typeof createAdminClient>>;

// For writes with no `.select()` (data is null by design — Prefer: return=minimal).
async function must(res: { error: { message: string } | null }, what: string): Promise<void> {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
}

// For `.select(...).single()` reads/writes, where a null row is a real failure.
async function mustRow<T>(res: { data: T | null; error: { message: string } | null }, what: string): Promise<T> {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  if (res.data === null) throw new Error(`${what}: no data returned`);
  return res.data;
}

// ---------------------------------------------------------------------------
// users + workspace
// ---------------------------------------------------------------------------
async function ensureUser(admin: Admin, email: string): Promise<string> {
  const { data: list, error } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (error) throw new Error(`listUsers: ${error.message}`);
  const found = list.users.find((u) => u.email === email);
  if (found) return found.id;

  const { data, error: createErr } = await admin.auth.admin.createUser({
    email,
    password: SEED_PASSWORD,
    email_confirm: true,
  });
  if (createErr || !data.user) throw new Error(`createUser(${email}): ${createErr?.message}`);
  return data.user.id;
}

async function ensureWorkspace(admin: Admin): Promise<string> {
  const { data: existing } = await admin.from("workspaces").select("id").limit(1).maybeSingle();
  if (existing) return existing.id;

  const { data, error } = await admin.rpc("bootstrap_workspace", {
    p_email: ADMIN_EMAIL,
    p_workspace_name: "MNW Seed",
  });
  if (error || !data) throw new Error(`bootstrap_workspace: ${error?.message}`);
  return data;
}

// ---------------------------------------------------------------------------
// reference data
// ---------------------------------------------------------------------------
async function seedFxRates(admin: Admin, ws: string) {
  const today = dateOnly(new Date().toISOString());
  for (const [currency, rate] of [["EUR", EUR_RATE], ["USD", USD_RATE]] as const) {
    const { data: existing } = await admin
      .from("exchange_rates")
      .select("id")
      .eq("workspace_id", ws)
      .eq("currency", currency)
      .eq("valid_from", today)
      .maybeSingle();
    if (existing) continue;
    await must(
      await admin.from("exchange_rates").insert({ workspace_id: ws, currency, rate_dzd: rate, valid_from: today }),
      "exchange_rates insert",
    );
  }
}

async function seedFixedFees(admin: Admin, ws: string): Promise<number> {
  const fees = [
    { label: "Loyer atelier", amount: 25000 },
    { label: "Salaires équipe", amount: 60000 },
    { label: "Flexy / outils", amount: 3000 },
  ];
  const { data: existing } = await admin.from("fixed_fees").select("id").eq("workspace_id", ws);
  if (!existing || existing.length === 0) {
    for (const f of fees) {
      await must(
        await admin
          .from("fixed_fees")
          .insert({ workspace_id: ws, label: f.label, amount: f.amount, currency: "DZD", fx_rate: 1 }),
        "fixed_fees insert",
      );
    }
  }
  return fees.reduce((s, f) => s + f.amount, 0);
}

async function seedWilayaFees(admin: Admin, ws: string) {
  for (let i = 0; i < TOP_WILAYAS.length; i++) {
    await must(
      await admin
        .from("wilaya_fees")
        .update({ home_fee: 400 + i * 20, stopdesk_fee: 300 + i * 15 })
        .eq("workspace_id", ws)
        .eq("wilaya_code", TOP_WILAYAS[i]),
      "wilaya_fees update",
    );
  }
}

async function seedContacts(admin: Admin, ws: string) {
  const suppliers = [
    { type: "atelier_couture" as const, name: "Atelier Yasmine", phones: ["0550111222"], location: "Alger" },
    { type: "shooting_studio" as const, name: "Studio Flash", phones: ["0550333444"], location: "Oran" },
    { type: "emballage" as const, name: "Emballage Plus", phones: ["0550555666"], location: "Blida" },
  ];
  const ids: Record<string, string> = {};
  for (const s of suppliers) {
    const { data: existing } = await admin
      .from("contacts")
      .select("id")
      .eq("workspace_id", ws)
      .eq("name", s.name)
      .maybeSingle();
    if (existing) {
      ids[s.name] = existing.id;
      continue;
    }
    const row = await mustRow<{ id: string }>(
      await admin
        .from("contacts")
        .insert({ workspace_id: ws, type: s.type, name: s.name, phones: s.phones, location: s.location })
        .select("id")
        .single(),
      "contacts insert",
    );
    ids[s.name] = row.id;
  }
  return ids;
}

// ---------------------------------------------------------------------------
// products: costs, scenarios, expenses, ad spend, initial stock
// ---------------------------------------------------------------------------
async function seedProducts(
  admin: Admin,
  ws: string,
  createdBy: string,
  supplierIds: Record<string, string>,
) {
  const productIds: string[] = [];
  const fixedFeesTotal = await seedFixedFees(admin, ws);

  for (let pi = 0; pi < PRODUCTS.length; pi++) {
    const p = PRODUCTS[pi];
    const { data: existing } = await admin
      .from("products")
      .select("id")
      .eq("workspace_id", ws)
      .eq("name", p.name)
      .maybeSingle();

    let productId: string;
    if (existing) {
      productId = existing.id;
    } else {
      const row = await mustRow<{ id: string }>(
        await admin
          .from("products")
          .insert({
            workspace_id: ws,
            name: p.name,
            category: p.category,
            fabric: p.fabric,
            status: "confirmed",
            sale_price: p.sale_price,
            variants: [{ label: "S" }, { label: "M" }, { label: "L" }],
            created_by: createdBy,
          })
          .select("id")
          .single(),
        "products insert",
      );
      productId = row.id;
    }
    productIds.push(productId);

    // costs
    const costDzd = p.sourcing_cost * p.fx_rate;
    await must(
      await admin.from("product_costs").upsert(
        {
          product_id: productId,
          workspace_id: ws,
          sourcing_cost: p.sourcing_cost,
          sourcing_currency: p.sourcing_currency,
          fx_rate: p.fx_rate,
        },
        { onConflict: "product_id" },
      ),
      "product_costs upsert",
    );

    // scenarios: best/medium/worst, baseline from seedForProduct + fixed-fee/fx inputs
    const baseline: PricingInputs = {
      ...seedForProduct(costDzd, p.sale_price),
      euro_price: EUR_RATE,
      salary_month: fixedFeesTotal,
    };
    const scenarios: { slug: string; inputs: PricingInputs }[] = [
      { slug: "best", inputs: baseline },
      { slug: "medium", inputs: { ...baseline, confirmation_pct: 55, delivery_pct: 55, spend_eur_day: 12 } },
      { slug: "worst", inputs: { ...DEFAULT_INPUTS, confirmation_pct: 0, delivery_pct: 0 } },
    ];
    for (const s of scenarios) {
      // product_scenarios' uniqueness is a partial index (product_id IS NOT
      // NULL), which supabase-js upsert can't target — select-then-write,
      // same pattern scenario-engine.tsx uses for the same reason.
      const { data: existingScenario } = await admin
        .from("product_scenarios")
        .select("id")
        .eq("product_id", productId)
        .eq("slug", s.slug)
        .maybeSingle();
      if (existingScenario) {
        await must(
          await admin.from("product_scenarios").update({ inputs: s.inputs }).eq("id", existingScenario.id),
          "product_scenarios update",
        );
      } else {
        await must(
          await admin
            .from("product_scenarios")
            .insert({ workspace_id: ws, product_id: productId, slug: s.slug, inputs: s.inputs }),
          "product_scenarios insert",
        );
      }
    }

    // expenses (2 per product)
    const { data: existingExpenses } = await admin.from("expenses").select("id").eq("product_id", productId);
    if (!existingExpenses || existingExpenses.length === 0) {
      const rows = [
        {
          category: "shooting" as const,
          amount: vary(2500, 0.2, pi),
          currency: "DZD" as const,
          fx_rate: 1,
          spent_on: dateOnly(daysAgoIso(20 + pi)),
          contact_id: supplierIds["Studio Flash"],
        },
        {
          category: "packaging" as const,
          amount: vary(1200, 0.2, pi),
          currency: "DZD" as const,
          fx_rate: 1,
          spent_on: dateOnly(daysAgoIso(10 + pi)),
          contact_id: supplierIds["Emballage Plus"],
        },
      ];
      for (const r of rows) {
        await must(
          await admin
            .from("expenses")
            .insert({ workspace_id: ws, product_id: productId, created_by: createdBy, ...r }),
          "expenses insert",
        );
      }
    }

    // ad spend: 8 days 'test', plus 4 'scaling' days for the first two products
    const { data: existingAdSpend } = await admin.from("ad_spend_daily").select("id").eq("product_id", productId);
    if (!existingAdSpend || existingAdSpend.length === 0) {
      for (let d = 0; d < 8; d++) {
        await must(
          await admin.from("ad_spend_daily").insert({
            workspace_id: ws,
            product_id: productId,
            spent_on: dateOnly(daysAgoIso(d + 1)),
            kind: "test",
            amount: vary(15, 0.3, d),
            currency: "EUR",
            fx_rate: EUR_RATE,
            created_by: createdBy,
          }),
          "ad_spend_daily insert",
        );
      }
      if (pi < 2) {
        for (let d = 0; d < 4; d++) {
          await must(
            await admin.from("ad_spend_daily").insert({
              workspace_id: ws,
              product_id: productId,
              spent_on: dateOnly(daysAgoIso(d + 1)),
              kind: "scaling",
              amount: vary(35, 0.3, d),
              currency: "EUR",
              fx_rate: EUR_RATE,
              created_by: createdBy,
            }),
            "ad_spend_daily insert",
          );
        }
      }
    }

    // initial stock (only if the product has never had a movement)
    const { data: existingMovement } = await admin
      .from("stock_movements")
      .select("id")
      .eq("product_id", productId)
      .limit(1)
      .maybeSingle();
    if (!existingMovement) {
      await must(
        await admin.from("stock_movements").insert({
          workspace_id: ws,
          product_id: productId,
          delta: 150,
          reason: "purchase",
          created_by: createdBy,
          note: "seed: initial stock",
        }),
        "stock_movements insert",
      );
    }
  }

  return productIds;
}

// ---------------------------------------------------------------------------
// orders: ~60 across statuses/wilayas/sources/dates, 2 flagged duplicates,
// cash collections for delivered orders
// ---------------------------------------------------------------------------
type ConfStatus = "wait_for_confirmation" | "no_answer" | "closed_phone" | "cancelled" | "confirmed";
type DelivStatus =
  | "wait_for_deposit" | "bureau_deposited" | "in_transit" | "out_for_delivery"
  | "stop_desk_waiting" | "delivered" | "cancelled" | "delayed" | "returning" | "returned";
type Plan = { confirmation: ConfStatus; delivery?: DelivStatus };

function buildPlans(): Plan[] {
  const plans: Plan[] = [];
  const push = (n: number, p: Plan) => { for (let k = 0; k < n; k++) plans.push(p); };
  push(8, { confirmation: "wait_for_confirmation" });
  push(5, { confirmation: "no_answer" });
  push(3, { confirmation: "closed_phone" });
  push(4, { confirmation: "cancelled" });
  push(4, { confirmation: "confirmed" });
  push(20, { confirmation: "confirmed", delivery: "delivered" });
  push(6, { confirmation: "confirmed", delivery: "returned" });
  push(4, { confirmation: "confirmed", delivery: "cancelled" });
  push(4, { confirmation: "confirmed", delivery: "in_transit" });
  return plans; // 58
}

const SOURCES = ["shopify", "lightfunnels", "manual"] as const;
const DELIVERY_TYPES = ["home", "stopdesk"] as const;

async function seedOrders(
  admin: Admin,
  ws: string,
  productIds: string[],
  createdBy: string,
  confAgentId: string,
  delivAgentId: string,
) {
  const { data: existingOrders } = await admin.from("orders").select("id").eq("workspace_id", ws).limit(1);
  if (existingOrders && existingOrders.length > 0) {
    console.log("orders already seeded, skipping order generation");
    return;
  }

  const plans = buildPlans();
  const createdOrderIds: { id: string; plan: Plan; sale: number; qty: number }[] = [];

  for (let i = 0; i < plans.length; i++) {
    const plan = plans[i];
    const productId = productIds[i % productIds.length];
    const product = PRODUCTS[i % PRODUCTS.length];
    const wilaya = TOP_WILAYAS[i % TOP_WILAYAS.length];
    const source = SOURCES[i % SOURCES.length];
    const deliveryType = DELIVERY_TYPES[i % DELIVERY_TYPES.length];
    const daysAgo = 1 + (i % 44);
    const qty = 1 + (i % 3 === 0 ? 1 : 0);
    const customerIdx = i % CUSTOMER_NAMES.length;
    const phone = `05${String(50000000 + customerIdx).slice(-8)}`;

    const customerId = await upsertCustomerFromOrder(admin, {
      workspaceId: ws,
      name: CUSTOMER_NAMES[customerIdx],
      phone,
      wilayaCode: wilaya,
      commune: "Centre",
    });

    const createdAt = daysAgoIso(daysAgo);
    const isConfirmed = plan.confirmation === "confirmed";
    const attempts = plan.confirmation === "wait_for_confirmation" ? 0 : 1 + (i % 3);
    const comment =
      plan.confirmation === "no_answer" ? "Pas de réponse après 3 tentatives"
      : plan.confirmation === "closed_phone" ? "Téléphone injoignable"
      : plan.confirmation === "cancelled" ? "Client ne veut plus la commande"
      : null;

    const row = await mustRow<{ id: string }>(
      await admin
        .from("orders")
        .insert({
          workspace_id: ws,
          order_number: `SEED-${String(i + 1).padStart(4, "0")}`,
          source,
          external_id: source === "manual" ? null : `seed-${source}-${i + 1}`,
          product_id: productId,
          variant: i % 2 === 0 ? "M" : "L",
          quantity: qty,
          customer_id: customerId,
          customer_name: CUSTOMER_NAMES[customerIdx],
          customer_phone: phone,
          wilaya_code: wilaya,
          commune: "Centre",
          delivery_type: deliveryType,
          sale_price: product.sale_price,
          delivery_fee: deliveryType === "home" ? 400 : 300,
          delivery_fee_source: "wilaya_table",
          confirmation_attempts: attempts,
          created_by: createdBy,
          created_at: createdAt,
          placed_at: createdAt,
        })
        .select("id")
        .single(),
      "orders insert",
    );

    if (plan.confirmation !== "wait_for_confirmation") {
      await must(
        await admin
          .from("orders")
          .update({
            confirmation_status: plan.confirmation,
            confirmation_comment: comment,
            assigned_confirmation_agent: confAgentId,
          })
          .eq("id", row.id),
        "orders update confirmation",
      );
    }
    if (isConfirmed && plan.delivery && plan.delivery !== "wait_for_deposit") {
      await must(
        await admin
          .from("orders")
          .update({ delivery_status: plan.delivery, assigned_delivery_agent: delivAgentId })
          .eq("id", row.id),
        "orders update delivery",
      );
    }

    createdOrderIds.push({ id: row.id, plan, sale: product.sale_price, qty });
  }

  // 2 duplicate-demo orders — same customer + product, inserted back-to-back
  // with real "now" timestamps so `flag_duplicate_order` (which compares
  // against actual now(), not an overridden created_at) fires naturally.
  const dupProduct = productIds[0];
  const dupPhone = "0550099999";
  const dupCustomerId = await upsertCustomerFromOrder(admin, {
    workspaceId: ws,
    name: "Client Duplicate Test",
    phone: dupPhone,
    wilayaCode: TOP_WILAYAS[0],
  });
  for (let k = 0; k < 2; k++) {
    await must(
      await admin.from("orders").insert({
        workspace_id: ws,
        order_number: `SEED-DUP-${k + 1}`,
        source: "manual",
        product_id: dupProduct,
        quantity: 1,
        customer_id: dupCustomerId,
        customer_name: "Client Duplicate Test",
        customer_phone: dupPhone,
        wilaya_code: TOP_WILAYAS[0],
        delivery_type: "home",
        sale_price: PRODUCTS[0].sale_price,
        delivery_fee: 400,
        delivery_fee_source: "wilaya_table",
        created_by: createdBy,
      }),
      "orders insert (duplicate demo)",
    );
  }

  // cash collections for delivered orders: all collected, ~1/3 also deposited
  const delivered = createdOrderIds.filter((o) => o.plan.delivery === "delivered");
  for (let i = 0; i < delivered.length; i++) {
    const o = delivered[i];
    const deposited = i % 3 === 0;
    await must(
      await admin.from("cash_collections").insert({
        workspace_id: ws,
        order_id: o.id,
        amount_dzd: o.sale * o.qty,
        status: deposited ? "deposited" : "collected",
        collected_on: dateOnly(daysAgoIso(5)),
        deposited_on: deposited ? dateOnly(daysAgoIso(2)) : null,
        reference: deposited ? `DEP-${i + 1}` : null,
        created_by: createdBy,
      }),
      "cash_collections insert",
    );
  }

  console.log(`orders: ${createdOrderIds.length + 2} inserted (incl. 2 duplicate-demo)`);
}

// ---------------------------------------------------------------------------
// meetings + rules docs
// ---------------------------------------------------------------------------
async function seedMeetings(admin: Admin, ws: string, createdBy: string, attendees: string[]) {
  const { data: existing } = await admin.from("meetings").select("id").eq("workspace_id", ws);
  if (existing && existing.length > 0) return;

  const held = await mustRow<{ id: string }>(
    await admin
      .from("meetings")
      .insert({
        workspace_id: ws,
        title: "Point hebdo — semaine passée",
        scheduled_at: daysAgoIso(7),
        created_by: createdBy,
        attendees,
      })
      .select("id")
      .single(),
    "meetings insert (held)",
  );
  await must(
    await admin
      .from("meeting_objectives")
      .insert([
        { meeting_id: held.id, content: "Revoir les stats de confirmation", position: 0, is_done: true },
        { meeting_id: held.id, content: "Décider des wilayas à stopper", position: 1, is_done: true },
      ]),
    "meeting_objectives insert",
  );
  await must(
    await admin
      .from("meetings")
      .update({ status: "held", notes: "RAS, bonne semaine." })
      .eq("id", held.id),
    "meetings mark held",
  );

  const planned = await mustRow<{ id: string }>(
    await admin
      .from("meetings")
      .insert({
        workspace_id: ws,
        title: "Point hebdo — semaine prochaine",
        scheduled_at: new Date(Date.now() + 3 * 86_400_000).toISOString(),
        created_by: createdBy,
        attendees,
      })
      .select("id")
      .single(),
    "meetings insert (planned)",
  );
  await must(
    await admin
      .from("meeting_objectives")
      .insert([{ meeting_id: planned.id, content: "Suivre les nouveaux produits", position: 0 }]),
    "meeting_objectives insert",
  );
}

async function seedRulesDocs(admin: Admin, ws: string, updatedBy: string) {
  const { data: existing } = await admin.from("rules_docs").select("id").eq("workspace_id", ws);
  if (existing && existing.length > 0) return;

  const docs = [
    { title: "Script de confirmation", content: "1. Saluer le client.\n2. Confirmer l'adresse.\n3. Confirmer le prix.", position: 0 },
    { title: "Politique de retour", content: "Un retour est facturé au client si le colis a été refusé sans motif.", position: 1 },
  ];
  for (const d of docs) {
    await must(
      await admin.from("rules_docs").insert({ workspace_id: ws, updated_by: updatedBy, ...d }),
      "rules_docs insert",
    );
  }
}

// ---------------------------------------------------------------------------
async function main() {
  const admin = await createAdminClient();

  const adminId = await ensureUser(admin, ADMIN_EMAIL);
  const confAgentId = await ensureUser(admin, CONF_EMAIL);
  const delivAgentId = await ensureUser(admin, DELIV_EMAIL);

  const ws = await ensureWorkspace(admin);
  const seedWsResult = await admin.rpc("seed_workspace", { p_ws: ws });
  if (seedWsResult.error) throw new Error(`seed_workspace: ${seedWsResult.error.message}`);

  // seed_workspace()'s stop_shipping_rule default (min_orders: 10) is sized
  // for a real workspace, not this demo's ~5 orders/wilaya — override it
  // here (dev-only) so the dashboard's wilaya choropleth actually colors
  // instead of showing every wilaya as "not enough data".
  await must(
    await admin
      .from("settings")
      .upsert(
        { workspace_id: ws, key: "stop_shipping_rule", value: { min_orders: 3, min_delivery_rate: 40 } },
        { onConflict: "workspace_id,key" },
      ),
    "settings upsert (stop_shipping_rule)",
  );

  await must(
    await admin
      .from("profiles")
      .upsert(
        { user_id: adminId, workspace_id: ws, role: "admin", is_active: true, display_name: "Admin (seed)", duty: "Founder" },
        { onConflict: "user_id" },
      ),
    "profiles upsert (admin)",
  );
  await must(
    await admin
      .from("profiles")
      .upsert(
        { user_id: confAgentId, workspace_id: ws, role: "confirmation_agent", is_active: true, display_name: "Agent Confirmation (seed)", duty: "Confirmation" },
        { onConflict: "user_id" },
      ),
    "profiles upsert (confirmation agent)",
  );
  await must(
    await admin
      .from("profiles")
      .upsert(
        { user_id: delivAgentId, workspace_id: ws, role: "delivery_agent", is_active: true, display_name: "Agent Livraison (seed)", duty: "Delivery" },
        { onConflict: "user_id" },
      ),
    "profiles upsert (delivery agent)",
  );

  await seedFxRates(admin, ws);
  await seedWilayaFees(admin, ws);
  const supplierIds = await seedContacts(admin, ws);
  const productIds = await seedProducts(admin, ws, adminId, supplierIds);
  await seedOrders(admin, ws, productIds, adminId, confAgentId, delivAgentId);
  await seedMeetings(admin, ws, adminId, [adminId, confAgentId, delivAgentId]);
  await seedRulesDocs(admin, ws, adminId);

  console.log("\nSeed complete.");
  console.log(`workspace: ${ws}`);
  console.log(`admin:               ${ADMIN_EMAIL} / ${SEED_PASSWORD}`);
  console.log(`confirmation agent:  ${CONF_EMAIL} / ${SEED_PASSWORD}`);
  console.log(`delivery agent:      ${DELIV_EMAIL} / ${SEED_PASSWORD}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
