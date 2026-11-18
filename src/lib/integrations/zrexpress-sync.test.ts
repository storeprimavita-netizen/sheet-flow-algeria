import { createHmac } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { cronAuthorized } from "@/lib/cron-auth";
import { GET as cronGET } from "@/app/api/cron/zr-sync/route";
import { applyZRParcelState, processZRWebhook } from "./zrexpress-webhook";

// ---- cron auth (no DB) ------------------------------------------------------
describe("cron auth", () => {
  test("401 when CRON_SECRET is unset, even for 'Bearer undefined'", async () => {
    const prev = process.env.CRON_SECRET;
    delete process.env.CRON_SECRET;
    try {
      expect(cronAuthorized("Bearer undefined")).toBe(false);
      expect(cronAuthorized("Bearer ")).toBe(false);
      expect((await cronGET(new Request("http://x/api/cron/zr-sync", { headers: { authorization: "Bearer undefined" } }))).status).toBe(401);
      expect((await cronGET(new Request("http://x/api/cron/zr-sync"))).status).toBe(401);
    } finally {
      if (prev !== undefined) process.env.CRON_SECRET = prev;
    }
  });
  test("wrong secret 401, right secret accepted", () => {
    expect(cronAuthorized("Bearer nope", "s3cret")).toBe(false);
    expect(cronAuthorized("Bearer s3cret", "s3cret")).toBe(true);
  });
});

// ---- live: apply_zr_state + webhook ----------------------------------------
const URL = process.env.LOCAL_SUPABASE_URL;
const SERVICE_KEY =
  process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const SECRET = "whsec_" + Buffer.from("zr2-test-secret").toString("base64");
const T = (min: number) => new Date(Date.UTC(2026, 0, 1, 12, min)).toISOString();

