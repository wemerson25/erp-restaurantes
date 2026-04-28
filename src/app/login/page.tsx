"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Erro ao fazer login");
        return;
      }
      router.push("/dashboard");
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden"
      style={{ background: "linear-gradient(135deg, var(--brand-red-light) 0%, var(--brand-red) 40%, var(--brand-red-dark) 70%, var(--brand-black) 100%)" }}
    >
      {/* Círculos decorativos de fundo */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(255,255,255,0.07), transparent 70%)", transform: "translate(20%, -20%)" }} />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(255,255,255,0.05), transparent 70%)", transform: "translate(-20%, 20%)" }} />

      {/* Logo */}
      <div className="relative z-10 mb-8">
        <Image
          src="/logo-ykedin-transparent.png"
          alt="Grupo Ykedin"
          width={320}
          height={116}
          className="object-contain"
          style={{ filter: "brightness(0) invert(1)" }}
          priority
        />
      </div>

      {/* Card do formulário */}
      <div className="relative z-10 w-full max-w-sm">
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 overflow-hidden">
          <div className="px-8 py-8">
            <h1 className="text-2xl font-bold text-white mb-1">Bem-vindo!</h1>
            <p className="text-red-200 text-sm mb-7">Entre com suas credenciais de acesso</p>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-white/90 mb-1.5">E-mail</label>
                <input
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="flex h-10 w-full rounded-lg border border-white/30 bg-white/10 px-3 py-1 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-transparent transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/90 mb-1.5">Senha</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="flex h-10 w-full rounded-lg border border-white/30 bg-white/10 px-3 py-1 pr-10 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-transparent transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="bg-black/30 border border-red-300/30 rounded-lg px-4 py-3 text-sm text-red-200">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 rounded-lg bg-white text-red-700 font-bold text-sm hover:bg-red-50 transition-colors disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
              >
                {loading ? <><Loader2 size={16} className="animate-spin" /> Entrando...</> : "Entrar no Sistema"}
              </button>
            </form>

            <p className="mt-6 text-center text-xs text-white/40">
              Problemas de acesso? Contate o administrador.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
