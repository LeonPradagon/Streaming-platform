import { Loader2 } from "lucide-react";

export default function AdminLoading() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        gap: "1rem",
      }}
    >
      <Loader2
        size={40}
        color="#eab308"
        style={{
          animation: "spin 1s linear infinite",
        }}
      />
      <div style={{ color: "#94a3b8", fontSize: "0.95rem", fontWeight: 600 }}>
        Memuat data...
      </div>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
