import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Outlet, createRootRoute, createRoute, createRouter, Link, RouterProvider, useNavigate, useRouterState } from "@tanstack/react-router";
import { authClient } from "./auth";
import { useShelf } from "./use-shelf";
import { isTrustedPlayerEvent, parsePlayerProgress, withResume } from "./player-progress";
import { Activity, AlertTriangle, BarChart3, Check, CheckCircle2, ChevronLeft, ChevronRight, ExternalLink, Film, Flame, History, Home as HomeIcon, Info, List, ListVideo, LoaderCircle, LogOut, Menu, Play, Plus, RefreshCw, Search, Server, Settings, Share2, Shield, Sparkles, Star, ThumbsUp, Tv, User, Users, X } from "lucide-react";
import "./styles.css";
import "./viewer.css";

type Content = { id: string; tmdbId?: number; title: string; type: string; overview?: string | null; status?: string; platform?: string | null; platforms?: string[]; posterPath?: string | null; poster_path?: string | null; backdropPath?: string | null; backdrop_path?: string | null; genreNames?: string[] | null; genre_names?: string[] | null; voteAverage?: number | string | null; vote_average?: number | string | null; releaseDate?: string | null; release_date?: string | null; popularity?: number | string | null };
type WatchData = {
  content: { id: string; tmdbId: number; title: string; type: string; overview?: string | null; posterPath?: string | null; backdropPath?: string | null; quality?: string | null; tvStatus?: string | null; trailerKey?: string | null; genreNames?: string[] | null };
  mediaType: "movie" | "tv";
  metadata: { overview?: string; poster_path?: string | null; backdrop_path?: string | null; vote_average?: number; release_date?: string; first_air_date?: string; status?: string; genres?: { id: number; name: string }[]; credits?: { cast?: { id: number; name: string; character: string; profile_path?: string | null }[] }; videos?: { results?: { key: string; site: string; type: string }[] } } | null;
  links: { id: string; provider: string; url: string }[];
  seasons: { id: string; seasonNumber: number; name?: string | null }[];
  episodes: { id: string; episodeNumber: number; name?: string | null; airDate?: string | null }[];
  activeSeason: number;
};
function addSubtitleToPlayer(url: string, subtitleUrl: string) {
  try {
    const player = new URL(url);
    if (!subtitleUrl || !["https://moviesapi.to", "https://vidapi.xyz", "https://multiembed.mov"].includes(player.origin)) return url;
    for (const key of ["sub", "subtitle", "sub_url", "subtitle_url", "sub_file"]) player.searchParams.set(key, subtitleUrl);
    player.searchParams.set("sub_label", "NETIX");
    return player.toString();
  } catch { return url; }
}
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
function RootLayout() {
  const location = useRouterState({ select: (state) => state.location });
  const pathname = location.pathname;
  const searchTab = (location.search as { tab?: string }).tab;
  const browseActive = ["/browse", "/search", "/trending", "/network"].some((path) => pathname.startsWith(path));
  const listActive = pathname === "/profile" && ["list", "watchlist"].includes(searchTab ?? "");
  const profileMenuRef = React.useRef<HTMLDetailsElement>(null);
  const session = authClient.useSession();
  const closeProfileMenu = () => { if (profileMenuRef.current) profileMenuRef.current.open = false; };
  const config = useQuery({ queryKey: ["site-config"], queryFn: async () => {
    const response = await fetch("/api/site-config", { credentials: "include" });
    if (!response.ok) throw new Error("Site configuration unavailable.");
    return response.json() as Promise<{ title: string; primaryColor: string; navbarColor: string; maintenanceMode: boolean; allowRegistrations: boolean; isSuperAdmin: boolean }>;
  } });
  React.useEffect(() => { if (config.data?.title) document.title = config.data.title; }, [config.data?.title]);
  const maintenance = config.data?.maintenanceMode && !config.data.isSuperAdmin;
  if (pathname.startsWith("/admin")) return <AdminShell><Outlet /></AdminShell>;
  return <div className="viewer-app" style={{ "--cinema-accent": config.data?.primaryColor ?? "#eab308", "--cinema-navbar": config.data?.navbarColor ?? "#38bdf8" } as React.CSSProperties}>
    <header className="viewer-header"><div className="viewer-header-inner"><Link to="/" className="viewer-brand" aria-label={`${config.data?.title ?? "NETIX"} — Beranda`}>{(config.data?.title ?? "NETIX").toUpperCase() === "NETIX" ? <>NET<span>IX</span></> : config.data?.title}</Link><nav className="desktop-navigation" aria-label="Navigasi utama"><Link to="/" aria-current={pathname === "/" ? "page" : undefined}>Beranda</Link><Link to="/browse" search={{ q: "", type: "", platform: "", sort: "popularity", page: 1 }} aria-current={browseActive ? "page" : undefined}>Jelajahi</Link><Link to="/trending" aria-current={pathname === "/trending" ? "page" : undefined}>Trending</Link><Link to="/profile" search={{ tab: "list" }} aria-current={listActive ? "page" : undefined}>Daftar Saya</Link></nav><SiteSearch /><details ref={profileMenuRef} className="profile-menu" onKeyDown={(event) => { if (event.key === "Escape") { closeProfileMenu(); profileMenuRef.current?.querySelector("summary")?.focus(); } }}><summary className="circle-button" aria-label="Buka menu profil"><User size={20} /></summary><div className="profile-menu-panel"><p>{session.data?.user ? session.data.user.name || "Akun Anda" : "Tamu NETIX"}</p><Link to="/profile" search={{ tab: "history" }} onClick={closeProfileMenu}><User size={18} />Profil</Link><Link to="/profile" search={{ tab: "list" }} onClick={closeProfileMenu}><ListVideo size={18} />Daftar Saya</Link><Link to="/profile" search={{ tab: "settings" }} onClick={closeProfileMenu}><Settings size={18} />Pengaturan</Link><Link to="/network" onClick={closeProfileMenu}>Koleksi network</Link><Link to="/search" onClick={closeProfileMenu}>Pencarian & saran TMDB</Link>{session.data?.user ? <button onClick={async () => { await authClient.signOut(); closeProfileMenu(); }}><LogOut size={18} />Keluar</button> : <Link to="/login" onClick={closeProfileMenu} className="menu-sign-in">Masuk akun</Link>}</div></details></div></header>
    <main className="viewer-main">{maintenance ? <section className="page-shell"><div className="empty-panel"><h1>NETIX sedang dalam pemeliharaan</h1><p>Kami akan kembali sebentar lagi.</p></div></section> : <Outlet />}</main>
    <footer className="viewer-footer"><div className="viewer-shell"><div><Link to="/" className="viewer-brand">NET<span>IX</span></Link><p>Temukan tontonan untuk malam Anda.</p></div><nav aria-label="Navigasi footer"><Link to="/browse" search={{ q: "", type: "", platform: "", sort: "popularity", page: 1 }}>Jelajahi</Link><Link to="/network">Network</Link><Link to="/faq">Bantuan</Link><Link to="/terms">Ketentuan</Link><Link to="/privacy">Privasi</Link></nav><small>© {new Date().getFullYear()} NETIX</small></div></footer>
    <nav className="mobile-navigation" aria-label="Navigasi utama"><Link to="/" aria-current={pathname === "/" ? "page" : undefined}><HomeIcon size={20} /><span>Beranda</span></Link><Link to="/browse" search={{ q: "", type: "", platform: "", sort: "popularity", page: 1 }} aria-current={browseActive ? "page" : undefined}><Search size={20} /><span>Jelajahi</span></Link><Link to="/profile" search={{ tab: "list" }} aria-current={listActive ? "page" : undefined}><ListVideo size={20} /><span>Daftar Saya</span></Link><Link to="/profile" search={{ tab: "history" }} aria-current={pathname === "/profile" && !listActive ? "page" : undefined}><User size={20} /><span>Profil</span></Link></nav>
  </div>;
}
function SiteSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const suggestions = useQuery({ queryKey: ["header-search", query], enabled: open && query.trim().length >= 2, queryFn: async () => {
    const response = await fetch(`/api/contents?limit=6&q=${encodeURIComponent(query.trim())}`);
    if (!response.ok) throw new Error("Pencarian tidak tersedia.");
    return response.json() as Promise<{ items: Content[] }>;
  } });
  const items = suggestions.data?.items ?? [];
  const browse = { q: query.trim(), type: "", platform: "", sort: "popularity" as const, page: 1 };
  return <div className="header-search-wrapper" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false); }}>
    <form className="header-search" role="search" onSubmit={(event) => { event.preventDefault(); setOpen(false); void navigate({ to: "/browse", search: browse }); }}><Search size={18} /><input type="search" role="combobox" aria-label="Cari konten" aria-autocomplete="list" aria-expanded={open && query.trim().length >= 2} placeholder="Cari film, serial, Korea…" maxLength={80} value={query} onFocus={() => setOpen(true)} onChange={(event) => { setQuery(event.target.value); setOpen(true); }} /><button type="submit" className="search-submit" aria-label="Cari"><Search size={16} /></button></form>
    {open && query.trim().length >= 2 && <div className="search-suggestions"><div className="suggestions-status" role="status">{suggestions.isLoading ? "Mencari…" : suggestions.isError ? "Pencarian tidak tersedia." : items.length ? `${items.length} judul tersedia` : "Tidak ada judul yang cocok"}</div><ul role="listbox" aria-label="Saran judul">{items.map((item) => <li key={item.id} role="option"><Link to="/watch/$id" params={{ id: item.id }} search={{ s: 0, e: 1, ss: 1 }} onClick={() => setOpen(false)}><span className="suggestion-artwork">{(item.posterPath ?? item.poster_path) && <img src={`https://image.tmdb.org/t/p/w185${item.posterPath ?? item.poster_path}`} alt="" />}</span><span><strong>{item.title}</strong><small>{item.type}{(item.releaseDate ?? item.release_date) ? ` · ${(item.releaseDate ?? item.release_date)?.slice(0, 4)}` : ""}</small></span></Link></li>)}</ul><Link to="/browse" search={browse} className="suggestions-all" onClick={() => setOpen(false)}>Lihat semua hasil</Link></div>}
  </div>;
}
function AdminShell({ children }: { children: React.ReactNode }) {
  const location = useRouterState({ select: (state) => state.location });
  const pathname = location.pathname;
  const [menuOpen, setMenuOpen] = React.useState(false);
  const profile = useQuery({ queryKey: ["admin", "shell-profile"], queryFn: async () => fetchJson<{ user: { name: string; email: string; role: string } }>("/api/profile") });
  React.useEffect(() => {
    if (profile.error?.message === "Anda belum masuk.") {
      const next = `${location.pathname}${location.searchStr}`;
      window.location.replace(`/login?next=${encodeURIComponent(next)}`);
    }
  }, [location.pathname, location.searchStr, profile.error]);
  const nav = [
    ["/admin", "overview", "Ringkasan", "Statistik & performa", BarChart3],
    ["/admin/approve", "approve", "Persetujuan", "Review konten baru", CheckCircle2],
    ["/admin/catalog", "catalog", "Katalog", "Kelola semua film", Film],
    ["/admin/networks", "networks", "Network", "Platform & provider", Tv],
    ["/admin/users", "users", "Pengguna", "Kelola tim & role", Users],
    ["/admin/audit", "audit", "Riwayat", "Log aktivitas admin", History],
    ["/admin/scraper", "scraper", "Otomatisasi", "Kontrol bot scraper", Activity],
    ["/admin/reports", "reports", "Laporan", "Komplain & kendala", AlertTriangle],
    ["/admin/settings", "settings", "Site Settings", "Konfigurasi platform", Settings],
  ] as const;
  const activeTab = new URLSearchParams(location.searchStr).get("tab") ?? "overview";
  const activePath = nav.find((item) => item[0] !== "/admin" && pathname.startsWith(item[0]))?.[0] ?? "/admin";
  const activeSection = nav.find((item) => pathname === "/admin" ? item[1] === activeTab : item[0] === activePath);
  React.useEffect(() => { setMenuOpen(false); }, [pathname, location.searchStr]);
  React.useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setMenuOpen(false); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);
  if (profile.isLoading || profile.error?.message === "Anda belum masuk.") return <div className="admin-auth-state" role="status">Memeriksa akses admin…</div>;
  if (profile.isError) return <main className="admin-auth-state" role="alert"><h1>Panel admin tidak tersedia</h1><p>Sesi akun tidak dapat diverifikasi. Coba muat ulang halaman.</p><button className="action-button" onClick={() => window.location.reload()}>Muat ulang</button></main>;
  if (!profile.data || !["admin", "moderator", "super_admin"].includes(profile.data.user.role)) return <main className="admin-auth-state" role="alert"><h1>Akses admin ditolak</h1><p>Akun ini tidak memiliki izin administrator.</p><Link className="action-button action-button--primary" to="/">Kembali ke NETIX</Link></main>;
  return <div className="admin-app">
    <button className="admin-mobile-toggle" aria-label={menuOpen ? "Tutup navigasi" : "Buka navigasi"} aria-expanded={menuOpen} aria-controls="admin-sidebar" onClick={() => setMenuOpen((open) => !open)}>{menuOpen ? <X /> : <Menu />}</button>
    {menuOpen && <button className="admin-scrim" aria-label="Tutup navigasi" onClick={() => setMenuOpen(false)} />}
    <aside id="admin-sidebar" className={`admin-sidebar${menuOpen ? " is-open" : ""}`}>
      <Link className="admin-brand" to="/admin" search={{ tab: "overview", platform: "" }}>NETIX <span>ADMIN</span></Link>
      <nav>{nav.map(([href, tab, label, description, Icon]) => {
        const selected = pathname === "/admin" ? activeTab === tab : activePath === href;
        return <Link key={tab} to="/admin" search={{ tab, platform: "" }} onClick={() => setMenuOpen(false)} className={selected ? "admin-nav-link is-active" : "admin-nav-link"}><span className="admin-nav-icon"><Icon size={19} /></span><span><strong>{label}</strong><small>{description}</small></span></Link>;
      })}</nav>
      <div className="admin-sidebar-bottom"><Link to="/" className="admin-site-link"><ExternalLink size={17} /> Lihat Website</Link><div className="admin-user-card"><span className="admin-avatar"><Shield size={18} /></span><span><strong>{profile.data?.user.name ?? "Administrator"}</strong><small>{profile.data?.user.role ?? "Admin"}</small></span><button aria-label="Keluar akun" title="Keluar akun" onClick={async () => { await authClient.signOut(); window.location.assign("/"); }}><LogOut size={17} /></button></div></div>
    </aside>
    <main className="admin-main"><header className="admin-topbar"><div><span className="admin-section-eyebrow">NETIX ADMIN</span><h1>{activeSection?.[2] ?? "Panel Admin"}</h1><p>{activeSection?.[3] ?? "Kelola katalog dan operasional NETIX."}</p></div></header><div className="admin-content">{children}</div></main>
  </div>;
}
const rootRoute = createRootRoute({ component: RootLayout });
function Home() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["contents", "home"],
    queryFn: async () => {
      const get = async (params: Record<string, string>) => {
        const response = await fetch(`/api/contents?${new URLSearchParams(params)}`);
        if (!response.ok) throw new Error("Katalog gagal dimuat");
        return (await response.json() as { items: Content[] }).items;
      };
      const platforms = ["netflix", "disney", "amazon", "apple", "hbo", "paramount"];
      const [popular, latest, drakor, movies, anime, donghua, ...networkRows] = await Promise.all([
        get({ limit: "100", sort: "popularity" }), get({ limit: "60", sort: "release_date" }),
        get({ limit: "40", sort: "popularity", type: "drakor" }), get({ limit: "40", sort: "popularity", type: "movie" }),
        get({ limit: "40", sort: "popularity", type: "anime" }), get({ limit: "40", sort: "popularity", type: "donghua" }),
        ...platforms.map((platform) => get({ limit: "20", sort: "popularity", platform })),
      ]);
      const unique = (items: Content[]) => [...new Map(items.map((item) => [item.id, item])).values()];
      const genreGroups = new Map<string, Content[]>();
      for (const item of unique([...popular, ...latest, ...drakor, ...anime, ...donghua])) {
        for (const genre of item.genreNames ?? item.genre_names ?? []) genreGroups.set(genre, [...(genreGroups.get(genre) ?? []), item]);
      }
      const trending: Content[] = [];
      const drakorItems = unique([...drakor, ...popular.filter((item) => item.type === "drakor")]).slice(0, 15);
      const animeItems = unique([...anime, ...donghua, ...popular.filter((item) => ["anime", "donghua"].includes(item.type))]).slice(0, 15);
      const movieItems = unique([...movies, ...popular.filter((item) => item.type === "movie")]).slice(0, 15);
      for (let index = 0; index < Math.max(movieItems.length, drakorItems.length, animeItems.length); index++) {
        if (movieItems[index]) trending.push(movieItems[index]);
        if (drakorItems[index]) trending.push(drakorItems[index]);
        if (animeItems[index]) trending.push(animeItems[index]);
      }
      return { popular, latest, drakor: drakorItems, movies: movieItems, anime: animeItems, trending: trending.slice(0, 24), networks: platforms.map((slug, index) => ({ slug, items: networkRows[index] })), genres: [...genreGroups.entries()].filter(([, items]) => items.length >= 4).slice(0, 5) };
    },
  });
  const items = data?.popular ?? [];
  const [heroIndex, setHeroIndex] = React.useState(0);
  const heroItems = items.slice(0, 6);
  React.useEffect(() => { setHeroIndex(0); }, [items.length]);
  const featured = heroItems[heroIndex % Math.max(heroItems.length, 1)];
  const categories = [
    { label: "Semua", type: "" }, { label: "Film", type: "movie" }, { label: "Serial", type: "tv" },
    { label: "Korea", type: "drakor" }, { label: "Anime", type: "anime" }, { label: "Donghua", type: "donghua" },
  ];
  return <div className="viewer-shell home-layout">
    <nav className="home-categories" aria-label="Kategori tontonan">{categories.map((category) => <Link className="filter-chip" key={category.label} to="/browse" search={{ q: "", type: category.type, platform: "", sort: "popularity", page: 1 }}>{category.label}</Link>)}<Link className="filter-chip" to="/browse" search={{ q: "", type: "", platform: "netflix", sort: "popularity", page: 1 }}>Network</Link></nav>
    {isLoading ? <div className="empty-panel">Memuat pilihan tontonan…</div> : error ? <div className="empty-panel" role="alert">{error.message}</div> : featured ? <section className="cinema-hero" aria-label="Pilihan NETIX" style={{ backgroundImage: `url(https://image.tmdb.org/t/p/w1280${featured.backdropPath ?? featured.backdrop_path ?? featured.posterPath ?? featured.poster_path ?? ""})` }}><div className="cinema-hero-scrim" /><div className="cinema-hero-content"><span className="eyebrow">Pilihan malam ini</span><h1>{featured.title}</h1><div className="hero-metadata">{(featured.releaseDate ?? featured.release_date)?.slice(0, 4) && <span>{(featured.releaseDate ?? featured.release_date)?.slice(0, 4)}</span>}<span>{featured.type === "movie" ? "Film" : "Serial"}</span>{Number(featured.voteAverage ?? featured.vote_average) > 0 && <span><Star size={14} />{Number(featured.voteAverage ?? featured.vote_average).toFixed(1)}</span>}{(featured.genreNames ?? featured.genre_names)?.slice(0, 2).map((genre) => <span key={genre}>{genre}</span>)}</div><p className="hero-synopsis">{featured.overview}</p><div className="hero-actions"><Link className="action-button action-button--primary" to="/watch/$id" params={{ id: featured.id }} search={{ s: 0, e: 1, ss: 1 }}><Play size={18} fill="currentColor" />Tonton</Link><Link className="action-button" to="/watch/$id" params={{ id: featured.id }} search={{ s: 0, e: 1, ss: 1 }}><Info size={18} />Detail</Link></div></div>{heroItems.length > 1 && <div className="hero-pagination"><button className="circle-button" onClick={() => setHeroIndex((index) => (index - 1 + heroItems.length) % heroItems.length)} aria-label="Judul pilihan sebelumnya"><ChevronLeft size={20} /></button><span aria-live="polite">{heroIndex + 1} / {heroItems.length}</span><button className="circle-button" onClick={() => setHeroIndex((index) => (index + 1) % heroItems.length)} aria-label="Judul pilihan berikutnya"><ChevronRight size={20} /></button></div>}</section> : <section className="empty-panel"><h2>Katalog sedang disiapkan</h2><p>Konten akan muncul setelah data NETIX selesai dipindahkan.</p></section>}
    {data && <>
      <HomeShelf title="Trending Minggu Ini" items={data.trending} ranked icon={<Flame size={20} />} />
      <HomeShelf title="Serial Korea Terbaru" items={data.drakor} icon={<Tv size={20} />} />
      <HomeShelf title="Populer Hari Ini" items={data.movies} icon={<Film size={20} />} />
      <HomeShelf title="Anime & Donghua" items={[...data.anime]} icon={<Sparkles size={20} />} />
      <HomeShelf title="Terbaru Ditambahkan" items={data.latest.slice(0, 24)} />
      {data.networks.filter(({ items: networkItems }) => networkItems.length >= 4).map(({ slug, items: networkItems }) => <HomeShelf key={slug} title={slug[0].toUpperCase() + slug.slice(1)} items={networkItems} viewAll={`/network/${slug}`} />)}
      {data.genres.map(([genre, genreItems]) => <HomeShelf key={genre} title={genre} items={genreItems.slice(0, 20)} />)}
    </>}
  </div>;
}
function HomeShelf({ title, items, icon, ranked = false, viewAll }: { title: string; items: Content[]; icon?: React.ReactNode; ranked?: boolean; viewAll?: string }) {
  if (!items.length) return null;
  const id = React.useId();
  const [kind, setKind] = React.useState<"all" | "movie" | "tv">("all");
  const filteredItems = items.filter((item) => kind === "all" || (kind === "movie" ? item.type === "movie" : item.type !== "movie"));
  const { ref, edges, scroll, handlers, dragging } = useShelf(filteredItems.length);
  const kinds = [{ value: "all", label: "All" }, { value: "movie", label: "Movies" }, { value: "tv", label: "TV Series" }] as const;
  return <section className="content-row" aria-labelledby={`${id}-title`}><div className="content-row-heading"><h2 id={`${id}-title`}>{icon && <span aria-hidden="true">{icon}</span>}{title}</h2><div className="content-row-controls"><div className="shelf-filters" role="group" aria-label={`Filter ${title}`}>{kinds.map((item) => <button key={item.value} className="shelf-filter" aria-pressed={kind === item.value} onClick={() => setKind(item.value)}>{item.label}</button>)}</div>{viewAll && <Link className="row-view-all" to={viewAll}>Lihat semua</Link>}<button className="circle-button shelf-arrow" disabled={!edges.previous} onClick={() => scroll(-1)} aria-label={`Geser ${title} ke kiri`} aria-controls={id}><ChevronLeft size={20} /></button><button className="circle-button shelf-arrow" disabled={!edges.next} onClick={() => scroll(1)} aria-label={`Geser ${title} ke kanan`} aria-controls={id}><ChevronRight size={20} /></button></div></div><div id={id} ref={ref} {...handlers} className={`content-shelf${ranked ? " content-shelf--ranked" : ""}${dragging ? " is-dragging" : ""}`}>{filteredItems.map((item, index) => { const year = (item.releaseDate ?? item.release_date)?.slice(0, 4); const rating = Number(item.voteAverage ?? item.vote_average); const typeLabel = item.type === "movie" ? "Film" : item.type === "tv" ? "Serial" : item.type === "drakor" ? "Korea" : item.type; return <Link className={`catalog-card${ranked ? " catalog-card--ranked" : ""}`} key={item.id} to="/watch/$id" params={{ id: item.id }} search={{ s: 0, e: 1, ss: 1 }}>{ranked && <span className="catalog-rank">{index + 1}</span>}<div className={ranked ? "catalog-card-main" : undefined}><div className="catalog-artwork">{(item.posterPath ?? item.poster_path) && <img src={`https://image.tmdb.org/t/p/w342${item.posterPath ?? item.poster_path}`} alt="" loading="lazy" />}<span className="catalog-card-type">{typeLabel}</span>{year && <span className="catalog-card-year">{year}</span>}{rating > 0 && <span className="catalog-card-rating">★ {rating.toFixed(1)}</span>}</div><h3>{item.title}</h3><div className="catalog-caption"><span>{(item.genreNames ?? item.genre_names)?.slice(0, 2).join(" · ") || typeLabel}</span></div></div></Link>; })}</div></section>;
}
const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: Home,
});
const browseRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/browse",
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === "string" ? search.q : "",
    type: typeof search.type === "string" ? search.type : "",
    platform: typeof search.platform === "string" ? search.platform : "",
    sort: search.sort === "release_date" ? "release_date" as const : "popularity" as const,
    page: Number.isSafeInteger(Number(search.page)) && Number(search.page) > 0 ? Number(search.page) : 1,
  }),
  component: function Browse() {
    const filters = browseRoute.useSearch();
    const navigate = browseRoute.useNavigate();
    const [searchText, setSearchText] = React.useState(filters.q);
    const { data, isLoading, error } = useQuery({
      queryKey: ["contents", filters],
      queryFn: async () => {
        const params = new URLSearchParams({ limit: "48", page: String(filters.page), sort: filters.sort });
        if (filters.q) params.set("q", filters.q);
        if (filters.type) params.set("type", filters.type);
        if (filters.platform) params.set("platform", filters.platform);
        const response = await fetch(`/api/contents?${params}`);
        if (!response.ok) throw new Error("Katalog gagal dimuat");
        return response.json() as Promise<{ items: Content[]; total: number; page: number; limit: number }>;
      },
    });
    if (isLoading) return <p>Memuat katalog…</p>;
    if (error) return <p role="alert">{error.message}</p>;
    const items = data?.items ?? [];
    return <section className="page-shell"><div className="page-heading"><h1 className="page-title">Jelajahi katalog</h1><p className="page-description">Temukan film dan serial untuk ditonton berikutnya.</p></div><form className="filter-toolbar" onSubmit={(event) => { event.preventDefault(); navigate({ search: (previous) => ({ ...previous, q: searchText, page: 1 }) }); }}><input className="search-input" aria-label="Cari judul" placeholder="Cari judul…" value={searchText} onChange={(event) => setSearchText(event.target.value)} /><select aria-label="Jenis konten" value={filters.type} onChange={(event) => navigate({ search: (previous) => ({ ...previous, type: event.target.value, page: 1 }) })}><option value="">Semua jenis</option>{["movie", "tv", "drakor", "drachin", "anime", "donghua", "variety", "drathai", "drajep"].map((type) => <option key={type} value={type}>{type === "drakor" ? "Korea" : type}</option>)}</select><select aria-label="Network" value={filters.platform} onChange={(event) => navigate({ search: (previous) => ({ ...previous, platform: event.target.value, page: 1 }) })}><option value="">Semua network</option>{["netflix", "disney", "amazon", "apple", "hbo", "paramount", "other"].map((platform) => <option key={platform} value={platform}>{platform}</option>)}</select><select aria-label="Urutan" value={filters.sort} onChange={(event) => navigate({ search: (previous) => ({ ...previous, sort: event.target.value as "popularity" | "release_date", page: 1 }) })}><option value="popularity">Populer</option><option value="release_date">Terbaru</option></select></form>{isLoading ? <div className="empty-panel">Memuat katalog…</div> : <><div className="catalog-grid">{items.map((item) => <Link className="catalog-card-link" key={item.id} to="/watch/$id" params={{ id: item.id }} search={{ s: 0, e: 1, ss: 1 }}><div className="catalog-artwork">{item.posterPath || item.poster_path ? <img src={`https://image.tmdb.org/t/p/w342${item.posterPath ?? item.poster_path}`} alt="" loading="lazy" /> : null}</div><h3>{item.title}</h3><div className="catalog-caption"><span>{item.type}</span></div></Link>)}</div>{items.length === 0 && <div className="empty-panel">Belum ada konten yang cocok.</div>}{data && data.total > data.limit && <div className="pagination"><button disabled={filters.page <= 1} onClick={() => navigate({ search: (previous) => ({ ...previous, page: filters.page - 1 }) })}>Sebelumnya</button><span>Halaman {filters.page} · {data.total} judul</span><button disabled={filters.page * data.limit >= data.total} onClick={() => navigate({ search: (previous) => ({ ...previous, page: filters.page + 1 }) })}>Berikutnya</button></div>}</>}</section>;
  },
});
const networkList = [
  { slug: "netflix", name: "Netflix", description: "Film dan serial original Netflix." },
  { slug: "disney", name: "Disney+", description: "Disney, Marvel, Star Wars, dan Pixar." },
  { slug: "amazon", name: "Prime Video", description: "Amazon Original dan pilihan Prime Video." },
  { slug: "apple", name: "Apple TV+", description: "Serial dan film original Apple." },
  { slug: "hbo", name: "HBO / Max", description: "HBO, Warner Bros, dan Max." },
  { slug: "paramount", name: "Paramount+", description: "Paramount, Showtime, dan CBS." },
];
const networkRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/network",
  component: () => <section className="page-shell"><div className="page-heading"><h1 className="page-title">Network</h1><p className="page-description">Jelajahi katalog berdasarkan layanan streaming.</p></div><div className="network-grid">{networkList.map((network) => <Link className="network-card" key={network.slug} to="/network/$slug" params={{ slug: network.slug }}><span className="eyebrow">NETIX NETWORK</span><h2>{network.name}</h2><p>{network.description}</p><span className="action-button">Lihat katalog →</span></Link>)}</div></section>,
});
const networkDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/network/$slug",
  component: function NetworkDetail() {
    const { slug } = networkDetailRoute.useParams();
    const network = networkList.find((item) => item.slug === slug);
    const query = useQuery({ queryKey: ["network", slug], queryFn: async () => { const response = await fetch(`/api/contents?platform=${encodeURIComponent(slug)}&limit=100`); if (!response.ok) throw new Error("Katalog network gagal dimuat."); return response.json() as Promise<{ items: Content[] }>; } });
    return <section className="page-shell"><Link className="back-link" to="/network">← Semua network</Link><div className="page-heading"><h1 className="page-title">{network?.name ?? "Network"}</h1><p className="page-description">{network?.description}</p></div>{query.isLoading ? <div className="empty-panel">Memuat katalog…</div> : query.isError ? <div className="empty-panel" role="alert">{query.error.message}</div> : query.data?.items.length ? <div className="catalog-grid">{query.data.items.map((item) => <Link className="catalog-card-link" key={item.id} to="/watch/$id" params={{ id: item.id }} search={{ s: 0, e: 1, ss: 1 }}><div className="catalog-artwork">{(item.posterPath ?? item.poster_path) && <img src={`https://image.tmdb.org/t/p/w342${item.posterPath ?? item.poster_path}`} alt="" loading="lazy" />}</div><h3>{item.title}</h3><div className="catalog-caption"><span>{item.type}</span></div></Link>)}</div> : <div className="empty-panel">Belum ada konten untuk network ini.</div>}</section>;
  },
});
const trendingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/trending",
  component: function Trending() {
    const query = useQuery({ queryKey: ["trending"], queryFn: async () => { const response = await fetch("/api/contents?limit=100&sort=popularity"); if (!response.ok) throw new Error("Trending gagal dimuat."); return response.json() as Promise<{ items: Content[] }>; } });
    return <section className="page-shell"><div className="page-heading"><h1 className="page-title">Trending</h1><p className="page-description">Judul populer di katalog NETIX.</p></div>{query.isLoading ? <div className="empty-panel">Memuat…</div> : query.isError ? <div role="alert">{query.error.message}</div> : <div className="catalog-grid">{(query.data?.items ?? []).map((item, index) => <Link className="catalog-card-link" key={item.id} to="/watch/$id" params={{ id: item.id }} search={{ s: 0, e: 1, ss: 1 }}><div className="catalog-artwork"><span className="catalog-quality">#{index + 1}</span>{(item.posterPath ?? item.poster_path) && <img src={`https://image.tmdb.org/t/p/w342${item.posterPath ?? item.poster_path}`} alt="" loading="lazy" />}</div><h3>{item.title}</h3><div className="catalog-caption"><span>{item.type}</span></div></Link>)}</div>}</section>;
  },
});
const searchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/search",
  component: function SearchPage() {
    const navigate = useNavigate();
    const [query, setQuery] = React.useState("");
    return <section className="page-shell"><div className="page-heading"><h1 className="page-title">Cari tontonan</h1><p className="page-description">Cari berdasarkan judul film atau serial.</p></div><form className="filter-toolbar" onSubmit={(event) => { event.preventDefault(); navigate({ to: "/browse", search: { q: query, type: "", platform: "", sort: "popularity", page: 1 } }); }}><input autoFocus className="search-input" aria-label="Cari judul" placeholder="Masukkan judul…" value={query} onChange={(event) => setQuery(event.target.value)} /><button className="action-button action-button--primary">Cari</button></form></section>;
  },
});
const watchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/watch/$id",
  validateSearch: (search: Record<string, unknown>) => ({
    s: Number.isSafeInteger(Number(search.s)) && Number(search.s) >= 0 ? Number(search.s) : 0,
    e: Number.isSafeInteger(Number(search.e)) && Number(search.e) > 0 ? Number(search.e) : 1,
    ss: Number.isSafeInteger(Number(search.ss)) && Number(search.ss) >= 0 ? Number(search.ss) : 1,
  }),
  component: function WatchPage() {
    const { id } = watchRoute.useParams();
    const { s, e, ss } = watchRoute.useSearch();
    const navigate = watchRoute.useNavigate();
    const playerRef = React.useRef<HTMLIFrameElement>(null);
    const playerDocumentLoadedRef = React.useRef(false);
    const [watchlistNotice, setWatchlistNotice] = React.useState("");
    const [subtitleUrl, setSubtitleUrl] = React.useState("");
    const [playerLoaded, setPlayerLoaded] = React.useState(false);
    const [playerError, setPlayerError] = React.useState(false);
    const [playerReload, setPlayerReload] = React.useState(0);
    const [liked, setLiked] = React.useState(() => {
      try { return JSON.parse(localStorage.getItem("netix:liked") ?? "[]").includes(id); } catch { return false; }
    });
    React.useEffect(() => {
      try { setLiked((JSON.parse(localStorage.getItem("netix:liked") ?? "[]") as string[]).includes(id)); } catch { setLiked(false); }
    }, [id]);
    const { data, isLoading, error } = useQuery({
      queryKey: ["watch", id, ss, e],
      queryFn: async () => {
        const response = await fetch(`/api/contents/${encodeURIComponent(id)}/watch?season=${ss}&episode=${e}`);
        if (!response.ok) throw new Error(response.status === 404 ? "Konten tidak ditemukan." : "Detail tontonan gagal dimuat.");
        return response.json() as Promise<WatchData>;
      },
    });
    const subtitles = useQuery({
      queryKey: ["subtitles", id, ss, e],
      enabled: Boolean(data),
      queryFn: async () => {
        const params = new URLSearchParams({ tmdb_id: String(data!.content.tmdbId), type: data!.mediaType });
        if (data!.mediaType === "tv") { params.set("season", String(data!.activeSeason)); params.set("episode", String(e)); }
        const response = await fetch(`/api/subtitles/catalog?${params}`);
        if (!response.ok) throw new Error("Subtitle lokal gagal dimuat.");
        return response.json() as Promise<{ subtitles: { language: string; label: string; url: string }[] }>;
      },
    });
    const savedProgress = useQuery({
      queryKey: ["profile", "history", id],
      queryFn: async () => {
        const response = await fetch(`/api/profile/history/${encodeURIComponent(id)}`, { credentials: "include" });
        if (response.status === 401) return { progressTime: 0, duration: 0 };
        if (!response.ok) throw new Error("Progres tontonan gagal dimuat.");
        return response.json() as Promise<{ progressTime: number; duration: number }>;
      },
    });
    const savedItem = useQuery({
      queryKey: ["profile", "watchlist", id],
      queryFn: async () => {
        const response = await fetch("/api/profile/watchlist", { credentials: "include" });
        if (response.status === 401) return false;
        if (!response.ok) throw new Error("Daftar tontonan gagal dimuat.");
        const result = await response.json() as { items: { id: string }[] };
        return result.items.some((item) => item.id === id);
      },
    });
    const related = useQuery({
      queryKey: ["watch-related", id],
      enabled: Boolean(data?.content.genreNames?.length),
      queryFn: async () => {
        const response = await fetch("/api/contents?limit=100&sort=popularity");
        if (!response.ok) throw new Error("Konten terkait gagal dimuat.");
        const result = await response.json() as { items: Content[] };
        const genre = data!.content.genreNames?.[0];
        return result.items.filter((item) => item.id !== id && item.genreNames?.includes(genre ?? "")).slice(0, 12);
      },
    });
    React.useEffect(() => {
      const list = subtitles.data?.subtitles ?? [];
      setSubtitleUrl(list.find((subtitle) => subtitle.language === "id")?.url ?? list.find((subtitle) => subtitle.language === "en")?.url ?? "");
    }, [subtitles.data]);
    React.useEffect(() => {
      if (!data) return;
      const serverIndex = Math.min(s, Math.max(0, data.links.length - 1));
      const source = data.links[serverIndex]?.url;
      if (!source) return;
      let lastCloudSave = 0;
      const onMessage = (event: MessageEvent) => {
        if (!isTrustedPlayerEvent(event, playerRef.current, source)) return;
        const progress = parsePlayerProgress(event.data, { tmdbId: data.content.tmdbId, mediaType: data.mediaType, season: data.activeSeason, episode: e });
        if (!progress || progress.position < 10) return;
        const now = Date.now();
        if (now - lastCloudSave < 15000 && !["pause", "ended", "seeked"].includes(progress.event ?? "")) return;
        lastCloudSave = now;
        void fetch("/api/profile/history", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contentId: id, progressTime: Math.floor(progress.position), duration: Math.floor(progress.duration) }) }).then(() => queryClient.invalidateQueries({ queryKey: ["profile"] })).catch(() => {});
      };
      window.addEventListener("message", onMessage);
      return () => window.removeEventListener("message", onMessage);
    }, [data, id, s, e]);
    const activeSource = data?.links[Math.min(s, Math.max(0, (data?.links.length ?? 1) - 1))]?.url;
    React.useEffect(() => {
      setPlayerLoaded(false);
      setPlayerError(false);
      playerDocumentLoadedRef.current = false;
      if (!activeSource) return;
      const reveal = window.setTimeout(() => setPlayerLoaded(true), 6000);
      const timeout = window.setTimeout(() => {
        if (!playerDocumentLoadedRef.current) {
          setPlayerLoaded(true);
          setPlayerError(true);
        }
      }, 20000);
      return () => { window.clearTimeout(reveal); window.clearTimeout(timeout); };
    }, [id, activeSource, ss, e, subtitleUrl, playerReload]);
    if (isLoading) return <div className="page-shell" aria-busy="true" aria-label="Memuat player"><div><div className="watch-player animate-pulse mb-6" /><div className="grid grid-cols-1 lg:grid-cols-3 gap-10"><div className="lg:col-span-2 space-y-6"><div className="h-10 w-2/3 bg-white/5 rounded-xl animate-pulse" /><div className="flex gap-4"><div className="h-6 w-20 bg-white/5 rounded-md animate-pulse" /><div className="h-6 w-20 bg-white/5 rounded-md animate-pulse" /></div><div className="space-y-2"><div className="h-4 w-full bg-white/5 rounded-md animate-pulse" /><div className="h-4 w-full bg-white/5 rounded-md animate-pulse" /><div className="h-4 w-2/3 bg-white/5 rounded-md animate-pulse" /></div></div><div className="space-y-4"><div className="h-8 w-40 bg-white/5 rounded-xl animate-pulse" /><div className="space-y-3">{Array.from({ length: 4 }, (_, index) => <div key={index} className="h-20 w-full bg-white/5 rounded-2xl animate-pulse" />)}</div></div></div></div></div>;
    if (error) return <p role="alert">{error.message}</p>;
    if (!data) return <p>Konten tidak ditemukan.</p>;

    const serverIndex = Math.min(s, Math.max(0, data.links.length - 1));
    const activeServer = data.links[serverIndex];
    const metadata = data.metadata;
    const isMovie = data.mediaType === "movie";
    const resumePosition = savedProgress.data?.progressTime ?? 0;
    const resumeDuration = savedProgress.data?.duration ?? 0;
    const poster = metadata?.poster_path ?? data.content.posterPath;
    const backdrop = metadata?.backdrop_path ?? data.content.backdropPath;
    const trailer = metadata?.videos?.results?.find((video) => video.site === "YouTube" && video.type === "Trailer")?.key;
    const navigateSearch = (values: { s?: number; e?: number; ss?: number }) => navigate({ search: (previous) => ({ ...previous, ...values }) });
    const saveToWatchlist = async () => {
      const response = savedItem.data
        ? await fetch(`/api/profile/watchlist/${encodeURIComponent(id)}`, { method: "DELETE", credentials: "include" })
        : await fetch("/api/profile/watchlist", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contentId: id }) });
      if (response.status === 401) { setWatchlistNotice("Masuk untuk menyimpan tontonan."); return; }
      if (!response.ok) { setWatchlistNotice("Gagal memperbarui Daftar Saya."); return; }
      await queryClient.invalidateQueries({ queryKey: ["profile", "watchlist", id] });
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
      setWatchlistNotice(savedItem.data ? "Dihapus dari Daftar Saya." : "Ditambahkan ke Daftar Saya.");
    };
    const toggleLike = () => {
      const next = !liked;
      setLiked(next);
      try {
        const ids = JSON.parse(localStorage.getItem("netix:liked") ?? "[]") as string[];
        localStorage.setItem("netix:liked", JSON.stringify(next ? [...new Set([...ids, id])] : ids.filter((item) => item !== id)));
      } catch { /* Local likes are optional and must not affect playback. */ }
    };
    const shareTitle = async () => {
      try {
        if (navigator.share) await navigator.share({ title: data.content.title, url: window.location.href });
        else await navigator.clipboard.writeText(window.location.href);
        setWatchlistNotice("Tautan tontonan dibagikan.");
      } catch { /* Share dismissed or clipboard unavailable. */ }
    };

    const episodeIndex = data.episodes.findIndex((episode) => episode.episodeNumber === e);
    const previousEpisode = episodeIndex > 0 ? data.episodes[episodeIndex - 1] : undefined;
    const nextEpisode = episodeIndex >= 0 ? data.episodes[episodeIndex + 1] : data.episodes[0];
    const releaseYear = (metadata?.first_air_date ?? metadata?.release_date ?? "").slice(0, 4);
    const cast = metadata?.credits?.cast?.slice(0, 6) ?? [];

    return <article className="watch-page relative isolate min-h-[70vh]">
      {backdrop && <div className="absolute top-0 left-0 z-0 h-[600px] w-full pointer-events-none"><div className="absolute inset-0 opacity-10" style={{ backgroundImage: `url(https://image.tmdb.org/t/p/original${backdrop})`, backgroundSize: "cover", backgroundPosition: "center 20%" }} /><div className="absolute inset-0 bg-gradient-to-t from-[#0b0d12] to-transparent" /></div>}
      <div className="page-shell relative z-10">
        <div className="mb-8 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div className="space-y-2">
            <Link to="/" className="action-button group mb-4"><div className="rounded-full border border-white/10 bg-white/5 p-1.5 transition-all group-hover:border-red-500 group-hover:bg-red-600"><ChevronLeft size={16} /></div>Kembali</Link>
            <h1 className="page-title">{data.content.title}</h1>
            {!isMovie && <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-red-500">{metadata?.status === "Returning Series" && <span className="rounded border border-emerald-500/20 bg-emerald-600/10 px-2 py-1 text-emerald-400">Ongoing</span>}{data.episodes.length > 0 && <><span className="rounded border border-red-500/20 bg-red-600/10 px-2 py-1">Season {data.activeSeason}</span><span className="rounded border border-white/10 bg-white/10 px-2 py-1 text-white">Episode {e}</span></>}</div>}
          </div>
        </div>
        <div className="watch-layout">
          <div className="space-y-6 min-w-0">
            <div className="watch-player-wrap"><div className="watch-player">
              {activeServer ? <><div className={`player-loading${playerLoaded || playerError ? " is-hidden" : ""}`}><div className="player-loading-backdrop" style={{ backgroundImage: backdrop ? `linear-gradient(to top,rgba(0,0,0,.95),rgba(0,0,0,.5)),url(https://image.tmdb.org/t/p/original${backdrop})` : "none" }} /><div className="relative z-10 flex flex-col items-center gap-3"><LoaderCircle className="player-spinner" size={32} strokeWidth={2} /><div className="flex flex-col items-center gap-2"><span className="text-white font-semibold text-sm">Menyiapkan tontonan…</span><span className="text-gray-400 text-xs max-w-[240px] truncate text-center">{data.content.title}</span></div></div></div><iframe ref={playerRef} key={`${id}:${ss}:${e}:${serverIndex}:${subtitleUrl}:${resumePosition}:${playerReload}`} src={withResume(addSubtitleToPlayer(activeServer.url, subtitleUrl), resumePosition)} title={data.content.title} style={{ opacity: playerLoaded ? 1 : 0 }} onLoad={() => { playerDocumentLoadedRef.current = true; setPlayerLoaded(true); setPlayerError(false); }} onError={() => { setPlayerLoaded(true); setPlayerError(true); }} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" referrerPolicy="no-referrer" allowFullScreen />{playerError && <div className="player-error-overlay"><div className="player-error-icon"><Server size={24} /></div><div><h3>Server Tidak Merespon</h3><p>Coba muat ulang atau pilih server lain.</p></div><button className="action-button action-button--primary" onClick={() => setPlayerReload((value) => value + 1)}><RefreshCw size={16} />Muat Ulang</button></div>}</> : <div className="player-empty"><span><Server size={34} /></span><h3>PILIH SERVER</h3><p>Pilih server untuk memulai</p></div>}
            </div>{resumePosition >= 10 && resumeDuration > resumePosition + 30 && <p className="resume-caption">Lanjutkan dari {Math.floor(resumePosition / 60)}:{String(Math.floor(resumePosition % 60)).padStart(2, "0")}</p>}
              {activeServer && Boolean(subtitles.data?.subtitles.length) && <div className="subtitle-controls"><label>Subtitle <select value={subtitleUrl} onChange={(event) => setSubtitleUrl(event.target.value)} disabled={subtitles.isLoading || !subtitles.data?.subtitles.length}><option value="">Tanpa subtitle eksternal</option>{subtitles.data?.subtitles.map((subtitle) => <option key={subtitle.url} value={subtitle.url}>{subtitle.label}</option>)}</select></label>{subtitles.isError && <span role="status">Subtitle gagal dimuat.</span>}</div>}
            </div>
            {!isMovie && <nav className="episode-navigation" aria-label="Navigasi episode">{previousEpisode ? <button className="action-button" onClick={() => navigateSearch({ e: previousEpisode.episodeNumber })}><ChevronLeft size={18} /> Episode sebelumnya</button> : <span />}{nextEpisode && <button className="action-button action-button--primary" onClick={() => navigateSearch({ e: nextEpisode.episodeNumber })}>Episode berikutnya <ChevronRight size={18} /></button>}</nav>}
            <section className="watch-panel"><div className="watch-metadata"><div className="watch-rating"><Star size={19} fill="currentColor" /><strong>{metadata?.vote_average ? metadata.vote_average.toFixed(1) : "N/A"}</strong></div><i /><div><small>Release</small><strong>{releaseYear || "—"}</strong></div><i /><div><small>Quality</small><strong className="watch-quality">{data.content.quality || "HD"}</strong></div></div>
              <div className="watch-actions"><button className="action-button" onClick={() => void saveToWatchlist()}>{savedItem.data ? <Check size={17} /> : <Plus size={17} />}{savedItem.data ? "Tersimpan" : "Daftar Saya"}</button><button className={liked ? "action-button is-liked" : "action-button"} aria-pressed={liked} onClick={toggleLike}><ThumbsUp size={17} />{liked ? "Disukai" : "Suka"}</button><button className="action-button" onClick={() => void shareTitle()}><Share2 size={17} />Bagikan</button>{trailer && <a className="action-button" href={`https://www.youtube.com/watch?v=${encodeURIComponent(trailer)}`} target="_blank" rel="noreferrer">Lihat trailer</a>}</div>{watchlistNotice && <p className="watch-notice" role="status">{watchlistNotice}</p>}
            </section>
            <section className="watch-info"><div><h2>Sinopsis</h2><p className="page-description">{metadata?.overview ?? data.content.overview ?? "Sinopsis tidak tersedia untuk judul ini."}</p><div className="watch-genres">{metadata?.genres?.map((genre) => <span key={genre.id}>{genre.name}</span>)}</div></div>{cast.length > 0 && <div><h2>Pemain utama</h2><div className="cast-grid">{cast.map((actor) => <div key={actor.id} className="cast-card"><img src={actor.profile_path ? `https://image.tmdb.org/t/p/w185${actor.profile_path}` : `https://placehold.co/100x100/1a1a1a/ffffff?text=${encodeURIComponent(actor.name.charAt(0))}`} alt={actor.name} /><div><strong>{actor.name}</strong><small>{actor.character}</small></div></div>)}</div></div>}</section>
            {related.data && related.data.length > 0 && <section className="watch-related"><h2>Mungkin Anda suka</h2><div className="watch-related-grid">{related.data.map((item) => <Link key={item.id} to="/watch/$id" params={{ id: item.id }} search={{ s: 0, e: 1, ss: 1 }} className="watch-related-card">{(item.posterPath ?? item.poster_path) ? <img src={`https://image.tmdb.org/t/p/w342${item.posterPath ?? item.poster_path}`} alt="" /> : <span className="watch-related-placeholder" />}<strong>{item.title}</strong><small>{item.type}</small></Link>)}</div></section>}
          </div>
          <aside className="space-y-4 min-w-0 watch-sidebar"><section className="watch-panel"><div className="watch-panel-title"><span><Server size={19} /></span><h2>Pilih server</h2></div><div className="server-options">{data.links.map((server, index) => <button key={server.id} aria-current={index === serverIndex ? "true" : undefined} className="server-option" onClick={() => navigateSearch({ s: index })}>Server {index + 1}</button>)}</div><p className="watch-tip">Tips: Jika loading lambat, coba ganti server lain atau gunakan VPN.</p></section>
            {!isMovie && <section className="watch-panel"><div className="watch-panel-title watch-episode-title"><span><List size={19} /></span><h2>Episode</h2>{data.seasons.length > 0 && <select aria-label="Pilih season" value={data.activeSeason} onChange={(event) => navigateSearch({ ss: Number(event.target.value), e: 1 })}>{data.seasons.map((season) => <option key={season.id} value={season.seasonNumber}>{season.name || `Season ${season.seasonNumber}`}</option>)}</select>}</div><div className="watch-episode-list">{data.episodes.map((episode) => <button key={episode.id} className="watch-episode-link" aria-current={episode.episodeNumber === e ? "true" : undefined} onClick={() => navigateSearch({ e: episode.episodeNumber })}><span>{episode.episodeNumber}</span><div><strong>{episode.name || `Episode ${episode.episodeNumber}`}</strong><small>{episode.airDate ? new Date(`${episode.airDate}T00:00:00`).getFullYear() : "TBA"}</small></div></button>)}</div></section>}
            {poster && <img className="watch-poster" src={`https://image.tmdb.org/t/p/w342${poster}`} alt={`Poster ${data.content.title}`} />}
          </aside>
        </div>
      </div>
    </article>;
  },
});
const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: function Login() {
    const [error, setError] = React.useState("");
    const [pending, setPending] = React.useState(false);
    async function submit(event: React.FormEvent<HTMLFormElement>) {
      event.preventDefault(); setError(""); setPending(true);
      const form = new FormData(event.currentTarget);
      const result = await authClient.signIn.email({ email: String(form.get("email")), password: String(form.get("password")) });
      setPending(false);
      if (result.error) setError(result.error.message ?? "Login gagal.");
      else {
        const next = new URLSearchParams(window.location.search).get("next");
        window.location.assign(next?.startsWith("/") && !next.startsWith("//") && !next.includes("\\") ? next : "/");
      }
    }
    return <form className="auth-card" onSubmit={submit}><h1>Masuk</h1><label>Email<input name="email" type="email" autoComplete="email" required /></label><label>Password<input name="password" type="password" autoComplete="current-password" required /></label>{error && <p role="alert">{error}</p>}<button disabled={pending}>{pending ? "Memproses…" : "Masuk"}</button><Link to="/register">Buat akun</Link></form>;
  },
});
const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/register",
  component: function Register() {
    const [error, setError] = React.useState("");
    const registrationConfig = useQuery({ queryKey: ["site-config"], queryFn: async () => { const response = await fetch("/api/site-config"); if (!response.ok) throw new Error("Konfigurasi pendaftaran tidak tersedia."); return response.json() as Promise<{ allowRegistrations: boolean }>; } });
    async function submit(event: React.FormEvent<HTMLFormElement>) {
      event.preventDefault(); setError("");
      if (registrationConfig.data?.allowRegistrations === false) { setError("Pendaftaran akun sedang ditutup."); return; }
      const form = new FormData(event.currentTarget);
      const result = await authClient.signUp.email({ name: String(form.get("name")), email: String(form.get("email")), password: String(form.get("password")) });
      if (result.error) setError(result.error.message ?? "Pendaftaran gagal.");
      else window.location.assign("/");
    }
    return <form className="auth-card" onSubmit={submit}><h1>Daftar</h1>{registrationConfig.data?.allowRegistrations === false ? <p role="status">Pendaftaran akun sedang ditutup.</p> : <><label>Nama<input name="name" autoComplete="name" required /></label><label>Email<input name="email" type="email" autoComplete="email" required /></label><label>Password<input name="password" type="password" autoComplete="new-password" minLength={8} required /></label>{error && <p role="alert">{error}</p>}<button disabled={registrationConfig.isLoading}>Buat akun</button></>}<Link to="/login">Sudah punya akun?</Link></form>;
  },
});
type ProfileResponse = { user: { id: string; name: string; email: string; role?: string }; profile?: { preferences?: { emailNotif?: boolean; quality?: string } | null }; watchlistCount: number; historyCount: number };
class ApiError extends Error {
  constructor(readonly status: number, message: string) { super(message); this.name = "ApiError"; }
}
async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: "include", ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  if (!response.ok) throw new ApiError(response.status, response.status === 401 ? "Anda belum masuk." : response.status === 403 ? "Akses ditolak untuk akun ini." : `Permintaan gagal (${response.status}).`);
  return response.json() as Promise<T>;
}
const profileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/profile",
  validateSearch: (search: Record<string, unknown>) => ({ tab: ["history", "list", "settings"].includes(String(search.tab)) ? String(search.tab) : "history" }),
  component: function ProfilePage() {
    const { tab } = profileRoute.useSearch();
    const navigate = profileRoute.useNavigate();
    const profile = useQuery({ queryKey: ["profile"], queryFn: () => fetchJson<ProfileResponse>("/api/profile") });
    const items = useQuery({ queryKey: ["profile", tab], enabled: profile.isSuccess && tab !== "settings", queryFn: () => fetchJson<{ items: (Content & { progressTime?: number; duration?: number; updatedAt?: string; addedAt?: string })[] }>(`/api/profile/${tab === "list" ? "watchlist" : "history"}`) });
    const [name, setName] = React.useState("");
    const [notice, setNotice] = React.useState("");
    React.useEffect(() => { if (profile.data) setName(profile.data!.user.name); }, [profile.data]);
    if (profile.isLoading) return <section className="page-shell"><div className="empty-panel">Memuat profil…</div></section>;
    if (profile.isError) return <section className="page-shell"><div className="empty-panel"><h2>Masuk untuk membuka profil</h2><p>Watchlist dan riwayat tersinkron ke akun Anda.</p><Link className="action-button action-button--primary" to="/login">Masuk</Link></div></section>;
    async function saveSettings(event: React.FormEvent<HTMLFormElement>) {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      await fetchJson("/api/profile", { method: "PATCH", body: JSON.stringify({ name, preferences: { emailNotif: form.get("emailNotif") === "on", quality: String(form.get("quality") || "auto") } }) });
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
      setNotice("Pengaturan tersimpan.");
    }
    async function removeItem(id: string) {
      await fetchJson(`/api/profile/watchlist/${encodeURIComponent(id)}`, { method: "DELETE" });
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
      await queryClient.invalidateQueries({ queryKey: ["profile", "list"] });
    }
    async function clearHistory() {
      await fetchJson("/api/profile/history", { method: "DELETE" });
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
      await queryClient.invalidateQueries({ queryKey: ["profile", "history"] });
    }
    return <section className="page-shell"><div className="page-heading"><h1 className="page-title">{tab === "list" ? "Daftar Saya" : "Profil Anda"}</h1><p className="page-description">Tontonan favorit dan riwayat Anda, dalam satu tempat.</p></div><div className="profile-layout"><aside className="profile-panel"><h2>{profile.data!.user.name}</h2><p className="page-description">{profile.data!.user.email}</p><p>{profile.data!.historyCount} ditonton · {profile.data!.watchlistCount} tersimpan</p><div className="profile-tabs">{[["history", "Riwayat Tonton"], ["list", "Daftar Saya"], ["settings", "Pengaturan"]].map(([value, label]) => <button key={value} aria-pressed={tab === value} onClick={() => navigate({ search: { tab: value } })}>{label}</button>)}</div>{(profile.data!.user.role === "admin" || profile.data!.user.role === "super_admin") && <Link className="action-button" to="/admin" search={{ tab: "overview" }}>Panel admin</Link>}<button className="action-button" onClick={async () => { await authClient.signOut(); window.location.assign("/"); }}>Keluar akun</button><button className="action-button" onClick={async () => { if (!window.confirm("Hapus akun secara permanen? Watchlist dan riwayat akan ikut dihapus.")) return; const result = await authClient.deleteUser({}); if (result.error) { setNotice(result.error.message ?? "Penghapusan akun gagal. Masuk kembali lalu coba lagi."); return; } window.location.assign("/"); }}>Hapus akun</button></aside><div className="profile-panel profile-content">{tab === "settings" ? <form className="profile-settings" onSubmit={(event) => void saveSettings(event)}><h2>Pengaturan akun</h2><label>Nama tampilan<input value={name} onChange={(event) => setName(event.target.value)} required /></label><label>Kualitas video<select name="quality" defaultValue={profile.data!.profile?.preferences?.quality ?? "auto"}><option value="auto">Otomatis</option><option value="1080p">1080p</option><option value="720p">720p</option><option value="480p">480p</option></select></label><label className="checkbox-label"><input type="checkbox" name="emailNotif" defaultChecked={profile.data!.profile?.preferences?.emailNotif ?? true} /> Email notifikasi</label><button className="action-button action-button--primary">Simpan</button>{notice && <p role="status">{notice}</p>}</form> : <><div className="profile-content-heading"><h2>{tab === "list" ? "Daftar Saya" : "Riwayat Terakhir Ditonton"}</h2>{tab === "history" && profile.data!.historyCount > 0 && <button className="action-button" onClick={() => void clearHistory()}>Hapus semua</button>}</div>{items.isLoading ? <div className="empty-panel">Memuat…</div> : items.data?.items.length ? <div className="catalog-grid">{items.data.items.map((item) => <div className="profile-item" key={item.id}><Link className="catalog-card-link" to="/watch/$id" params={{ id: item.id }} search={{ s: 0, e: 1, ss: 1 }}><div className="catalog-artwork">{(item.posterPath ?? item.poster_path) && <img src={`https://image.tmdb.org/t/p/w342${item.posterPath ?? item.poster_path}`} alt="" loading="lazy" />}{item.duration && <div className="catalog-progress"><i style={{ width: `${Math.min(100, ((item.progressTime ?? 0) / item.duration) * 100)}%` }} /></div>}</div><h3>{item.title}</h3></Link>{tab === "list" && <button className="action-button" onClick={() => void removeItem(item.id)}>Hapus</button>}</div>)}</div> : <div className="empty-panel"><h3>{tab === "list" ? "Daftar masih kosong" : "Belum ada riwayat"}</h3><p>Tambahkan tontonan dari katalog untuk melihatnya di sini.</p><Link className="action-button action-button--primary" to="/browse" search={{ q: "", type: "", platform: "", sort: "popularity", page: 1 }}>Jelajahi katalog</Link></div>}</>}</div></div></section>;
  },
});
function AdminOverviewPage({ data }: { data: { contents: number; pending: number; users: number; todayViews: number; missingPosters: number; missingOverviews: number; recentLogs: any[] } }) {
  const stats: { label: string; value: number; tab: string; missing?: string }[] = [
    { label: "Total katalog", value: data.contents, tab: "catalog" },
    { label: "Menunggu review", value: data.pending, tab: "approve" },
    { label: "Pengguna", value: data.users, tab: "users" },
    { label: "Tontonan hari ini", value: data.todayViews, tab: "overview" },
    { label: "Poster belum ada", value: data.missingPosters, tab: "catalog", missing: "poster" },
    { label: "Sinopsis belum ada", value: data.missingOverviews, tab: "catalog", missing: "overview" },
  ];
  const latest = data.recentLogs[0];
  return <section className="page-shell"><div className="admin-stats admin-overview-stats">{stats.map((item) => <Link className="profile-panel admin-overview-stat" key={item.label} to="/admin" search={{ tab: item.tab, platform: "", missing: item.missing ?? "" }}><span className="page-description">{item.label}</span><strong>{Number(item.value).toLocaleString("id-ID")}</strong><small>Buka {item.tab === "approve" ? "review" : item.tab === "catalog" ? "katalog" : item.tab === "users" ? "pengguna" : "ringkasan"} →</small></Link>)}</div><section className="profile-panel admin-overview-jobs"><div className="admin-record-heading"><div><h2>Operasional scraper</h2><p>{latest ? `Terakhir berjalan ${latest.createdAt ? new Date(latest.createdAt).toLocaleString("id-ID") : "—"}` : "Belum ada job scraper."}</p></div><Link className="action-button" to="/admin" search={{ tab: "scraper", platform: "", missing: "" }}>Buka scraper</Link></div>{latest && <div className="admin-overview-latest"><strong>{latest.taskName}</strong><span className={`admin-status-badge admin-status-badge--${latest.status}`}>{latest.status}</span><span>{Number(latest.itemsCount ?? 0).toLocaleString("id-ID")} item diproses</span>{latest.errorMessage && <p role="alert">{latest.errorMessage}</p>}</div>}{data.recentLogs.slice(0, 5).map((log) => <div className="admin-overview-log" key={log.id}><span>{log.taskName}</span><span className={`admin-status-badge admin-status-badge--${log.status}`}>{log.status}</span><small>{log.createdAt ? new Date(log.createdAt).toLocaleString("id-ID") : "—"}</small></div>)}</section></section>;
}

