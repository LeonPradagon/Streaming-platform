import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Antigravity Streaming | Anime & Drakor Terlengkap",
  description: "Platform streaming film gratis untuk Anime dan Drakor dengan kualitas HD. Nonton tanpa iklan mengganggu.",
  keywords: ["streaming", "anime", "drakor", "nonton film gratis", "idlix clone"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body>
        {/* Navigation Bar */}
        <nav className="glass" style={{ position: 'sticky', top: 0, zIndex: 100, padding: '1rem 5%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-1px' }}>
            ANTI<span style={{ color: '#38bdf8' }}>GRAVITY</span>
          </div>
          <div style={{ display: 'flex', gap: '2rem', fontWeight: 600, fontSize: '0.9rem' }}>
            <a href="/">Home</a>
            <a href="/?type=anime">Anime</a>
            <a href="/?type=drakor">Drakor</a>
            <a href="/admin" style={{ color: '#f43f5e' }}>Admin</a>
          </div>
        </nav>

        {children}

        {/* Footer */}
        <footer style={{ padding: '4rem 5%', borderTop: '1px solid #1e293b', marginTop: '4rem', textAlign: 'center' }}>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
            &copy; 2026 Antigravity Streaming. Dibuat dengan 🔥 untuk pecinta film.
          </p>
          <p style={{ color: '#334155', fontSize: '0.75rem', marginTop: '1rem' }}>
            Data provided by TMDB. Content powered by external embed providers.
          </p>
        </footer>
      </body>
    </html>
  );
}
