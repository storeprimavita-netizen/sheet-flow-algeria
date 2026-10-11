import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import { verifyZRWebhookSignature } from "./zrexpress-webhook";

const A = "whsec_" + Buffer.from("workspace-a-secret").toString("base64");
const B = "whsec_" + Buffer.from("workspace-b-secret").toString("base64");

function sign(secret: string, id: string, ts: string, body: string) {
  const key = Buffer.from(secret.slice(6), "base64");
  return "v1," + createHmac("sha256", key).update(`${id}.${ts}.${body}`).digest("base64");
}

describe("verifyZRWebhookSignature (15f tenant selection relies on this)", () => {
  const body = '{"type":"parcel.state.updated"}';
  const now = String(Math.floor(Date.now() / 1000));

  it("accepts the signing workspace's secret, rejects another tenant's", () => {
    const headers = { id: "msg_1", timestamp: now, signature: sign(A, "msg_1", now, body) };
    expect(verifyZRWebhookSignature(A, body, headers)).toBe(true);
    expect(verifyZRWebhookSignature(B, body, headers)).toBe(false);
  });

  it("rejects a tampered body and a stale timestamp", () => {
    const headers = { id: "msg_1", timestamp: now, signature: sign(A, "msg_1", now, body) };
    expect(verifyZRWebhookSignature(A, body + " ", headers)).toBe(false);
    const old = String(Math.floor(Date.now() / 1000) - 600);
    expect(verifyZRWebhookSignature(A, body, { id: "msg_1", timestamp: old, signature: sign(A, "msg_1", old, body) })).toBe(false);
  });

  it("accepts any matching entry in a rotated multi-signature header", () => {
    const sig = sign(A, "msg_2", now, body);
    expect(verifyZRWebhookSignature(A, body, { id: "msg_2", timestamp: now, signature: `v1,AAAA ${sig}` })).toBe(true);
  });
});