function AdminScraperPage({ logs }: { logs: any[] }) {
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const [suiteProgress, setSuiteProgress] = React.useState<{ current: number; total: number; task: string } | null>(null);
  const [discoveryAdded, setDiscoveryAdded] = React.useState<number | null>(null);
  const recovery = useQuery({ queryKey: ["admin", "scraper", "recovery"], queryFn: () => fetchJson<{ task: string | null; state?: Record<string, unknown>; progress?: { current?: number; total?: number; current_item?: string; _lastUpdated?: string } }>("/api/admin/scraper/recovery"), refetchInterval: 15000 });
  const latest = logs[0];
  const discoveryTasks = [...["netflix", "disney", "amazon", "apple", "hbo", "paramount"].flatMap((network) => [[`network_${network}`, `${network} film`], [`network_tv_${network}`, `${network} serial`]] as [string, string][]), ["scrape", "Discovery film"], ["trending", "Trending film"]] as [string, string][];
  const maintenanceTasks = [["sync", "Refresh metadata"], ["validate", "Health check"], ["reclassify", "Klasifikasi ulang"], ["tv_sync", "Sinkron episode TV"], ["subtitles", "Sinkron subtitle"]] as const;
  async function processTask(task: string, resumeState?: Record<string, unknown>) {
    let state: Record<string, unknown> = {};
    if (resumeState) state = resumeState;
    else try { state = JSON.parse(localStorage.getItem(`netix:scraper:${task}`) ?? "{}"); } catch { localStorage.removeItem(`netix:scraper:${task}`); }
    let processed = 0;
    let added = 0;
    for (;;) {
      const result = await fetchJson<{ hasMore: boolean; nextState: Record<string, unknown>; summary?: { items_processed?: number; items_added?: number } }>("/api/admin/scraper/run", { method: "POST", body: JSON.stringify({ task, state }) });
      processed += result.summary?.items_processed ?? 0;
      added += result.summary?.items_added ?? 0;
      await queryClient.invalidateQueries({ queryKey: ["admin", "scraper"] });
      if (!result.hasMore) { localStorage.removeItem(`netix:scraper:${task}`); return { complete: true, processed, added }; }
      state = result.nextState;
      localStorage.setItem(`netix:scraper:${task}`, JSON.stringify(state));
    }
  }
  async function run(task: string, resumeState?: Record<string, unknown>) {
    if (busy) return;
    setBusy(true); setMessage(`Menjalankan ${task}…`); setDiscoveryAdded(null);
    try {
      const result = await processTask(task, resumeState);
      setMessage(result.complete ? `${task} selesai: ${result.processed} diproses, ${result.added} baru.` : `Checkpoint ${task} tersimpan; buka kembali task untuk melanjutkan.`);
    } catch (error) { localStorage.removeItem(`netix:scraper:${task}`); setMessage(error instanceof Error ? error.message : "Scraper gagal."); }
    finally { setBusy(false); }
  }
  async function runDiscoverySuite() {
    if (busy || recovery.data?.task) return;
    if (!window.confirm("Jalankan discovery film, trending, dan semua platform? Proses dapat berlangsung lama. Konten baru masuk antrean review.")) return;
    setBusy(true); setDiscoveryAdded(null); setMessage("");
    let processed = 0;
    let added = 0;
    try {
      for (let index = 0; index < discoveryTasks.length; index++) {
        const [task, label] = discoveryTasks[index];
        setSuiteProgress({ current: index, total: discoveryTasks.length, task: label });
        setMessage(`Discovery ${index + 1}/${discoveryTasks.length}: ${label}…`);
        const result = await processTask(task);
        processed += result.processed;
        added += result.added;
        if (!result.complete) {
          setMessage(`${label} mencapai batas batch. Checkpoint tersimpan; jalankan Discovery katalog lengkap lagi untuk melanjutkan.`);
          return;
        }
      }
      setSuiteProgress({ current: discoveryTasks.length, total: discoveryTasks.length, task: "Selesai" });
      setDiscoveryAdded(added);
      setMessage(`Discovery lengkap selesai: ${processed} diproses, ${added} judul baru menunggu pemeriksaan.`);
      await queryClient.invalidateQueries({ queryKey: ["admin"] });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Discovery katalog gagal.");
    } finally { setBusy(false); }
  }
  async function checkProviders() {
    try {
      const result = await fetchJson<{ providers: { name: string; status: string; latency: number }[] }>("/api/admin/scraper/health");
      setMessage(result.providers.map((provider) => `${provider.name}: ${provider.status} (${provider.latency} ms)`).join(" · "));
    } catch (error) { setMessage(error instanceof Error ? error.message : "Pemeriksaan gagal."); }
  }
  const taskButton = ([task, label]: readonly [string, string]) => <button key={task} className="action-button" disabled={busy || Boolean(recovery.data?.task)} onClick={() => void run(task)}>{label}</button>;
  const activeLog = logs.find((log) => log.status === "running") ?? latest;
  const recoveryIsActive = Boolean(recovery.data?.task && recovery.data.progress?._lastUpdated && Date.now() - Date.parse(recovery.data.progress._lastUpdated) < 180000);
  const taskPercent = activeLog?.progress?.total > 0 ? Math.min(100, Math.round((activeLog.progress.current / activeLog.progress.total) * 100)) : activeLog?.status === "success" ? 100 : 0;
  const progressPercent = suiteProgress ? Math.min(100, Math.round(((suiteProgress.current + (suiteProgress.current < suiteProgress.total ? taskPercent / 100 : 0)) / suiteProgress.total) * 100)) : taskPercent;
  const progressLabel = suiteProgress ? `${suiteProgress.task} · tahap ${Math.min(suiteProgress.current + 1, suiteProgress.total)} dari ${suiteProgress.total}` : activeLog ? `${activeLog.taskName} · ${activeLog.status}` : "Belum ada progres";
  return <section className="page-shell admin-scraper-page">
    <div className="page-heading"><h1 className="page-title">Scraper</h1><p className="page-description">Discovery memprioritaskan film dan serial provider Indonesia. Hanya judul dengan rating minimal 6/10 dan 50 vote TMDB; konten baru menunggu persetujuan kecuali auto-approve aktif.</p></div>
    <section className="profile-panel admin-scraper-summary"><div><div><h2>Status otomatisasi</h2><p>Cloudflare Worker menjalankan Discovery dan Trending tiap 6 jam setelah di-deploy. Progres batch tersimpan di Neon.</p></div><span className={`admin-status-badge admin-status-badge--${latest?.status ?? "idle"}`}>{latest ? latest.status : "belum berjalan"}</span></div>{latest ? <><p>Job terakhir: <strong>{latest.taskName}</strong> · {latest.createdAt ? new Date(latest.createdAt).toLocaleString("id-ID") : "waktu tidak tersedia"} · {Number(latest.itemsCount ?? 0).toLocaleString("id-ID")} diproses</p>{latest.errorMessage && <p className="admin-scraper-error" role="alert">{latest.errorMessage}</p>}</> : <p>Belum ada riwayat job. Jalankan task manual atau deploy scheduler Worker.</p>}<div className="admin-scraper-progress"><div><span>{progressLabel}</span><strong>{progressPercent}%</strong></div><progress max={100} value={progressPercent} aria-label={`Progres scraper ${progressLabel}`} /></div></section>
    <section className="profile-panel admin-scraper-controls"><div className="admin-scraper-controls-heading"><div><h2>Kontrol scraper</h2><p>Jalankan batch manual atau periksa provider.</p></div><div className="hero-actions"><button className="action-button admin-danger-button" disabled={busy} onClick={async () => { try { const result = await fetchJson<{ stopped: number }>("/api/admin/scraper/stop", { method: "POST" }); setMessage(`${result.stopped} task dihentikan.`); await queryClient.invalidateQueries({ queryKey: ["admin", "scraper"] }); } catch (error) { setMessage(error instanceof Error ? error.message : "Gagal menghentikan scraper."); } }}>Hentikan task</button><button className="action-button" disabled={busy} onClick={() => void checkProviders()}>Periksa provider</button></div></div>
      <div className="admin-scraper-task-groups"><div><h3>Discovery katalog</h3><p>Film dan serial dari Netflix serta provider Indonesia lain diproses lebih dulu, lalu film bioskop dan trending film. Filter rating: minimal 6/10 dan 50 vote. Konten baru menunggu review.</p><div className="hero-actions"><button className="action-button action-button--primary" disabled={busy || Boolean(recovery.data?.task)} onClick={() => void runDiscoverySuite()}>{busy && suiteProgress ? "Discovery berjalan…" : "Jalankan discovery lengkap"}</button></div></div><div><h3>Perawatan katalog</h3><div className="hero-actions">{maintenanceTasks.map(taskButton)}</div></div></div>
      {recovery.data?.task && <div className="admin-scraper-recovery" role="status"><div><strong>{recoveryIsActive ? `Task sedang berjalan: ${recovery.data.task}` : `Task tertahan: ${recovery.data.task}`}</strong><p>{recovery.data.progress?.current_item ?? "Checkpoint tersimpan"} · {recovery.data.progress?.current ?? 0}/{recovery.data.progress?.total ?? 0}</p></div>{!recoveryIsActive && <button className="action-button action-button--primary" disabled={busy} onClick={() => void run(recovery.data!.task!, recovery.data!.state)}>Lanjutkan task</button>}</div>}{message && <p className="admin-notice" role="status">{message}{discoveryAdded !== null && <> <Link to="/admin" search={{ tab: "approve", platform: "", missing: "" }}>Buka antrean review →</Link></>}</p>}
    </section>
    <details className="profile-panel admin-scraper-history"><summary>Riwayat task <span>{logs.length} terbaru</span></summary><div className="admin-list">{logs.map((log) => <article className="profile-panel" key={log.id}><div className="admin-overview-log"><strong>{log.taskName}</strong><span className={`admin-status-badge admin-status-badge--${log.status}`}>{log.status}</span><small>{log.createdAt ? new Date(log.createdAt).toLocaleString("id-ID") : "—"}</small></div><p>{log.summary?.items_processed ?? 0} diproses · {log.summary?.items_added ?? 0} ditambahkan{log.summary?.items_updated ? ` · ${log.summary.items_updated} diperbarui` : ""}</p>{log.progress?.current_item && <small>{log.progress.current_item} ({log.progress.current}/{log.progress.total})</small>}{log.errorMessage && <p className="admin-scraper-error" role="alert">{log.errorMessage}</p>}</article>)}{!logs.length && <div className="empty-panel">Belum ada aktivitas scraper.</div>}</div></details>
  </section>;
}

