// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { MobileNav } from "@/components/mobile-nav";

let pathname = "/projects/demo";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));
vi.mock("@/lib/use-locale", () => ({ useLocale: () => ({ t: (key: string) => key }) }));

describe("MobileNav", () => {
  it("should expose only projects and profile and mark the active destination", () => {
    pathname = "/projects/demo";
    render(<MobileNav />);
    expect(screen.getAllByRole("link")).toHaveLength(2);
    expect(screen.getByRole("link", { name: "mobile.nav.projects" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "mobile.nav.profile" })).not.toHaveAttribute("aria-current");
  });
  it.each(["/", "/auth/login"])("should omit bottom navigation on %s", path => {
    pathname = path;
    render(<MobileNav />);
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });
});
