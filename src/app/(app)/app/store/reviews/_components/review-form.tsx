"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { Field } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { createReview } from "../../actions";
import { RatingInput } from "./rating-input";

const NAME_MAX = 80;
const BODY_MAX = 1000;

export function ReviewForm({ products }: { products: { id: string; name: string }[] }) {
  const t = useTranslations("store.admin.reviews");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [productId, setProductId] = useState("");
  const [rating, setRating] = useState(0);
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [agreed, setAgreed] = useState(false);

  function submit(formData: FormData) {
    formData.set("rating", String(rating));
    formData.set("agreed", agreed ? "on" : "");
    start(async () => {
      const r = await createReview(formData);
      if (r.ok) {
        toast.success(t("added"));
        setError(null);
        setName("");
        setBody("");
        setRating(0);
        setAgreed(false);
        router.refresh();
        return;
      }
      setError(
        r.error === "order_not_found" ? t("errOrderNotFound") : r.error === "order_not_verifiable" ? t("errOrderNotVerifiable") : r.error === "invalid" ? t("errInvalid") : t("errFailed"),
      );
    });
  }

  return (
    <form action={submit} className="card-surface space-y-4 rounded-xl p-5">
      <h2 className="text-base font-semibold">{t("newTitle")}</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label={t("fieldProduct")}>
          <Combobox
            name="product_id"
            value={productId}
            onChange={setProductId}
            options={products.map((p) => ({ value: p.id, label: p.name }))}
            placeholder={t("pickProduct")}
            searchPlaceholder={t("searchProduct")}
            emptyText={t("noProductsFound")}
          />
        </Field>
        <Field label={t("fieldName")} htmlFor="review-name" hint={t("nameHint")}>
          <Input id="review-name" name="name" required maxLength={NAME_MAX} value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
          <p className="num mt-1 text-xs text-muted-foreground">{t("counter", { n: name.length, max: NAME_MAX })}</p>
        </Field>
        <Field label={t("fieldRating")}>
          <RatingInput value={rating} onChange={setRating} label={t("fieldRating")} />
        </Field>
        <Field label={t("fieldOrder")} htmlFor="review-order" hint={t("orderHint")}>
          <Input id="review-order" name="order_seq" type="number" inputMode="numeric" min={1} step={1} dir="ltr" autoComplete="off" />
        </Field>
      </div>
      <Field label={t("fieldBody")} htmlFor="review-body">
        <Textarea id="review-body" name="body" required maxLength={BODY_MAX} rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
        <p className="num mt-1 text-xs text-muted-foreground">{t("counter", { n: body.length, max: BODY_MAX })}</p>
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={agreed} onCheckedChange={(v) => setAgreed(v === true)} />
        {t("agreed")}
      </label>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending || !productId || rating === 0 || !agreed || !name.trim() || !body.trim()}>
        <Plus className="h-4 w-4" />
        {t("add")}
      </Button>
    </form>
  );
}