function AdminSettingsPage({ items }: { items: { key: string; value: unknown }[] }) {
  const [notice, setNotice] = React.useState("");
  const [busyKey, setBusyKey] = React.useState<string | null>(null);
  const record = (key: string): Record<string, unknown> => {
    const value = items.find((item) => item.key === key)?.value;
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  };
  const site = record("site_config");
  const scraper = record("scraper_config");
  async function save(event: React.FormEvent<HTMLFormElement>, key: "site_config" | "scraper_config") {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const current = record(key);
    const value = key === "site_config" ? {
      ...current,
      title: String(form.get("title") ?? "").trim(),
      primary_color: String(form.get("primary_color") ?? "#eab308"),
      navbar_color: String(form.get("navbar_color") ?? "#38bdf8"),
      maintenance_mode: form.get("maintenance_mode") === "on",
      allow_registrations: form.get("allow_registrations") === "on",
    } : {
      ...current,
      auto_approve: form.get("auto_approve") === "on",
      auto_scrape_enabled: form.get("auto_scrape_enabled") === "on",
      videasy_enabled: form.get("videasy_enabled") === "on",
      vidlink_enabled: form.get("vidlink_enabled") === "on",
      moviesapito_enabled: form.get("moviesapito_enabled") === "on",
      discovery_pages: Math.min(25, Math.max(1, Number(form.get("discovery_pages")) || 1)),
    };
    setBusyKey(key); setNotice("");
    try {
      await fetchJson(`/api/admin/settings/${encodeURIComponent(key)}`, { method: "PATCH", body: JSON.stringify({ value }) });
      setNotice("Pengaturan berhasil disimpan.");
      if (key === "site_config") await queryClient.invalidateQueries({ queryKey: ["site-config"] });
      await queryClient.invalidateQueries({ queryKey: ["admin"] });
    } catch (error) { setNotice(error instanceof Error ? error.message : "Pengaturan gagal disimpan."); }
    finally { setBusyKey(null); }
  }
  return <section className="page-shell"><p className="admin-page-summary">Atur tampilan situs dan perilaku otomatisasi. Rahasia konfigurasi tetap tersembunyi dan tidak dapat diubah dari sini.</p>{notice && <p className="admin-notice" role="status">{notice}</p>}<div className="admin-settings-grid">
    <form className="profile-panel profile-settings admin-settings-card" onSubmit={(event) => void save(event, "site_config")}><div><h2>Pengaturan situs</h2><p>Branding dan akses dasar NETIX.</p></div><label>Nama situs<input name="title" defaultValue={String(site.title ?? "NETIX")} maxLength={80} required /></label><div className="admin-color-fields"><label>Warna aksen<input name="primary_color" type="color" defaultValue={String(site.primary_color ?? "#eab308")} /></label><label>Warna navigasi<input name="navbar_color" type="color" defaultValue={String(site.navbar_color ?? "#38bdf8")} /></label></div><label className="admin-toggle"><input name="maintenance_mode" type="checkbox" defaultChecked={site.maintenance_mode === true} /><span><strong>Mode pemeliharaan</strong><small>Sembunyikan situs dari pengunjung biasa.</small></span></label><label className="admin-toggle"><input name="allow_registrations" type="checkbox" defaultChecked={site.allow_registrations !== false} /><span><strong>Izinkan pendaftaran</strong><small>Pengguna baru dapat membuat akun.</small></span></label><button className="action-button action-button--primary" disabled={busyKey !== null}>{busyKey === "site_config" ? "Menyimpan…" : "Simpan pengaturan situs"}</button></form>
    <form className="profile-panel profile-settings admin-settings-card" onSubmit={(event) => void save(event, "scraper_config")}><div><h2>Pengaturan otomatisasi</h2><p>Konten baru tetap menunggu persetujuan kecuali auto-approve aktif.</p></div><label className="admin-number-field">Halaman discovery<input name="discovery_pages" type="number" min={1} max={25} defaultValue={Number(scraper.discovery_pages) || 5} /><small>Jumlah halaman TMDB yang diproses per task (1–25).</small></label>{[["auto_approve", "Setujui otomatis", "Publikasikan konten baru tanpa antrean review."], ["auto_scrape_enabled", "Aktifkan jadwal scraper", "Izinkan task discovery terjadwal."], ["moviesapito_enabled", "MoviesAPI", "Gunakan provider MoviesAPI."], ["vidlink_enabled", "VidLink", "Gunakan provider VidLink."], ["videasy_enabled", "Videasy", "Gunakan provider Videasy bila tersedia."]].map(([key, label, description]) => <label className="admin-toggle" key={key}><input name={key} type="checkbox" defaultChecked={scraper[key] === true} /><span><strong>{label}</strong><small>{description}</small></span></label>)}<p className="admin-secret-note">Kredensial scheduler tersimpan dan tidak ditampilkan. Ubah lewat secret deployment, bukan formulir ini.</p><button className="action-button action-button--primary" disabled={busyKey !== null}>{busyKey === "scraper_config" ? "Menyimpan…" : "Simpan otomatisasi"}</button></form>
  </div></section>;
}

