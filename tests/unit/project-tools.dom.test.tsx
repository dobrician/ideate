// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { ProjectTools } from "@/components/project-tools";

vi.mock("@/lib/use-locale", () => ({ useLocale: () => ({ t: (key: string) => key === "projects.moreActions" ? "More actions" : "Actions" }) }));

describe("ProjectTools", () => {
  it("should reveal secondary actions only on request and close with Escape", async () => {
    const user = userEvent.setup();
    render(<ProjectTools><button>Download PDF</button><button>Edit project</button></ProjectTools>);
    expect(screen.queryByText("Download PDF")).not.toBeInTheDocument();
    const trigger = screen.getByRole("button", { name: "More actions" });
    await user.click(trigger);
    expect(screen.getByRole("button", { name: "Download PDF" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Edit project" })).toBeVisible();
    await user.keyboard("{Escape}");
    expect(screen.queryByText("Download PDF")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
