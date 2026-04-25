import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import Link from "next/link";
import MaintenanceMode from "@/components/MaintenanceMode";
import Navbar from "@/components/Navbar";
import MobileNav from "@/components/MobileNav";
import ToastContainer from "@/components/Toast";
import { Analytics } from "@vercel/analytics/react";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export async function generateMetadata(): Promise<Metadata> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("settings")
    .select("*")
    .eq("key", "site_config")
    .single();
  const siteConfig = data?.value || { title: "Antigravity" };

  return {
    metadataBase: new URL('https://v2.netix.my.id'),
    title: {
      default: `${siteConfig.title} | Film & Series Terlengkap`,
      template: `%s | ${siteConfig.title}`,
    },
    description: "Nonton Film & Series subtitle Indonesia terbaru gratis dengan kualitas HD.",
    openGraph: {
      title: `${siteConfig.title} | Film & Series Terlengkap`,
      description: "Nonton Film & Series subtitle Indonesia terbaru gratis dengan kualitas HD.",
      type: 'website',
      siteName: siteConfig.title,
    },
    robots: {
      index: true,
      follow: true,
    },
    manifest: '/manifest.json'
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  // Detect if current route is admin or auth page
  const headersList = await headers();
  const pathname = 
    headersList.get("x-pathname") || 
    headersList.get("x-invoke-path") || 
    headersList.get("x-url") || 
    "";
  
  const isAdminRoute = pathname.startsWith("/admin");
  const isAuthRoute = pathname === "/login" || pathname === "/register";

  // ⚡ PERFORMANCE: Run ALL DB calls in parallel instead of serial waterfall
  const [settingsResult, authResult] = await Promise.all([
    supabase.from("settings").select("*"),
    supabase.auth.getUser(),
  ]);

  const settingsData = settingsResult.data;
  const user = authResult.data?.user;

  const siteConfig = settingsData?.find((s) => s.key === "site_config")?.value || {
    title: "Antigravity",
    primary_color: "#eab308",
    navbar_color: "#38bdf8",
    maintenance_mode: false,
  };

  // Only fetch profile if user exists (conditional, not wasted)
  let isAdmin = false;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    isAdmin = profile?.role === "super_admin";
  }

  const isMaintenance = siteConfig.maintenance_mode && !isAdmin;

  // Split title for dual-tone (Logo)
  const titleParts = (siteConfig.title || "Antigravity").split(" ");
  const firstPart = titleParts[0];
  const secondPart = titleParts.slice(1).join(" ");

  // Colors
  const primaryColor = siteConfig.primary_color || "#eab308";
  const navbarColor = siteConfig.navbar_color || "#38bdf8";

  return (
    <html 
      lang="id" 
      suppressHydrationWarning 
      className={inter.variable}
      style={{
        // @ts-ignore
        '--primary': primaryColor,
        '--primary-glow': `${primaryColor}33`,
        '--navbar-text': navbarColor,
      }}
    >
      <head>
        {/* DNS Prefetch for faster external resource loading */}
        <link rel="dns-prefetch" href="https://image.tmdb.org" />
        <link rel="preconnect" href="https://image.tmdb.org" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://oqpubtvugpevpgflrjwv.supabase.co" />
        <link rel="preconnect" href="https://oqpubtvugpevpgflrjwv.supabase.co" crossOrigin="anonymous" />
      </head>
      <body suppressHydrationWarning className="font-sans antialiased text-gray-100 bg-[#0f0f0f] min-h-screen">
        {isAdminRoute || isAuthRoute ? (
          /* Admin/Auth routes: just render children */
          <>
            {children}
          </>
        ) : isMaintenance ? (
          <MaintenanceMode siteTitle={siteConfig.title} />
        ) : (
          <div className="min-h-screen flex flex-col pb-16 md:pb-0">
            {/* Top Navigation */}
            <Navbar brandName={siteConfig.title} />

            <main className="flex-1 w-full overflow-hidden">{children}</main>

            {/* Premium Footer (Desktop) */}
            <footer className="hidden md:block py-12 px-6 md:px-12 border-t border-white/5 bg-[#0f0f0f]">
              <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="text-2xl font-black uppercase tracking-tighter">
                  {firstPart}
                  <span className="text-primary">
                    {secondPart ? ` ${secondPart}` : ""}
                  </span>
                </div>
                <div className="flex gap-6 text-sm text-gray-500 font-semibold">
                  <Link
                    href="/terms"
                    className="hover:text-white transition-colors"
                  >
                    Term of Use
                  </Link>
                  <Link
                    href="/privacy"
                    className="hover:text-white transition-colors"
                  >
                    Privacy Policy
                  </Link>
                  <Link
                    href="/faq"
                    className="hover:text-white transition-colors"
                  >
                    FAQ
                  </Link>
                </div>
                <div className="text-gray-600 text-sm">
                  &copy; {new Date().getFullYear()} {siteConfig.title}. All
                  rights reserved.
                </div>
              </div>
            </footer>

            {/* Mobile Bottom Navigation */}
            <MobileNav />
          </div>
        )}
        <ToastContainer />
        <Analytics />
      </body>
    </html>
  );
}