function AdminApprovalPage({ items }: { items: Content[] }) {
  const [message, setMessage] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [type, setType] = React.useState("");
  const [platform, setPlatform] = React.useState("");
  const [page, setPage] = React.useState(1);
  const pending = useQuery({ queryKey: ["admin", "approval", query, type, platform, page], queryFn: () => fetchJson<{ items: Content[]; total: number; limit: number }>(`/api/admin/catalog?status=pending&limit=20&page=${page}&q=${encodeURIComponent(query)}&type=${type}&platform=${platform}`) });
  async function update(url: string, body?: unknown) {
    if (busy) return;
    setBusy(true);
    try {
      await fetchJson(url, { method: url.includes("/status") ? "PATCH" : "POST", body: JSON.stringify(body ?? { status: "approved" }) });
      setMessage("Perubahan persetujuan tersimpan.");
      await queryClient.invalidateQueries({ queryKey: ["admin"] });
    } catch (error) { setMessage(error instanceof Error ? error.message : "Perubahan gagal."); }
    finally { setBusy(false); }
  }
  const rows = pending.data?.items ?? items;
  async function reject(item: Content) {
    const reason = window.prompt(`Alasan menolak “${item.title}” (minimal 3 karakter):`);
    if (reason === null) return;
    if (reason.trim().length < 3) { setMessage("Alasan penolakan minimal 3 karakter."); return; }
    await update(`/api/admin/catalog/${item.id}/status`, { status: "rejected", reason });
  }
  return <section className="page-shell"><div className="admin-page-toolbar"><p className="admin-page-summary">{pending.data?.total ?? items.length} judul menunggu review.</p><button className="action-button action-button--primary" disabled={!(pending.data?.total ?? items.length) || busy} onClick={() => { if (window.confirm(`Setujui semua ${pending.data?.total ?? items.length} konten yang menunggu?`)) void update("/api/admin/catalog/approve-pending", {}); }}>Setujui semua ({pending.data?.total ?? items.length})</button></div><div className="filter-toolbar admin-review-filters"><input className="search-input" aria-label="Cari review" placeholder="Cari judul…" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} /><select aria-label="Tipe review" value={type} onChange={(event) => { setType(event.target.value); setPage(1); }}><option value="">Semua tipe</option><option value="movie">Film</option><option value="tv">Serial</option></select><select aria-label="Network review" value={platform} onChange={(event) => { setPlatform(event.target.value); setPage(1); }}><option value="">Semua platform</option>{["netflix", "disney", "amazon", "apple", "hbo", "paramount", "anime", "other", "unassigned"].map((value) => <option key={value} value={value}>{value === "unassigned" ? "Belum diklasifikasi" : value}</option>)}</select></div>{message && <p className="admin-notice" role="status">{message}</p>}{pending.isError ? <div className="empty-panel" role="alert">{pending.error.message}</div> : pending.isLoading ? <div className="empty-panel">Memuat antrean review…</div> : <><div className="admin-approval-grid">{rows.map((item) => { const poster = item.posterPath ?? item.poster_path; return <article className="profile-panel admin-approval-card" key={item.id}><div className="admin-approval-poster">{poster ? <img src={`https://image.tmdb.org/t/p/w342${poster}`} alt={`Poster ${item.title}`} loading="lazy" /> : <span>Poster tidak tersedia</span>}</div><div className="admin-approval-details"><h2>{item.title}</h2><p className="page-description">{item.type} · {item.platform ?? "Platform belum diklasifikasi"} · TMDB {item.tmdbId}</p><p className="admin-approval-overview">{item.overview || "Sinopsis belum tersedia."}</p><details><summary>Pratinjau detail</summary><p>{item.overview || "Sinopsis belum tersedia."}</p><a href={`https://www.themoviedb.org/${item.type === "movie" ? "movie" : "tv"}/${item.tmdbId}`} target="_blank" rel="noreferrer">Lihat sumber TMDB ↗</a></details><div className="hero-actions"><button className="action-button action-button--primary" disabled={busy} onClick={() => void update(`/api/admin/catalog/${item.id}/status`)}>Setujui</button><button className="action-button" disabled={busy} onClick={() => void reject(item)}>Tolak</button></div></div></article>; })}{!rows.length && <div className="empty-panel">Tidak ada konten yang cocok dengan filter.</div>}</div><div className="admin-pagination"><button className="action-button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Sebelumnya</button><span>Halaman {page} dari {Math.max(1, Math.ceil((pending.data?.total ?? 0) / (pending.data?.limit ?? 20)))}</span><button className="action-button" disabled={page * (pending.data?.limit ?? 20) >= (pending.data?.total ?? 0)} onClick={() => setPage((value) => value + 1)}>Berikutnya</button></div></>}</section>;
}

