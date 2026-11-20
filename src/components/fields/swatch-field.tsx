"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SWATCH_PICKER_DEFAULT, SWATCH_PRESETS } from "@/lib/swatch-presets";
import { swatchHexSchema, swatchImageSchema } from "@/lib/variants";

export type Swatch = { color: string | null; image: string | null };

/** The dot that shows a swatch. Only a validated hex reaches `style`, as a custom property; photos are <img>, never background-image. */
export function SwatchDot({ swatch, className = "" }: { swatch: Swatch; className?: string }) {
  const hex = swatch.color && swatchHexSchema.safeParse(swatch.color).success ? swatch.color : null;
  const img = swatch.image && swatchImageSchema.safeParse(swatch.image).success ? swatch.image : null;
  const base = `inline-block size-5 shrink-0 overflow-hidden rounded-full border border-border ${className}`;
  if (img) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={img} alt="" width={20} height={20} loading="lazy" className={`${base} object-cover`} />;
  }
  return <span aria-hidden="true" className={`${base} ${hex ? "bg-[var(--swatch)]" : "bg-muted"}`} style={hex ? ({ "--swatch": hex } as React.CSSProperties) : undefined} />;
}

/**
 * Colour or photo swatch for one value: hex text + preset buttons, or an https photo URL with a live preview.
 * Documented exception to "no raw input": the native colour picker (`type=color`) lives only here.
 */
export function SwatchField({ value, onChange }: { value: Swatch; onChange: (next: Swatch) => void }) {
  const t = useTranslations("variants");
  const hexErrId = React.useId();
  const urlErrId = React.useId();
  const [mode, setMode] = React.useState<"color" | "image">(value.image ? "image" : "color");
  const [hex, setHex] = React.useState(value.color ?? "");
  const [url, setUrl] = React.useState(value.image ?? "");
  const hexOk = !hex || swatchHexSchema.safeParse(hex).success;
  const urlOk = !url || swatchImageSchema.safeParse(url).success;

  return (
    <div className="w-full space-y-3">
      <div className="flex gap-2" role="group" aria-label={t("swatchMode")}>
        <Button type="button" size="sm" variant={mode === "color" ? "default" : "outline"} aria-pressed={mode === "color"} onClick={() => setMode("color")}>
          {t("swatchColor")}
        </Button>
        <Button type="button" size="sm" variant={mode === "image" ? "default" : "outline"} aria-pressed={mode === "image"} onClick={() => setMode("image")}>
          {t("swatchPhoto")}
        </Button>
      </div>
      {mode === "color" ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Input
              aria-label={t("swatchHex")}
              aria-invalid={!hexOk}
              aria-describedby={hexOk ? undefined : hexErrId}
              dir="ltr"
              className="min-w-0 flex-1"
              value={hex}
              maxLength={7}
              placeholder="#rrggbb"
              onChange={(e) => {
                setHex(e.target.value);
                if (swatchHexSchema.safeParse(e.target.value).success) onChange({ color: e.target.value.toLowerCase(), image: null });
                else onChange({ color: null, image: null });
              }}
            />
            <Input
              type="color"
              aria-label={t("swatchPick")}
              className="h-9 w-12 shrink-0 cursor-pointer p-1"
              value={swatchHexSchema.safeParse(hex).success ? hex : SWATCH_PICKER_DEFAULT}
              onChange={(e) => {
                setHex(e.target.value);
                onChange({ color: e.target.value, image: null });
              }}
            />
          </div>
          {!hexOk ? <p id={hexErrId} role="alert" className="text-xs text-danger">{t("swatchHexError")}</p> : null}
          <div className="flex flex-wrap gap-1.5">
            {SWATCH_PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                aria-label={t("swatchPreset", { hex: p })}
                aria-pressed={value.color === p}
                className="size-8 rounded-full border border-border bg-[var(--swatch)] outline-offset-2 focus-visible:outline-2 aria-pressed:ring-2 aria-pressed:ring-ring"
                style={{ "--swatch": p } as React.CSSProperties}
                onClick={() => {
                  setHex(p);
                  onChange({ color: p, image: null });
                }}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <Input
            aria-label={t("swatchUrl")}
            aria-invalid={!urlOk}
            aria-describedby={urlOk ? undefined : urlErrId}
            dir="ltr"
            type="url"
            inputMode="url"
            value={url}
            placeholder="https://"
            onChange={(e) => {
              setUrl(e.target.value);
              if (swatchImageSchema.safeParse(e.target.value).success) onChange({ color: null, image: e.target.value });
              else onChange({ color: null, image: null });
            }}
          />
          {!urlOk ? <p id={urlErrId} role="alert" className="text-xs text-danger">{t("swatchUrlError")}</p> : null}
          {url && urlOk ? <SwatchDot swatch={{ color: null, image: url }} className="!size-12" /> : null}
        </div>
      )}
      <Button type="button" variant="ghost" size="sm" onClick={() => { setHex(""); setUrl(""); onChange({ color: null, image: null }); }}>
        {t("swatchClear")}
      </Button>
    </div>
  );
}
