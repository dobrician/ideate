// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { ProjectOverview } from "@/components/project-overview";
import { getTranslations } from "@/lib/i18n";

vi.mock("@/components/deadline-countdown", () => ({
  DeadlineCountdown: () => <span>45 days left</span>,
}));

const project = {
  title: "Choose the next three improvements",
  summary: "Prioritize onboarding, customer support and transparency.",
  description: "Full context and participation guidelines.",
  status: "active", deadline: new Date("2027-01-01"),
  createdAt: new Date("2026-09-21"), updatedAt: new Date("2026-10-03"),
};
const props = {
  project, stats: { votes: 97, voters: 12 }, tags: [{ id: "demo", name: "Demo" }],
  ...getTranslations("en"), tools: <button>More actions</button>,
};

describe("ProjectOverview", () => {
  it("should show the AI summary and participation without revealing administrative details", () => {
    render(<ProjectOverview {...props} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(project.title);
    expect(screen.getByText(project.summary)).toBeVisible();
    expect(screen.getByLabelText("Voting so far")).toHaveTextContent("45 days left97 votes cast12 people voted");
    expect(screen.getByText(project.description)).not.toBeVisible();
    expect(screen.getByText("Created")).not.toBeVisible();
    expect(screen.getByText("Last Updated")).not.toBeVisible();
    expect(screen.getByText("Demo")).not.toBeVisible();
  });

  it("should reveal the original context when the user opens details", () => {
    render(<ProjectOverview {...props} />);
    fireEvent.click(screen.getByText("Context & details"));
    expect(screen.getByText(project.description)).toBeVisible();
    expect(screen.getByText("Created")).toBeVisible();
    expect(screen.getByText("Demo")).toBeVisible();
  });

  it("should use the first description paragraph when no AI summary exists", () => {
    render(<ProjectOverview {...props} project={{ ...project, summary: null, description: "First paragraph.\n\nLonger context." }} />);
    expect(screen.getAllByText("First paragraph.")[0]).toBeVisible();
    expect(screen.getByText("Longer context.")).not.toBeVisible();
  });

  it("should render zero participation and missing optional context in Romanian", () => {
    render(<ProjectOverview {...props} {...getTranslations("ro")}
      project={{ ...project, summary: null, description: null, createdAt: null, updatedAt: null }}
      stats={{ votes: 0, voters: 0 }} tags={[]} />);
    expect(screen.getByLabelText("Votarea până acum")).toHaveTextContent("45 days left0 voturi exprimate0 persoane au votat");
    expect(screen.queryByText("Created")).not.toBeInTheDocument();
  });
});


describe("ProjectOverview compact metadata", () => {
  it("should place the deadline before the statistics and omit the active badge", () => {
    render(<ProjectOverview {...props} />);
    expect(screen.queryByText("Active")).toBeNull();
    expect(screen.getByLabelText("Voting so far")).toHaveTextContent("45 days left97 votes cast12 people voted");
  });
  it("should reduce contrast for archived projects and keep their status", () => {
    const { container } = render(<ProjectOverview {...props} project={{ ...project, status: "archived" }} />);
    expect(container.querySelector("section")).toHaveClass("opacity-65");
    expect(screen.getByText("Archived")).toBeVisible();
  });
});