function AdminCatalogPage({ initialPlatform = "", initialMissing = "" }: { initialPlatform?: string; initialMissing?: string }) {
  const [query, setQuery] = React.useState("");
  const [type, setType] = React.useState("");
  const [status, setStatus] = React.useState("all");
  const [missing, setMissing] = React.useState(initialMissing);
  const [platform, setPlatform] = React.useState(initialPlatform);
  const [page, setPage] = React.useState(1);
  const [notice, setNotice] = React.useState("");
  const [busyItem, setBusyItem] = React.useState<string | null>(null);
  const catalog = useQuery({
    queryKey: ["admin", "catalog", query, type, platform, status, missing, page],
    queryFn: () => fetchJson<{ items: (Content & { status: string })[]; total: number; page: number; limit: number }>(`/api/admin/catalog?status=${status}&limit=20&page=${page}&q=${encodeURIComponent(query)}&type=${type}&platform=${platform}&missing=${missing}`),
  });
  async function save(event: React.FormEvent<HTMLFormElement>, item: Content) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusyItem(item.id); setNotice("");
    try {
      await fetchJson(`/api/admin/catalog/${item.id}`, { method: "PATCH", body: JSON.stringify({ title: form.get("title"), overview: form.get("overview"), platform: form.get("platform") || null }) });
      setNotice(`${item.title} diperbarui.`);
      await queryClient.invalidateQueries({ queryKey: ["admin", "catalog"] });
    } catch (error) { setNotice(error instanceof Error ? error.message : "Pembaruan gagal."); }
    finally { setBusyItem(null); }
  }
  async function remove(item: Content) {
    if (!window.confirm(`Hapus ${item.title} beserta data turunannya?`)) return;
    setBusyItem(item.id); setNotice("");
    try { await fetchJson(`/api/admin/catalog/${item.id}`, { method: "DELETE" }); setNotice(`${item.title} dihapus.`); await queryClient.invalidateQueries({ queryKey: ["admin", "catalog"] }); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Penghapusan gagal."); }
    finally { setBusyItem(null); }
  }
  return <section className="page-shell">
    <div className="page-heading"><h1 className="page-title">Manajemen katalog</h1><p className="page-description">{catalog.data?.total ?? 0} judul dalam katalog.</p></div>
    <form className="filter-toolbar" onSubmit={(event) => { event.preventDefault(); setPage(1); }}>
      <input className="search-input" aria-label="Cari konten" placeholder="Cari judul…" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} />
      <select aria-label="Status konten" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="all">Semua status</option><option value="pending">Menunggu review</option><option value="approved">Aktif</option><option value="rejected">Ditolak</option></select>
      <select aria-label="Metadata" value={missing} onChange={(event) => { setMissing(event.target.value); setPage(1); }}><option value="">Semua metadata</option><option value="poster">Poster belum ada</option><option value="overview">Sinopsis belum ada</option></select>
      <select aria-label="Tipe" value={type} onChange={(event) => { setType(event.target.value); setPage(1); }}><option value="">Semua tipe</option><option value="movie">Film</option><option value="tv">Serial</option></select>
      <select aria-label="Network" value={platform} onChange={(event) => { setPlatform(event.target.value); setPage(1); }}><option value="">Semua network</option><option value="unassigned">Belum diklasifikasikan</option>{["netflix", "disney", "amazon", "apple", "hbo", "paramount", "anime", "other"].map((value) => <option key={value} value={value}>{value}</option>)}</select>
      <button className="action-button">Cari</button>
    </form>
    {notice && <p className="admin-notice" role="status">{notice}</p>}
    {catalog.isLoading ? <div className="empty-panel">Memuat katalog…</div> : catalog.isError ? <div className="empty-panel" role="alert">{catalog.error.message}</div> : <>
      {catalog.data!.items.length ? <div className="admin-list admin-catalog-list">{catalog.data!.items.map((item) => <form className="profile-panel admin-user admin-catalog-edit-card" key={item.id} onSubmit={(event) => void save(event, item)}>
        <div className="admin-catalog-poster">{(item.posterPath ?? item.poster_path) ? <img src={`https://image.tmdb.org/t/p/w185${item.posterPath ?? item.poster_path}`} alt={`Poster ${item.title}`} loading="lazy" /> : <span>Tanpa poster</span>}</div>
        <div className="admin-catalog-fields"><div><h2>{item.title}</h2><p className="page-description">{item.type} · {item.status} · TMDB {item.tmdbId}</p></div>
        <input name="title" aria-label={`Judul ${item.title}`} defaultValue={item.title} required />
        <textarea name="overview" aria-label={`Sinopsis ${item.title}`} defaultValue={item.overview ?? ""} rows={3} maxLength={10000} placeholder="Sinopsis belum tersedia" />
        <select name="platform" defaultValue={item.platform ?? ""} aria-label="Network"><option value="">Belum diatur</option>{["netflix", "disney", "amazon", "apple", "hbo", "paramount", "anime", "other"].map((value) => <option key={value} value={value}>{value}</option>)}</select>
        <div className="hero-actions"><button className="action-button" disabled={busyItem === item.id}>{busyItem === item.id ? "Menyimpan…" : "Simpan"}</button>
        {item.type === "movie" && <Link className="action-button" to="/admin/drive/$id" params={{ id: item.id }}>Drive</Link>}
        <button type="button" className="action-button admin-danger-button" disabled={busyItem === item.id} onClick={() => void remove(item)}>Hapus</button>
        <button type="button" className="action-button action-button--primary" disabled={busyItem === item.id} onClick={async () => { const next = item.status === "approved" ? "pending" : "approved"; setBusyItem(item.id); setNotice(""); try { await fetchJson(`/api/admin/catalog/${item.id}/status`, { method: "PATCH", body: JSON.stringify({ status: next }) }); setNotice(next === "approved" ? "Konten disetujui." : "Konten dipindahkan ke antrean persetujuan."); await queryClient.invalidateQueries({ queryKey: ["admin", "catalog"] }); } catch (error) { setNotice(error instanceof Error ? error.message : "Perubahan status gagal."); } finally { setBusyItem(null); } }}>{item.status === "approved" ? "Nonaktifkan" : "Setujui"}</button></div></div>
      </form>)}</div> : <div className="empty-panel">Tidak ada konten yang cocok dengan filter ini.</div>}
      <div className="admin-user"><button className="action-button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Sebelumnya</button><span>Halaman {page} dari {Math.max(1, Math.ceil(catalog.data!.total / catalog.data!.limit))}</span><button className="action-button" disabled={page * catalog.data!.limit >= catalog.data!.total} onClick={() => setPage((value) => value + 1)}>Berikutnya</button></div>
    </>}</section>;
}

