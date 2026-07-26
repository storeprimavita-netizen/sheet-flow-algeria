import { getTranslations } from "next-intl/server";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { isCurrentUserAdmin } from "@/lib/rbac";
import { PageHeader } from "@/components/page-header";
import { Empty } from "@/components/empty";
import { Field } from "@/components/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
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

  return (
    <div className="space-y-6">
      <PageHeader title={t("team.title")} subtitle={t("team.subtitle")} />
      <TeamTabs active="rules" />

      {admin && (
        <section className="glass-card space-y-4 rounded-xl p-5">
          <h2 className="text-sm font-semibold">{t("team.newRule")}</h2>
          <form action={saveRuleDoc.bind(null, null)} className="space-y-4">
            <Field label={t("team.ruleTitle")}>
              <Input name="title" required />
            </Field>
            <Field label={t("team.ruleContent")}>
              <Textarea name="content" rows={4} />
            </Field>
            <Button type="submit">{t("actions.create")}</Button>
          </form>
        </section>
      )}

      {!list.length ? (
        <Empty>{t("team.rulesNone")}</Empty>
      ) : (
        <div className="space-y-4">
          {list.map((d, i) => (
            <section key={d.id} className="glass-card space-y-4 rounded-xl p-5">
              {admin ? (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-sm font-semibold">{d.title}</h2>
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
                  <form action={saveRuleDoc.bind(null, d.id)} className="space-y-4">
                    <Field label={t("team.ruleTitle")}>
                      <Input name="title" defaultValue={d.title} required />
                    </Field>
                    <Field label={t("team.ruleContent")}>
                      <Textarea name="content" defaultValue={d.content} rows={6} />
                    </Field>
                    <Button type="submit" size="sm">
                      {t("actions.save")}
                    </Button>
                  </form>
                </>
              ) : (
                <>
                  <h2 className="text-sm font-semibold">{d.title}</h2>
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">{d.content}</p>
                </>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
