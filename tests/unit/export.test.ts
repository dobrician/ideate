import { describe, it, expect } from "vitest";
import { generateCsv, generateReportHtml } from "@/lib/export";

const mockProject = {
  title: "Test Project",
  description: "A test project description",
  status: "active",
  deadline: new Date("2026-03-01"),
  createdAt: new Date("2026-02-01"),
  proposals: [
    {
      title: "Proposal One",
      description: "First proposal",
      summary: "Summary of first",
      authorName: "Alice",
      createdAt: new Date("2026-02-10"),
      upvotes: 5,
      downvotes: 2,
      comments: [
        {
          content: "Great idea!",
          authorName: "Bob",
          createdAt: new Date("2026-02-11"),
        },
      ],
    },
    {
      title: "Proposal Two",
      description: null,
      summary: null,
      authorName: "Charlie",
      createdAt: new Date("2026-02-12"),
      upvotes: 3,
      downvotes: 3,
      comments: [],
    },
  ],
};

describe("Export", () => {
  describe("generateCsv", () => {
    it("should generate valid CSV with header row", () => {
      const csv = generateCsv(mockProject);
      const lines = csv.split("\n");
      expect(lines[0]).toBe(
        "Type,Title,Author,Description,Upvotes,Downvotes,Date"
      );
    });

    it("should include project row", () => {
      const csv = generateCsv(mockProject);
      expect(csv).toContain("Project,Test Project");
    });

    it("should include proposal rows", () => {
      const csv = generateCsv(mockProject);
      expect(csv).toContain("Proposal,Proposal One,Alice");
      expect(csv).toContain("Proposal,Proposal Two,Charlie");
    });

    it("should include comment rows", () => {
      const csv = generateCsv(mockProject);
      expect(csv).toContain("Comment");
      expect(csv).toContain("Bob");
    });

    it("should escape commas in fields", () => {
      const project = {
        ...mockProject,
        title: "Test, Project",
        proposals: [],
      };
      const csv = generateCsv(project);
      expect(csv).toContain('"Test, Project"');
    });
  });

  describe("generateReportHtml", () => {
    it("should generate valid HTML document", () => {
      const html = generateReportHtml(mockProject);
      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("</html>");
    });

    it("should include project title", () => {
      const html = generateReportHtml(mockProject);
      expect(html).toContain("Test Project");
    });

    it("should include proposal titles", () => {
      const html = generateReportHtml(mockProject);
      expect(html).toContain("Proposal One");
      expect(html).toContain("Proposal Two");
    });

    it("should include vote counts", () => {
      const html = generateReportHtml(mockProject);
      expect(html).toContain("+5 Pro");
      expect(html).toContain("-2 Contra");
    });

    it("should include comments", () => {
      const html = generateReportHtml(mockProject);
      expect(html).toContain("Great idea!");
      expect(html).toContain("Bob");
    });

    it("should include stats summary", () => {
      const html = generateReportHtml(mockProject);
      expect(html).toContain("2");
      expect(html).toContain("proposals");
    });

    it("should escape HTML in content", () => {
      const project = {
        ...mockProject,
        title: '<script>alert("xss")</script>',
        proposals: [],
      };
      const html = generateReportHtml(project);
      expect(html).not.toContain("<script>");
      expect(html).toContain("&lt;script&gt;");
    });
  });
});
