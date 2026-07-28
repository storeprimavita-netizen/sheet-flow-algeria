/**
 * ZR Express delivery-company API client (https://docs.zrexpress.app).
 * Outbound only from here: push a confirmed order as a parcel, fetch a
 * parcel's tracking number/state, sync the wilaya/commune territory tree,
 * register the status webhook. Server-only — credentials come from
 * `integration_configs` (provider='zrexpress'), never exposed to the client.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

const BASE_URL = "https://api.zrexpress.app/api/v1";

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

async function zrFetch<T>(creds: ZRCredentials, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
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
};

/** Only `deliveryType: "home"` is supported — stop-desk needs a ZR hub picker, not built yet. */
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
      deliveryType: "home",
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
};

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
