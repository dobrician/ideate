"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { User, LogOut, Shield, Search, Globe, Sun, Moon, LayoutDashboard, X } from "lucide-react";
import { DarkModeToggle } from "@/components/dark-mode-toggle";
import { SearchBar } from "@/components/search-bar";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useLocale } from "@/lib/use-locale";

/** Keep projects in the main navigation and utilities in the account menu. */
export function Header() {
  const pathname = usePathname();
  const { t, locale } = useLocale();
  const { theme, setTheme } = useTheme();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchContainer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/me")
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (active) { setIsLoggedIn(!!data); setIsAdmin(data?.role === "admin"); } })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === "Escape") setSearchOpen(false);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  useEffect(() => {
    if (searchOpen) searchContainer.current?.querySelector("input")?.focus();
  }, [searchOpen]);

  return (
    <header role="banner" className="sticky top-0 z-50 border-b border-border/60 bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-5xl items-center gap-5 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 hover:opacity-80">
          <Image src="/logo.png" alt="" width={28} height={28} className="size-7" />
          <span className="text-lg font-semibold tracking-tight">Ideate</span>
        </Link>
        <nav className="hidden md:flex" aria-label={t("nav.mainNavigation")}>
          <Link href="/projects" aria-current={pathname.startsWith("/projects") ? "page" : undefined}
            className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            {t("nav.projects")}
          </Link>
        </nav>
        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <Button variant="ghost" size="icon" aria-label={t("search.placeholder")}
            aria-expanded={searchOpen} aria-controls="app-search" onClick={() => setSearchOpen(!searchOpen)}>
            {searchOpen ? <X className="size-4" /> : <Search className="size-4" />}
          </Button>
          <div className="hidden items-center gap-1 md:flex"><LocaleSwitcher /><DarkModeToggle /></div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={t("nav.profile")} title={t("nav.profile")}>
                <User className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem asChild><Link href="/profile"><User className="size-4" />{t("nav.profile")}</Link></DropdownMenuItem>
              {isLoggedIn && <DropdownMenuItem asChild><Link href="/dashboard"><LayoutDashboard className="size-4" />{t("nav.dashboard")}</Link></DropdownMenuItem>}
              {isAdmin && <DropdownMenuItem asChild><Link href="/admin"><Shield className="size-4" />{t("nav.admin")}</Link></DropdownMenuItem>}
              <DropdownMenuSeparator className="md:hidden" />
              <DropdownMenuItem className="md:hidden" onSelect={event => {
                event.preventDefault();
                const next = locale === "en" ? "ro" : "en";
                document.cookie = `locale=${next}; expires=${new Date(Date.now() + 365 * 864e5).toUTCString()}; path=/; SameSite=Lax`;
                window.location.reload();
              }}><Globe className="size-4" />{t(locale === "ro" ? "locale.switchToEn" : "locale.switchToRo")}</DropdownMenuItem>
              <DropdownMenuItem className="md:hidden" onSelect={event => {
                event.preventDefault(); setTheme(theme === "dark" ? "light" : "dark");
              }}>{theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}{t("theme.toggle")}</DropdownMenuItem>
              {isLoggedIn && <><DropdownMenuSeparator /><DropdownMenuItem asChild>
                <form action="/auth/logout" method="POST"><button type="submit" className="flex w-full items-center gap-2"><LogOut className="size-4" />{t("nav.signOut")}</button></form>
              </DropdownMenuItem></>}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {searchOpen && <div id="app-search" ref={searchContainer} className="mx-auto max-w-3xl px-4 pb-4"><SearchBar /></div>}
    </header>
  );
}
