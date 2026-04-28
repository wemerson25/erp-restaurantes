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
    <div className="min-h-screen flex">
      {/* Painel esquerdo — marca */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center p-12 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, var(--brand-red) 0%, var(--brand-red-dark) 50%, var(--brand-black) 100%)" }}
      >
        {/* Círculos decorativos */}
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-10" style={{ background: "radial-gradient(circle, white, transparent)", transform: "translate(30%, -30%)" }} />
        <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full opacity-10" style={{ background: "radial-gradient(circle, white, transparent)", transform: "translate(-30%, 30%)" }} />

        <div className="relative z-10 text-center">
          <div className="mb-8 inline-block">
            <Image
              src="/logo-ykedin.png"
              alt="Grupo Ykedin"
              width={240}
              height={88}
              className="object-contain"
              style={{ mixBlendMode: "multiply", filter: "brightness(0) invert(1)" }}
              priority
            />
          </div>
          <h2 className="text-white text-3xl font-bold mb-3">Grupo Ykedin</h2>
          <p className="text-red-200 text-lg">Sistema de RH & Gestão</p>
          <div className="mt-10 flex flex-col gap-3 text-left">
            {["Gestão de Funcionários", "Controle de Férias", "Folha de Pagamento", "Atestados & Faltas"].map(item => (
              <div key={item} className="flex items-center gap-3 text-white/80 text-sm">
                <div className="w-1.5 h-1.5 bg-red-300 rounded-full flex-shrink-0" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Painel direito — formulário */}
      <div className="flex-1 flex items-center justify-center p-6 bg-gray-50">
        <div className="w-full max-w-md">
          {/* Logo mobile */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-block bg-white rounded-2xl p-4 shadow-lg border border-gray-100">
              <Image src="/logo-ykedin.png" alt="Grupo Ykedin" width={180} height={65} className="object-contain" priority />
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
            {/* Faixa vermelha no topo */}
            <div className="h-1.5 w-full" style={{ background: "linear-gradient(to right, var(--brand-red), var(--brand-black))" }} />

            <div className="px-8 py-8">
              <h1 className="text-2xl font-bold text-gray-900 mb-1">Bem-vindo!</h1>
              <p className="text-gray-400 text-sm mb-7">Entre com suas credenciais de acesso</p>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">E-mail</label>
                  <Input
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Senha</label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                    {error}
                  </div>
                )}

                <Button type="submit" className="w-full h-11 text-base" disabled={loading}>
                  {loading ? <><Loader2 size={16} className="animate-spin" /> Entrando...</> : "Entrar no Sistema"}
                </Button>
              </form>

              <p className="mt-6 text-center text-xs text-gray-400">
                Problemas de acesso? Contate o administrador.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
