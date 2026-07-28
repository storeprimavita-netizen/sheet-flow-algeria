import { processZRWebhook } from "@/lib/integrations/zrexpress-webhook";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<Response> {
  return processZRWebhook(req);
}
