import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { AppShell } from "@/components/app-shell";
import { Toaster } from "@/components/ui/sonner";
import { PwaInstall } from "@/components/pwa-install";
import { ServiceWorkerRegistration } from "@/components/sw-register";
import { getRequestLocale } from "@/lib/i18n-server";
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
        <ThemeProvider>
          <AppShell>{children}</AppShell>
          <Toaster richColors closeButton position="bottom-right" />
          <PwaInstall />
          <ServiceWorkerRegistration />
        </ThemeProvider>
      </body>
    </html>
  );
}
