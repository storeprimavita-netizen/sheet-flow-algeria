// Server-only Google Sheets client using JWT + Web Crypto (Worker-compatible).
// Do NOT import this file from client code.

const SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";

interface CachedToken {
  token: string;
  expiresAt: number;
}
let cached: CachedToken | null = null;

function b64url(input: ArrayBuffer | string): string {
  const bytes =
    typeof input === "string"
      ? new TextEncoder().encode(input)
      : new Uint8Array(input);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const clean = pem
    .replace(/\\n/g, "\n")
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const bin = atob(clean);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

async function getAccessToken(): Promise<string> {
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;
  if (!email || !privateKey) {
    throw new Error("Google Sheets credentials not configured");
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: email,
    scope: SCOPE,
    aud: TOKEN_URL,
    exp: now + 3600,
    iat: now,
  };
  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claim))}`;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(privateKey),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  const jwt = `${unsigned}.${b64url(sig)}`;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) {
    throw new Error(`Token request failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cached = {
    token: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
  return cached.token;
}

function extractSheetId(raw: string): string {
  const trimmed = raw.trim();
  // Match /spreadsheets/d/<ID> in a full Google Sheets URL
  const m = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (m) return m[1];
  // Strip any stray query/path suffix like /edit?gid=0
  return trimmed.split("/")[0].split("?")[0];
}

function getSheetId(): string {
  const id = process.env.GOOGLE_SHEETS_ID;
  if (!id) throw new Error("GOOGLE_SHEETS_ID not configured");
  return extractSheetId(id);
}

async function api<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`${SHEETS_API}/${getSheetId()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Sheets API ${res.status}: ${text}`);
  }
  return (await res.json()) as T;
}

export async function readRange(range: string): Promise<string[][]> {
  const data = await api<{ values?: string[][] }>(`/values/${encodeURIComponent(range)}`);
  return data.values || [];
}

export async function appendRow(range: string, row: (string | number)[]): Promise<void> {
  await api(
    `/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: "POST",
      body: JSON.stringify({ values: [row] }),
    },
  );
}

export async function updateRange(range: string, values: (string | number)[][]): Promise<void> {
  await api(`/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`, {
    method: "PUT",
    body: JSON.stringify({ values }),
  });
}

export async function batchGet(ranges: string[]): Promise<Record<string, string[][]>> {
  const params = ranges.map((r) => `ranges=${encodeURIComponent(r)}`).join("&");
  const data = await api<{ valueRanges: { range: string; values?: string[][] }[] }>(
    `/values:batchGet?${params}`,
  );
  const out: Record<string, string[][]> = {};
  data.valueRanges.forEach((vr, i) => {
    out[ranges[i]] = vr.values || [];
  });
  return out;
}

// Helpers for typed parsing
export function num(v: string | undefined, fallback = 0): number {
  if (v === undefined || v === "" || v === null) return fallback;
  const n = Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : fallback;
}

export function nextId(prefix: string, existing: string[]): string {
  let max = 0;
  for (const id of existing) {
    const m = String(id).match(/(\d+)$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}
