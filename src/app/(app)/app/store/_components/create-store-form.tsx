"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Store } from "lucide-react";
import { toast } from "sonner";

import { Field } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { createStore } from "../actions";
import { hubErrorKey } from "./error-key";

export function CreateStoreForm() {
  const t = useTranslations("store.admin.hub");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(formData: FormData) {
    start(async () => {
      const r = await createStore(formData);
      if (r.ok) {
        setError(null);
        toast.success(t("create"));
        router.refresh();
      } else {
        setError(t(hubErrorKey(r)));
      }
    });
  }

  return (
    <form action={submit} className="card-surface mx-auto max-w-md space-y-4 rounded-xl p-6">
      <div className="space-y-1 text-center">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Store className="h-5 w-5" />
        </div>
        <h2 className="text-base font-semibold">{t("createTitle")}</h2>
        <p className="text-sm text-muted-foreground">{t("createBody")}</p>
      </div>
      <Field label={t("fieldName")} htmlFor="store-name">
        <Input id="store-name" name="name" required maxLength={80} />
      </Field>
      <Field label={t("fieldSlug")} htmlFor="store-slug" hint={t("slugHint")}>
        <Input id="store-slug" name="slug" required dir="ltr" pattern="[a-z0-9\-]{2,40}" minLength={2} maxLength={40} autoCapitalize="none" spellCheck={false} />
      </Field>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="w-full">
        {t("create")}
      </Button>
    </form>
  );
}
