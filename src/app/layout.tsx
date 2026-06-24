import type { Metadata } from "next";
import "./globals.css";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { Toaster } from "react-hot-toast";

export const metadata: Metadata = {
  title: "Aequora Digital — Workspace",
  description: "Internal project management for Aequora Digital",
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
          {children}
          <Toaster
            position="bottom-right"
            toastOptions={{
              className: "text-sm font-medium",
              style: { borderRadius: "8px", border: "1px solid #E5E7EB" },
            }}
          />
        </SessionProvider>
      </body>
    </html>
  );
}
