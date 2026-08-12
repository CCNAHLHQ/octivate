import { Suspense } from "react";
import { SiteNavbar } from "@/components/chrome/site-navbar";
import { SiteMarquee } from "@/components/chrome/site-marquee";
import { SiteFooter } from "@/components/chrome/site-footer";
import { NavigationProgress } from "@/components/chrome/navigation-progress";
import { AlertsProvider } from "@/components/alerts/alerts-provider";
import { Toaster } from "@/components/ui/toast";
import { LocaleProvider } from "@/components/i18n/locale-provider";
import { CookieConsent } from "@/components/cookies/cookie-consent";
import "@/app/cookies/cookie-consent.css";

/** Global chrome — navbar, signal ticker, footer on every route. */
export function SiteChrome({ children }: { children: React.ReactNode }) {
  return (
    <LocaleProvider>
      <div className="site-chrome flex min-h-screen flex-col" id="top">
        <NavigationProgress />
        <SiteNavbar />
        <SiteMarquee />
        <main id="main" className="site-main flex-1">
          {children}
        </main>
        <SiteFooter />
        <Toaster />
        <AlertsProvider />
        <Suspense fallback={null}>
          <CookieConsent />
        </Suspense>
      </div>
    </LocaleProvider>
  );
}