function AdminDrivePage({ id }: { id: string }) {
  const drive = useQuery({ queryKey: ["admin", "drive", id], queryFn: () => fetchJson<{ content: { title: string }; url: string; duplicateLinks: boolean }>(`/api/admin/catalog/${id}/drive`) });
  const [url, setUrl] = React.useState("");
  const [confirmed, setConfirmed] = React.useState(false);
  const [message, setMessage] = React.useState("");
  React.useEffect(() => { if (drive.data) setUrl(drive.data.url); }, [drive.data]);
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try { await fetchJson(`/api/admin/catalog/${id}/drive`, { method: "PUT", body: JSON.stringify({ url, rightsConfirmed: confirmed }) }); setMessage("Tautan tersimpan. Uji playback sebelum diterbitkan."); await queryClient.invalidateQueries({ queryKey: ["admin", "drive", id] }); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Gagal menyimpan tautan."); }
  }
  if (drive.isLoading) return <section className="page-shell"><div className="empty-panel">Memuat tautan Drive…</div></section>;
  if (drive.isError) return <section className="page-shell"><div className="empty-panel" role="alert">{drive.error.message}</div></section>;
  return <section className="page-shell"><Link className="back-link" to="/admin" search={{ tab: "catalog" }}>← Kembali ke katalog</Link><div className="page-heading"><h1 className="page-title">Google Drive · {drive.data!.content.title}</h1><p className="page-description">Hanya tautan preview HTTPS. NETIX tidak menyimpan atau menghapus file Drive.</p></div><form className="profile-panel profile-settings" onSubmit={(event) => void save(event)}><label>Tautan file atau file ID<input value={url} maxLength={2048} onChange={(event) => setUrl(event.target.value)} required placeholder="https://drive.google.com/file/d/…/view" /></label><label className="checkbox-label"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} required /> Saya memiliki video ini atau izin untuk memutarnya kepada penonton.</label><button className="action-button action-button--primary" disabled={!confirmed}>Simpan tautan</button>{drive.data!.url && <button type="button" className="action-button" onClick={async () => { if (!window.confirm("Lepaskan link dari NETIX? File tidak dihapus.")) return; try { await fetchJson(`/api/admin/catalog/${id}/drive`, { method: "DELETE" }); setUrl(""); setConfirmed(false); setMessage("Tautan dilepas dari NETIX."); await queryClient.invalidateQueries({ queryKey: ["admin", "drive", id] }); } catch (error) { setMessage(error instanceof Error ? error.message : "Gagal melepas tautan."); } }}>Lepaskan tautan</button>}{drive.data!.duplicateLinks && <p role="alert">Terdapat tautan duplikat; lepaskan semuanya sebelum menyimpan tautan baru.</p>}{message && <p role="status">{message}</p>}</form></section>;
}

