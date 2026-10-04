// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

const state = vi.hoisted(() => ({ status: "", user: { id: "u1", email: "member@example.test", firstName: "Demo", lastName: "Member", passwordHash: null as string | null }, identities: [] as { provider: string }[] }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(state.status ? `status=${state.status}` : ""),
  redirect: (path: string) => { throw new Error(`redirect:${path}`); },
}));
vi.mock("next/link", () => ({ default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a> }));
const t = (key: string) => ({ "projects.title": "Projects", "projects.current": "Current decisions", "projects.archive": "Archive", "profile.account": "Account", "notifications.title": "Notifications", "profile.tabSecurity": "Security", "profile.ssoIdentity": "SSO manages your identity" })[key] ?? key;
vi.mock("@/lib/use-locale", () => ({ useLocale: () => ({ t }) }));
vi.mock("@/lib/i18n-server", () => ({ getTranslations: async () => ({ t }) }));
vi.mock("@/lib/auth", () => ({ getCurrentUser: async () => state.user }));
vi.mock("@/db", () => ({ db: { select: (fields?: unknown) => ({ from: () => ({ where: () => fields ? Promise.resolve(state.identities) : { limit: () => Promise.resolve([]) } }) }) } }));
vi.mock("@/app/profile/profile-form", () => ({ ProfileForm: () => <div>Name preferences</div> }));
vi.mock("@/app/profile/notification-settings", () => ({ NotificationSettings: () => <div>Email preferences</div> }));

beforeEach(() => { state.status = ""; state.identities = []; state.user.passwordHash = null; });

describe("Essential user destinations", () => {
  it("should offer current decisions and archive without technical filters", async () => {
    const { ProjectFilters } = await import("@/components/project-filters");
    render(<ProjectFilters />);
    expect(screen.getByRole("link", { name: "Current decisions" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Archive" })).toHaveAttribute("href", "/projects?status=archived");
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  });
  it("should indicate the archive when reached by a bookmark", async () => {
    state.status = "archived";
    const { ProjectFilters } = await import("@/components/project-filters");
    render(<ProjectFilters />);
    expect(screen.getByRole("link", { name: "Archive" })).toHaveAttribute("aria-current", "page");
  });
  it("should omit activity tabs and local credential controls", async () => {
    const { default: ProfilePage } = await import("@/app/profile/page");
    render(await ProfilePage());
    expect(screen.getByRole("heading", { name: "Account" })).toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    expect(screen.queryByText("Change email")).not.toBeInTheDocument();
    expect(screen.queryByText("Change password")).not.toBeInTheDocument();
  });
  it("should recognize linked SSO identities rather than infer them from a missing password", async () => {
    state.identities = [{ provider: "surcod" }];
    const { default: ProfilePage } = await import("@/app/profile/page");
    render(await ProfilePage());
    expect(screen.getByText("SSO manages your identity")).toBeInTheDocument();
    expect(screen.queryByText("Change email")).not.toBeInTheDocument();
    expect(screen.queryByText("Security")).not.toBeInTheDocument();
  });
  it("should retire password management even when legacy credentials remain in data", async () => {
    state.identities = [{ provider: "surcod" }]; state.user.passwordHash = "existing";
    const { default: ProfilePage } = await import("@/app/profile/page");
    render(await ProfilePage());
    expect(screen.queryByText("Change password")).not.toBeInTheDocument();
    expect(screen.queryByText("Change email")).not.toBeInTheDocument();
  });
  it("should redirect old dashboard bookmarks to Projects", async () => {
    const { default: DashboardPage } = await import("@/app/dashboard/page");
    expect(() => DashboardPage()).toThrow("redirect:/projects");
  });
});
