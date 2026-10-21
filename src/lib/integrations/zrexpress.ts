/**
 * ZR Express delivery-company API client (https://docs.zrexpress.app).
 * Outbound only from here: push a confirmed order as a parcel, fetch a
 * parcel's tracking number/state, sync the wilaya/commune territory tree,
 * register the status webhook. Server-only — credentials come from
 * `integration_configs` (provider='zrexpress'), never exposed to the client.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

const PROD_BASE = "https://api.zrexpress.app/api/v1";

export type ZRCredentials = { tenantId: string; apiKey: string };

export class ZRExpressError extends Error {}

/** `catch (e) { error: zrErrorMessage(e, "fallback") }` — the one line every ZR call site needs. */
export function zrErrorMessage(e: unknown, fallback: string): string {
  return e instanceof ZRExpressError ? e.message : fallback;
}

/** Reads tenant ID + API key from `integration_configs`. Throws with a UI-safe message if unset. */
export async function getZRCredentials(
  supabase: SupabaseClient<Database>,
  workspaceId: string,
): Promise<ZRCredentials> {
  const { data } = await supabase
    .from("integration_configs")
    .select("config")
    .eq("workspace_id", workspaceId)
    .eq("provider", "zrexpress")
    .maybeSingle();
  const config = (data?.config as { tenant_id?: string; api_key?: string } | null) ?? {};
  if (!config.tenant_id || !config.api_key) {
    throw new ZRExpressError("Set ZR Express's tenant ID and API key in Settings first.");
  }
  return { tenantId: config.tenant_id, apiKey: config.api_key };
}

/** Per-call so tests can set ZR_API_BASE. Any zrexpress.app host is reachable only from a
 * real production deploy (VERCEL_ENV=production; self-hosted prod must set ZR_ALLOW_PROD=1) —
 * a local `next start`, e2e run or preview sharing the prod DB must never ship real parcels. */
function zrBaseUrl(): string {
  const base = process.env.ZR_API_BASE || PROD_BASE;
  let u: URL;
  try {
    u = new URL(base);
  } catch {
    throw new ZRExpressError("ZR_API_BASE is not a valid URL");
  }
  const host = u.hostname.toLowerCase().replace(/\.$/, "");
  const loopback = host === "localhost" || host === "127.0.0.1";
  if (u.protocol !== "https:" && !(loopback && u.protocol === "http:")) {
    throw new ZRExpressError("ZR_API_BASE must be https (or http on localhost)");
  }
  const isProd = process.env.VERCEL ? process.env.VERCEL_ENV === "production" : process.env.ZR_ALLOW_PROD === "1";
  if ((host === "zrexpress.app" || host.endsWith(".zrexpress.app")) && !isProd) {
    throw new ZRExpressError("ZR prod API blocked outside production; set ZR_API_BASE");
  }
  return base.replace(/\/+$/, "");
}

