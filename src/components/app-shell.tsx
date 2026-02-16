"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Header } from "@/components/header";

const Sidebar = dynamic(
  () => import("@/components/sidebar").then((m) => ({ default: m.Sidebar })),
  { ssr: false }
);

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
        <main className="flex-1 overflow-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
