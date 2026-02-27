import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { AppShell } from "@/components/app-shell";
import { Toaster } from "@/components/ui/sonner";
import { PwaInstall } from "@/components/pwa-install";
import { ServiceWorkerRegistration } from "@/components/sw-register";
import { OfflineIndicator } from "@/components/offline-indicator";
import { MobileNav } from "@/components/mobile-nav";
import { SkipNav } from "@/components/skip-nav";
import { AppUpdate } from "@/components/app-update";
import { getRequestLocale } from "@/lib/i18n-server";
import { LocaleProvider } from "@/lib/use-locale";
import { OnboardingCheck } from "@/components/onboarding-check";
import "./globals.css";

const inter = Inter({ subsets: ["latin", "latin-ext"] });

export const metadata: Metadata = {
  title: {
    default: "Ideate - Democratic Idea Prioritization",
    template: "%s | Ideate",
  },
  description:
    "Enterprise-grade democratic idea prioritization platform for teams. Create projects, submit proposals, vote, and discuss.",
  manifest: "/manifest.json",
  applicationName: "Ideate",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icons/icon.svg", type: "image/svg+xml" },
    ],
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Ideate",
  },
  openGraph: {
    type: "website",
    siteName: "Ideate",
    title: "Ideate - Democratic Idea Prioritization",
    description:
      "Enterprise-grade democratic idea prioritization platform for teams",
    locale: "en_US",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: "#0070f3",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getRequestLocale();

  return (
    <html lang={locale} suppressHydrationWarning>
      <head />
      <body className={`${inter.className} antialiased`}>
        <LocaleProvider locale={locale}>
        <ThemeProvider>
          <SkipNav />
          <AppShell>
            <main id="main-content">
              {children}
            </main>
            <OnboardingCheck />
          </AppShell>
          <MobileNav />
          <Toaster richColors closeButton position="bottom-right" />
          <PwaInstall />
          <OfflineIndicator />
          <AppUpdate />
          <ServiceWorkerRegistration />
        </ThemeProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
