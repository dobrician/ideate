// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { StatCard } from "@/components/stat-card";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

describe("StatCard component", () => {
  it("renders title and value", () => {
    render(
      <StatCard title="Projects" value={42} icon={<span data-testid="icon">P</span>} />,
    );

    expect(screen.getByText("Projects")).toBeInTheDocument();
    expect(screen.getByLabelText("Projects: 42")).toBeInTheDocument();
  });

  it("renders icon as aria-hidden", () => {
    render(
      <StatCard title="Votes" value={10} icon={<span data-testid="icon">V</span>} />,
    );

    const iconWrapper = screen.getByTestId("icon").parentElement;
    expect(iconWrapper).toHaveAttribute("aria-hidden", "true");
  });

  it("renders description when provided", () => {
    render(
      <StatCard
        title="Comments"
        value={7}
        icon={<span>C</span>}
        description="of 100 total"
      />,
    );

    expect(screen.getByText("of 100 total")).toBeInTheDocument();
  });

  it("does not render description when not provided", () => {
    const { container } = render(
      <StatCard title="Proposals" value={3} icon={<span>P</span>} />,
    );

    const descriptions = container.querySelectorAll(".text-xs.text-muted-foreground");
    expect(descriptions).toHaveLength(0);
  });

  it("formats large numbers with toLocaleString", () => {
    render(
      <StatCard title="Views" value={1234567} icon={<span>V</span>} />,
    );

    // toLocaleString will format with commas in en-US
    const valueEl = screen.getByLabelText("Views: 1234567");
    expect(valueEl).toBeInTheDocument();
    // The displayed text uses toLocaleString formatting
    expect(valueEl.textContent).toBe("1,234,567");
  });

  it("renders value of 0 correctly", () => {
    render(
      <StatCard title="Empty" value={0} icon={<span>E</span>} />,
    );

    expect(screen.getByLabelText("Empty: 0")).toBeInTheDocument();
    expect(screen.getByLabelText("Empty: 0").textContent).toBe("0");
  });

  it("wraps in a Link when href is provided", () => {
    render(
      <StatCard title="Linked" value={5} icon={<span>L</span>} href="/dashboard" />,
    );

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/dashboard");
    expect(screen.getByText("Linked")).toBeInTheDocument();
  });

  it("does not render a link without href", () => {
    render(
      <StatCard title="NoLink" value={3} icon={<span>N</span>} />,
    );

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
