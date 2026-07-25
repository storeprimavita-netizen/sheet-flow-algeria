import { lightfunnelProvider, processWebhook } from "@/lib/webhook";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<Response> {
  return processWebhook(lightfunnelProvider, req);
}
