// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

const mocks = vi.hoisted(() => ({ update: vi.fn(), error: vi.fn(), success: vi.fn() }));
vi.mock("@/app/profile/actions", () => ({ updateProfile: mocks.update }));
vi.mock("@/lib/use-locale", () => ({ useLocale: () => ({ t: (key: string) => key }) }));
vi.mock("@/lib/csrf-client", () => ({ getCsrfTokenClient: () => "fixture" }));
vi.mock("sonner", () => ({ toast: { error: mocks.error, success: mocks.success } }));
import { ProfileForm } from "@/app/profile/profile-form";

beforeEach(() => vi.resetAllMocks());
describe("ProfileForm", () => {
  it("should recover from a failed request and allow retry without losing the name", async () => {
    mocks.update.mockRejectedValueOnce(new Error("Network failure")).mockResolvedValueOnce({ success: true });
    const user = userEvent.setup();
    render(<ProfileForm firstName="Emma" lastName="Parker" />);
    await user.type(screen.getByLabelText("profile.firstName"), " Jane");
    await user.click(screen.getByRole("button", { name: "profile.update" }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith("profile.updateFailed"));
    expect(screen.getByRole("button", { name: "profile.update" })).toBeEnabled();
    expect(screen.getByLabelText("profile.firstName")).toHaveValue("Emma Jane");
    await user.click(screen.getByRole("button", { name: "profile.update" }));
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith("profile.updated"));
  });
  it("should show an action validation error and release the loading state", async () => {
    mocks.update.mockResolvedValueOnce({ error: "profile.invalidName" });
    const user = userEvent.setup();
    render(<ProfileForm firstName="Emma" lastName="Parker" />);
    await user.click(screen.getByRole("button", { name: "profile.update" }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith("profile.invalidName"));
    expect(screen.getByRole("button", { name: "profile.update" })).toBeEnabled();
  });
});
