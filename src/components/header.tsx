"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { User, LogOut, Shield, Search, Globe, X } from "lucide-react";
import { SearchBar } from "@/components/search-bar";
import { DarkModeToggle } from "@/components/dark-mode-toggle";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useLocale } from "@/lib/use-locale";

interface HeaderUser {
  email?: string; firstName?: string | null; lastName?: string | null; role: string;
}

/** Present the Convergence brand in a floating, compact navigation bar. */
export function Header() {
  const pathname = usePathname();
  const { t, locale } = useLocale();
  const [user, setUser] = useState<HeaderUser | null>(null);
  const isLoggedIn = !!user;
  const isAdmin = user?.role === "admin";
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(" ");
  const initials = name ? `${user?.firstName?.[0] ?? ""}${user?.lastName?.[0] ?? ""}`.toUpperCase()
    : user?.email?.slice(0, 2).toUpperCase();
  const [searchOpen, setSearchOpen] = useState(false);
  const searchContainer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/me")
      .then(r => r.ok ? r.json() as Promise<HeaderUser> : null)
      .then(data => { if (active) setUser(data); })
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
    <header role="banner" className="sticky top-0 z-50 px-3 pt-3 sm:px-6">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 rounded-2xl border border-border/70 bg-background/95 px-3 shadow-sm backdrop-blur sm:gap-6 sm:px-5">
        <Link href="/" aria-label="Ideate" className="flex min-h-11 shrink-0 items-center gap-2 hover:opacity-80">
          <svg data-brand-mark aria-hidden="true" viewBox="0 0 42 42" className="size-7 shrink-0">
            <path d="M5 7h6c7 0 8 13 15 13h4M5 20h25M5 33h6c7 0 8-13 15-13h4" fill="none" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" />
            <circle cx="32" cy="20" r="5" className="fill-primary" />
          </svg>
          <span className="hidden min-[360px]:inline text-[22px] font-semibold leading-none tracking-[-1px]">ideate</span>
        </Link>
        <nav className="flex min-w-0" aria-label={t("nav.mainNavigation")}>
          <Link href="/projects" aria-current={pathname.startsWith("/projects") ? "page" : undefined}
            className="inline-flex min-h-11 items-center text-xs text-muted-foreground transition-colors hover:text-foreground sm:text-sm">
            {t("nav.projects")}
          </Link>
        </nav>
        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <Button variant="ghost" size="icon" aria-label={t("search.placeholder")}
            aria-expanded={searchOpen} aria-controls="app-search" onClick={() => setSearchOpen(!searchOpen)}>
            {searchOpen ? <X className="size-4" /> : <Search className="size-4" />}
          </Button>
          <DarkModeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full border border-border/60 bg-muted/60" aria-label={t("nav.profile")} title={t("nav.profile")}>
                {initials ? <span className="text-xs font-semibold" aria-hidden="true">{initials}</span> : <User className="size-4" />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60 rounded-xl p-2">
              {user?.email && <div className="border-b px-2 py-2.5 mb-1">
                <p className="truncate text-sm font-medium">{name || user.email}</p>
                {name && <p className="truncate text-xs text-muted-foreground">{user.email}</p>}
              </div>}
              <DropdownMenuItem asChild><Link href="/profile"><User className="size-4" />{t("nav.profile")}</Link></DropdownMenuItem>
              {isAdmin && <DropdownMenuItem asChild><Link href="/admin"><Shield className="size-4" />{t("nav.admin")}</Link></DropdownMenuItem>}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={event => {
                event.preventDefault();
                const next = locale === "en" ? "ro" : "en";
                document.cookie = `locale=${next}; expires=${new Date(Date.now() + 365 * 864e5).toUTCString()}; path=/; SameSite=Lax`;
                window.location.reload();
              }}><Globe className="size-4" />{t(locale === "ro" ? "locale.switchToEn" : "locale.switchToRo")}<span className="ml-auto text-xs text-muted-foreground">{locale.toUpperCase()}</span></DropdownMenuItem>

              {isLoggedIn && <><DropdownMenuSeparator /><DropdownMenuItem asChild>
                <form action="/auth/logout" method="POST"><button type="submit" className="flex w-full items-center gap-2"><LogOut className="size-4" />{t("nav.signOut")}</button></form>
              </DropdownMenuItem></>}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {searchOpen && <div id="app-search" ref={searchContainer} className="mx-auto mt-2 max-w-3xl rounded-xl border bg-background p-3 shadow-sm"><SearchBar /></div>}
    </header>
  );
}
