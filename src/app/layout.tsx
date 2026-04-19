import type { Metadata } from "next";
import "./globals.css";
import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import Link from "next/link";
import MaintenanceMode from "@/components/MaintenanceMode";
import Navbar from "@/components/Navbar";
import ToastContainer from "@/components/Toast";
import { Analytics } from "@vercel/analytics/next";

export async function generateMetadata(): Promise<Metadata> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("settings")
    .select("*")
    .eq("key", "site_config")
    .single();
  const siteConfig = data?.value || { title: "Antigravity" };

  return {
    title: `${siteConfig.title} | Film & Series Terlengkap`,
    description:
      "Nonton Film & Series subtitle Indonesia terbaru gratis dengan kualitas HD.",
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
  const isAuthRoute = pathname === "/login" || pathname === "/register";

  // Fetch Site Config
  const { data: settingsData } = await supabase.from("settings").select("*");
  const siteConfig = settingsData?.find((s) => s.key === "site_config")
    ?.value || {
    title: "Antigravity",
    primary_color: "#eab308",
    navbar_color: "#38bdf8",
    maintenance_mode: false,
  };

  // Auth Check for Admin
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user?.id)
    .single();

  const isAdmin = profile?.role === "super_admin";
  const isMaintenance = siteConfig.maintenance_mode && !isAdmin;

  // Split title for dual-tone (Logo)
  const titleParts = siteConfig.title.split(" ");
  const firstPart = titleParts[0];
  const secondPart = titleParts.slice(1).join(" ");

  // Colors
  const primaryColor = siteConfig.primary_color || "#eab308";
  const navbarColor = siteConfig.navbar_color || "#38bdf8";

  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <style
          dangerouslySetInnerHTML={{
            __html: `
          :root {
            --primary: ${primaryColor};
            --primary-glow: ${primaryColor}33;
            --navbar-text: ${navbarColor};
          }
        `,
          }}
        />
      </head>
      <body>
        {isAdminRoute || isAuthRoute ? (
          /* Admin/Auth routes: just render children */
          <>
            {children}
            <ToastContainer />
          </>
        ) : isMaintenance ? (
          <MaintenanceMode siteTitle={siteConfig.title} />
        ) : (
          <div className="min-h-screen flex flex-col pb-16 md:pb-0">
            {/* Top Navigation */}
            <Navbar brandName={siteConfig.title} />

            <main className="flex-1 w-full overflow-hidden">{children}</main>

            {/* Premium Footer (Desktop) */}
            <footer className="hidden md:block py-12 px-6 md:px-12 border-t border-white/5 bg-black">
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
                  &copy; {new Date().getFullYear()} {siteConfig.title}. Built
                  with Antigravity.
                </div>
              </div>
            </footer>

            {/* Mobile Bottom Navigation */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 glass-nav border-t border-white/10 px-6 py-3 flex justify-between items-center pb-safe">
              <Link
                href="/"
                className="flex flex-col items-center gap-1 text-primary"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
                <span className="text-[10px] font-bold">Home</span>
              </Link>
              <Link
                href="/browse"
                className="flex flex-col items-center gap-1 text-gray-400 hover:text-white transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
                <span className="text-[10px] font-bold">Search</span>
              </Link>
              <Link
                href="/profile?tab=list"
                className="flex flex-col items-center gap-1 text-gray-400 hover:text-white transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="12" x2="12" y1="5" y2="19" />
                  <line x1="5" x2="19" y1="12" y2="12" />
                </svg>
                <span className="text-[10px] font-bold">My List</span>
              </Link>
              <Link
                href="/profile"
                className="flex flex-col items-center gap-1 text-gray-400 hover:text-white transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                <span className="text-[10px] font-bold">Profile</span>
              </Link>
            </div>
          </div>
        )}
        <ToastContainer />
        <Analytics />
      </body>
    </html>
  );
}
