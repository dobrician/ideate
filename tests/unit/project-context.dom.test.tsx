// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { ProjectContext } from "@/components/project-context";

describe("ProjectContext", () => {
  it("should replace the summary with context and preserve the footer", () => {
    render(<ProjectContext preview={<p>AI overview</p>} context={<p>Full project context</p>} stats={<p aria-label="Votes">97 votes</p>} label="Context & details" />);
    const footer = screen.getByLabelText("Votes");
    const toggle = screen.getByRole("button", { name: "Context & details" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(screen.queryByText("AI overview")).toBeNull();
    expect(screen.getByText("Full project context")).toBeVisible();
    expect(screen.getByLabelText("Votes")).toBe(footer);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(toggle);
    expect(screen.getByText("AI overview")).toBeVisible();
    expect(screen.queryByText("Full project context")).toBeNull();
  });
});
