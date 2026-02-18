import { describe, it, expect } from "vitest";
import { generateCsv, generatePdf } from "@/lib/export";
import { formatDate } from "@/lib/export-types";

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

    it("should include project comments when present", () => {
      const project = {
        ...mockProject,
        projectComments: [
          { content: "Great project!", authorName: "Eve", createdAt: new Date("2026-02-15") },
        ],
      };
      const csv = generateCsv(project);
      expect(csv).toContain("ProjectComment");
      expect(csv).toContain("Eve");
      expect(csv).toContain("Great project!");
    });

    it("should handle null project description", () => {
      const project = { ...mockProject, description: null, proposals: [] };
      const csv = generateCsv(project);
      expect(csv).toContain("Project,Test Project,,");
    });

    it("should escape double quotes in fields", () => {
      const project = {
        ...mockProject,
        title: 'Say "Hello"',
        proposals: [],
      };
      const csv = generateCsv(project);
      expect(csv).toContain('"Say ""Hello"""');
    });

    it("should use summary when description is null", () => {
      const project = {
        ...mockProject,
        proposals: [{
          title: "P",
          description: null,
          summary: "A summary",
          authorName: "X",
          createdAt: new Date("2026-02-10"),
          upvotes: 0,
          downvotes: 0,
          comments: [],
        }],
      };
      const csv = generateCsv(project);
      expect(csv).toContain("A summary");
    });
  });

  describe("generatePdf", () => {
    it("should generate a valid PDF binary starting with %PDF header", async () => {
      const buffer = await generatePdf(mockProject);
      expect(buffer).toBeInstanceOf(ArrayBuffer);
      expect(buffer.byteLength).toBeGreaterThan(0);
      const header = new TextDecoder().decode(new Uint8Array(buffer).slice(0, 5));
      expect(header).toBe("%PDF-");
    });

    it("should handle project with no proposals", async () => {
      const emptyProject = { ...mockProject, proposals: [] };
      const buffer = await generatePdf(emptyProject);
      const header = new TextDecoder().decode(new Uint8Array(buffer).slice(0, 5));
      expect(header).toBe("%PDF-");
    });

    it("should handle project with project comments", async () => {
      const projectWithComments = {
        ...mockProject,
        projectComments: [
          { content: "A project comment", authorName: "Eve", createdAt: new Date("2026-02-15") },
        ],
      };
      const buffer = await generatePdf(projectWithComments);
      expect(buffer.byteLength).toBeGreaterThan(0);
    });

    it("should handle page overflow with many proposals", async () => {
      const manyProposals = Array.from({ length: 15 }, (_, i) => ({
        title: `Proposal ${i + 1}`,
        description: "A ".repeat(200),
        summary: null,
        authorName: `Author ${i}`,
        createdAt: new Date("2026-02-10"),
        upvotes: i + 1,
        downvotes: i,
        comments: [
          { content: "Comment text here", authorName: "Bob", createdAt: new Date("2026-02-11") },
        ],
      }));
      const bigProject = { ...mockProject, proposals: manyProposals };
      const buffer = await generatePdf(bigProject);
      expect(buffer.byteLength).toBeGreaterThan(0);
    });

    it("should handle project with no description", async () => {
      const project = { ...mockProject, description: null };
      const buffer = await generatePdf(project);
      const header = new TextDecoder().decode(new Uint8Array(buffer).slice(0, 5));
      expect(header).toBe("%PDF-");
    });

    it("should handle proposals with zero votes", async () => {
      const project = {
        ...mockProject,
        proposals: [{
          title: "Zero Votes",
          description: null,
          summary: null,
          authorName: "Alice",
          createdAt: new Date("2026-02-10"),
          upvotes: 0,
          downvotes: 0,
          comments: [],
        }],
      };
      const buffer = await generatePdf(project);
      expect(buffer.byteLength).toBeGreaterThan(0);
    });

    it("should pluralize comments label when proposal has multiple comments", async () => {
      const project = {
        ...mockProject,
        proposals: [{
          title: "Multi Comment",
          description: null,
          summary: null,
          authorName: "Alice",
          createdAt: new Date("2026-02-10"),
          upvotes: 1,
          downvotes: 0,
          comments: [
            { content: "First", authorName: "Bob", createdAt: new Date("2026-02-11") },
            { content: "Second", authorName: "Eve", createdAt: new Date("2026-02-12") },
          ],
        }],
      };
      const buffer = await generatePdf(project);
      expect(buffer.byteLength).toBeGreaterThan(0);
    });
  });

  describe("formatDate", () => {
    it("returns N/A for null date", () => {
      expect(formatDate(null)).toBe("N/A");
    });

    it("formats date with default en-US locale", () => {
      const result = formatDate(new Date("2026-03-15"));
      expect(result).toContain("2026");
      expect(result).toContain("Mar");
    });

    it("formats date with Romanian locale", () => {
      const result = formatDate(new Date("2026-03-15"), "ro-RO");
      expect(result).toContain("2026");
      expect(result).toMatch(/mar/i);
    });

    it("handles POSIX locale format with underscores", () => {
      const result = formatDate(new Date("2026-06-20"), "ro_RO");
      expect(result).toContain("2026");
      expect(result).toMatch(/iun/i);
    });

    it("respects process.env.LOCALE when no explicit locale is passed", () => {
      const orig = process.env.LOCALE;
      try {
        process.env.LOCALE = "ro-RO";
        const result = formatDate(new Date("2026-03-15"));
        expect(result).toContain("2026");
        expect(result).toMatch(/mar/i);
      } finally {
        if (orig === undefined) delete process.env.LOCALE;
        else process.env.LOCALE = orig;
      }
    });
  });
});
