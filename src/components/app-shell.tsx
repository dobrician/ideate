"use client";

import { usePathname } from "next/navigation";
import { Header } from "@/components/header";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/auth/login") {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <div className="min-w-0 flex-1 px-4 py-4 pb-6 lg:px-6">{children}</div>
    </div>
  );
}
