import type { Metadata } from "next";
import { Inter, Noto_Serif_Display, JetBrains_Mono } from "next/font/google";
import { SiteChrome } from "@/components/chrome/site-chrome";
import { ClientRecovery } from "@/components/system/client-recovery";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { ThemeScript } from "@/components/theme/theme-script";
import "./theme.css";
import "./globals.css";
import "./octivate-theme.css";
import "./chrome.css";
import "./i18n/site-translate.css";
import "./chrome/site-alerts.css";

const body = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const display = Noto_Serif_Display({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://octivate.io"),
  title: "Octivate — Decision intelligence for the Caribbean | CENSII",
  description:
    "Octivate connects scattered Caribbean information, tests what can be trusted and turns it into evidence-backed judgement for the decisions that cannot wait.",
  keywords: [
    "Caribbean decision intelligence",
    "Caribbean political risk analysis",
    "market entry Caribbean",
    "agentic AI analyst",
    "CENSII",
    "Octivate",
  ],
  authors: [{ name: "CENSII" }],
  openGraph: {
    title: "Octivate — Agentic Decision Intelligence for Fragmented Regional Markets",
    description:
      "A guided agentic workflow that structures the decision, runs the research, validates evidence and delivers an action-ready brief — built Caribbean-first.",
    url: "https://octivate.io",
    siteName: "Octivate by CENSII",
    type: "website",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Octivate",
  },
  applicationName: "Octivate",
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.svg", sizes: "192x192", type: "image/svg+xml" },
      { url: "/icons/icon-512.svg", sizes: "512x512", type: "image/svg+xml" },
    ],
    apple: [{ url: "/icons/icon-192.svg", sizes: "192x192", type: "image/svg+xml" }],
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning data-theme="light">
      <body className={`${body.variable} ${display.variable} ${mono.variable} font-body antialiased`}>
        <ThemeScript />
        <ThemeProvider>
          <ClientRecovery />
          <SiteChrome>{children}</SiteChrome>
        </ThemeProvider>
      </body>
    </html>
  );
}
