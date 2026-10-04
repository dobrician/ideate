// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
const mocks = vi.hoisted(() => ({ update: vi.fn(), error: vi.fn(), success: vi.fn() }));
vi.mock("@/app/profile/actions", () => ({ updateNotificationPreferences: mocks.update }));
vi.mock("@/lib/use-locale", () => ({ useLocale: () => ({ t: (key: string) => key }) }));
vi.mock("@/lib/csrf-client", () => ({ getCsrfTokenClient: () => "fixture" }));
vi.mock("sonner", () => ({ toast: { error: mocks.error, success: mocks.success } }));
import { NotificationSettings } from "@/app/profile/notification-settings";
beforeEach(() => vi.resetAllMocks());
const prefs = { emailNewProposal: true, emailVoteOnMine: true, emailCommentReply: true, emailWeeklyDigest: false };
describe("NotificationSettings", () => {
  it("should retain choices and allow retry after a request rejection", async () => {
    mocks.update.mockRejectedValueOnce(new Error("Offline")).mockResolvedValueOnce({ success: true });
    const user = userEvent.setup();
    render(<NotificationSettings prefs={prefs} />);
    await user.click(screen.getAllByRole("checkbox")[0]);
    await user.click(screen.getByRole("button", { name: "notifications.save" }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith("common.errorOccurred"));
    expect(screen.getAllByRole("checkbox")[0]).not.toBeChecked();
    expect(screen.getByRole("button", { name: "notifications.save" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "notifications.save" }));
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith("notifications.saved"));
  });
});
