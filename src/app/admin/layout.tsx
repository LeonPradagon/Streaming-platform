import { logout } from "@/app/auth/actions";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import {
  BarChart3,
  Film,
  Users,
  History,
  Settings,
  LogOut,
  ExternalLink,
  Search,
  CheckCircle2,
  Activity,
} from "lucide-react";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        backgroundColor: "#060d17",
        color: "#f8fafc",
      }}
    >
      {/* Sidebar */}
      <aside
        style={{
          width: "280px",
          borderRight: "1px solid rgba(255,255,255,0.05)",
          padding: "2rem 1.5rem",
          display: "flex",
          flexDirection: "column",
          position: "sticky",
          top: 0,
          height: "100vh",
        }}
      >
        {/* Brand */}
        <div style={{ marginBottom: "3rem", padding: "0 0.5rem" }}>
          <h2
            style={{
              fontSize: "1.5rem",
              fontWeight: 900,
              color: "#eab308",
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
            }}
          >
            OHAYO{" "}
            <span
              style={{
                fontSize: "0.6rem",
                padding: "0.2rem 0.4rem",
                backgroundColor: "rgba(234, 179, 8, 0.1)",
                borderRadius: "4px",
              }}
            >
              ADMIN
            </span>
          </h2>
        </div>

        {/* Navigation */}
        <nav
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
          }}
        >
          <SidebarLink
            href="/admin"
            icon={<BarChart3 size={20} />}
            label="Overview"
          />
          <SidebarLink
            href="/admin/approve"
            icon={<CheckCircle2 size={20} />}
            label="Persetujuan Film"
          />
          <SidebarLink
            href="/admin/catalog"
            icon={<Film size={20} />}
            label="Katalog Konten"
          />
          <SidebarLink
            href="/admin/users"
            icon={<Users size={20} />}
            label="Manajemen User"
          />
          <SidebarLink
            href="/admin/audit"
            icon={<History size={20} />}
            label="Log Audit"
          />
          <SidebarLink
            href="/admin/scraper"
            icon={<Activity size={20} />}
            label="Scraper Control"
          />
          <div
            style={{
              margin: "1.5rem 0",
              height: "1px",
              backgroundColor: "rgba(255,255,255,0.05)",
            }}
          />
          <SidebarLink
            href="/admin/settings"
            icon={<Settings size={20} />}
            label="Site Settings"
          />
          <Link
            href="/"
            target="_blank"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              padding: "0.75rem 1rem",
              color: "#64748b",
              textDecoration: "none",
              fontSize: "0.9rem",
              fontWeight: 600,
            }}
          >
            <ExternalLink size={18} /> Lihat Website
          </Link>
        </nav>

        {/* User Info & Logout */}
        <div
          className="glass"
          style={{
            marginTop: "auto",
            padding: "1rem",
            borderRadius: "1rem",
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
          }}
        >
          <div
            style={{
              width: "40px",
              height: "40px",
              backgroundColor: "#eab308",
              borderRadius: "0.75rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#060d17",
              fontWeight: 800,
            }}
          >
            {user?.user_metadata.full_name?.charAt(0) || "A"}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: "0.85rem",
                fontWeight: 700,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {user?.user_metadata.full_name || "Admin"}
            </div>
            <div style={{ fontSize: "0.7rem", color: "#64748b" }}>
              Administrator
            </div>
          </div>
          <form action={logout}>
            <button
              type="submit"
              style={{
                backgroundColor: "transparent",
                border: "none",
                color: "#ef4444",
                cursor: "pointer",
                padding: "0.5rem",
              }}
            >
              <LogOut size={18} />
            </button>
          </form>
        </div>
      </aside>

      {/* Main Content Area */}
      <main style={{ flex: 1, padding: "2.5rem 3.5rem", overflowY: "auto" }}>
        {/* Action Bar / Header */}
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "3rem",
          }}
        >
          <div>
            <h1
              style={{
                fontSize: "1.75rem",
                fontWeight: 900,
                letterSpacing: "-0.5px",
              }}
            >
              Admin Dashboard
            </h1>
            <p style={{ color: "#64748b", fontSize: "0.9rem" }}>
              Selamat datang kembali, mari kelola konten hari ini.
            </p>
          </div>
          <div style={{ display: "flex", gap: "1rem" }}>
            <div style={{ position: "relative" }}>
              <Search
                size={18}
                style={{
                  position: "absolute",
                  left: "1rem",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#475569",
                }}
              />
              <input
                type="text"
                placeholder="Cari film atau user..."
                style={{
                  backgroundColor: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.05)",
                  padding: "0.6rem 1rem 0.6rem 2.8rem",
                  borderRadius: "0.75rem",
                  color: "white",
                  width: "300px",
                }}
              />
            </div>
          </div>
        </header>

        {children}
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
