export type Marker = "circle" | "square" | "diamond";

/** One tooltip / table-visible value row. `color` is a CSS variable reference, never a literal. */
export type TipRow = { label: string; value: string; color?: string; dash?: string; marker?: Marker };

/** What the tooltip shows and where a point drills to. `aria` is the focus announcement. */
export type Pt = { title: string; rows: TipRow[]; href?: string; aria: string };

export type ChartTableData = {
  caption: string;
  head: string[];
  rows: string[][];
};

export type ChartEmpty = { title: string; action?: { label: string; href: string } };

/** A named series with its token colour and a non-colour cue (dash + marker). */
export type SeriesStyle = { key: string; label: string; color: string; dash?: string; marker: Marker };
