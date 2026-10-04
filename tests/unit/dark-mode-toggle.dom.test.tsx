// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { ThemeProvider } from "@/components/theme-provider";
import { DarkModeToggle } from "@/components/dark-mode-toggle";

vi.mock("@/lib/use-locale", () => ({
  useLocale: () => ({ t: () => "Toggle theme" }),
}));

describe("DarkModeToggle", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true })));
  });

  it("should override system darkness and retain the manual choice after remount", async () => {
    const user = userEvent.setup();
    const view = render(<ThemeProvider><DarkModeToggle /></ThemeProvider>);
    await waitFor(() => expect(document.documentElement).toHaveClass("dark"));
    await user.click(screen.getByRole("button", { name: "Toggle theme" }));
    await waitFor(() => expect(document.documentElement).not.toHaveClass("dark"));
    expect(localStorage.getItem("theme")).toBe("light");
    view.unmount();
    render(<ThemeProvider><DarkModeToggle /></ThemeProvider>);
    expect(document.documentElement).not.toHaveClass("dark");
    await user.click(screen.getByRole("button", { name: "Toggle theme" }));
    await waitFor(() => expect(document.documentElement).toHaveClass("dark"));
    expect(localStorage.getItem("theme")).toBe("dark");
  });

  it("should let keyboard users switch an explicit light theme", async () => {
    localStorage.setItem("theme", "light");
    render(<ThemeProvider><DarkModeToggle /></ThemeProvider>);
    const button = screen.getByRole("button", { name: "Toggle theme" });
    button.focus();
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(document.documentElement).toHaveClass("dark"));
    expect(localStorage.getItem("theme")).toBe("dark");
  });
});
