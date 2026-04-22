"use client";

import { signup } from "@/app/auth/actions";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { useState } from "react";
import {
  UserPlus,
  Mail,
  Lock,
  User,
  Loader2,
  ChevronRight,
} from "lucide-react";

export default function RegisterForm() {
  const [error, setError] = useState<string | null>(null);

  async function clientAction(formData: FormData) {
    setError(null);
    const result = await signup(formData);
    if (result?.error) {
      setError(result.error);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#060d17",
        backgroundImage:
          "radial-gradient(circle at top left, rgba(234, 179, 8, 0.05), transparent 40%), radial-gradient(circle at bottom right, rgba(56, 189, 248, 0.05), transparent 40%)",
        padding: "2rem",
      }}
    >
      <div
        className="glass"
        style={{
          width: "100%",
          maxWidth: "450px",
          padding: "3rem",
          borderRadius: "2rem",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
          <div
            style={{
              width: "64px",
              height: "64px",
              backgroundColor: "rgba(56, 189, 248, 0.1)",
              borderRadius: "1rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 1.5rem",
              color: "#38bdf8",
            }}
          >
            <UserPlus size={32} />
          </div>
          <h1
            style={{
              fontSize: "2rem",
              fontWeight: 900,
              color: "#f8fafc",
              marginBottom: "0.5rem",
              letterSpacing: "-1px",
            }}
          >
            Registrasi Admin
          </h1>
          <p style={{ color: "#94a3b8" }}>
            Daftarkan akun untuk mengelola platform Anda
          </p>
        </div>

        <form
          action={clientAction}
          style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}
        >
          {error && (
            <div
              style={{
                padding: "1rem",
                backgroundColor: "rgba(239, 68, 68, 0.1)",
                border: "1px solid rgba(239, 68, 68, 0.2)",
                borderRadius: "0.75rem",
                color: "#ef4444",
                fontSize: "0.9rem",
                textAlign: "center",
              }}
            >
              {error}
            </div>
          )}

          <div
            style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
          >
            <label
              style={{
                fontSize: "0.8rem",
                fontWeight: 700,
                color: "#64748b",
                textTransform: "uppercase",
                letterSpacing: "1px",
              }}
            >
              Nama Lengkap
            </label>
            <div style={{ position: "relative" }}>
              <User
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
                name="full_name"
                type="text"
                required
                placeholder="Nama Anda"
                style={{
                  width: "100%",
                  padding: "0.8rem 1rem 0.8rem 3rem",
                  borderRadius: "0.75rem",
                  backgroundColor: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.05)",
                  color: "#f8fafc",
                  outline: "none",
                  fontSize: "1rem",
                }}
              />
            </div>
          </div>

          <div
            style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
          >
            <label
              style={{
                fontSize: "0.8rem",
                fontWeight: 700,
                color: "#64748b",
                textTransform: "uppercase",
                letterSpacing: "1px",
              }}
            >
              Email
            </label>
            <div style={{ position: "relative" }}>
              <Mail
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
                name="email"
                type="email"
                required
                placeholder="admin@gmail.com"
                style={{
                  width: "100%",
                  padding: "0.8rem 1rem 0.8rem 3rem",
                  borderRadius: "0.75rem",
                  backgroundColor: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.05)",
                  color: "#f8fafc",
                  outline: "none",
                  fontSize: "1rem",
                }}
              />
            </div>
          </div>

          <div
            style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
          >
            <label
              style={{
                fontSize: "0.8rem",
                fontWeight: 700,
                color: "#64748b",
                textTransform: "uppercase",
                letterSpacing: "1px",
              }}
            >
              Password
            </label>
            <div style={{ position: "relative" }}>
              <Lock
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
                name="password"
                type="password"
                required
                placeholder="••••••••"
                style={{
                  width: "100%",
                  padding: "0.8rem 1rem 0.8rem 3rem",
                  borderRadius: "0.75rem",
                  backgroundColor: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.05)",
                  color: "#f8fafc",
                  outline: "none",
                  fontSize: "1rem",
                }}
              />
            </div>
          </div>

          <SubmitButton />
        </form>

        <div
          style={{
            marginTop: "2rem",
            textAlign: "center",
            fontSize: "0.9rem",
            color: "#64748b",
          }}
        >
          Sudah punya akun?{" "}
          <Link
            href="/login"
            style={{ color: "var(--primary)", fontWeight: 700 }}
          >
            Login sekarang
          </Link>
        </div>
      </div>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      style={{
        marginTop: "1rem",
        width: "100%",
        padding: "1rem",
        borderRadius: "0.75rem",
        backgroundColor: "var(--primary)",
        color: "#060d17",
        border: "none",
        fontWeight: 800,
        fontSize: "1rem",
        cursor: pending ? "not-allowed" : "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.5rem",
        transition: "all 0.2s ease",
        boxShadow: "0 10px 20px -5px var(--primary-glow)",
      }}
    >
      {pending ? (
        <Loader2 size={20} className="animate-spin" />
      ) : (
        <>
          Buat Akun Admin <ChevronRight size={18} />
        </>
      )}
    </button>
  );
}
