"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { User, LogOut, Shield, Search, Globe, Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";
import { DarkModeToggle } from "@/components/dark-mode-toggle";
import { SearchBar } from "@/components/search-bar";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { useTheme } from "@/components/theme-provider";
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
  const { t, locale } = useLocale();
  const { theme, setTheme } = useTheme();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

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
        <Link href="/" className="flex items-center gap-2 hover:opacity-80">
          <Image src="/logo.png" alt="" width={28} height={28} className="h-7 w-7" />
          <span className="text-lg font-semibold">Ideate</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label={t("nav.mainNavigation")}>
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

        {!pathname.startsWith("/admin") && (
          <div className="hidden flex-1 justify-center md:flex">
            <div className="w-full max-w-sm">
              <SearchBar />
            </div>
          </div>
        )}

        <div className="ml-auto flex items-center gap-2 md:ml-0">
          {!pathname.startsWith("/admin") && (
            <Button
              variant="ghost"
              size="icon"
              className="min-h-[44px] min-w-[44px] md:hidden"
              aria-label={t("search.placeholder")}
              onClick={() => setMobileSearchOpen((o) => !o)}
            >
              <Search className="h-4 w-4" />
            </Button>
          )}
          <div className="hidden md:flex md:items-center md:gap-2">
            <LocaleSwitcher />
            <DarkModeToggle />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="min-h-[44px] min-w-[44px]" aria-label={t("nav.profile")} title={t("nav.profile")}>
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
              <DropdownMenuSeparator className="md:hidden" />
              <DropdownMenuItem
                className="flex items-center gap-2 md:hidden"
                onSelect={(e) => {
                  e.preventDefault();
                  const next = locale === "en" ? "ro" : "en";
                  document.cookie = `locale=${next}; expires=${new Date(Date.now() + 365 * 864e5).toUTCString()}; path=/; SameSite=Lax`;
                  window.location.reload();
                }}
              >
                <Globe className="h-4 w-4" />
                {t(locale === "ro" ? "locale.switchToEn" : "locale.switchToRo")}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="flex items-center gap-2 md:hidden"
                onSelect={(e) => {
                  e.preventDefault();
                  setTheme(theme === "dark" ? "light" : "dark");
                }}
              >
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                {t("theme.toggle")}
              </DropdownMenuItem>
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

      <nav className="border-t md:hidden" aria-label={t("nav.mobileNavigation")}>
        <div className="mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-4 py-1">
          {allNavItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "shrink-0 whitespace-nowrap rounded-md px-3 py-2.5 text-sm font-medium transition-colors duration-150",
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

      {mobileSearchOpen && (
        <div className="border-t bg-background px-4 py-2 md:hidden">
          <SearchBar />
        </div>
      )}
    </header>
  );
}
