import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  readRange,
  appendRow,
  updateRange,
  batchGet,
  num,
  nextId,
  findRowById,
} from "./sheets.server";
import type {
  Account,
  Transaction,
  Product,
  SpyEntry,
  Contact,
  Settings,
} from "./types";

// ---------- READ ALL ----------
export const fetchAll = createServerFn({ method: "GET" }).handler(async () => {
  const ranges = [
    "Accounts!A2:E",
    "Transactions!A2:O",
    "Products!A2:L",
    "Spy!A2:R",
    "Contacts!A2:M",
    "Settings!A2:B",
  ];
  const data = await batchGet(ranges);

  const accounts: Account[] = (data["Accounts!A2:E"] || [])
    .filter((r) => r[0])
    .map((r) => ({
      account_id: r[0] || "",
      name: r[1] || "",
      owner: r[2] || "",
      currency: (r[3] as "DZD" | "USD") || "DZD",
      balance: num(r[4]),
    }));

  const transactions: Transaction[] = (data["Transactions!A2:O"] || [])
    .filter((r) => r[0])
    .map((r) => ({
      transaction_id: r[0] || "",
      date: r[1] || "",
      type: (r[2] as Transaction["type"]) || "Expense",
      amount: num(r[3]),
      currency: (r[4] as "DZD" | "USD") || "DZD",
      amount_dzd: num(r[5]),
      amount_usd: num(r[6]),
      category: r[7] || "",
      account_id: r[8] || "",
      to_account_id: r[9] || "",
      product_id: r[10] || "",
      person: r[11] || "",
      comment: r[12] || "",
      status: (r[13] as Transaction["status"]) || "Confirmed",
      created_at: r[14] || "",
    }));

  const products: Product[] = (data["Products!A2:L"] || [])
    .filter((r) => r[0])
    .map((r) => ({
      product_id: r[0] || "",
      name: r[1] || "",
      category: r[2] || "",
      status: r[3] || "",
      product_cost: num(r[4]),
      selling_price: num(r[5]),
      confirmation_rate: num(r[6]),
      delivery_rate: num(r[7]),
      description: r[8] || "",
      supplier_contact_id: r[9] || "",
      launch_date: r[10] || "",
      notes: r[11] || "",
    }));

  const spy: SpyEntry[] = (data["Spy!A2:R"] || [])
    .filter((r) => r[0])
    .map((r) => ({
      spy_id: r[0] || "",
      product_name: r[1] || "",
      category: r[2] || "",
      status: r[3] || "Researching",
      source: r[4] || "",
      source_url: r[5] || "",
      estimated_cost: num(r[6]),
      estimated_selling_price: num(r[7]),
      tissue_needed: r[8] || "",
      estimated_tissue_cost: num(r[9]),
      target_audience: r[10] || "",
      target_location: r[11] || "",
      estimated_ad_budget: num(r[12]),
      competitor_analysis: r[13] || "",
      score: num(r[14]),
      decision: r[15] || "",
      added_by: r[16] || "",
      date_found: r[17] || "",
    }));

  const contacts: Contact[] = (data["Contacts!A2:M"] || [])
    .filter((r) => r[0])
    .map((r) => ({
      contact_id: r[0] || "",
      name: r[1] || "",
      services: r[2] || "",
      phone: r[3] || "",
      whatsapp: r[4] || "",
      email: r[5] || "",
      instagram: r[6] || "",
      facebook: r[7] || "",
      location: r[8] || "",
      rating: num(r[9]),
      price_range: r[10] || "",
      notes: r[11] || "",
      status: r[12] || "Active",
    }));

  const settingsRows = data["Settings!A2:B"] || [];
  const settingsMap: Record<string, string> = {};
  for (const r of settingsRows) settingsMap[r[0]] = r[1];
  const settings: Settings = {
    exchange_rate: num(settingsMap["exchange_rate"], 250),
    last_updated: settingsMap["last_updated"] || "",
    updated_by: settingsMap["updated_by"] || "",
  };

  return { accounts, transactions, products, spy, contacts, settings };
});

