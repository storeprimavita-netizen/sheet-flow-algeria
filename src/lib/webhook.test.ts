import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import { lightfunnelProvider, MAX_WEBHOOK_BYTES, processWebhook, shopifyProvider, verifySignature } from "./webhook";

describe("verifySignature", () => {
  const secret = "shh";
  const body = '{"id":1}';

  it("accepts a correctly signed body (hex)", () => {
    const sig = createHmac("sha256", secret).update(body, "utf8").digest("hex");
    expect(verifySignature(secret, body, sig, "hex")).toBe(true);
  });
  it("accepts a correctly signed body (base64)", () => {
    const sig = createHmac("sha256", secret).update(body, "utf8").digest("base64");
    expect(verifySignature(secret, body, sig, "base64")).toBe(true);
  });
  it("rejects a tampered body", () => {
    const sig = createHmac("sha256", secret).update(body, "utf8").digest("hex");
    expect(verifySignature(secret, '{"id":2}', sig, "hex")).toBe(false);
  });
  it("rejects a wrong-length signature without throwing", () => {
    expect(verifySignature(secret, body, "short", "hex")).toBe(false);
  });
});

describe("shopifyProvider.map", () => {
  it("extracts the unified shape from a typical order payload", () => {
    const mapped = shopifyProvider.map({
      id: 123,
      order_number: 1001,
      total_price: "4000",
      created_at: "2026-01-01T00:00:00Z",
      customer: { first_name: "Amine", last_name: "K", phone: "0555123456" },
      shipping_address: { city: "Alger", province: "Alger", address1: "Rue X" },
      line_items: [{ quantity: 2, variant_title: "Rouge / M", sku: "DRESS-A", title: "Robe Zahra" }],
      shipping_lines: [{ price: "400", code: "home" }],
    });
    expect(mapped).toMatchObject({
      external_id: "123",
      order_number: "1001",
      quantity: 2,
      sale_price: 2000,
      customer: { name: "Amine, K", phone: "0555123456", city: "Alger" },
      wilaya_name: "Alger",
      delivery_fee: 400,
      delivery_type: "home",
      variant: "Rouge / M",
      product_sku: "DRESS-A",
      product_name: "Robe Zahra",
    });
  });

  it("defaults quantity to 1 and leaves wilaya/delivery null when absent", () => {
    const mapped = shopifyProvider.map({ id: 9, total_price: "100" });
    expect(mapped.external_id).toBe("9");
    expect(mapped.quantity).toBe(1);
    expect(mapped.wilaya_name).toBeNull();
    expect(mapped.delivery_fee).toBeNull();
    expect(mapped.delivery_type).toBe("home");
  });
});

describe("lightfunnelProvider.map", () => {
  it("extracts the unified shape from a typical order payload", () => {
    const mapped = lightfunnelProvider.map({
      id: "lf-1",
      total: 3000,
      created_at: "2026-01-01T00:00:00Z",
      customer: { full_name: "Sara B", phone: "0666112233" },
      shipping_address: { city: "Oran", province: "Oran" },
      line_items: [{ quantity: 1, variant: "Bleu / L", sku: "ABAYA-N" }],
      shipping_fee: 350,
      delivery_type: "stopdesk",
    });
    expect(mapped).toMatchObject({
      external_id: "lf-1",
      quantity: 1,
      sale_price: 3000,
      customer: { name: "Sara B", phone: "0666112233", city: "Oran" },
      wilaya_name: "Oran",
      delivery_fee: 350,
      delivery_type: "stopdesk",
      variant: "Bleu / L",
      product_sku: "ABAYA-N",
    });
  });
});

describe("processWebhook early rejects (no DB touched)", () => {
  const post = (headers: Record<string, string>, body = "{}") =>
    processWebhook(shopifyProvider, new Request("http://x/api/webhooks/shopify", { method: "POST", headers, body }));

  it("401s a request with no signature header", async () => {
    expect((await post({})).status).toBe(401);
  });
  it("413s an oversized declared content-length before reading", async () => {
    const r = await post({ "x-shopify-hmac-sha256": "x", "content-length": String(MAX_WEBHOOK_BYTES + 1) });
    expect(r.status).toBe(413);
  });
});

// P0-2: replay (redelivery) must only fill empty columns, never overwrite admin edits.
describe.skipIf(!process.env.LOCAL_SUPABASE_URL)("replayEvent after an admin edit (live)", () => {
  it("keeps the admin's quantity/price/product", async () => {
    const url = process.env.LOCAL_SUPABASE_URL!;
    process.env.NEXT_PUBLIC_SUPABASE_URL = url;
    process.env.SUPABASE_SERVICE_ROLE_KEY =
      process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY ??
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const { replayEvent } = await import("./webhook");
    const db = await createAdminClient();
    const { data: p } = await db.from("products").select("id, workspace_id").limit(1).single();
    const ext = `p02-${Date.now()}`;
    const payload = {
      id: ext, order_number: 1, total_price: "4000", created_at: "2026-01-01T00:00:00Z",
      customer: { first_name: "A", last_name: "B", phone: "0555123456" },
      line_items: [{ quantity: 2, title: "no-such-product-zzz" }],
    };
    const { data: ev } = await db.from("webhook_events")
      .insert({ workspace_id: p!.workspace_id, provider: "shopify", payload, signature_ok: true }).select("id").single();
    expect((await replayEvent(ev!.id, p!.workspace_id)).ok).toBe(true);
    const sel = () => db.from("orders").select("id, customer_id, quantity, sale_price, product_id").eq("source", "shopify").eq("external_id", ext).single();
    const { data: o } = await sel();
    try {
      await db.from("orders").update({ quantity: 7, sale_price: 9999, product_id: p!.id }).eq("id", o!.id);
      expect((await replayEvent(ev!.id, p!.workspace_id)).ok).toBe(true);
      const { data: after } = await sel();
      expect(after).toMatchObject({ quantity: 7, sale_price: 9999, product_id: p!.id });
    } finally {
      await db.from("orders").delete().eq("id", o!.id);
      if (o?.customer_id) await db.from("customers").delete().eq("id", o.customer_id);
      await db.from("webhook_events").delete().eq("id", ev!.id);
    }
  });
});
