import { afterEach, describe, expect, test, vi } from "vitest";

let effect: (() => (() => void) | void) | undefined;
vi.mock("react", () => ({ useEffect: (fn: () => (() => void) | void) => void (effect = fn) }));

import { DocumentTitle } from "./document-title";

const g = globalThis as unknown as Record<string, unknown>;

describe("DocumentTitle", () => {
  afterEach(() => {
    delete g.document;
    delete g.location;
    delete g.MutationObserver;
  });

  function setup() {
    let observed: (() => void) | undefined;
    g.document = { title: "layout", head: {} };
    g.location = { pathname: "/app/x" };
    g.MutationObserver = class {
      constructor(cb: () => void) {
        observed = cb;
      }
      observe() {}
      disconnect() {}
    };
    DocumentTitle({ title: "Not found" });
    const cleanup = effect!() as () => void;
    return { cleanup, fire: () => observed!() };
  }

  test("keeps its title while mounted", () => {
    const { fire } = setup();
    expect((g.document as { title: string }).title).toBe("Not found");
    (g.document as { title: string }).title = "layout";
    fire();
    expect((g.document as { title: string }).title).toBe("Not found");
  });

  test("DocumentTitle does not overwrite after unmount", () => {
    const { cleanup, fire } = setup();
    cleanup();
    (g.document as { title: string }).title = "Next page";
    fire(); // a mutation callback already queued
    expect((g.document as { title: string }).title).toBe("Next page");
  });

  test("does not overwrite after the pathname changed", () => {
    const { fire } = setup();
    (g.location as { pathname: string }).pathname = "/app/orders";
    (g.document as { title: string }).title = "Orders";
    fire();
    expect((g.document as { title: string }).title).toBe("Orders");
  });
});
