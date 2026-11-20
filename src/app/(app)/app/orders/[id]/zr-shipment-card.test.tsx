import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => k }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));
vi.mock("../actions", () => ({
  listZRHubs: vi.fn(),
  pushOrderToZRExpress: vi.fn(),
  refreshZRShipmentStatus: vi.fn(),
  switchOrderToHome: vi.fn(),
}));

import { ZRShipmentCard } from "./zr-shipment-card";

const base = { orderId: "o1", stopDesk: false, canSwitchToHome: false };
const shipment = { trackingNumber: "TRK1", state: "new", stateUpdatedAt: null };

describe("ZRShipmentCard", () => {
  it("renders reason when not sendable", () => {
    const html = renderToStaticMarkup(<ZRShipmentCard {...base} shipment={null} canSend={false} notSendableReason="status" />);
    expect(html).toContain("orders.zrexpress.notSendable.status");
    expect(html).not.toMatch(/<button[^>]*>[^<]*orders\.zrexpress\.send</);
  });
  it("renders the swapped reason", () => {
    const html = renderToStaticMarkup(<ZRShipmentCard {...base} shipment={null} canSend={false} notSendableReason="swapped" />);
    expect(html).toContain("orders.zrexpress.notSendable.swapped");
  });
  it("shows the shipment, not the reason, when one exists", () => {
    const html = renderToStaticMarkup(<ZRShipmentCard {...base} shipment={shipment} canSend={false} notSendableReason="status" />);
    expect(html).toContain("TRK1");
    expect(html).not.toContain("notSendable");
  });
  it("renders the send button when sendable", () => {
    const html = renderToStaticMarkup(<ZRShipmentCard {...base} shipment={null} canSend notSendableReason={null} />);
    expect(html).toMatch(/<button[^>]*>[^<]*orders\.zrexpress\.send/);
    expect(html).not.toContain("notSendable");
  });
});
