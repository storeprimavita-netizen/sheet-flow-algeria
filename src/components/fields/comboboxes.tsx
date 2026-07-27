"use client";

import * as React from "react";

import { Combobox } from "@/components/ui/combobox";
import { StatusPill } from "@/components/status-pill";

/** Wilaya picker: all 58 as "16 — Alger", searchable by code or name. */
export function WilayaCombobox({
  wilayas,
  value,
  onChange,
  name,
  placeholder = "Wilaya",
  disabled,
}: {
  wilayas: { code: string; name: string }[];
  value?: string;
  onChange?: (value: string) => void;
  name?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  const options = wilayas.map((w) => ({
    value: w.code,
    label: `${w.code} — ${w.name}`,
    keywords: [w.name, w.code],
  }));
  return (
    <Combobox
      options={options}
      value={value}
      onChange={onChange}
      name={name}
      placeholder={placeholder}
      disabled={disabled}
    />
  );
}

/** Commune picker: dependent on wilaya, disabled with a reason until it is set. */
export function CommuneCombobox({
  communes,
  wilayaSet,
  disabledReason = "Select a wilaya first",
  value,
  onChange,
  name,
  placeholder = "Commune",
}: {
  communes: string[];
  wilayaSet: boolean;
  disabledReason?: string;
  value?: string;
  onChange?: (value: string) => void;
  name?: string;
  placeholder?: string;
}) {
  return (
    <Combobox
      options={communes.map((c) => ({ value: c, label: c }))}
      value={value}
      onChange={onChange}
      name={name}
      placeholder={placeholder}
      disabled={!wilayaSet}
      disabledReason={disabledReason}
    />
  );
}

/** Product picker: thumbnail + name + status pill per option. */
export function ProductCombobox({
  products,
  value,
  onChange,
  name,
  placeholder = "Product",
  disabled,
}: {
  products: { id: string; name: string; image?: string | null; status?: string | null }[];
  value?: string;
  onChange?: (value: string) => void;
  name?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  const options = products.map((p) => ({
    value: p.id,
    label: p.name,
    keywords: [p.name],
    icon: (
      <span className="flex items-center gap-2">
        {p.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.image} alt="" className="h-5 w-5 shrink-0 rounded object-cover" />
        ) : (
          <span className="h-5 w-5 shrink-0 rounded bg-surface-raised" />
        )}
        {p.status ? <StatusPill kind="product" status={p.status} size="sm" showIcon={false} /> : null}
      </span>
    ),
  }));
  return (
    <Combobox
      options={options}
      value={value}
      onChange={onChange}
      name={name}
      placeholder={placeholder}
      disabled={disabled}
    />
  );
}
