import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  FolderOpen,
  Lightbulb,
  BarChart3,
  Users,
  LayoutDashboard,
} from "lucide-react";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Ideate",
  description:
    "Enterprise-grade democratic idea prioritization platform for teams",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Any",
  url: "https://idea.surmont.co",
};

export default function HomePage() {
  return (
    <main className="mx-auto max-w-4xl space-y-8 px-4 py-8" role="main">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="text-center sm:text-left">
        <h2 className="text-3xl font-bold tracking-tight">
          Welcome to Ideate
        </h2>
        <p className="mt-2 text-muted-foreground">
          Democratic idea prioritization for teams. Create projects, submit
          proposals, vote, and discuss.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button asChild size="lg">
          <Link href="/projects">
            <FolderOpen className="mr-2 h-4 w-4" />
            View Projects
          </Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/dashboard">
            <LayoutDashboard className="mr-2 h-4 w-4" />
            Dashboard
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" role="region" aria-label="Platform features">
        <Card className="transition-shadow duration-200 hover:shadow-md">
          <CardHeader>
            <FolderOpen className="mb-2 h-6 w-6 text-muted-foreground" aria-hidden="true" />
            <CardTitle>Projects</CardTitle>
            <CardDescription>
              Create and manage idea prioritization projects with deadlines and
              status tracking
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="transition-shadow duration-200 hover:shadow-md">
          <CardHeader>
            <Lightbulb className="mb-2 h-6 w-6 text-muted-foreground" aria-hidden="true" />
            <CardTitle>Proposals</CardTitle>
            <CardDescription>
              Submit proposals, vote pro or contra, and see AI-generated
              summaries
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="transition-shadow duration-200 hover:shadow-md">
          <CardHeader>
            <BarChart3 className="mb-2 h-6 w-6 text-muted-foreground" aria-hidden="true" />
            <CardTitle>Consensus</CardTitle>
            <CardDescription>
              Real-time vote charts show team alignment and help prioritize
              ideas
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="transition-shadow duration-200 hover:shadow-md">
          <CardHeader>
            <Users className="mb-2 h-6 w-6 text-muted-foreground" aria-hidden="true" />
            <CardTitle>Discussions</CardTitle>
            <CardDescription>
              Threaded comments on every proposal for structured team
              conversations
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="transition-shadow duration-200 hover:shadow-md">
          <CardHeader>
            <LayoutDashboard className="mb-2 h-6 w-6 text-muted-foreground" aria-hidden="true" />
            <CardTitle>Dashboard</CardTitle>
            <CardDescription>
              Personal overview of your projects, proposals, votes, and recent
              activity
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </main>
  );
}
