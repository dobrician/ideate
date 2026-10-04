// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
vi.mock("next/navigation", () => ({
  usePathname: () => "/projects",
  useSearchParams: () => new URLSearchParams("q=budget&status=archived"),
}));
vi.mock("@/lib/use-locale", () => ({ useLocale: () => ({
  t: (key: string, params?: { page?: number }) => params?.page ? `${key}:${params.page}` : key,
}) }));
import { Pagination } from "@/components/pagination";
describe("Pagination", () => {
  it("should retain query context and current-page semantics in the compact Projects list", () => {
    render(<Pagination currentPage={3} totalPages={10} compactOnMobile />);
    expect(screen.getByRole("button", { name: "pagination.ariaPage:3" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "pagination.ariaNext" })).toHaveAttribute("href", "/projects?q=budget&status=archived&page=4");
    expect(screen.getByRole("link", { name: "pagination.ariaPrev" })).toHaveAttribute("href", "/projects?q=budget&status=archived&page=2");
  });
  it("should preserve the frozen project-detail page window without explicit opt-in", () => {
    const { container } = render(<Pagination currentPage={3} totalPages={10} />);
    expect(screen.getAllByRole("link")).toHaveLength(6);
    expect(container.querySelector(".hidden")).toBeNull();
  });
});
