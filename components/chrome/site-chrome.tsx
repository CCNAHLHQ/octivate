import { Suspense } from "react";
import { SiteNavbar } from "@/components/chrome/site-navbar";
import { SiteFooter } from "@/components/chrome/site-footer";
import { NavigationProgress } from "@/components/chrome/navigation-progress";
import { AlertsProvider } from "@/components/alerts/alerts-provider";
import { Toaster } from "@/components/ui/toast";
import { LocaleProvider } from "@/components/i18n/locale-provider";
import { CookieConsent } from "@/components/cookies/cookie-consent";
import { SiteSupportBubble } from "@/components/chrome/site-support-bubble";
import "@/app/cookies/cookie-consent.css";

/**
 * Global chrome — navbar + footer on every route.
 * Signal ticker intentionally disabled for now.
 */
export function SiteChrome({ children }: { children: React.ReactNode }) {
  return (
    <LocaleProvider>
      <div className="site-chrome flex min-h-screen flex-col" id="top">
        <NavigationProgress />
        <SiteNavbar />
        <main id="main" className="site-main flex-1">
          {children}
        </main>
        <SiteFooter />
        <Toaster />
        <AlertsProvider />
        <SiteSupportBubble />
        <Suspense fallback={null}>
          <CookieConsent />
        </Suspense>
      </div>
    </LocaleProvider>
  );
}
