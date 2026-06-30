import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { ServiceWorkerRegistration } from "@/components/providers/ServiceWorkerRegistration";
import { Toaster } from "react-hot-toast";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

export const metadata: Metadata = {
  title: "Aequora Digital — Workspace",
  description: "Internal project management for Aequora Digital",
  applicationName: "Aequora Digital",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Aequora",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#0F7B8A",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <SessionProvider>
          <ServiceWorkerRegistration />
          {children}
          <Toaster
            position="bottom-right"
            toastOptions={{
              className: "text-sm font-medium",
              style: { borderRadius: "8px", border: "1px solid #E5E7EB" },
            }}
          />
          <Analytics />
          <SpeedInsights />
        </SessionProvider>
      </body>
    </html>
  );
}
