// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { ProjectCard } from "@/components/project-card";
import { getTranslations } from "@/lib/i18n";

const project = { id: "demo", title: "Customer experience", summary: "Choose three improvements.", description: "Detailed background.", status: "active", deadline: new Date("2026-11-17") };

describe("ProjectCard", () => {
  it("should preserve linked summary text without nesting links in the project link", () => {
    render(<ProjectCard project={{ ...project, summary: "Choose [onboarding](https://example.com)." }} proposalCount={1} voteCount={1} {...getTranslations("en")} />);
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.getByRole("link")).toHaveTextContent("Choose onboarding.");
  });
  it("should prioritize the AI summary and voting totals in a single project link", () => {
    render(<ProjectCard project={project} proposalCount={10} voteCount={97} {...getTranslations("en")} />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/projects/demo");
    expect(screen.getByText(project.summary)).toBeVisible();
    expect(screen.queryByText(project.description)).not.toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveTextContent("10 proposals97 votes cast");
  });
  it("should fall back to the first context paragraph and support zero votes", () => {
    render(<ProjectCard project={{ ...project, summary: null, description: "First paragraph.\n\nDetails." }} proposalCount={0} voteCount={0} {...getTranslations("ro")} />);
    expect(screen.getByText("First paragraph.")).toBeVisible();
    expect(screen.queryByText("Details.")).not.toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveTextContent("0 voturi exprimate");
  });
  it("should render projects that have no optional description", () => {
    render(<ProjectCard project={{ ...project, summary: null, description: null }} proposalCount={0} voteCount={0} {...getTranslations("en")} />);
    expect(screen.getByRole("heading")).toHaveTextContent(project.title);
  });
});
