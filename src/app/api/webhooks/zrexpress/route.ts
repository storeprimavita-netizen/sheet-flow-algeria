import { markStorePublicStale } from "@/lib/store/invalidate";
import { processZRWebhook } from "@/lib/integrations/zrexpress-webhook";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<Response> {
  const res = await processZRWebhook(req);
  if (res.ok) markStorePublicStale(); // a delivery state change can move stock
  return res;
}
