import { supabase } from "@/lib/supabase";
import { NETWORK_CONFIGS, getTMDBImageUrl } from "@/lib/tmdb";
import MovieCard from "@/components/MovieCard";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ChevronLeft, Tv, Star, Search } from "lucide-react";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

interface NetworkPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string; sort?: string }>;
}

export async function generateMetadata({ params }: NetworkPageProps): Promise<Metadata> {
  const { slug } = await params;
  const network = NETWORK_CONFIGS.find((n) => n.slug === slug);
  if (!network) return { title: "Network Not Found" };
  return {
    title: `${network.name} — Koleksi Lengkap`,
    description: network.description,
  };
}

export default async function NetworkSlugPage({ params, searchParams }: NetworkPageProps) {
  const { slug } = await params;
  const resolvedSearchParams = await searchParams;
  const page = parseInt(resolvedSearchParams?.page || "1");
  const sort = resolvedSearchParams?.sort || "populer";
  const PAGE_SIZE = 30;

  const network = NETWORK_CONFIGS.find((n) => n.slug === slug);
  if (!network) notFound();

  // Build query
  let query = supabase
    .from("contents")
    .select("*", { count: "exact" })
    .eq("status", "approved")
    .eq("platform", slug);

  // Sort
  if (sort === "rating") {
    query = query.order("vote_average", { ascending: false, nullsFirst: false });
  } else if (sort === "terbaru") {
    query = query.order("release_date", { ascending: false });
  } else if (sort === "az") {
    query = query.order("title", { ascending: true });
  } else {
    query = query.order("popularity", { ascending: false });
  }

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  query = query.range(from, to);

  const { data: contents, count, error } = await query;

  // Get a featured item for the hero
  const featuredItem = contents?.[0];

  const validResults = (contents || []).map((item: any) => ({
    ...item,
    metadata: {
      poster_path: item.poster_path,
      vote_average: typeof item.vote_average === "number" ? item.vote_average : parseFloat(item.vote_average || "0"),
      release_date: item.release_date,
      first_air_date: item.release_date,
    },
  }));

  const totalPages = Math.ceil((count || 0) / PAGE_SIZE);

  const SORT_OPTIONS = [
    { value: "populer", label: "Populer" },
    { value: "terbaru", label: "Terbaru" },
    { value: "rating", label: "Rating" },
    { value: "az", label: "A-Z" },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a] relative overflow-hidden pb-24">
      {/* Hero Banner */}
      <div className="relative w-full h-[50vh] md:h-[60vh] overflow-hidden">
        {/* Background image from featured content */}
        {featuredItem?.backdrop_path && (
          <Image
            src={getTMDBImageUrl(featuredItem.backdrop_path, "original")}
            alt={network.name}
            fill
            priority
            className="object-cover opacity-30"
          />
        )}

        {/* Brand gradient overlay */}
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(135deg, ${network.color}30, transparent 50%), linear-gradient(to top, #0a0a0a, transparent 60%), linear-gradient(to right, #0a0a0a 10%, transparent 50%)`,
          }}
        />

        {/* Content */}
        <div className="absolute inset-0 flex items-end px-6 md:px-16 lg:px-24 pb-12 md:pb-16 z-20">
          <div className="max-w-4xl space-y-6">
            {/* Back link */}
            <Link
              href="/network"
              className="inline-flex items-center gap-2 text-gray-400 hover:text-white text-xs font-black uppercase tracking-widest transition-colors"
            >
              <ChevronLeft size={14} /> Semua Network
            </Link>

            {/* Brand badge */}
            <div className="flex items-center gap-4">
              <div
                className="w-16 h-16 md:w-20 md:h-20 rounded-2xl flex items-center justify-center text-white font-black text-3xl md:text-4xl shadow-2xl"
                style={{
                  backgroundColor: network.color,
                  boxShadow: `0 0 60px ${network.color}40`,
                }}
              >
                {network.name.charAt(0)}
              </div>
              <div>
                <h1 className="text-4xl md:text-6xl lg:text-7xl font-black text-white tracking-tighter uppercase leading-none">
                  {network.name}
                </h1>
                <p className="text-gray-400 font-bold tracking-[0.15em] text-[10px] md:text-xs uppercase mt-1">
                  {network.description}
                </p>
              </div>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2 text-gray-400">
                <Tv size={16} />
                <span className="text-sm font-bold">
                  <span className="text-white font-black text-lg">{count || 0}</span> Judul Tersedia
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 px-4 md:px-12 lg:px-20 -mt-8">
        <div className="max-w-[1700px] mx-auto">
          {/* Sort Bar */}
          <div className="flex flex-wrap items-center gap-2 mb-10 p-2 bg-white/[0.03] border border-white/5 rounded-2xl w-fit">
            {SORT_OPTIONS.map((s) => (
              <Link
                key={s.value}
                href={`/network/${slug}?sort=${s.value}`}
                className={`px-5 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${
                  sort === s.value
                    ? "text-white shadow-lg"
                    : "text-gray-500 hover:text-white hover:bg-white/5"
                }`}
                style={sort === s.value ? { backgroundColor: network.color, boxShadow: `0 0 20px ${network.color}30` } : {}}
              >
                {s.label}
              </Link>
            ))}
          </div>

          {/* Results Grid */}
          {validResults.length > 0 ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 md:gap-8">
                {validResults.map((item: any) => (
                  <MovieCard key={item.id} item={item} />
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-center items-center gap-6 mt-20">
                  <Link
                    href={`/network/${slug}?sort=${sort}&page=${Math.max(1, page - 1)}`}
                    className={`p-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all border ${
                      page <= 1
                        ? "bg-white/2 text-gray-700 border-white/5 pointer-events-none"
                        : "bg-white/5 text-white border-white/10 hover:bg-white/10 active:scale-95"
                    }`}
                  >
                    PREV
                  </Link>
                  <div className="flex flex-col items-center">
                    <span className="text-white font-black text-lg leading-none">{page}</span>
                    <span className="text-gray-600 text-[9px] font-black uppercase tracking-tighter mt-1">
                      OF {totalPages}
                    </span>
                  </div>
                  <Link
                    href={`/network/${slug}?sort=${sort}&page=${page + 1}`}
                    className={`p-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all border ${
                      page >= totalPages
                        ? "bg-white/2 text-gray-700 border-white/5 pointer-events-none"
                        : "text-white border-white/20 hover:opacity-90 active:scale-95 shadow-lg"
                    }`}
                    style={
                      page < totalPages
                        ? { backgroundColor: network.color, borderColor: network.color, boxShadow: `0 0 20px ${network.color}30` }
                        : {}
                    }
                  >
                    NEXT
                  </Link>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-32 text-center glass-card rounded-[3rem]">
              <div className="p-6 rounded-full bg-white/5 border border-white/10 mb-6 text-gray-500">
                <Search size={40} />
              </div>
              <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-2">
                Belum Ada Konten
              </h3>
              <p className="text-gray-500 max-w-sm font-medium">
                Konten dari {network.name} belum tersedia. Jalankan scraper untuk menambahkan konten dari network ini.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
