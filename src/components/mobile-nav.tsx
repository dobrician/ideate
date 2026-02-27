"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Home, FolderKanban, LayoutDashboard, User, MoreHorizontal } from "lucide-react";
import { useLocale } from "@/lib/use-locale";

interface NavItem {
  href: string;
  labelKey: string;
  icon: React.ElementType;
  matchPath: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/", labelKey: "mobile.nav.home", icon: Home, matchPath: "/" },
  { href: "/projects", labelKey: "mobile.nav.projects", icon: FolderKanban, matchPath: "/projects" },
  { href: "/dashboard", labelKey: "mobile.nav.dashboard", icon: LayoutDashboard, matchPath: "/dashboard" },
  { href: "/profile", labelKey: "mobile.nav.profile", icon: User, matchPath: "/profile" },
];

/**
 * Mobile bottom navigation bar.
 * Visible only on small screens (< 768px / md breakpoint).
 * All touch targets are at least 44px.
 */
export function MobileNav() {
  const pathname = usePathname();
  const { t } = useLocale();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
      aria-label={t("nav.mobileNavigation")}
      role="navigation"
    >
      <div className="flex items-center justify-around">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.matchPath ||
            (item.matchPath !== "/" && pathname.startsWith(item.matchPath));
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-h-[44px] min-w-[44px] flex-col items-center justify-center px-3 py-3 text-xs transition-colors ${
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              <span className="mt-1">{t(item.labelKey)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
