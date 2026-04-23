import { logout } from "@/app/auth/actions";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Search } from "lucide-react";
import AdminSidebar from "@/components/Admin/Sidebar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "super_admin" && profile.role !== "moderator")) {
    redirect("/");
  }

  const { data: siteConfigReq } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "site_config")
    .single();
    
  const brandName = siteConfigReq?.value?.title || "OHAYO";

  return (
    <div className="flex min-h-screen bg-[#060d17] text-[#f8fafc]">
      <AdminSidebar user={user} brandName={brandName} />

      {/* Main Content Area */}
      <main className="flex-1 p-6 md:p-10 lg:p-14 overflow-y-auto w-full">
        {/* Action Bar / Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
          <div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-1">
              Admin Dashboard
            </h1>
            <p className="text-zinc-500 font-medium">
              Selamat datang kembali, mari kelola konten hari ini.
            </p>
          </div>
          
          <div className="flex w-full md:w-auto gap-3">
            <div className="relative flex-1 md:flex-none">
              <Search
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600"
              />
              <input
                type="text"
                placeholder="Cari film atau user..."
                className="w-full md:w-[300px] bg-white/5 border border-white/5 pl-12 pr-4 py-3 rounded-xl focus:outline-none focus:border-[#eab308]/30 transition-all text-sm"
              />
            </div>
          </div>
        </header>

        <div className="relative">
          {children}
        </div>
      </main>
    </div>
  );
}

function SidebarLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        padding: "0.75rem 1rem",
        borderRadius: "0.75rem",
        color: "#94a3b8",
        textDecoration: "none",
        fontWeight: "600",
        fontSize: "0.95rem",
        transition: "all 0.2s ease",
      }}
      className="nav-item"
    >
      {icon} {label}
    </Link>
  );
}
