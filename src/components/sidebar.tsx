"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Home,
  FolderOpen,
  User,
  LogOut,
  LayoutDashboard,
  Shield,
} from "lucide-react";
import { useLocale } from "@/lib/use-locale";
import { useEffect, useState } from "react";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

const navItems = [
  { href: "/", labelKey: "nav.home", icon: Home },
  { href: "/dashboard", labelKey: "nav.dashboard", icon: LayoutDashboard },
  { href: "/projects", labelKey: "nav.projects", icon: FolderOpen },
  { href: "/profile", labelKey: "nav.profile", icon: User },
];

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { t } = useLocale();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.role === "admin") setIsAdmin(true);
      })
      .catch(() => {});
  }, []);

  const allItems = [
    ...navItems,
    ...(isAdmin
      ? [{ href: "/admin", labelKey: "nav.admin", icon: Shield }]
      : []),
  ];

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 transition-opacity lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        role="navigation"
        aria-label="Main navigation"
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 border-r bg-sidebar text-sidebar-foreground transition-transform duration-200 ease-in-out lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-14 items-center border-b px-4">
          <span className="text-lg font-semibold">{t("nav.navigation")}</span>
        </div>
        <ScrollArea className="h-[calc(100vh-3.5rem)]">
          <nav className="space-y-1 p-4" aria-label="Site navigation">
            {allItems.map((item) => {
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150",
                    isActive
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {t(item.labelKey)}
                </Link>
              );
            })}
          </nav>

          <div className="border-t p-4">
            <form action="/auth/logout" method="POST">
              <button
                type="submit"
                className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-accent-foreground"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                {t("nav.signOut")}
              </button>
            </form>
          </div>
        </ScrollArea>
      </aside>
    </>
  );
}
