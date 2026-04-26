"use client";

import { useRouter } from "next/navigation";

interface SeasonSelectorProps {
  id: string;
  currentSeason: number;
  currentServerIndex: number;
  seasons: any[];
}

export default function SeasonSelector({ id, currentSeason, currentServerIndex, seasons }: SeasonSelectorProps) {
  const router = useRouter();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newSeason = e.target.value;
    router.push(`/watch/${id}?s=${currentServerIndex}&e=1&ss=${newSeason}`);
  };

  return (
    <select 
      value={currentSeason}
      onChange={handleChange}
      className="bg-black/40 border border-white/10 rounded-xl px-3 py-1.5 text-xs font-black outline-none focus:border-red-600 transition-all cursor-pointer hover:bg-white/5"
    >
      {seasons?.map((s) => (
        <option key={s.id} value={s.season_number} className="bg-[#141414]">
          Season {s.season_number}
        </option>
      ))}
    </select>
  );
}