// ---------- ADD TRANSACTION (also updates account balances) ----------
const TxInput = z.object({
  date: z.string(),
  type: z.enum(["Income", "Expense", "Transfer"]),
  amount: z.number(),
  currency: z.enum(["DZD", "USD"]),
  category: z.string(),
  account_id: z.string(),
  to_account_id: z.string().optional().default(""),
  product_id: z.string().optional().default(""),
  person: z.string(),
  comment: z.string().optional().default(""),
  status: z.enum(["Confirmed", "Pending", "Cancelled"]).default("Confirmed"),
});

async function getAccountsRaw() {
  return await readRange("Accounts!A2:E");
}
async function getRate(): Promise<number> {
  const rows = await readRange("Settings!A2:B");
  for (const r of rows) if (r[0] === "exchange_rate") return num(r[1], 250);
  return 250;
}

export const addTransaction = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => TxInput.parse(d))
  .handler(async ({ data }) => {
    const [existingTx, accountsRaw, rate] = await Promise.all([
      readRange("Transactions!A2:A"),
      getAccountsRaw(),
      getRate(),
    ]);
    const id = nextId("TXN-", existingTx.map((r) => r[0]));

    const amount_dzd = data.currency === "DZD" ? data.amount : data.amount * rate;
    const amount_usd = data.currency === "USD" ? data.amount : data.amount / rate;

    const row = [
      id,
      data.date,
      data.type,
      data.amount,
      data.currency,
      Math.round(amount_dzd * 100) / 100,
      Math.round(amount_usd * 10000) / 10000,
      data.category,
      data.account_id,
      data.to_account_id || "",
      data.product_id || "",
      data.person,
      data.comment || "",
      data.status,
      new Date().toISOString(),
    ];
    await appendRow("Transactions!A:O", row);

    // Update balances only if Confirmed
    if (data.status === "Confirmed") {
      const balanceUpdates: { rowIndex: number; newBalance: number }[] = [];
      accountsRaw.forEach((r, i) => {
        const acc_id = r[0];
        const currency = r[3] as "DZD" | "USD";
        let bal = num(r[4]);
        const amtInAcc =
          currency === data.currency
            ? data.amount
            : currency === "DZD"
              ? amount_dzd
              : amount_usd;

        if (data.type === "Income" && acc_id === data.account_id) bal += amtInAcc;
        else if (data.type === "Expense" && acc_id === data.account_id) bal -= amtInAcc;
        else if (data.type === "Transfer") {
          if (acc_id === data.account_id) bal -= amtInAcc;
          if (acc_id === data.to_account_id) bal += amtInAcc;
        } else return;

        balanceUpdates.push({ rowIndex: i + 2, newBalance: bal });
      });
      // Batch update one cell each (E column)
      await Promise.all(
        balanceUpdates.map((u) =>
          updateRange(`Accounts!E${u.rowIndex}`, [[Math.round(u.newBalance * 100) / 100]]),
        ),
      );
    }

    return { transaction_id: id };
  });

// ---------- ADD ACCOUNT ----------
const AccountInput = z.object({
  name: z.string(),
  owner: z.string(),
  currency: z.enum(["DZD", "USD"]),
  balance: z.number(),
});
export const addAccount = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => AccountInput.parse(d))
  .handler(async ({ data }) => {
    const existing = await readRange("Accounts!A2:A");
    const id = nextId("ACC", existing.map((r) => r[0]));
    await appendRow("Accounts!A:E", [id, data.name, data.owner, data.currency, data.balance]);
    return { account_id: id };
  });

// ---------- ADD PRODUCT ----------
const ProductInput = z.object({
  name: z.string(),
  category: z.string(),
  status: z.string().default("Idea"),
  product_cost: z.number().default(0),
  selling_price: z.number().default(0),
  confirmation_rate: z.number().default(0),
  delivery_rate: z.number().default(0),
  description: z.string().default(""),
  notes: z.string().default(""),
});
export const addProduct = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => ProductInput.parse(d))
  .handler(async ({ data }) => {
    const existing = await readRange("Products!A2:A");
    const id = nextId("PRD", existing.map((r) => r[0]));
    await appendRow("Products!A:L", [
      id,
      data.name,
      data.category,
      data.status,
      data.product_cost,
      data.selling_price,
      data.confirmation_rate,
      data.delivery_rate,
      data.description,
      "",
      "",
      data.notes,
    ]);
    return { product_id: id };
  });

