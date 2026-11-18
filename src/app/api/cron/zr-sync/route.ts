import { getZRCredentials, getZRParcel } from "@/lib/integrations/zrexpress";
import { applyZRParcelState } from "@/lib/integrations/zrexpress-webhook";
import { markStorePublicStale } from "@/lib/store/invalidate";
import { cronAuthorized } from "@/lib/cron-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { jsonResponse } from "@/lib/utils";

export const runtime = "nodejs";
export const maxDuration = 300;

const PER_WORKSPACE_CAP = 100;

/**
 * Vercel Cron (GET). Catch-up for missed webhooks: polls every parcel whose raw
 * ZR state is not terminal (recouvert / recupere_par_fournisseur). livre and
 * encaisse are still polled so ZR-4 can see money move.
 */
export async function GET(req: Request): Promise<Response> {
  if (!cronAuthorized(req.headers.get("authorization"))) return jsonResponse({ error: "unauthorized" }, 401);

  const admin = await createAdminClient();
  const { data: configs } = await admin
    .from("integration_configs")
    .select("workspace_id")
    .eq("provider", "zrexpress")
    .eq("is_active", true);

  let polled = 0;
  let failed = 0;
  // shuffle so a slow/failing workspace can't permanently starve the later ones when maxDuration hits
  const order = [...(configs ?? [])].sort(() => Math.random() - 0.5);
  for (const { workspace_id: ws } of order) {
    try {
      const creds = await getZRCredentials(admin, ws);
      const { data: rows } = await admin
        .from("zr_shipments")
        .select("parcel_id")
        .eq("workspace_id", ws)
        .or("state.is.null,and(state.not.ilike.recouvert,state.not.ilike.recupere_par_fournisseur)")
        .order("last_synced_at", { ascending: true, nullsFirst: true })
        .limit(PER_WORKSPACE_CAP);
      for (const { parcel_id } of rows ?? []) {
        try {
          const p = await getZRParcel(creds, parcel_id);
          await applyZRParcelState(admin, ws, {
            id: parcel_id,
            live: true,
            state: p.state,
            situation: p.situation?.slug ?? p.situation?.name,
            isReturn: p.isReturn,
            stateAt: p.lastStateUpdateAt ? new Date(p.lastStateUpdateAt).toISOString() : undefined,
          });
          await admin
            .from("zr_shipments")
            .update({ tracking_number: p.trackingNumber, last_synced_at: new Date().toISOString() })
            .eq("workspace_id", ws)
            .eq("parcel_id", parcel_id);
          polled++;
        } catch {
          failed++; // one bad parcel must not stop the rest
          // bump anyway so a failing parcel rotates to the back instead of starving the others
          await admin
            .from("zr_shipments")
            .update({ last_synced_at: new Date().toISOString() })
            .eq("workspace_id", ws)
            .eq("parcel_id", parcel_id);
        }
      }
    } catch {
      failed++; // one bad workspace must not stop the others
    }
  }
  if (polled > 0) markStorePublicStale();
  return jsonResponse({ ok: true, polled, failed }, 200);
}
