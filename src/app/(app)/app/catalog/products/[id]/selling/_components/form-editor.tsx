"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { EnumSelect } from "@/components/fields/enum-select";
import { SettingSwitch } from "@/components/fields/setting-switch";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CORE_KEYS, MAX_CUSTOM_FIELDS, normalizeFormFields, type FormField } from "@/lib/store/form-fields";

import { saveForm } from "../actions";
import { SaveBar, type SaveState } from "./save-bar";

type Method = "home" | "stopdesk";
const isCore = (k: string) => (CORE_KEYS as readonly string[]).includes(k);

export function FormEditor({ productId, fields: initial, deliveryMethods: initialMethods }: { productId: string; fields: FormField[]; deliveryMethods: Method[] }) {
  const t = useTranslations("store.admin.selling");
  const [fields, setFields] = React.useState<FormField[]>(initial);
  const [methods, setMethods] = React.useState<Method[]>(initialMethods);
  const [state, setState] = React.useState<SaveState>({ kind: "idle" });
  const [dirty, setDirty] = React.useState(false);
  const touch = () => {
    setDirty(true);
    setState((s) => (s.kind === "saved" ? { kind: "idle" } : s));
  };
  const set = (key: string, p: Partial<FormField>) => {
    setFields((fs) => fs.map((f) => (f.key === key ? ({ ...f, ...p } as FormField) : f)));
    touch();
  };
  const custom = fields.filter((f) => f.type !== "core");
  const builtin = fields.filter((f) => f.type === "core");

  function addCustom() {
    const key = ["c1", "c2", "c3", "c4", "c5"].find((k) => !fields.some((f) => f.key === k));
    if (!key) return;
    setFields((fs) => [...fs, { type: "text", key, label: "", required: false, enabled: true }]);
    touch();
  }

  async function save() {
    if (custom.some((f) => !f.label.trim() || (f.type === "select" && f.options.length < 2))) {
      setState({ kind: "error", reason: t("form.incomplete") });
      return;
    }
    setState({ kind: "saving" });
    const res = await saveForm({ productId, fields: normalizeFormFields(fields.map((f) => (f.type === "core" ? { ...f, label: f.label?.trim() || undefined } : { ...f, label: f.label.trim() }))), deliveryMethods: methods });
    if (res.ok) {
      setState({ kind: "saved" });
      setDirty(false);
    } else setState({ kind: "error", reason: t(res.error === "invalid" ? "form.invalid" : `errors.${res.error}`) });
  }

  return (
    <section className="card-surface space-y-5 rounded-xl p-5" aria-labelledby="form-title">
      <div className="space-y-1">
        <h3 id="form-title" className="text-sm font-semibold">{t("form.title")}</h3>
        <p className="text-xs text-muted-foreground">{t("form.hint")}</p>
      </div>

      <ul className="space-y-2">
        {builtin.map((f) => (
          <li key={f.key} className="grid grid-cols-1 items-center gap-3 rounded-lg border border-border p-3 sm:grid-cols-[10rem_1fr_auto]">
            <span className="text-sm font-medium">{t(`form.builtin.${f.key as "name"}`)}</span>
            <Input
              aria-label={t("form.labelFor", { name: t(`form.builtin.${f.key as "name"}`) })}
              placeholder={t("form.defaultLabel")}
              value={f.type === "core" ? (f.label ?? "") : ""}
              maxLength={60}
              onChange={(e) => set(f.key, { label: e.target.value })}
            />
            {isCore(f.key) ? (
              <span className="text-xs text-muted-foreground">{t("form.alwaysRequired")}</span>
            ) : (
              <div className="flex items-center gap-4">
                <SettingSwitch label={t("form.enabled")} checked={f.enabled} onCheckedChange={(v) => set(f.key, { enabled: v })} />
                <SettingSwitch label={t("form.required")} checked={f.required} disabled={!f.enabled} onCheckedChange={(v) => set(f.key, { required: v })} />
              </div>
            )}
          </li>
        ))}
      </ul>

      <div className="space-y-3">
        <h4 className="text-sm font-semibold">{t("form.customTitle")}</h4>
        {custom.length === 0 ? <p className="text-sm text-muted-foreground">{t("form.customEmpty")}</p> : null}
        {custom.map((f, i) => (
          <div key={f.key} className="space-y-3 rounded-lg border border-border p-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_10rem]">
              <label className="space-y-1.5 text-xs text-muted-foreground">
                {t("form.customLabel")}
                <Input value={f.label} maxLength={60} onChange={(e) => set(f.key, { label: e.target.value })} />
              </label>
              <div className="space-y-1.5 text-xs text-muted-foreground">
                <span>{t("form.customType")}</span>
                <EnumSelect
                  value={f.type}
                  options={[{ value: "text", label: t("form.typeText") }, { value: "select", label: t("form.typeSelect") }]}
                  onChange={(v) => {
                    setFields((fs) =>
                      fs.map((x): FormField =>
                        x.key !== f.key
                          ? x
                          : v === "select"
                            ? { type: "select", key: x.key, label: x.label ?? "", required: x.required, enabled: x.enabled, options: [] }
                            : { type: "text", key: x.key, label: x.label ?? "", required: x.required, enabled: x.enabled },
                      ),
                    );
                    touch();
                  }}
                />
              </div>
            </div>
            {f.type === "select" ? (
              <label className="block space-y-1.5 text-xs text-muted-foreground">
                {t("form.options")}
                <Textarea
                  defaultValue={f.options.join("\n")}
                  rows={3}
                  onChange={(e) => set(f.key, { options: e.target.value.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 10) })}
                />
              </label>
            ) : null}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-6">
                <SettingSwitch label={t("form.enabled")} checked={f.enabled} onCheckedChange={(v) => set(f.key, { enabled: v })} />
                <SettingSwitch label={t("form.required")} checked={f.required} onCheckedChange={(v) => set(f.key, { required: v })} />
              </div>
              <Button type="button" variant="destructive" size="icon" aria-label={t("form.removeField", { name: f.label || String(i + 1) })} onClick={() => { setFields((fs) => fs.filter((x) => x.key !== f.key)); touch(); }}>
                <Trash2 />
              </Button>
            </div>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" disabled={custom.length >= MAX_CUSTOM_FIELDS} onClick={addCustom}>
          <Plus />
          {custom.length >= MAX_CUSTOM_FIELDS ? t("form.maxCustom", { n: MAX_CUSTOM_FIELDS }) : t("form.addCustom")}
        </Button>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">{t("form.deliveryTitle")}</legend>
        <div className="flex flex-wrap gap-6">
          {(["home", "stopdesk"] as const).map((m) => {
            const on = methods.includes(m);
            return (
              <label key={m} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={on}
                  disabled={on && methods.length === 1}
                  onCheckedChange={(v) => {
                    setMethods((cur) => (v === true ? [...new Set([...cur, m])] : cur.filter((x) => x !== m)));
                    touch();
                  }}
                />
                {t(`form.delivery.${m}`)}
              </label>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">{t("form.deliveryHint")}</p>
      </fieldset>

      <SaveBar state={state} dirty={dirty} onSave={save} />
    </section>
  );
}
