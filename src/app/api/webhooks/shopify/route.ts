import { processWebhook, shopifyProvider } from "@/lib/webhook";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<Response> {
  return processWebhook(shopifyProvider, req);
}
