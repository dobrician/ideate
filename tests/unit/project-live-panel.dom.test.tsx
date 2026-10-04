// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render } from "@testing-library/react";
import { ProjectLivePanel } from "@/components/project-live-panel";

const { refresh, subscribe } = vi.hoisted(() => ({ refresh: vi.fn(), subscribe: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/websocket/client", () => ({ createWsClient: () => ({}) }));
vi.mock("@/lib/use-project-updates", () => ({ useProjectUpdates: subscribe }));

describe("ProjectLivePanel", () => {
  afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });

  it("should retain background refresh without rendering an activity panel", () => {
    vi.useFakeTimers();
    const view = render(<ProjectLivePanel projectId="demo" sessionToken="test-session" />);
    expect(view.container).toBeEmptyDOMElement();
    expect(subscribe).toHaveBeenCalledWith(expect.any(Object), "project:demo");
    vi.advanceTimersByTime(15_000);
    expect(refresh).toHaveBeenCalledTimes(1);
    view.unmount();
    vi.advanceTimersByTime(30_000);
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
