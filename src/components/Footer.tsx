"use client";

import Link from "next/link";
import { Mail, Globe, Share2, MessageSquare, Heart } from "lucide-react";
import { motion } from "framer-motion";
import { showToast } from "@/components/Toast";

export default function Footer({ siteTitle }: { siteTitle: string }) {
  const titleParts = siteTitle.split(" ");
  const firstPart = titleParts[0];
  const secondPart = titleParts.slice(1).join(" ");

  return (
    <footer className="relative mt-20 border-t border-white/5 bg-[#0a0a0a] overflow-hidden">
      {/* Ambient Glow */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-red-600/5 blur-[120px] -z-10" />
      
      <div className="max-w-[1700px] mx-auto px-6 md:px-12 lg:px-20 py-20">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-16">
          
          {/* Brand Section */}
          <div className="lg:col-span-2 space-y-8">
            <Link href="/" className="text-4xl md:text-5xl font-black uppercase tracking-tighter block">
              {firstPart}
              <span className="text-red-600">
                {secondPart ? ` ${secondPart}` : ""}
              </span>
            </Link>
            <p className="text-gray-500 max-w-md font-medium leading-relaxed">
              Platform streaming masa depan dengan koleksi terlengkap dan kualitas sinematik. 
              Nikmati pengalaman menonton tanpa batas, kapan saja, di mana saja.
            </p>
            <div className="flex items-center gap-4">
              <SocialLink icon={<Globe size={20} />} href="#" label="Website" />
              <SocialLink icon={<Share2 size={20} />} href="#" label="Share" />
              <SocialLink icon={<MessageSquare size={20} />} href="#" label="Chat" />
              <SocialLink icon={<Mail size={20} />} href="#" label="Email" />
            </div>
          </div>

          {/* Quick Links */}
          <div className="grid grid-cols-2 gap-8 lg:col-span-1">
            <div className="space-y-6">
              <h4 className="text-[10px] font-black text-white uppercase tracking-[0.3em]">Navigasi</h4>
              <ul className="space-y-4">
                <FooterLink href="/browse?type=movie" label="Film" />
                <FooterLink href="/browse?type=tv" label="Series" />
                <FooterLink href="/browse?type=anime" label="Anime" />
                <FooterLink href="/search" label="Cari Konten" />
              </ul>
            </div>
            <div className="space-y-6">
              <h4 className="text-[10px] font-black text-white uppercase tracking-[0.3em]">Legalitas</h4>
              <ul className="space-y-4">
                <FooterLink href="/terms" label="Ketentuan" />
                <FooterLink href="/privacy" label="Privasi" />
                <FooterLink href="/dmca" label="DMCA" />
              </ul>
            </div>
          </div>

          {/* Newsletter Mockup */}
          <div className="space-y-6">
             <h4 className="text-[10px] font-black text-white uppercase tracking-[0.3em]">Berlangganan</h4>
             <p className="text-gray-500 text-xs font-medium">Dapatkan update konten terbaru langsung ke email Anda.</p>
             <div className="relative group">
                <input 
                  type="email" 
                  placeholder="Email Anda"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm text-white focus:outline-none focus:border-red-600/50 transition-all group-hover:bg-white/10"
                />
                <button 
                  onClick={() => showToast('Fitur berlangganan segera hadir!', 'info')}
                  className="absolute right-2 top-2 bottom-2 bg-red-600 hover:bg-red-700 text-white px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95"
                >
                  Gabung
                </button>
             </div>
          </div>

        </div>

        {/* Bottom Bar */}
        <div className="mt-20 pt-10 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-[10px] font-black text-gray-600 uppercase tracking-widest">
            &copy; {new Date().getFullYear()} {siteTitle}. All rights reserved.
          </div>
          <div className="flex items-center gap-2 text-[10px] font-black text-gray-600 uppercase tracking-widest">
            Made with <Heart size={12} className="text-red-600 animate-pulse" /> for streaming lovers
          </div>
        </div>
      </div>
    </footer>
  );
}

function SocialLink({ icon, href, label }: { icon: any, href: string, label?: string }) {
  return (
    <Link 
      href={href}
      aria-label={label || 'Social link'}
      className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:bg-red-600 hover:text-white hover:border-red-600 transition-all duration-300"
    >
      {icon}
    </Link>
  );
}

function FooterLink({ href, label }: { href: string, label: string }) {
  return (
    <li>
      <Link 
        href={href} 
        className="text-sm font-bold text-gray-500 hover:text-white hover:translate-x-1 transition-all duration-300 block w-fit"
      >
        {label}
      </Link>
    </li>
  );
}
