"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { Field } from "@/components/field";
import { Combobox } from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { createPage } from "../actions";

export function CreatePageForm({ storeId, products }: { storeId: string; products: { id: string; name: string }[] }) {
  const t = useTranslations("store.admin");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [productId, setProductId] = useState("");

  function submit(formData: FormData) {
    start(async () => {
      const r = await createPage(formData);
      if (r.ok) {
        toast.success(t("pages.create"));
        router.push(`/app/store/pages/${r.id}`);
      } else {
        setError(r.error === "slug_taken" ? t("editor.errSlugTaken") : r.error === "product_taken" ? t("editor.errProductTaken") : r.error === "invalid" ? t("editor.errInvalid") : t("editor.errFailed"));
      }
    });
  }

  return (
    <form action={submit} className="card-surface space-y-4 rounded-xl p-5">
      <h2 className="text-base font-semibold">{t("pages.newTitle")}</h2>
      <input type="hidden" name="store_id" value={storeId} />
      <div className="grid gap-4 md:grid-cols-3">
        <Field label={t("pages.fieldProduct")}>
          <Combobox
            name="product_id"
            value={productId}
            onChange={setProductId}
            options={products.map((p) => ({ value: p.id, label: p.name }))}
            placeholder={t("pages.pickProduct")}
            searchPlaceholder={t("pages.searchProduct")}
            emptyText={t("pages.noProductsFound")}
          />
        </Field>
        <Field label={t("pages.fieldTitle")} htmlFor="page-title">
          <Input id="page-title" name="title" required maxLength={80} />
        </Field>
        <Field label={t("pages.fieldSlug")} htmlFor="page-slug" hint={t("hub.slugHint")}>
          <Input id="page-slug" name="slug" required dir="ltr" pattern="[a-z0-9\-]{2,40}" minLength={2} maxLength={40} autoCapitalize="none" spellCheck={false} />
        </Field>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending || !productId}>
        <Plus className="h-4 w-4" />
        {t("pages.create")}
      </Button>
    </form>
  );
}
