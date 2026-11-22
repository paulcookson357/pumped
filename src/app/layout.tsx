import type { Metadata, Viewport } from "next";
import { BottomNav } from "@/components/layout/BottomNav";
import { TopHeader } from "@/components/layout/TopHeader";
import { ServiceWorkerRegistrar } from "@/components/pwa/ServiceWorkerRegistrar";
import { SyncBootstrap } from "@/components/pwa/SyncBootstrap";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pumped",
  description: "Personal mobile-first strength training tracker and calendar.",
  applicationName: "Pumped",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Pumped",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#FFFFFF",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-white text-zinc-950 antialiased">
        <ServiceWorkerRegistrar />
        <SyncBootstrap />
        <TopHeader />
        <main className="w-full px-4 pt-4 pb-24 sm:px-6">{children}</main>
        <BottomNav />
      </body>
    </html>
  );
}
