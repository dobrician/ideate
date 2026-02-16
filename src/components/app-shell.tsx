"use client";

import { usePathname } from "next/navigation";
import { Header } from "@/components/header";

const AUTH_PATHS = ["/auth/login", "/auth/register", "/auth/forgot-password", "/auth/reset-password", "/auth/verify-email"];

function isAuthPath(pathname: string): boolean {
  return AUTH_PATHS.some((p) => pathname.startsWith(p));
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (isAuthPath(pathname)) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 overflow-auto p-4 lg:p-6">{children}</main>
    </div>
  );
}
