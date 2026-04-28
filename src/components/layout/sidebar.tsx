"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, Building2, Clock, Umbrella,
  DollarSign, Briefcase, ChefHat, LogOut, Menu, X, FileX
} from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { useState } from "react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/funcionarios", label: "Funcionários", icon: Users },
  { href: "/restaurantes", label: "Restaurantes", icon: Building2 },
  { href: "/ponto", label: "Controle de Ponto", icon: Clock },
  { href: "/ferias", label: "Férias", icon: Umbrella },
  { href: "/ausencias", label: "Atestados & Faltas", icon: FileX },
  { href: "/folha", label: "Folha de Pagamento", icon: DollarSign },
  { href: "/vagas", label: "Recrutamento", icon: Briefcase },
  { href: "/cargos", label: "Cargos", icon: ChefHat },
];

export function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="flex flex-col items-center px-5 py-5 border-b border-orange-700">
        <div className="bg-white rounded-xl px-3 py-2 w-full flex items-center justify-center">
          <Image
            src="/logo-ykedin.png"
            alt="Grupo Ykedin"
            width={150}
            height={55}
            className="object-contain"
            priority
          />
        </div>
        <p className="text-orange-200 text-xs mt-2">RH & Gestão</p>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                active
                  ? "bg-white/20 text-white"
                  : "text-orange-100 hover:bg-white/10 hover:text-white"
              )}
            >
              <Icon size={18} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-orange-700">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-orange-100 hover:bg-white/10 hover:text-white transition-all"
        >
          <LogOut size={18} />
          Sair
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile toggle */}
      <button
        className="fixed top-4 left-4 z-50 lg:hidden bg-orange-600 text-white p-2 rounded-lg shadow-lg"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-64 bg-gradient-to-b from-orange-600 to-orange-700">
            <SidebarContent />
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-60 bg-gradient-to-b from-orange-600 to-orange-700 min-h-screen fixed left-0 top-0 bottom-0 z-30">
        <SidebarContent />
      </aside>
    </>
  );
}
