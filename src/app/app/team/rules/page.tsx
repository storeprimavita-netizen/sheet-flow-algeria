import { getTranslations } from "next-intl/server";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { isCurrentUserAdmin, getProfile } from "@/lib/rbac";
import { formatDateTime } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { Empty } from "@/components/empty";
import { Field } from "@/components/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Chip } from "@/components/ui/chip";
import { EnumSelect } from "@/components/fields/enum-select";
import { Button } from "@/components/ui/button";
import { RULE_CATEGORIES } from "@/lib/enums";
import { TeamTabs } from "../team-tabs";
import { saveRuleDoc, deleteRuleDoc, moveRuleDoc } from "../actions";

/** Reachable by every authenticated role (RLS `rd_sel`) — no admin guard on
 * this route, unlike its siblings: agents get a read-only view (SPEC §8). */
export default async function RulesPage() {
  const t = await getTranslations();
  const admin = await isCurrentUserAdmin();
  const supabase = await createClient();
  const { data: docs } = await supabase.from("rules_docs").select("*").order("position");
  const list = docs ?? [];

  const profile = await getProfile();
  const { data: profiles } = profile
    ? await supabase.from("profiles").select("user_id, display_name").eq("workspace_id", profile.workspaceId)
    : { data: [] };
  const nameById = new Map((profiles ?? []).map((p) => [p.user_id, p.display_name ?? p.user_id]));

  const categoryOptions = RULE_CATEGORIES.map((c) => ({ value: c.value, label: c.label }));

  return (
    <div className="space-y-6">
      <PageHeader title={t("team.title")} subtitle={t("team.subtitle")} />
      <TeamTabs active="rules" />

      {admin && (
        <details className="group/card-surface card-surface rounded-xl">
          <summary className="cursor-pointer p-5 text-sm font-semibold select-none marker:hidden">
            <span className="inline-flex items-center gap-2">
              {t("team.addRule")}
              <span className="inline-block transition-transform group-open/card-surface:rotate-45 text-muted-foreground">+</span>
            </span>
          </summary>
          <form action={saveRuleDoc.bind(null, null)} className="space-y-4 px-5 pb-5">
            <Field label={t("team.ruleTitle")}>
              <Input name="title" required />
            </Field>
            <Field label={t("team.category")}>
              <EnumSelect name="category" options={[{ value: "", label: t("team.noCategory") }, ...categoryOptions]} defaultValue="" />
            </Field>
            <Field label={t("team.ruleContent")}>
              <Textarea name="content" rows={4} />
            </Field>
            <Button type="submit">{t("actions.create")}</Button>
          </form>
        </details>
      )}

      {!list.length ? (
        <Empty>{t("team.rulesNone")}</Empty>
      ) : (
        <div className="space-y-4">
          {list.map((d, i) => {
            const editedBy = d.updated_by ? (nameById.get(d.updated_by) ?? d.updated_by) : null;
            const lastEdited = editedBy ? `${t("team.lastEditedBy", { name: editedBy })} · ${formatDateTime(d.updated_at)}` : null;
            const cat = RULE_CATEGORIES.find((c) => c.value === d.category);
            return (
            <section key={d.id} className="card-surface space-y-4 rounded-xl p-5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold">{d.title}</h2>
                  {cat && <Chip token={cat.token}>{cat.label}</Chip>}
                </div>
                {lastEdited ? <p className="text-xs text-muted-foreground">{lastEdited}</p> : null}
              </div>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">{d.content}</p>

              {admin && (
                <details className="group">
                  <summary className="cursor-pointer text-sm font-medium select-none marker:hidden text-muted-foreground hover:text-foreground">
                    {t("team.editRule")}
                  </summary>
                  <div className="mt-4 space-y-4">
                    <form action={saveRuleDoc.bind(null, d.id)} className="space-y-4">
                      <Field label={t("team.ruleTitle")}>
                        <Input name="title" defaultValue={d.title} required />
                      </Field>
                      <Field label={t("team.category")}>
                        <EnumSelect name="category" options={[{ value: "", label: t("team.noCategory") }, ...categoryOptions]} defaultValue={d.category ?? ""} />
                      </Field>
                      <Field label={t("team.ruleContent")}>
                        <Textarea name="content" defaultValue={d.content} rows={6} />
                      </Field>
                      <Button type="submit" size="sm">{t("actions.save")}</Button>
                    </form>
                    <div className="flex items-center gap-1">
                      <form action={moveRuleDoc.bind(null, d.id, "up")}>
                        <Button type="submit" variant="ghost" size="sm" disabled={i === 0}>
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                      </form>
                      <form action={moveRuleDoc.bind(null, d.id, "down")}>
                        <Button type="submit" variant="ghost" size="sm" disabled={i === list.length - 1}>
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                      </form>
                      <form action={deleteRuleDoc.bind(null, d.id)}>
                        <Button type="submit" variant="ghost" size="sm">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </form>
                    </div>
                  </div>
                </details>
              )}
            </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
