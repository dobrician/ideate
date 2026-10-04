// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { ProposalForm } from "@/components/proposal-form";
import { getTranslations } from "@/lib/i18n";

vi.mock("@/lib/use-locale", () => ({ useLocale: () => getTranslations("en") }));
vi.mock("@/lib/csrf-client", () => ({ getCsrfTokenClient: () => "csrf" }));
vi.mock("@/app/projects/[id]/proposals/actions", () => ({ createProposal: vi.fn(async () => ({ success: true })), castVote: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe("ProposalForm", () => {
  it("should open the idea drawer without a permanent sidebar or advanced tag controls", async () => {
    const user = userEvent.setup();
    render(<ProposalForm projectId="demo" availableTags={[{ id: "one", name: "Automation" }]} />);
    expect(screen.queryByLabelText("Title")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /New Proposal/ }));
    expect(screen.getByLabelText("Title")).toBeVisible();
    expect(screen.getByLabelText("Description (optional)")).toBeVisible();
    expect(screen.getByText("Automation")).not.toBeVisible();
    await user.keyboard("{Escape}");
    expect(screen.queryByLabelText("Title")).not.toBeInTheDocument();
  });

  it("should open the new proposal drawer from an accessible compact icon", async () => {
    render(<ProposalForm projectId="demo" compact />);
    await userEvent.click(screen.getByRole("button", { name: /New Proposal/ }));
    expect(screen.getByLabelText("Title")).toBeVisible();
  });
});
