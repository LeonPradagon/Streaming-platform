import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import MaintenanceMode from "@/components/MaintenanceMode";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
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
  const siteConfig = data?.value || { title: "NETIX" };

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
  const pathname = headersList.get("x-pathname") || "";
  
  const isAdminRoute = pathname.startsWith("/admin");
  const isAuthRoute = pathname.startsWith("/login") || pathname.startsWith("/register");

  const [settingsResult, authResult] = await Promise.all([
    supabase.from("settings").select("*"),
    supabase.auth.getUser(),
  ]);

  const settingsData = settingsResult.data;
  const user = authResult.data?.user;

  const siteConfig = settingsData?.find((s) => s.key === "site_config")?.value || {
    title: "NETIX",
    primary_color: "#eab308",
    navbar_color: "#38bdf8",
    maintenance_mode: false,
  };

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
        <link rel="dns-prefetch" href="https://image.tmdb.org" />
        <link rel="preconnect" href="https://image.tmdb.org" crossOrigin="anonymous" />
      </head>
      <body suppressHydrationWarning className="font-sans antialiased text-gray-100 bg-[#0f0f0f] min-h-screen">
        {isAdminRoute || isAuthRoute ? (
          <>{children}</>
        ) : isMaintenance ? (
          <MaintenanceMode siteTitle={siteConfig.title} />
        ) : (
          <div className="min-h-screen flex flex-col">
            <Navbar brandName={siteConfig.title} />
            <main className="flex-1 w-full overflow-x-hidden">{children}</main>
            <Footer siteTitle={siteConfig.title} />
            <MobileNav />
          </div>
        )}
        <ToastContainer />
        <Analytics />
      </body>
    </html>
  );
}
