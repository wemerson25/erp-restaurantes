export const dynamic = "force-dynamic";

import { getSession } from "@/lib/auth";
import { ensureComprasTables } from "@/lib/compras-setup";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Users, ShoppingCart, ArrowRight } from "lucide-react";

export default async function Home() {
  await ensureComprasTables();
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)" }}
    >
      {/* Logo */}
      <div className="mb-3">
        <Image
          src="/logo-ykedin-transparent.png"
          alt="Grupo Ykedin"
          width={260}
          height={94}
          className="object-contain"
          style={{ filter: "brightness(0) invert(1)" }}
          priority
        />
      </div>

      <p className="text-slate-400 text-sm mb-12">
        Olá, <span className="text-white font-semibold">{session.name}</span> — escolha um sistema para continuar
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-2xl">
        {/* RH & Gestão */}
        <Link
          href="/dashboard"
          className="group relative overflow-hidden rounded-2xl border border-white/10 p-8 flex flex-col items-center text-center hover:border-red-500/40 transition-all duration-300 hover:scale-[1.02]"
          style={{ background: "linear-gradient(135deg, rgba(185,28,28,0.25) 0%, rgba(127,29,29,0.15) 100%)" }}
        >
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-lg"
            style={{ background: "linear-gradient(135deg, #dc2626, #991b1b)" }}
          >
            <Users size={32} className="text-white" />
          </div>
          <h2 className="text-white text-xl font-bold mb-2">RH &amp; Gestão</h2>
          <p className="text-slate-400 text-sm leading-relaxed">
            Funcionários, ponto, folha de pagamento, férias, escalas e muito mais.
          </p>
          <div className="flex items-center gap-1 mt-6 text-red-400 text-sm font-medium group-hover:gap-2 transition-all">
            Acessar <ArrowRight size={16} />
          </div>
        </Link>

        {/* Compras & Estoque */}
        <Link
          href="/compras"
          className="group relative overflow-hidden rounded-2xl border border-white/10 p-8 flex flex-col items-center text-center hover:border-blue-500/40 transition-all duration-300 hover:scale-[1.02]"
          style={{ background: "linear-gradient(135deg, rgba(29,78,216,0.25) 0%, rgba(30,58,138,0.15) 100%)" }}
        >
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-lg"
            style={{ background: "linear-gradient(135deg, #2563eb, #1d4ed8)" }}
          >
            <ShoppingCart size={32} className="text-white" />
          </div>
          <h2 className="text-white text-xl font-bold mb-2">Compras &amp; Estoque</h2>
          <p className="text-slate-400 text-sm leading-relaxed">
            Requisições de compra, serviços e reparos, e controle de estoque.
          </p>
          <div className="flex items-center gap-1 mt-6 text-blue-400 text-sm font-medium group-hover:gap-2 transition-all">
            Acessar <ArrowRight size={16} />
          </div>
        </Link>
      </div>

      <p className="mt-12 text-slate-600 text-xs">Grupo Ykedin © {new Date().getFullYear()}</p>
    </div>
  );
}
