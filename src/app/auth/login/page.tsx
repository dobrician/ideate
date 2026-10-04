import { redirect } from "next/navigation";
import { getTranslations } from "@/lib/i18n-server";
import { getSafeRedirect } from "@/lib/auth-redirect";
import { Button } from "@/components/ui/button";

/** Enter SurCod SSO directly; show a retry only when the provider flow fails. */
export default async function LoginPage({ searchParams }: {
  searchParams: Promise<{ redirect?: string; error?: string }>;
}) {
  const params = await searchParams;
  const destination = getSafeRedirect(params.redirect ?? null);
  const href = `/api/auth/oidc?redirect=${encodeURIComponent(destination)}`;
  if (!params.error) redirect(href);
  const { t } = await getTranslations();
  return (
    <section data-sso-retry className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-5 px-6">
      <h1 className="text-2xl font-semibold">{t("auth.signIn")}</h1>
      <p role="alert" className="text-sm text-muted-foreground">{t("auth.oidcError")}</p>
      <Button asChild className="min-h-11"><a href={href}>{t("auth.signInWithOidc")}</a></Button>
    </section>
  );
}
