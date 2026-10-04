import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getTranslations } from "@/lib/i18n-server";
import { getCurrentUser } from "@/lib/auth";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Ideate",
  description:
    "Enterprise-grade democratic idea prioritization platform for teams",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Any",
  url: process.env.APP_URL || "https://ideate.surcod.ro",
};

/** Introduce the three-step decision workflow and send members to projects. */
export default async function HomePage() {
  const user = await getCurrentUser();
  if (user) redirect("/projects");

  const { t } = await getTranslations();

  return (
    <main className="mx-auto max-w-4xl space-y-8 py-8 sm:space-y-10 sm:py-16" role="main">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="max-w-2xl">
        <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
          {t("home.welcome")}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {t("home.description")}
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button asChild size="lg">
          <Link href="/auth/login">
            {t("home.getStarted")}
          </Link>
        </Button>

      </div>

      <section className="grid gap-5 border-t pt-8 sm:grid-cols-3" aria-label={t("home.ariaFeatures")}>
        {[["01", "home.feature.projects", "home.feature.projectsDesc"], ["02", "home.feature.proposals", "home.feature.proposalsDesc"], ["03", "home.feature.consensus", "home.feature.consensusDesc"]].map(([step, title, description]) => (
          <div key={step}>
            <span className="text-xs font-medium text-muted-foreground">{step}</span>
            <h2 className="mt-2 text-base font-semibold">{t(title)}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t(description)}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
