import type * as React from "react";

export type Align = "start" | "end" | "center";

export type Column<T> = {
  /** stable id; also the sort key when `sortable` */
  id: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  align?: Align;
  /** right-align + tabular numerals */
  numeric?: boolean;
  sortable?: boolean;
  /** sticky first column (pins on horizontal scroll) */
  sticky?: boolean;
  /** hidden by default (can be toggled on via the column menu) */
  defaultHidden?: boolean;
  /** exclude from the column-visibility menu (e.g. the actions column) */
  alwaysVisible?: boolean;
  /** fixed width utility class, e.g. "w-10" */
  width?: string;
};

export type SortState = { id: string; dir: "asc" | "desc" } | null;