// ---------- ADD SPY ----------
const SpyInput = z.object({
  product_name: z.string(),
  category: z.string().default(""),
  status: z.string().default("Researching"),
  source: z.string().default(""),
  source_url: z.string().default(""),
  estimated_cost: z.number().default(0),
  estimated_selling_price: z.number().default(0),
  tissue_needed: z.string().default(""),
  estimated_tissue_cost: z.number().default(0),
  target_audience: z.string().default(""),
  target_location: z.string().default(""),
  estimated_ad_budget: z.number().default(0),
  competitor_analysis: z.string().default(""),
  score: z.number().default(0),
  decision: z.string().default(""),
  added_by: z.string(),
});
export const addSpy = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => SpyInput.parse(d))
  .handler(async ({ data }) => {
    const existing = await readRange("Spy!A2:A");
    const id = nextId("SPY", existing.map((r) => r[0]));
    await appendRow("Spy!A:R", [
      id,
      data.product_name,
      data.category,
      data.status,
      data.source,
      data.source_url,
      data.estimated_cost,
      data.estimated_selling_price,
      data.tissue_needed,
      data.estimated_tissue_cost,
      data.target_audience,
      data.target_location,
      data.estimated_ad_budget,
      data.competitor_analysis,
      data.score,
      data.decision,
      data.added_by,
      new Date().toISOString().slice(0, 10),
    ]);
    return { spy_id: id };
  });

// ---------- ADD CONTACT ----------
const ContactInput = z.object({
  name: z.string(),
  services: z.string().default(""),
  phone: z.string().default(""),
  whatsapp: z.string().default(""),
  email: z.string().default(""),
  instagram: z.string().default(""),
  facebook: z.string().default(""),
  location: z.string().default(""),
  rating: z.number().default(0),
  price_range: z.string().default(""),
  notes: z.string().default(""),
  status: z.string().default("Active"),
});
export const addContact = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => ContactInput.parse(d))
  .handler(async ({ data }) => {
    const existing = await readRange("Contacts!A2:A");
    const id = nextId("CON", existing.map((r) => r[0]));
    await appendRow("Contacts!A:M", [
      id,
      data.name,
      data.services,
      data.phone,
      data.whatsapp,
      data.email,
      data.instagram,
      data.facebook,
      data.location,
      data.rating,
      data.price_range,
      data.notes,
      data.status,
    ]);
    return { contact_id: id };
  });

// ---------- UPDATE EXCHANGE RATE ----------
export const updateExchangeRate = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ rate: z.number(), updated_by: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const today = new Date().toISOString().slice(0, 10);
    await updateRange("Settings!A2:B4", [
      ["exchange_rate", data.rate],
      ["last_updated", today],
      ["updated_by", data.updated_by],
    ]);
    return { ok: true };
  });

// ---------- UPDATE ACCOUNT ----------
const AccountUpdateInput = z.object({
  account_id: z.string(),
  name: z.string(),
  owner: z.string(),
  currency: z.enum(["DZD", "USD"]),
  balance: z.number(),
});
export const updateAccount = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => AccountUpdateInput.parse(d))
  .handler(async ({ data }) => {
    const row = await findRowById("Accounts", data.account_id);
    if (!row) throw new Error("Account not found");
    await updateRange(`Accounts!A${row}:E${row}`, [
      [data.account_id, data.name, data.owner, data.currency, data.balance],
    ]);
    return { ok: true };
  });

