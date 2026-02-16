"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { User, LogOut, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { DarkModeToggle } from "@/components/dark-mode-toggle";
import { SearchBar } from "@/components/search-bar";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLocale } from "@/lib/use-locale";

const NAV_ITEMS = [
  { href: "/dashboard", labelKey: "nav.dashboard" },
  { href: "/projects", labelKey: "nav.projects" },
];

export function Header() {
  const pathname = usePathname();
  const { t } = useLocale();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setIsLoggedIn(true);
        if (data?.role === "admin") setIsAdmin(true);
      })
      .catch(() => {});
  }, []);

  const allNavItems = [
    ...NAV_ITEMS,
    ...(isAdmin ? [{ href: "/admin", labelKey: "nav.admin" }] : []),
  ];

  return (
    <header role="banner" className="sticky top-0 z-50 border-b bg-background">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 lg:px-6">
        <Link href="/" className="text-lg font-semibold hover:opacity-80">
          Ideate
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Main navigation">
          {allNavItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150",
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                {t(item.labelKey)}
              </Link>
            );
          })}
        </nav>

        <div className="hidden flex-1 justify-center md:flex">
          <div className="w-full max-w-sm">
            <SearchBar />
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <LocaleSwitcher />
          <DarkModeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" title={t("nav.profile")}>
                <User className="h-4 w-4" />
                <span className="sr-only">{t("nav.profile")}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem asChild>
                <Link href="/profile" className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  {t("nav.profile")}
                </Link>
              </DropdownMenuItem>
              {isAdmin && (
                <DropdownMenuItem asChild className="md:hidden">
                  <Link href="/admin" className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    {t("nav.admin")}
                  </Link>
                </DropdownMenuItem>
              )}
              {isLoggedIn && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <form action="/auth/logout" method="POST">
                      <button
                        type="submit"
                        className="flex w-full items-center gap-2"
                      >
                        <LogOut className="h-4 w-4" />
                        {t("nav.signOut")}
                      </button>
                    </form>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <nav className="border-t md:hidden" aria-label="Mobile navigation">
        <div className="mx-auto flex max-w-7xl items-center gap-1 px-4 py-1">
          {allNavItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150",
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                {t(item.labelKey)}
              </Link>
            );
          })}
        </div>
      </nav>
    </header>
  );
}