function AdminUsersPage({ users, canManage, currentUserId }: { users: { id: string; name: string; email: string; role: string; createdAt: string }[]; canManage: boolean; currentUserId: string }) {
  const [notice, setNotice] = React.useState("");
  const [busyUser, setBusyUser] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const [page, setPage] = React.useState(1);
  const userPage = useQuery({ queryKey: ["admin", "users", query, page], queryFn: () => fetchJson<{ items: typeof users; total: number; limit: number }>(`/api/admin/users?q=${encodeURIComponent(query)}&page=${page}&limit=25`) });
  async function changeRole(id: string, role: string) {
    const account = (userPage.data?.items ?? users).find((item) => item.id === id);
    if (account && !window.confirm(`Ubah role ${account.email} dari ${account.role.replaceAll("_", " ")} menjadi ${role.replaceAll("_", " ")}?${role === "super_admin" ? " Role ini memberi akses penuh ke pengaturan dan akun." : ""}`)) return;
    setBusyUser(id); setNotice("");
    try {
      await fetchJson(`/api/admin/users/${id}/role`, { method: "PATCH", body: JSON.stringify({ role }) });
      setNotice("Peran pengguna diperbarui.");
      await queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    } catch (error) { setNotice(error instanceof Error ? error.message : "Perubahan peran gagal."); }
    finally { setBusyUser(null); }
  }
  async function removeUser(user: { id: string; email: string }) {
    if (!window.confirm(`Hapus akun ${user.email} secara permanen? Tindakan ini tidak dapat dibatalkan.`)) return;
    setBusyUser(user.id); setNotice("");
    try {
      await fetchJson(`/api/admin/users/${user.id}`, { method: "DELETE" });
      setNotice("Akun pengguna dihapus.");
      await queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    } catch (error) { setNotice(error instanceof Error ? error.message : "Penghapusan akun gagal."); }
    finally { setBusyUser(null); }
  }
  const rows = userPage.data?.items ?? users;
  return <section className="page-shell"><div className="page-heading"><h2 className="page-title">Pengguna</h2><p className="page-description">{userPage.data?.total ?? users.length} akun. Perubahan role hanya untuk super-admin.</p></div><div className="filter-toolbar admin-user-search"><input className="search-input" aria-label="Cari pengguna" placeholder="Cari nama atau email…" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} /></div>{notice && <p className="admin-notice" role="status">{notice}</p>}{userPage.isLoading ? <div className="empty-panel">Memuat pengguna…</div> : userPage.isError ? <div className="empty-panel" role="alert">{userPage.error.message}</div> : rows.length ? <div className="admin-list">{rows.map((account) => <article className="profile-panel admin-user-row" key={account.id}><div className="admin-user-identity"><span className="admin-avatar"><User size={18} /></span><span><strong>{account.name || "Tanpa nama"}</strong><small>{account.email}</small></span></div><span className={`admin-role-badge admin-role-badge--${account.role}`}>{account.role.replaceAll("_", " ")}</span>{canManage && account.id !== currentUserId && <div className="admin-user-actions"><label><span className="sr-only">Role untuk {account.email}</span><select aria-label={`Role untuk ${account.email}`} value={account.role} disabled={busyUser === account.id} onChange={(event) => void changeRole(account.id, event.target.value)}><option value="user">User</option><option value="moderator">Moderator</option><option value="super_admin">Super-admin</option></select></label>{account.role !== "super_admin" && <button className="action-button admin-danger-button" disabled={busyUser === account.id} onClick={() => void removeUser(account)}>Hapus akun</button>}</div>}{account.id === currentUserId && <small className="page-description">Akun aktif</small>}</article>)}</div> : <div className="empty-panel">Tidak ada pengguna yang cocok.</div>}<div className="admin-pagination"><button className="action-button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Sebelumnya</button><span>Halaman {page} dari {Math.max(1, Math.ceil((userPage.data?.total ?? 0) / (userPage.data?.limit ?? 25)))}</span><button className="action-button" disabled={page * (userPage.data?.limit ?? 25) >= (userPage.data?.total ?? 0)} onClick={() => setPage((value) => value + 1)}>Berikutnya</button></div></section>;
}

function AdminNetworkPage({ items }: { items: { platform: string | null; count: number }[] }) {
  return <section className="page-shell"><p className="admin-page-summary">Jumlah katalog per platform. Buka daftar yang sudah difilter untuk mengubah klasifikasi konten.</p>{items.length ? <div className="admin-network-grid">{items.map((item) => <article className="profile-panel admin-network-card" key={item.platform ?? "unassigned"}><span className="admin-network-icon"><Tv size={18} /></span><div><h2>{item.platform ?? "Belum diklasifikasikan"}</h2><p>{item.count.toLocaleString("id-ID")} judul</p></div><Link className="action-button" to="/admin" search={{ tab: "catalog", platform: item.platform ?? "unassigned" }}>Kelola konten</Link></article>)}</div> : <div className="empty-panel">Belum ada data network.</div>}</section>;
}