// ---------- UPDATE PRODUCT ----------
const ProductUpdateInput = z.object({
  product_id: z.string(),
  name: z.string(),
  category: z.string(),
  status: z.string(),
  product_cost: z.number(),
  selling_price: z.number(),
  confirmation_rate: z.number(),
  delivery_rate: z.number(),
  description: z.string().default(""),
  notes: z.string().default(""),
});
export const updateProduct = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => ProductUpdateInput.parse(d))
  .handler(async ({ data }) => {
    const row = await findRowById("Products", data.product_id);
    if (!row) throw new Error("Product not found");
    await updateRange(`Products!A${row}:L${row}`, [
      [
        data.product_id,
        data.name,
        data.category,
        data.status,
        data.product_cost,
        data.selling_price,
        data.confirmation_rate,
        data.delivery_rate,
        data.description,
        "",
        "",
        data.notes,
      ],
    ]);
    return { ok: true };
  });

// ---------- UPDATE CONTACT ----------
const ContactUpdateInput = z.object({
  contact_id: z.string(),
  name: z.string(),
  services: z.string().default(""),
  phone: z.string().default(""),
  whatsapp: z.string().default(""),
  email: z.string().default(""),
  instagram: z.string().default(""),
  facebook: z.string().default(""),
  location: z.string().default(""),
  rating: z.number().default(0),
  price_range: z.string().default(""),
  notes: z.string().default(""),
  status: z.string().default("Active"),
});
export const updateContact = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => ContactUpdateInput.parse(d))
  .handler(async ({ data }) => {
    const row = await findRowById("Contacts", data.contact_id);
    if (!row) throw new Error("Contact not found");
    await updateRange(`Contacts!A${row}:M${row}`, [
      [
        data.contact_id,
        data.name,
        data.services,
        data.phone,
        data.whatsapp,
        data.email,
        data.instagram,
        data.facebook,
        data.location,
        data.rating,
        data.price_range,
        data.notes,
        data.status,
      ],
    ]);
    return { ok: true };
  });

// ---------- REVERSE TRANSACTION (UNDO) ----------
// Marks the original transaction Cancelled and reverses the balance impact on accounts.
export const reverseTransaction = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ transaction_id: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const txRows = await readRange("Transactions!A2:O");
    let txRowIndex = -1;
    for (let i = 0; i < txRows.length; i++) {
      if (txRows[i][0] === data.transaction_id) {
        txRowIndex = i;
        break;
      }
    }
    if (txRowIndex < 0) throw new Error("Transaction not found");
    const r = txRows[txRowIndex];
    const status = r[13] as "Confirmed" | "Pending" | "Cancelled";
    if (status === "Cancelled") throw new Error("Transaction is already cancelled");

    const type = r[2] as "Income" | "Expense" | "Transfer";
    const amount = num(r[3]);
    const currency = r[4] as "DZD" | "USD";
    const amount_dzd = num(r[5]);
    const amount_usd = num(r[6]);
    const account_id = r[8];
    const to_account_id = r[9];

    // Reverse balances only if the original was Confirmed
    if (status === "Confirmed") {
      const accountsRaw = await readRange("Accounts!A2:E");
      const updates: { rowIndex: number; newBalance: number }[] = [];
      accountsRaw.forEach((a, i) => {
        const acc_id = a[0];
        const accCurrency = a[3] as "DZD" | "USD";
        let bal = num(a[4]);
        const amtInAcc =
          accCurrency === currency ? amount : accCurrency === "DZD" ? amount_dzd : amount_usd;
        let touched = false;
        if (type === "Income" && acc_id === account_id) {
          bal -= amtInAcc;
          touched = true;
        } else if (type === "Expense" && acc_id === account_id) {
          bal += amtInAcc;
          touched = true;
        } else if (type === "Transfer") {
          if (acc_id === account_id) {
            bal += amtInAcc;
            touched = true;
          }
          if (acc_id === to_account_id) {
            bal -= amtInAcc;
            touched = true;
          }
        }
        if (touched) updates.push({ rowIndex: i + 2, newBalance: bal });
      });
      await Promise.all(
        updates.map((u) =>
          updateRange(`Accounts!E${u.rowIndex}`, [[Math.round(u.newBalance * 100) / 100]]),
        ),
      );
    }

    // Mark original Cancelled (column N = index 14, 1-based 14 = N)
    const sheetRow = txRowIndex + 2;
    await updateRange(`Transactions!N${sheetRow}`, [["Cancelled"]]);

    return { ok: true };
  });
