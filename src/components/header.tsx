"use client";

import { DarkModeToggle } from "@/components/dark-mode-toggle";
import { SearchBar } from "@/components/search-bar";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { User } from "lucide-react";
import { useLocale } from "@/lib/use-locale";

function MenuIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <line x1="4" x2="20" y1="12" y2="12" />
      <line x1="4" x2="20" y1="6" y2="6" />
      <line x1="4" x2="20" y1="18" y2="18" />
    </svg>
  );
}

interface HeaderProps {
  onToggleSidebar?: () => void;
}

export function Header({ onToggleSidebar }: HeaderProps) {
  const { t } = useLocale();

  return (
    <header role="banner" className="sticky top-0 z-50 flex h-14 items-center gap-4 border-b bg-background px-4 lg:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onToggleSidebar}
      >
        <MenuIcon className="h-5 w-5" />
        <span className="sr-only">{t("nav.toggleSidebar")}</span>
      </Button>

      <div className="flex items-center gap-2">
        <Link href="/" className="text-lg font-semibold hover:opacity-80">
          Ideate
        </Link>
      </div>

      <div className="hidden md:block flex-1 max-w-sm mx-4">
        <SearchBar />
      </div>

      <div className="ml-auto flex items-center gap-2">
        <LocaleSwitcher />
        <Button asChild variant="ghost" size="icon">
          <Link href="/profile">
            <User className="h-4 w-4" />
            <span className="sr-only">{t("nav.profile")}</span>
          </Link>
        </Button>
        <DarkModeToggle />
      </div>
    </header>
  );
}
