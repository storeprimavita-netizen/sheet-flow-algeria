"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { requireAdminProfile } from "@/lib/rbac";
import { isRealIsoDate } from "@/lib/query-string";

/** Error values are i18n keys under `settings.seasons.err.*`; the client translates them. */
export type SeasonState = { error: string } | { ok: true } | undefined;

const name = z.string().trim().min(1).max(80);
const isoDate = z.string().refine(isRealIsoDate);

const createSchema = z.object({ name });
const renameSchema = z.object({ id: z.uuid(), name });
const periodSchema = z.object({
  season_id: z.uuid(),
  id: z.uuid().optional(),
  date_from: isoDate,
  date_to: isoDate,
});

const text = (fd: FormData, k: string) => (typeof fd.get(k) === "string" ? (fd.get(k) as string) : "");

async function guard(): Promise<{ workspaceId: string } | { error: string }> {
  try {
    const { workspaceId } = await requireAdminProfile();
    return { workspaceId };
  } catch {
    return { error: "errForbidden" };
  }
}

const dbError = (e: { code?: string }): { error: string } => {
  if (e.code === "23505") return { error: "errDuplicate" };
  if (e.code === "23514") return { error: "errRange" };
  if (e.code === "23503") return { error: "errMissing" };
  return { error: "errGeneric" };
};

export async function createSeason(_prev: SeasonState, fd: FormData): Promise<SeasonState> {
  const g = await guard();
  if ("error" in g) return g;
  const input = createSchema.safeParse({ name: text(fd, "name") });
  if (!input.success) return { error: "errName" };
  const supabase = await createClient();
  const { data: last } = await supabase.from("seasons").select("sort").order("sort", { ascending: false }).limit(1).maybeSingle();
  const { error } = await supabase
    .from("seasons")
    .insert({ workspace_id: g.workspaceId, name: input.data.name, sort: (last?.sort ?? -1) + 1 });
  if (error) return error.code === "23505" ? { error: "errDuplicateName" } : dbError(error);
  revalidatePath("/app/settings/seasons");
  return { ok: true };
}

export async function renameSeason(_prev: SeasonState, fd: FormData): Promise<SeasonState> {
  const g = await guard();
  if ("error" in g) return g;
  const input = renameSchema.safeParse({ id: text(fd, "id"), name: text(fd, "name") });
  if (!input.success) return { error: "errName" };
  const supabase = await createClient();
  const { data: current } = await supabase
    .from("seasons")
    .select("name")
    .eq("id", input.data.id)
    .eq("workspace_id", g.workspaceId)
    .maybeSingle();
  if (!current) return { error: "errMissing" };
  if (current.name === input.data.name) return { ok: true }; // unchanged: keep the translated name
  // a renamed seeded season stops using its translated name (name_key) and shows what was typed
  const { error } = await supabase
    .from("seasons")
    .update({ name: input.data.name, name_key: null })
    .eq("id", input.data.id)
    .eq("workspace_id", g.workspaceId);
  if (error) return error.code === "23505" ? { error: "errDuplicateName" } : dbError(error);
  revalidatePath("/app/settings/seasons");
  return { ok: true };
}

/** Add or edit one period. year = year of date_from (the DB checks it too); one period per season and year. */
export async function savePeriod(_prev: SeasonState, fd: FormData): Promise<SeasonState> {
  const g = await guard();
  if ("error" in g) return g;
  const input = periodSchema.safeParse({
    season_id: text(fd, "season_id"),
    id: text(fd, "id") || undefined,
    date_from: text(fd, "date_from"),
    date_to: text(fd, "date_to"),
  });
  if (!input.success) return { error: "errDates" };
  const { season_id, id, date_from, date_to } = input.data;
  if (date_from > date_to) return { error: "errRange" };
  const year = Number(date_from.slice(0, 4));
  if (year < 2000 || year > 2100) return { error: "errDates" };

  const supabase = await createClient();
  const { data: saved, error } = id
    ? await supabase.from("season_periods").update({ year, date_from, date_to }).eq("id", id).eq("workspace_id", g.workspaceId).select("id")
    : await supabase.from("season_periods").insert({ workspace_id: g.workspaceId, season_id, year, date_from, date_to }).select("id");
  if (error) return error.code === "23505" ? { error: "errDuplicateYear" } : dbError(error);
  if (!saved?.length) return { error: "errMissing" };
  revalidatePath("/app/settings/seasons");
  return { ok: true };
}