function AdminRecordsPage({ tab, items, onUpdate }: { tab: "audit" | "reports"; items: any[]; onUpdate: (url: string, method: string, body: unknown) => Promise<void> }) {
  const isAudit = tab === "audit";
  const [query, setQuery] = React.useState("");
  const filtered = items.filter((item) => `${item.action ?? item.issueType ?? ""} ${item.targetType ?? ""} ${item.targetId ?? ""} ${item.contentTitle ?? ""} ${JSON.stringify(item.details ?? item.status ?? "")}`.toLowerCase().includes(query.toLowerCase()));
  return <section className="page-shell"><p className="admin-page-summary">{filtered.length} dari {items.length} {isAudit ? "aktivitas terbaru" : "laporan"}.</p><div className="filter-toolbar"><input className="search-input" aria-label={isAudit ? "Cari aktivitas" : "Cari laporan"} placeholder={isAudit ? "Cari aktivitas…" : "Cari laporan…"} value={query} onChange={(event) => setQuery(event.target.value)} /></div>{filtered.length ? <div className="admin-list">{filtered.map((item) => {
    const detail = item.details ?? item.status ?? item.targetId;
    const detailText = typeof detail === "string" ? detail : detail == null ? "—" : JSON.stringify(detail, null, 2);
    return <article className="profile-panel admin-record-card" key={item.id}><div className="admin-record-heading"><div><h2>{item.action ?? item.issueType ?? item.taskName ?? "Aktivitas"}</h2><p>{item.targetType ?? item.contentId ?? ""}</p></div><time dateTime={item.createdAt}>{item.createdAt ? new Date(item.createdAt).toLocaleString("id-ID") : "Waktu tidak tersedia"}</time></div><pre className="admin-record-detail">{detailText}</pre>{!isAudit && <div className="hero-actions"><button className="action-button action-button--primary" onClick={() => void onUpdate(`/api/admin/reports/${item.id}`, "PATCH", { status: "resolved" })}>Selesaikan</button><button className="action-button" onClick={() => void onUpdate(`/api/admin/reports/${item.id}`, "PATCH", { status: "dismissed" })}>Abaikan</button></div>}</article>;
  })}</div> : <div className="empty-panel">{isAudit ? "Belum ada aktivitas yang cocok." : "Belum ada laporan yang cocok."}</div>}</section>;
}

const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin",
  validateSearch: (search: Record<string, unknown>) => ({ tab: ["overview", "approve", "catalog", "networks", "scraper", "reports", "audit", "settings", "users"].includes(String(search.tab)) ? String(search.tab) : "overview", ...(typeof search.platform === "string" ? { platform: search.platform } : {}), ...(typeof search.missing === "string" ? { missing: search.missing } : {}) }),
  component: function AdminPage() {
    const { tab, platform, missing } = adminRoute.useSearch();
    const navigate = adminRoute.useNavigate();
    const adminData = useQuery({ queryKey: ["admin", tab], queryFn: async () => fetchJson<any>(`/api/admin/${tab === "overview" ? "overview" : tab === "approve" ? "catalog?status=pending" : tab === "catalog" ? "catalog?status=approved" : tab === "networks" ? "platforms" : tab === "scraper" ? "scraper/logs" : tab}`), refetchInterval: tab === "scraper" ? 3000 : false });
    if (adminData.isLoading) return <section className="page-shell"><div className="empty-panel">Memuat panel admin…</div></section>;
    if (adminData.isError) return <section className="page-shell"><div className="empty-panel" role="alert"><h2>{adminData.error instanceof ApiError && adminData.error.status === 403 ? "Izin tidak mencukupi" : "Panel admin gagal dimuat"}</h2><p>{adminData.error.message}</p>{adminData.error instanceof ApiError && adminData.error.status === 403 ? <Link className="action-button" to="/">Kembali ke NETIX</Link> : <button className="action-button" onClick={() => void adminData.refetch()}>Coba lagi</button>}</div></section>;
    if (tab === "scraper") return <AdminScraperPage logs={adminData.data.items} />;
    if (tab === "settings") return <AdminSettingsPage items={adminData.data.items} />;
    if (tab === "approve") return <AdminApprovalPage items={adminData.data.items} />;
    if (tab === "catalog") return <AdminCatalogPage initialPlatform={platform} initialMissing={missing} />;
    const update = async (url: string, method: string, body: unknown) => { await fetchJson(url, { method, body: JSON.stringify(body) }); await queryClient.invalidateQueries({ queryKey: ["admin"] }); };
    if (tab === "users") return <AdminUsersPage users={adminData.data.items} canManage={adminData.data.canManage} currentUserId={adminData.data.currentUserId} />;
    if (tab === "networks") return <AdminNetworkPage items={adminData.data.items} />;
    if (tab === "audit" || tab === "reports") return <AdminRecordsPage tab={tab} items={adminData.data.items} onUpdate={update} />;
    if (tab === "overview") return <AdminOverviewPage data={adminData.data} />;
    return <section className="page-shell"><div className="page-heading"><h1 className="page-title">Panel Admin</h1><p className="page-description">Kelola katalog dan operasional NETIX.</p></div><nav className="admin-tabs">{[["overview", "Ringkasan"], ["approve", "Persetujuan"], ["catalog", "Katalog"], ["networks", "Network"], ["scraper", "Scraper"], ["reports", "Laporan"], ["audit", "Audit"], ["settings", "Pengaturan"], ["users", "Pengguna"]].map(([value, label]) => <button key={value} aria-pressed={tab === value} onClick={() => navigate({ search: { tab: value } })}>{label}</button>)}</nav>{tab === "overview" ? <><div className="admin-stats">{[["Konten", adminData.data.contents], ["Menunggu", adminData.data.pending], ["Pengguna", adminData.data.users], ["Tontonan hari ini", adminData.data.todayViews]].map(([label, value]) => <div className="profile-panel" key={String(label)}><span className="page-description">{label}</span><h2>{value}</h2></div>)}</div><section className="profile-panel"><h2>Log scraper terakhir</h2>{adminData.data.recentLogs.map((log: any) => <p key={log.id}>{log.taskName} · {log.status} · {log.itemsCount ?? 0}</p>)}</section></> : tab === "approve" ? <div className="admin-list">{adminData.data.items.length ? adminData.data.items.map((item: Content) => <article className="profile-panel" key={item.id}><h2>{item.title}</h2><p className="page-description">{item.type} · {item.id}</p><div className="hero-actions"><button className="action-button action-button--primary" onClick={() => void update(`/api/admin/catalog/${item.id}/status`, "PATCH", { status: "approved" })}>Setujui</button><button className="action-button" onClick={() => void update(`/api/admin/catalog/${item.id}/status`, "PATCH", { status: "rejected" })}>Tolak</button></div></article>) : <div className="empty-panel">Tidak ada konten yang menunggu persetujuan.</div>}</div> : tab === "catalog" ? <div className="admin-list">{adminData.data.items.map((item: Content) => <form className="profile-panel admin-user" key={item.id} onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); void update(`/api/admin/catalog/${item.id}`, "PATCH", { platform: String(form.get("platform") || "other") }); }}><div><h2>{item.title}</h2><p className="page-description">{item.type} � {item.status}</p></div><select name="platform" defaultValue={item.platform ?? "other"}>{["netflix", "disney", "amazon", "apple", "hbo", "paramount", "anime", "other"].map((platform) => <option key={platform} value={platform}>{platform}</option>)}</select><button className="action-button">Simpan</button></form>)}</div> : tab === "networks" ? <div className="admin-list">{adminData.data.items.map((item: any) => <article className="profile-panel admin-user" key={item.platform ?? "unassigned"}><h2>{item.platform ?? "Belum ditentukan"}</h2><p>{item.count} judul</p></article>)}</div> : tab === "users" ? <div className="admin-list">{adminData.data.items.map((item: any) => <article className="profile-panel admin-user" key={item.id}><div><h2>{item.name}</h2><p className="page-description">{item.email} ? {item.role}</p></div>{adminData.data.canManage && item.id !== adminData.data.currentUserId && <div className="hero-actions"><button className="action-button" onClick={() => void update(`/api/admin/users/${item.id}/role`, "PATCH", { role: item.role === "super_admin" ? "moderator" : "super_admin" })}>{item.role === "super_admin" ? "Jadikan moderator" : "Jadikan super admin"}</button>{item.role !== "super_admin" && <button className="action-button" onClick={async () => { if (window.confirm(`Hapus akun ${item.email}?`)) await update(`/api/admin/users/${item.id}`, "DELETE", {}); }}>Hapus akun</button>}</div>}</article>)}</div> : tab === "settings" ? <div className="admin-list">{adminData.data.items.map((item: any) => <article className="profile-panel" key={item.key}><h2>{item.key}</h2><pre>{JSON.stringify(item.value, null, 2)}</pre></article>)}</div> : <div className="admin-list">{adminData.data.items.map((item: any) => <article className="profile-panel" key={item.id}><h2>{item.action ?? item.issueType ?? item.taskName ?? "Log"}</h2><p>{item.details ?? item.status ?? item.targetId}</p><small>{item.createdAt}</small>{tab === "reports" && <div className="hero-actions"><button className="action-button action-button--primary" onClick={() => void update(`/api/admin/reports/${item.id}`, "PATCH", { status: "resolved" })}>Selesaikan</button><button className="action-button" onClick={() => void update(`/api/admin/reports/${item.id}`, "PATCH", { status: "dismissed" })}>Abaikan</button></div>}</article>)}</div>}</section>;
  },
});
function LegalPage({ title, sections }: { title: string; sections: { heading: string; body: string }[] }) {
  return <section className="page-shell legal-page"><div className="page-heading"><h1 className="page-title">{title}</h1></div>{sections.map((section) => <article className="profile-panel" key={section.heading}><h2>{section.heading}</h2><p className="page-description">{section.body}</p></article>)}</section>;
}
const faqRoute = createRoute({ getParentRoute: () => rootRoute, path: "/faq", component: () => <LegalPage title="Bantuan" sections={[{ heading: "Bagaimana cara menonton?", body: "Pilih judul dari katalog, buka halaman tontonan, lalu pilih server yang tersedia." }, { heading: "Apakah perlu akun?", body: "Katalog bisa dijelajahi tanpa akun. Masuk untuk menyimpan daftar tontonan dan menyinkronkan riwayat." }, { heading: "Video tidak bisa diputar?", body: "Coba server lain atau kembali lagi nanti. Ketersediaan pemutar bergantung pada penyedia pihak ketiga." }]} /> });
const termsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/terms", component: () => <LegalPage title="Ketentuan Penggunaan" sections={[{ heading: "Penggunaan layanan", body: "Gunakan NETIX secara bertanggung jawab dan patuhi hukum yang berlaku di wilayah Anda." }, { heading: "Konten pihak ketiga", body: "Tautan pemutar dan metadata dapat berasal dari layanan pihak ketiga dan memiliki ketentuan masing-masing." }, { heading: "Ketersediaan", body: "Katalog dan layanan dapat berubah atau tidak tersedia sewaktu-waktu." }]} /> });
const privacyRoute = createRoute({ getParentRoute: () => rootRoute, path: "/privacy", component: () => <LegalPage title="Kebijakan Privasi" sections={[{ heading: "Data akun", body: "NETIX menyimpan informasi akun, preferensi, daftar tontonan, dan riwayat yang diperlukan untuk menyediakan fitur akun." }, { heading: "Data lokal", body: "Sebagian preferensi dan aktivitas tanpa akun dapat tersimpan di browser perangkat Anda." }, { heading: "Penyedia pihak ketiga", body: "Permintaan pemutar dan metadata dapat diteruskan ke penyedia eksternal. Kebijakan mereka berlaku untuk data yang mereka terima." }]} /> });
const driveAdminRoute = createRoute({ getParentRoute: () => rootRoute, path: "/admin/drive/$id", component: function DriveAdmin() { const { id } = driveAdminRoute.useParams(); return <AdminDrivePage id={id} />; } });
function AdminTabAlias({ tab }: { tab: string }) {
  const navigate = useNavigate();
  React.useEffect(() => { void navigate({ to: "/admin", search: { tab }, replace: true }); }, [navigate, tab]);
  return <section className="page-shell"><div className="empty-panel">Membuka panel admin…</div></section>;
}
const adminApproveRoute = createRoute({ getParentRoute: () => rootRoute, path: "/admin/approve", component: () => <AdminTabAlias tab="approve" /> });
const adminCatalogRoute = createRoute({ getParentRoute: () => rootRoute, path: "/admin/catalog", component: () => <AdminTabAlias tab="catalog" /> });
const adminNetworksRoute = createRoute({ getParentRoute: () => rootRoute, path: "/admin/networks", component: () => <AdminTabAlias tab="networks" /> });
const adminUsersRoute = createRoute({ getParentRoute: () => rootRoute, path: "/admin/users", component: () => <AdminTabAlias tab="users" /> });
const adminAuditRoute = createRoute({ getParentRoute: () => rootRoute, path: "/admin/audit", component: () => <AdminTabAlias tab="audit" /> });
const adminScraperRoute = createRoute({ getParentRoute: () => rootRoute, path: "/admin/scraper", component: () => <AdminTabAlias tab="scraper" /> });
const adminReportsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/admin/reports", component: () => <AdminTabAlias tab="reports" /> });
const adminSettingsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/admin/settings", component: () => <AdminTabAlias tab="settings" /> });
const legacyDriveAdminRoute = createRoute({ getParentRoute: () => rootRoute, path: "/admin/catalog/$id/drive", component: function LegacyDriveAdmin() { const { id } = legacyDriveAdminRoute.useParams(); return <AdminDrivePage id={id} />; } });
const routeTree = rootRoute.addChildren([homeRoute, browseRoute, networkRoute, networkDetailRoute, trendingRoute, searchRoute, watchRoute, loginRoute, registerRoute, profileRoute, adminRoute, adminApproveRoute, adminCatalogRoute, adminNetworksRoute, adminUsersRoute, adminAuditRoute, adminScraperRoute, adminReportsRoute, adminSettingsRoute, driveAdminRoute, legacyDriveAdminRoute, faqRoute, termsRoute, privacyRoute]);
const router = createRouter({ routeTree, defaultPreload: "intent" });
declare module "@tanstack/react-router" { interface Register { router: typeof router } }

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode><QueryClientProvider client={queryClient}><RouterProvider router={router} /></QueryClientProvider></React.StrictMode>,
);
