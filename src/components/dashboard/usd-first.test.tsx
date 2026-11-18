import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import { UsdFirst } from "./usd-first";

const render = (props: Partial<React.ComponentProps<typeof UsdFirst>>) =>
  renderToStaticMarkup(
    <TooltipProvider>
      <UsdFirst usd={120} dzd={26400} rate={220} date="2026-11-01" rateLabel={(r, d) => `${r} @ ${d}`} noRateHint="set a USD rate" {...props} />
    </TooltipProvider>,
  );

describe("UsdFirst", () => {
  test("USD big, DZD small and grey under it", () => {
    const html = render({});
    expect(html).toContain("$120");
    expect(html).toContain("26 400 DA");
    expect(html).toContain("text-muted-foreground");
    expect(html.indexOf("$120")).toBeLessThan(html.indexOf("DA"));
  });
  test("no rate -> DZD only plus hint", () => {
    const html = render({ usd: null, rate: null });
    expect(html).not.toContain("$");
    expect(html).toContain("26 400 DA");
    expect(html).toContain("set a USD rate");
  });
});
