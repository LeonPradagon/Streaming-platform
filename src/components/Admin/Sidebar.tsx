'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  Film,
  Users,
  History,
  Settings,
  LogOut,
  ExternalLink,
  CheckCircle2,
  Activity,
  AlertTriangle,
  Menu,
  X
} from "lucide-react";
import { logout } from "@/app/auth/actions";

interface SidebarProps {
  user: any;
  brandName: string;
}

export default function AdminSidebar({ user, brandName }: SidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  const links = [
    { href: "/admin", icon: <BarChart3 size={20} />, label: "Overview" },
    { href: "/admin/approve", icon: <CheckCircle2 size={20} />, label: "Persetujuan Film" },
    { href: "/admin/catalog", icon: <Film size={20} />, label: "Katalog Konten" },
    { href: "/admin/users", icon: <Users size={20} />, label: "Manajemen User" },
    { href: "/admin/audit", icon: <History size={20} />, label: "Log Audit" },
    { href: "/admin/scraper", icon: <Activity size={20} />, label: "Scraper Control" },
    { href: "/admin/reports", icon: <AlertTriangle size={20} />, label: "Laporan Kendala" },
  ];

  return (
    <>
      {/* Mobile Toggle */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-6 left-6 z-50 p-3 bg-zinc-900 border border-white/10 rounded-xl text-white shadow-xl"
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:sticky top-0 left-0 z-40 h-screen w-[280px] bg-[#060d17] border-r border-white/5 
          transition-transform duration-300 ease-in-out flex flex-col p-8
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Brand */}
        <div className="mb-12 px-2">
          <h2 className="text-2xl font-black text-[#eab308] flex items-center gap-3">
            {brandName}
            <span className="text-[10px] px-1.5 py-0.5 bg-[#eab308]/10 rounded font-bold">ADMIN</span>
          </h2>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-2">
          {links.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsOpen(false)}
                className={`
                  flex items-center gap-3 p-3 rounded-xl font-semibold transition-all
                  ${isActive 
                    ? 'bg-[#eab308]/10 text-[#eab308]' 
                    : 'text-zinc-500 hover:text-white hover:bg-white/5'}
                `}
              >
                {link.icon}
                <span>{link.label}</span>
              </Link>
            );
          })}
          
          <div className="my-6 h-px bg-white/5" />
          
          <Link
            href="/admin/settings"
            onClick={() => setIsOpen(false)}
            className={`
              flex items-center gap-3 p-3 rounded-xl font-semibold transition-all
              ${pathname === "/admin/settings" 
                ? 'bg-[#eab308]/10 text-[#eab308]' 
                : 'text-zinc-500 hover:text-white hover:bg-white/5'}
            `}
          >
            <Settings size={20} />
            <span>Site Settings</span>
          </Link>

          <Link
            href="/"
            target="_blank"
            className="flex items-center gap-3 p-3 text-zinc-600 hover:text-zinc-400 font-semibold text-sm transition-colors"
          >
            <ExternalLink size={18} />
            <span>Lihat Website</span>
          </Link>
        </nav>

        {/* User Info */}
        <div className="mt-auto glass p-4 rounded-2xl flex items-center gap-3">
          <div className="w-10 h-10 bg-[#eab308] rounded-xl flex items-center justify-center text-[#060d17] font-black shrink-0">
            {user?.user_metadata.full_name?.charAt(0) || "A"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold truncate">{user?.user_metadata.full_name || "Admin"}</p>
            <p className="text-[10px] text-zinc-500 font-medium">Administrator</p>
          </div>
          <button 
            onClick={() => logout()}
            className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
          >
            <LogOut size={18} />
          </button>
        </div>
      </aside>
    </>
  );
}