describe.skipIf(!URL)("ZR-2 state sync (live DB)", () => {
  let admin: SupabaseClient;
  let ws: string;
  let orderId: string;
  let productId: string;
  let parcel: string;
  const MAP = { map: { livre: "delivered", "en transit": "in_transit", retour: "returned" } };

  const rpc = (state: string | null, at: string | null, extra: Record<string, unknown> = {}) =>
    admin.rpc("apply_zr_state", {
      p_ws: ws, p_parcel: parcel, p_state: state as string, p_slug: null as unknown as string,
      p_situation: null as unknown as string, p_is_return: null as unknown as boolean, p_occurred: at as string, ...extra,
    });
  const order = async () => (await admin.from("orders").select("delivery_status").eq("id", orderId).single()).data!.delivery_status;
  const shipment = async () => (await admin.from("zr_shipments").select("*").eq("order_id", orderId).single()).data!;
  // D34: pieces this order holds outside the warehouse (qty 1): on road/delivered = 1, returned/not shipped = 0
  const held = async () =>
    ((await admin.from("stock_movements").select("delta").eq("order_id", orderId)).data ?? []).reduce((s, m) => s - m.delta, 0);

  async function reset() {
    await admin.from("zr_shipments").delete().eq("order_id", orderId);
    await admin.from("orders").update({ delivery_status: "wait_for_deposit" }).eq("id", orderId); // releases the piece
    await admin.from("webhook_events").delete().eq("workspace_id", ws).eq("provider", "zrexpress");
    parcel = crypto.randomUUID();
    await admin.from("zr_shipments").insert({ order_id: orderId, workspace_id: ws, parcel_id: parcel });
  }
  const setMap = (v: unknown) => admin.from("settings").upsert({ workspace_id: ws, key: "zr_state_map", value: v as never }, { onConflict: "workspace_id,key" });

  beforeAll(async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = URL;
    process.env.SUPABASE_SERVICE_ROLE_KEY = SERVICE_KEY;
    admin = createClient(URL!, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    ws = (await admin.from("workspaces").insert({ name: `zr-test-${crypto.randomUUID()}` }).select("id").single()).data!.id; // own workspace
    productId = (await admin.from("products").insert({ workspace_id: ws, name: `zr-test-${crypto.randomUUID()}` }).select("id").single()).data!.id;
    orderId = (await admin.from("orders").insert({ workspace_id: ws, product_id: productId, quantity: 1 }).select("id").single()).data!.id;
    await admin.from("integration_configs").upsert({ workspace_id: ws, provider: "zrexpress", config: {}, secret: SECRET, is_active: true });
  });
  afterAll(async () => {
    if (!admin) return;
    // the stock log is add-only: delete the order, then the product (movements follow by cascade)
    await admin.from("zr_shipments").delete().eq("order_id", orderId);
    await admin.from("orders").delete().eq("id", orderId);
    await admin.from("products").delete().eq("id", productId);
    await admin.from("webhook_events").delete().eq("workspace_id", ws);
    await admin.from("integration_configs").delete().eq("workspace_id", ws);
    await admin.from("settings").delete().eq("workspace_id", ws);
    expect((await admin.from("workspaces").delete().eq("id", ws)).error).toBeNull();
  });

  async function hook(body: unknown, id = `msg_${crypto.randomUUID()}`) {
    const raw = JSON.stringify(body);
    const ts = String(Math.floor(Date.now() / 1000));
    const sig = "v1," + createHmac("sha256", Buffer.from(SECRET.slice(6), "base64")).update(`${id}.${ts}.${raw}`).digest("base64");
    return processZRWebhook(new Request("http://x/api/webhooks/zrexpress", { method: "POST", body: raw, headers: { "svix-id": id, "svix-timestamp": ts, "svix-signature": sig } }));
  }
  const stateEvt = (name: string, at: string, over: Record<string, unknown> = {}) => ({
    eventType: "parcel.state.updated", occurredAt: at, data: { id: parcel, state: { name }, lastStateUpdateAt: at, ...over },
  });

  test("B-RPC/A-RPC/A-order/B-order interleaving ends on the newest state with one stock movement", async () => {
    await setMap(MAP);
    await reset();
    // A = older (livre @10), B = newer (en transit @20); every interleaving of the RPC calls
    await Promise.all([rpc("Livre", T(10)), rpc("En Transit", T(20))]);
    expect((await shipment()).state).toBe("En Transit");
    expect(await order()).toBe("in_transit");
    expect(await held()).toBeLessThanOrEqual(1);
    // returned (restocks) -> in_transit -> stale returned -> returned again
    await reset();
    await rpc("Retour", T(10));
    await rpc("En Transit", T(20));
    await rpc("Retour", T(15)); // stale: ignored, order stays on the STORED state
    expect(await order()).toBe("in_transit");
    await rpc("Retour", T(30));
    expect(await order()).toBe("returned");
    expect(await held()).toBe(0); // two returned transitions net nothing
  });

  test("returned -> admin sets delivered -> same-timestamp apply leaves delivered, stock once", async () => {
    await setMap(MAP);
    await reset();
    await rpc("Retour", T(10));
    await admin.from("orders").update({ delivery_status: "delivered" }).eq("id", orderId);
    await rpc("Retour", T(10));
    expect(await order()).toBe("delivered");
    expect(await held()).toBe(1); // delivered is out of the warehouse, once
  });

  test("shopify/lightfunnels redelivery of the same external_id is not blocked by the zr index", async () => {
    const row = { workspace_id: ws, provider: "shopify", external_id: "dup_1", payload: {}, processed_at: new Date().toISOString() };
    await admin.from("webhook_events").delete().eq("external_id", "dup_1");
    expect((await admin.from("webhook_events").insert(row)).error).toBeNull();
    expect((await admin.from("webhook_events").insert(row)).error).toBeNull();
    await admin.from("webhook_events").delete().eq("external_id", "dup_1");
  });

  test("returned -> stale -> returned moves stock once", async () => {
    await setMap(MAP);
    await reset();
    await rpc("Retour", T(10));
    await rpc("En Transit", T(5)); // stale
    await rpc("Retour", T(10)); // same ts, idempotent
    await rpc("Retour", T(11));
    expect(await order()).toBe("returned");
    expect(await held()).toBe(0);
  });

  test("live tie (different state) is applied and converges; same-state replay is a no-op; stock counted", async () => {
    await setMap(MAP);
    await reset();
    await rpc("En Transit", T(10));
    await rpc("Retour", T(10), { p_live: true }); // same ts, different state, live read
    expect((await shipment()).state).toBe("Retour");
    expect(await order()).toBe("returned");
    expect(await held()).toBe(0);
    await admin.from("orders").update({ delivery_status: "delivered" }).eq("id", orderId);
    await rpc("Retour", T(10), { p_live: true }); // same-state replay: admin correction survives
    await rpc(" RETOUR ", T(10), { p_live: true }); // case/whitespace variant is the same state
    expect(await order()).toBe("delivered");
    await applyZRParcelState(admin as never, ws, { id: parcel, live: true, state: { name: "retour" }, stateAt: T(10) });
    expect(await order()).toBe("delivered");
    expect(await held()).toBe(1);
  });

  test("tie with a different state is ignored for non-live (webhook) callers", async () => {
    await setMap(MAP);
    await reset();
    await rpc("En Transit", T(10));
    await rpc("Retour", T(10)); // p_live defaults false
    expect((await shipment()).state).toBe("En Transit");
    expect(await order()).toBe("in_transit");
    expect(await held()).toBe(1);
    await applyZRParcelState(admin as never, ws, { id: parcel, state: { name: "Retour" }, stateAt: T(10) }); // live omitted
    expect((await shipment()).state).toBe("En Transit");
  });

  test("webhook tie with different mapped state is ignored", async () => {
    await setMap(MAP);
    await reset();
    expect((await hook(stateEvt("En Transit", T(10)))).status).toBe(200);
    expect((await hook(stateEvt("Livre", T(10)))).status).toBe(200);
    expect((await shipment()).state).toBe("En Transit");
    expect(await order()).toBe("in_transit");
  });

  test("returned -> late delivered (webhook, same ts, ignored) -> poll returned: piece back once", async () => {
    await setMap(MAP);
    await reset();
    expect((await hook(stateEvt("Retour", T(10)))).status).toBe(200);
    expect(await held()).toBe(0);
    expect((await hook(stateEvt("Livre", T(10)))).status).toBe(200); // late, same ts
    expect(await order()).toBe("returned");
    await applyZRParcelState(admin as never, ws, { id: parcel, live: true, state: { name: "Retour" }, stateAt: T(10) });
    expect(await order()).toBe("returned");
    expect(await held()).toBe(0);
  });

  test("webhook timestamps: occurredAt alone is the fallback; neither -> 400", async () => {
    await setMap(MAP);
    await reset();
    const evt = { eventType: "parcel.state.updated", occurredAt: T(7), data: { id: parcel, state: { name: "En Transit" } } };
    expect((await hook(evt)).status).toBe(200);
    expect(new Date((await shipment()).occurred_at!).toISOString()).toBe(T(7));
    expect((await hook({ eventType: "parcel.state.updated", data: { id: parcel, state: { name: "Livre" } } })).status).toBe(400);
    expect((await shipment()).state).toBe("En Transit");
  });

  test("apply without a parcel timestamp throws instead of skipping", async () => {
    await expect(applyZRParcelState(admin as never, ws, { id: parcel, state: { name: "Livre" } })).rejects.toThrow(/lastStateUpdateAt/);
  });

  test("null occurred raises; null state does not wipe state; situation does not block a late state event", async () => {
    await setMap(MAP);
    await reset();
    expect((await rpc("Livre", null)).error).not.toBeNull();
    await rpc("En Transit", T(10));
    await rpc(null, T(50), { p_situation: "waiting_client", p_is_return: true });
    const s = await shipment();
    expect(s.state).toBe("En Transit");
    expect(s.situation).toBe("waiting_client");
    expect(s.is_return).toBe(true);
    await rpc("Livre", T(20)); // state ts 20 < situation ts 50, still applies
    expect((await shipment()).state).toBe("Livre");
    expect(await order()).toBe("delivered");
  });

  test("unmapped state stores shipment, leaves order untouched", async () => {
    await setMap(MAP);
    await reset();
    await rpc("Mystery", T(10));
    expect((await shipment()).state).toBe("Mystery");
    expect(await order()).toBe("wait_for_deposit");
  });

  test("default map applies only when the workspace never configured one", async () => {
    await admin.from("settings").delete().eq("workspace_id", ws).eq("key", "zr_state_map");
    await reset();
    await rpc("Recouvert", T(10));
    expect(await order()).toBe("delivered");
    await setMap(MAP);
  });

  test("webhook: eventType envelope, offset timestamps, missing timestamp -> 400", async () => {
    await setMap(MAP);
    await reset();
    const off = "2026-01-01T13:00:00+01:00"; // = 12:00Z
    expect((await hook(stateEvt("En Transit", off))).status).toBe(200);
    expect((await shipment()).state).toBe("En Transit");
    expect(new Date((await shipment()).occurred_at!).toISOString()).toBe(T(0));
    expect(await order()).toBe("in_transit");
    // legacy `type` key accepted too
    const legacy = { type: "parcel.state.updated", data: { id: parcel, state: { name: "Livre" }, lastStateUpdateAt: T(5) } };
    expect((await hook(legacy)).status).toBe(200);
    expect(await order()).toBe("delivered");
    // invalid occurredAt falls back to lastStateUpdateAt; none at all -> 400
    expect((await hook({ ...stateEvt("Retour", T(9)), occurredAt: "garbage" })).status).toBe(200);
    expect((await hook({ eventType: "parcel.state.updated", data: { id: parcel, state: { name: "Livre" } } })).status).toBe(400);
  });

  test("webhook: out-of-order ignored; same svix-id twice is a duplicate", async () => {
    await setMap(MAP);
    await reset();
    expect((await hook(stateEvt("Livre", T(20)))).status).toBe(200);
    expect((await hook(stateEvt("En Transit", T(10)))).status).toBe(200); // older
    expect((await shipment()).state).toBe("Livre");
    expect(await order()).toBe("delivered");
    const evt = stateEvt("Retour", T(30));
    await hook(evt, "msg_dup");
    const again = await (await hook(evt, "msg_dup")).json();
    expect(again.duplicate).toBe(true);
    const { data: ev } = await admin.from("webhook_events").select("id").eq("workspace_id", ws).eq("external_id", "msg_dup");
    expect(ev!.length).toBe(1);
  });

  test("webhook: failed apply is not marked processed and a same-svix-id retry still applies", async () => {
    await setMap({ map: { livre: "not_a_status" } }); // cast fails inside the RPC
    await reset();
    const evt = stateEvt("Livre", T(10));
    expect((await hook(evt, "msg_retry")).status).toBe(500);
    const { data: ev } = await admin.from("webhook_events").select("processed_at, error").eq("external_id", "msg_retry").single();
    expect(ev!.processed_at).toBeNull();
    await setMap(MAP);
    expect((await hook(evt, "msg_retry")).status).toBe(200);
    expect(await order()).toBe("delivered");
    const { data: ev2 } = await admin.from("webhook_events").select("processed_at").eq("external_id", "msg_retry");
    expect(ev2!.length).toBe(1);
    expect(ev2![0].processed_at).not.toBeNull();
  });

  test("applyZRParcelState (refresh/cron path) uses the parcel timestamp: stale refresh is a no-op", async () => {
    await setMap(MAP);
    await reset();
    await applyZRParcelState(admin as never, ws, { id: parcel, state: { name: "Livre" }, stateAt: T(20) });
    await applyZRParcelState(admin as never, ws, { id: parcel, state: { name: "En Transit" }, stateAt: T(10) });
    expect((await shipment()).state).toBe("Livre");
    expect(await order()).toBe("delivered");
    await applyZRParcelState(admin as never, ws, { id: parcel, state: null, stateAt: T(40) }); // null state: no wipe
    expect((await shipment()).state).toBe("Livre");
  });
});