async function zrFetch<T>(creds: ZRCredentials, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${zrBaseUrl()}${path}`, {
    ...init,
    headers: {
      "X-Tenant": creds.tenantId,
      "X-Api-Key": creds.apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...init.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new ZRExpressError(`ZR Express ${init.method ?? "GET"} ${path} → ${res.status}: ${body.slice(0, 500)}`);
  }
  return res.json() as Promise<T>;
}

/** Algeria local `0XXXXXXXXX` (as `normalize_dz_phone()` stores it) → `+213XXXXXXXXX`. */
export function toInternationalDzPhone(local: string): string {
  const digits = local.replace(/\D/g, "");
  return digits.startsWith("0") ? `+213${digits.slice(1)}` : `+213${digits}`;
}

// ---------------------------------------------------------------------------
// Territories (wilaya/commune tree — cached locally in zr_territories)
// ---------------------------------------------------------------------------
export type ZRTerritory = {
  id: string;
  code: number | null;
  name: string;
  level: "wilaya" | "commune";
  parentId: string | null;
};

type TerritorySearchResponse = {
  items: { id: string; code: number | null; name: string; level: string; parentId: string | null }[];
  hasNext: boolean;
};

/** Pages through every territory ZR knows about — a few hundred rows, fine to hold in memory. */
export async function searchZRTerritories(creds: ZRCredentials): Promise<ZRTerritory[]> {
  const all: ZRTerritory[] = [];
  let pageNumber = 1;
  const pageSize = 500;
  for (;;) {
    const data = await zrFetch<TerritorySearchResponse>(creds, "/territories/search", {
      method: "POST",
      body: JSON.stringify({ pageNumber, pageSize }),
    });
    for (const it of data.items) {
      if (it.level === "wilaya" || it.level === "commune") {
        all.push({ id: it.id, code: it.code, name: it.name, level: it.level, parentId: it.parentId });
      }
    }
    if (!data.hasNext || data.items.length === 0) break;
    pageNumber += 1;
  }
  return all;
}

// ---------------------------------------------------------------------------
// Parcels
// ---------------------------------------------------------------------------
export type CreateParcelInput = {
  customerName: string;
  phone: string; // international format, see toInternationalDzPhone
  cityTerritoryId: string;
  districtTerritoryId: string;
  street: string | null;
  productName: string;
  quantity: number;
  unitPrice: number;
  description: string;
  amount: number;
  /** our order id — lets us find the ZR parcel from our side without another lookup */
  externalId: string;
  /** stop-desk hub (pickup point); omit for home delivery */
  hubId?: string | null;
};

/** `hubId` set → stop-desk parcel (`deliveryType: "pickup-point"`, ZR requires
 * the hub); otherwise home delivery. Schema: docs.zrexpress.app createparcelendpoint. */
export async function createZRParcel(creds: ZRCredentials, input: CreateParcelInput): Promise<{ id: string }> {
  return zrFetch<{ id: string }>(creds, "/parcels", {
    method: "POST",
    body: JSON.stringify({
      customer: {
        customerId: crypto.randomUUID(),
        name: input.customerName,
        phone: { number1: input.phone },
      },
      deliveryAddress: {
        cityTerritoryId: input.cityTerritoryId,
        districtTerritoryId: input.districtTerritoryId,
        street: input.street ?? undefined,
      },
      orderedProducts: [
        {
          productName: input.productName,
          unitPrice: input.unitPrice,
          quantity: input.quantity,
          stockType: "none",
        },
      ],
      deliveryType: input.hubId ? "pickup-point" : "home",
      hubId: input.hubId ?? undefined,
      description: input.description,
      amount: input.amount,
      externalId: input.externalId,
    }),
  });
}

export type ZRParcel = {
  id: string;
  trackingNumber: string | null;
  state: { name: string } | null;
  externalId?: string | null;
};

/** Idempotency lookup: the parcel we already created for this order (externalId = order id), if any.
 * Only an item whose externalId matches is returned — a filter ZR ignores must never make us adopt
 * somebody else's parcel. */
export async function findZRParcelByExternalId(creds: ZRCredentials, externalId: string): Promise<ZRParcel | null> {
  // ponytail: filter field name unverified against a live tenant — confirm with zr-probe.
  const res = await zrFetch<{ items?: ZRParcel[] }>(creds, "/parcels/search", {
    method: "POST",
    body: JSON.stringify({
      pageNumber: 1,
      pageSize: 20,
      advancedFilter: { logic: "AND", filters: [{ field: "externalId", operator: "eq", value: externalId }] },
    }),
  });
  return res.items?.find((p) => p.externalId === externalId) ?? null;
}

export async function getZRParcel(creds: ZRCredentials, id: string): Promise<ZRParcel> {
  return zrFetch<ZRParcel>(creds, `/parcels/${id}`);
}

// ---------------------------------------------------------------------------
// Webhook endpoint registration (Svix-signed — see zrexpress-webhook.ts)
// ---------------------------------------------------------------------------
export async function createZRWebhookEndpoint(
  creds: ZRCredentials,
  callbackUrl: string,
): Promise<{ id: string; secret: string }> {
  const created = await zrFetch<{ id: string }>(creds, "/webhooks/endpoints", {
    method: "POST",
    body: JSON.stringify({
      url: callbackUrl,
      eventTypes: ["parcel.state.updated"],
      description: "MNW ERP",
    }),
  });
  const { secret } = await zrFetch<{ secret: string }>(creds, `/webhooks/endpoints/${created.id}/secret`);
  return { id: created.id, secret };
}

// ---------------------------------------------------------------------------
// Hubs (stop-desk pickup points) — POST /hubs/search
// ---------------------------------------------------------------------------
export type ZRHub = { id: string; name: string | null; cityTerritoryId: string | null };

type HubSearchResponse = {
  items: { id: string; name: string | null; address?: { cityTerritoryId?: string | null } | null }[];
  hasNext?: boolean;
};

/** Hubs in one wilaya (ZR "city" territory), for the stop-desk picker. */
export async function searchZRHubs(creds: ZRCredentials, cityTerritoryId: string): Promise<ZRHub[]> {
  const res = await zrFetch<HubSearchResponse>(creds, "/hubs/search", {
    method: "POST",
    body: JSON.stringify({ pageNumber: 1, pageSize: 1000 }),
  });
  return res.items
    .map((h) => ({ id: h.id, name: h.name, cityTerritoryId: h.address?.cityTerritoryId ?? null }))
    .filter((h) => h.cityTerritoryId === cityTerritoryId);
}

// ---------------------------------------------------------------------------
// Delivery rates — GET /delivery-pricing/rates (supplier price > price list)
// ---------------------------------------------------------------------------
export type ZRRate = { territoryCode: number | null; level: string | null; home: number | null; stopdesk: number | null };

type RatesResponse = {
  rates:
    | {
        toTerritoryCode: number | null;
        toTerritoryLevel: string | null;
        deliveryPrices: { deliveryType: string | null; price: number }[] | null;
      }[]
    | null;
};

/** deliveryType values aren't enumerated in ZR's spec — match "home" and
 * "pickup-point" (or anything desk/pickup-like) case-insensitively. */
export async function getZRRates(creds: ZRCredentials): Promise<ZRRate[]> {
  const res = await zrFetch<RatesResponse>(creds, "/delivery-pricing/rates");
  return (res.rates ?? []).map((r) => {
    const price = (re: RegExp) => r.deliveryPrices?.find((p) => p.deliveryType && re.test(p.deliveryType))?.price ?? null;
    return { territoryCode: r.toTerritoryCode, level: r.toTerritoryLevel, home: price(/home/i), stopdesk: price(/pickup|desk|stop/i) };
  });
}
