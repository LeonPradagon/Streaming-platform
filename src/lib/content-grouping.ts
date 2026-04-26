export interface ContentGroup {
  title: string;
  items: any[];
  href?: string;
}

export function groupContent(items: any[]) {
  const typeGroups: Record<string, any[]> = {
    movie: [],
    tv: [],
    drakor: [],
    drachin: [],
    anime: [],
    donghua: [],
    variety: [],
    drathai: [],
    drajep: [],
  };

  const genreGroups: Record<string, any[]> = {
    "Aksi & Petualangan": [],
    "Drama & Romansa": [],
    "Horor & Misteri": [],
    Komedi: [],
    Animasi: [],
    "Sci-Fi & Fantasi": [],
    Keluarga: [],
    Kejahatan: [],
  };

  const regionGroups: Record<string, any[]> = {
    west: [],
    korea: [],
    china: [],
    japan: [],
    thailand: [],
    indonesia: [],
  };

  items.forEach((item) => {
    // Type grouping
    if (typeGroups[item.type] !== undefined) {
      typeGroups[item.type].push(item);
    }

    // Region/Country grouping based on type or genre names (heuristic)
    const type = item.type || "";
    if (type === "drakor" || type === "korean-drama") regionGroups.korea.push(item);
    else if (type === "drachin" || type === "chinese-drama") regionGroups.china.push(item);
    else if (type === "drajep" || type === "japanese-drama") regionGroups.japan.push(item);
    else if (type === "drathai" || type === "thai-drama") regionGroups.thailand.push(item);
    else if (type === "anime") regionGroups.japan.push(item);
    else if (type === "donghua") regionGroups.china.push(item);
    else regionGroups.west.push(item);

    // Genre grouping
    const genres = (item.genre_names || []).map((g: string) => g.toLowerCase());
    
    if (genres.some((g: string) => g.includes("action") || g.includes("adventure") || g.includes("aksi") || g.includes("petualangan"))) {
      genreGroups["Aksi & Petualangan"].push(item);
    }
    if (genres.some((g: string) => g.includes("drama") || g.includes("romance") || g.includes("romansa"))) {
      genreGroups["Drama & Romansa"].push(item);
    }
    if (genres.some((g: string) => g.includes("horror") || g.includes("mystery") || g.includes("horor") || g.includes("misteri"))) {
      genreGroups["Horor & Misteri"].push(item);
    }
    if (genres.some((g: string) => g.includes("comedy") || g.includes("komedi"))) {
      genreGroups["Komedi"].push(item);
    }
    if (genres.some((g: string) => g.includes("animation") || g.includes("animasi"))) {
      genreGroups["Animasi"].push(item);
    }
    if (genres.some((g: string) => g.includes("sci-fi") || g.includes("fantasy") || g.includes("fantasi"))) {
      genreGroups["Sci-Fi & Fantasi"].push(item);
    }
    if (genres.some((g: string) => g.includes("family") || g.includes("keluarga"))) {
      genreGroups["Keluarga"].push(item);
    }
    if (genres.some((g: string) => g.includes("crime") || g.includes("kejahatan"))) {
      genreGroups["Kejahatan"].push(item);
    }
  });

  return { typeGroups, genreGroups, regionGroups };
}
