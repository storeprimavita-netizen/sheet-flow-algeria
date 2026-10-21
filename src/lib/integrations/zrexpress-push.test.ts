import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { pushToZR } from "./zrexpress-push";
import { findZRParcelByExternalId } from "./zrexpress";

const creds = { tenantId: "t", apiKey: "k" };
let server: Server;
let parcels: { id: string; externalId: string }[];
let creates: number;
let searchFails: boolean;
let ignoreFilter: boolean; // simulates ZR silently ignoring an unknown filter

beforeAll(async () => {
  server = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const send = (code: number, o: unknown) => {
        res.writeHead(code, { "Content-Type": "application/json" });
        res.end(JSON.stringify(o));
      };
      if (req.url === "/parcels/search") {
        if (searchFails) return send(500, {});
        const v = JSON.parse(body).advancedFilter.filters[0].value;
        return send(200, { items: parcels.filter((p) => ignoreFilter || p.externalId === v).map((p) => ({ ...p, trackingNumber: "TRK", state: { name: "new" } })) });
      }
      if (req.url === "/parcels" && req.method === "POST") {
        creates++;
        const p = { id: `p${creates}`, externalId: JSON.parse(body).externalId };
        parcels.push(p);
        return send(200, { id: p.id });
      }
      if (req.url?.startsWith("/parcels/")) return send(200, { id: "x", trackingNumber: "TRK", state: { name: "new" } });
      send(404, {});
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
});
afterAll(() => server.close());
beforeEach(() => {
  parcels = [];
  creates = 0;
  searchFails = false;
  ignoreFilter = false;
  vi.unstubAllEnvs();
  process.env.ZR_API_BASE = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

// Chainable stub: filters return the builder, terminal calls resolve per table.
function fakeSupabase(insertError: { code?: string; message: string } | null) {
  const tables: Record<string, unknown> = {
    orders: {
      id: "o1", confirmation_status: "confirmed", wilaya_code: 16, delivery_type: "home", commune: "Bab",
      customer_phone: "0555000000", customer_name: "A", address: "x", quantity: 1, sale_price: 100,
      delivery_fee: 0, product: { name: "P" },
    },
    zr_shipments: null,
    integration_configs: { config: { tenant_id: "t", api_key: "k" } },
  };
  const inserts: unknown[] = [];
  const from = (t: string) => {
    const q: Record<string, unknown> = {};
    q.select = () => q;
    q.eq = () => q;
    q.maybeSingle = async () => ({ data: t === "zr_territories" ? { id: "w1" } : (tables[t] ?? null) });
    if (t === "zr_territories") {
      // commune list is awaited after .eq(): make the builder thenable
      q.then = (ok: (v: unknown) => unknown) => ok({ data: [{ id: "c1", name: "Bab" }] });
    }
    q.insert = async (row: unknown) => {
      inserts.push(row);
      return { error: insertError };
    };
    return q;
  };
  return { client: { from } as never, inserts };
}

describe("zr base guard", () => {
  const blocked = async (base: string | undefined, env: Record<string, string> = {}) => {
    vi.unstubAllEnvs();
    for (const k of ["VERCEL", "VERCEL_ENV", "ZR_ALLOW_PROD", "NODE_ENV"]) vi.stubEnv(k, "");
    for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
    if (base === undefined) delete process.env.ZR_API_BASE;
    else process.env.ZR_API_BASE = base;
    const calls: string[] = [];
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation((async (u: string) => (calls.push(String(u)), new Response("{}"))) as typeof fetch);
    try {
      let err: unknown = null;
      await findZRParcelByExternalId(creds, "o1").catch((e) => (err = e));
      return { err, calls };
    } finally {
      spy.mockRestore();
    }
  };

  it("blocks the prod URL (and spelling variants) outside production, with no network call", async () => {
    for (const base of [
      undefined,
      "https://api.zrexpress.app/api/v1/",
      "https://API.zrexpress.app/api/v1",
      "https://api.zrexpress.app:443/api/v1",
      "https://api.zrexpress.app./api/v1",
    ]) {
      const { err, calls } = await blocked(base);
      expect(String(err), String(base)).toMatch(/blocked outside production/);
      expect(calls).toEqual([]);
    }
  });

  it("blocks preview deploys and local `next start` (NODE_ENV=production without VERCEL)", async () => {
    expect(String((await blocked(undefined, { VERCEL: "1", VERCEL_ENV: "preview", NODE_ENV: "production" })).err)).toMatch(/blocked/);
    expect(String((await blocked(undefined, { NODE_ENV: "production" })).err)).toMatch(/blocked/);
  });

  it("blocks when only env vars say production but NODE_ENV does not (pulled prod env on a laptop), and preview+ZR_ALLOW_PROD", async () => {
    expect(String((await blocked(undefined, { VERCEL: "1", VERCEL_ENV: "production", NODE_ENV: "development" })).err)).toMatch(/blocked/);
    expect(String((await blocked(undefined, { ZR_ALLOW_PROD: "1", NODE_ENV: "development" })).err)).toMatch(/blocked/);
    expect(String((await blocked(undefined, { VERCEL: "1", VERCEL_ENV: "preview", ZR_ALLOW_PROD: "1", NODE_ENV: "production" })).err)).toMatch(/blocked/);
  });

  it("allows the prod URL only on a real production deploy (or explicit ZR_ALLOW_PROD)", async () => {
    for (const env of [
      { VERCEL: "1", VERCEL_ENV: "production", NODE_ENV: "production" },
      { ZR_ALLOW_PROD: "1", NODE_ENV: "production" },
    ] as Record<string, string>[]) {
      const { err, calls } = await blocked(undefined, env);
      expect(err).toBeNull();
      expect(calls[0]).toMatch(/^https:\/\/api\.zrexpress\.app\/api\/v1\/parcels\/search$/);
    }
  });

  it("rejects non-https non-local and invalid URLs with a ZRExpressError", async () => {
    expect(String((await blocked("http://evil.example.com")).err)).toMatch(/https/);
    expect(String((await blocked("file://localhost/x")).err)).toMatch(/https/);
    expect(String((await blocked("not a url")).err)).toMatch(/valid URL/);
  });
});

describe("pushToZR", () => {
  it("push creates exactly one parcel and inserts shipment", async () => {
    const { client, inserts } = fakeSupabase(null);
    expect(await pushToZR(client, "w", "o1")).toEqual({ ok: true });
    expect(creates).toBe(1);
    expect(inserts).toHaveLength(1);
  });

  it("push insert failure leaves orphan; retry adopts parcel by externalId, create endpoint hit once total", async () => {
    const r1 = await pushToZR(fakeSupabase({ message: "boom" }).client, "w", "o1");
    expect(r1.ok).toBe(false);
    const good = fakeSupabase(null);
    expect(await pushToZR(good.client, "w", "o1")).toEqual({ ok: true });
    expect(creates).toBe(1);
    expect(good.inserts[0]).toMatchObject({ parcel_id: "p1" });
  });

  it("push aborts without creating when externalId lookup fails (5xx)", async () => {
    searchFails = true;
    const r = await pushToZR(fakeSupabase(null).client, "w", "o1");
    expect(r.ok).toBe(false);
    expect(creates).toBe(0);
  });

  it('duplicate insert 23505 returns "already sent"', async () => {
    const r = await pushToZR(fakeSupabase({ code: "23505", message: "dup" }).client, "w", "o1");
    expect(r).toMatchObject({ ok: false, error: expect.stringContaining("already sent") });
  });

  it("never adopts a parcel whose externalId differs (ZR ignoring the filter)", async () => {
    parcels.push({ id: "other", externalId: "someone-else" });
    ignoreFilter = true;
    const good = fakeSupabase(null);
    expect(await pushToZR(good.client, "w", "o1")).toEqual({ ok: true });
    expect(creates).toBe(1);
    expect(good.inserts[0]).toMatchObject({ parcel_id: "p1" });
  });

  it("logs the orphan parcel id when a create loses the insert race (23505)", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    await pushToZR(fakeSupabase({ code: "23505", message: "dup" }).client, "w", "o1");
    expect(err).toHaveBeenCalledWith(expect.stringContaining("duplicate parcel"), "p1", "order", "o1");
    err.mockRestore();
  });

  it("only ever talks to the local mock (no real network)", async () => {
    const urls: string[] = [];
    const real = globalThis.fetch;
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation(((u: string, i?: RequestInit) => (urls.push(String(u)), real(u, i))) as typeof fetch);
    await pushToZR(fakeSupabase(null).client, "w", "o1");
    spy.mockRestore();
    expect(urls.length).toBeGreaterThan(0);
    expect(urls.every((u) => u.startsWith("http://127.0.0.1:"))).toBe(true);
  });

  it("never follows a redirect (a 307 to the real API must not carry our key)", async () => {
    const real = globalThis.fetch;
    const seen: (RequestRedirect | undefined)[] = [];
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation(((u: string, i?: RequestInit) => (seen.push(i?.redirect), real(u, i))) as typeof fetch);
    await pushToZR(fakeSupabase(null).client, "w", "o1");
    spy.mockRestore();
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((r) => r === "error")).toBe(true);
  });

  it("insert error without a code reports the parcel id so it can be linked", async () => {
    const r = await pushToZR(fakeSupabase({ message: "boom" }).client, "w", "o1");
    expect(r).toMatchObject({ ok: false, error: expect.stringContaining("p1") });
  });

  it("search items without externalId are never adopted (retry would create — fail-closed until zr-probe confirms the field)", async () => {
    parcels.push({ id: "noext", externalId: undefined as unknown as string });
    ignoreFilter = true;
    await pushToZR(fakeSupabase(null).client, "w", "o1");
    expect(creates).toBe(1);
  });
});
