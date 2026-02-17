"use client";

import { usePathname } from "next/navigation";
import { Header } from "@/components/header";
import { useLocale } from "@/lib/use-locale";

const AUTH_PATHS = ["/auth/login", "/auth/register", "/auth/forgot-password", "/auth/reset-password", "/auth/verify-email"];

function isAuthPath(pathname: string): boolean {
  return AUTH_PATHS.some((p) => pathname.startsWith(p));
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { t } = useLocale();

  if (isAuthPath(pathname)) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[100] focus:rounded focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:shadow-lg"
      >
        {t("a11y.skipToMain")}
      </a>
      <Header />
      <main id="main-content" className="flex-1 overflow-auto p-4 lg:p-6">{children}</main>
    </div>
  );
}
