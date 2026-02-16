// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

let mockPathname = "/dashboard";

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

vi.mock("@/lib/use-locale", () => ({
  useLocale: () => ({
    locale: "en",
    t: (key: string) => {
      const map: Record<string, string> = {
        "nav.dashboard": "Dashboard",
        "nav.projects": "Projects",
        "nav.admin": "Admin",
        "nav.profile": "Profile",
        "nav.signOut": "Sign Out",
        "theme.toggle": "Toggle theme",
        "search.placeholder": "Search projects & proposals...",
        "locale.switchToRo": "Switch to Romanian",
      };
      return map[key] ?? key;
    },
  }),
}));

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => <img {...props} />,
}));

vi.mock("@/components/dark-mode-toggle", () => ({
  DarkModeToggle: () => <button data-testid="dark-mode-toggle">Theme</button>,
}));
vi.mock("@/components/search-bar", () => ({
  SearchBar: () => <div data-testid="search-bar">Search</div>,
}));
vi.mock("@/components/locale-switcher", () => ({
  LocaleSwitcher: () => <button data-testid="locale-switcher">EN</button>,
}));

function mockFetchResponse(data: unknown | null, ok = true) {
  global.fetch = vi.fn().mockResolvedValue({
    ok,
    json: () => Promise.resolve(data),
  });
}

async function renderHeader() {
  const { Header } = await import("@/components/header");
  return render(<Header />);
}

async function renderAppShell(children?: React.ReactNode) {
  const { AppShell } = await import("@/components/app-shell");
  return render(<AppShell>{children ?? <p>Page content</p>}</AppShell>);
}

describe("Header", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    mockPathname = "/dashboard";
  });

  describe("desktop nav links", () => {
    it("renders Dashboard and Projects links", async () => {
      mockFetchResponse(null, false);
      await renderHeader();

      const mainNav = screen.getByRole("navigation", { name: "Main navigation" });
      expect(mainNav).toBeInTheDocument();

      const dashLink = mainNav.querySelector('a[href="/dashboard"]');
      const projLink = mainNav.querySelector('a[href="/projects"]');
      expect(dashLink).toHaveTextContent("Dashboard");
      expect(projLink).toHaveTextContent("Projects");
    });

    it("marks the active link with aria-current=page", async () => {
      mockPathname = "/projects";
      mockFetchResponse(null, false);
      await renderHeader();

      const mainNav = screen.getByRole("navigation", { name: "Main navigation" });
      const projLink = mainNav.querySelector('a[href="/projects"]');
      const dashLink = mainNav.querySelector('a[href="/dashboard"]');
      expect(projLink).toHaveAttribute("aria-current", "page");
      expect(dashLink).not.toHaveAttribute("aria-current");
    });

    it("shows Ideate logo image + text linking to /", async () => {
      mockFetchResponse(null, false);
      await renderHeader();

      const logo = screen.getByText("Ideate");
      const link = logo.closest("a");
      expect(link).toHaveAttribute("href", "/");
      expect(link?.querySelector("img")).toHaveAttribute("src", "/logo.png");
    });
  });

  describe("mobile nav", () => {
    it("renders mobile navigation with same links", async () => {
      mockFetchResponse(null, false);
      await renderHeader();

      const mobileNav = screen.getByRole("navigation", { name: "Mobile navigation" });
      expect(mobileNav).toBeInTheDocument();

      const dashLink = mobileNav.querySelector('a[href="/dashboard"]');
      const projLink = mobileNav.querySelector('a[href="/projects"]');
      expect(dashLink).toHaveTextContent("Dashboard");
      expect(projLink).toHaveTextContent("Projects");
    });

    it("marks active link in mobile nav", async () => {
      mockPathname = "/dashboard";
      mockFetchResponse(null, false);
      await renderHeader();

      const mobileNav = screen.getByRole("navigation", { name: "Mobile navigation" });
      const dashLink = mobileNav.querySelector('a[href="/dashboard"]');
      expect(dashLink).toHaveAttribute("aria-current", "page");
    });
  });

  describe("admin link", () => {
    it("shows admin link in nav for admin users", async () => {
      mockFetchResponse({ role: "admin" });
      await renderHeader();

      await waitFor(() => {
        const mainNav = screen.getByRole("navigation", { name: "Main navigation" });
        expect(mainNav.querySelector('a[href="/admin"]')).toBeInTheDocument();
      });
    });

    it("shows admin link in mobile nav for admin users", async () => {
      mockFetchResponse({ role: "admin" });
      await renderHeader();

      await waitFor(() => {
        const mobileNav = screen.getByRole("navigation", { name: "Mobile navigation" });
        expect(mobileNav.querySelector('a[href="/admin"]')).toBeInTheDocument();
      });
    });

    it("does NOT show admin link for regular users", async () => {
      mockFetchResponse({ role: "user" });
      await renderHeader();

      await waitFor(() => {
        expect(screen.queryByText("Admin")).not.toBeInTheDocument();
      });
    });

    it("does NOT show admin link when not logged in", async () => {
      mockFetchResponse(null, false);
      await renderHeader();

      await waitFor(() => {
        expect(screen.queryByText("Admin")).not.toBeInTheDocument();
      });
    });
  });

  describe("sign out (auth-gated)", () => {
    it("shows Sign Out when authenticated", async () => {
      mockFetchResponse({ role: "user" });
      await renderHeader();

      const trigger = screen.getByTitle("Profile");
      await userEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByText("Sign Out")).toBeInTheDocument();
      });
    });

    it("does NOT show Sign Out when not authenticated", async () => {
      mockFetchResponse(null, false);
      await renderHeader();

      const trigger = screen.getByTitle("Profile");
      await userEvent.click(trigger);

      await waitFor(() => {
        expect(screen.queryByText("Sign Out")).not.toBeInTheDocument();
      });
    });
  });

  describe("dropdown menu", () => {
    it("opens dropdown on trigger click and shows Profile link", async () => {
      mockFetchResponse({ role: "user" });
      await renderHeader();

      const trigger = screen.getByTitle("Profile");
      await userEvent.click(trigger);

      await waitFor(() => {
        const profileLink = screen.getByRole("menuitem", { name: /Profile/i });
        expect(profileLink).toBeInTheDocument();
      });
    });

    it("closes dropdown when pressing Escape", async () => {
      mockFetchResponse(null, false);
      await renderHeader();

      const trigger = screen.getByTitle("Profile");
      await userEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByRole("menu")).toBeInTheDocument();
      });

      await userEvent.keyboard("{Escape}");

      await waitFor(() => {
        expect(screen.queryByRole("menu")).not.toBeInTheDocument();
      });
    });
  });
});

describe("AppShell", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("renders Header and children on non-auth paths", async () => {
    mockPathname = "/dashboard";
    mockFetchResponse(null, false);
    await renderAppShell(<p>Page content</p>);

    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByText("Page content")).toBeInTheDocument();
  });

  it("hides Header on auth paths", async () => {
    mockPathname = "/auth/login";
    await renderAppShell(<p>Login form</p>);

    expect(screen.queryByRole("banner")).not.toBeInTheDocument();
    expect(screen.getByText("Login form")).toBeInTheDocument();
  });

  it("hides Header on /auth/register", async () => {
    mockPathname = "/auth/register";
    await renderAppShell(<p>Register</p>);

    expect(screen.queryByRole("banner")).not.toBeInTheDocument();
  });

  it("hides Header on /auth/forgot-password", async () => {
    mockPathname = "/auth/forgot-password";
    await renderAppShell(<p>Forgot</p>);

    expect(screen.queryByRole("banner")).not.toBeInTheDocument();
  });
});
