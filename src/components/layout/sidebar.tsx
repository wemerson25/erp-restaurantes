"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, Building2, Clock, Umbrella,
  DollarSign, Briefcase, ChefHat, LogOut, Menu, X, FileX, MoreHorizontal
} from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { useState } from "react";

const navItems = [
  { href: "/dashboard",    label: "Dashboard",          icon: LayoutDashboard },
  { href: "/funcionarios", label: "Funcionários",        icon: Users },
  { href: "/restaurantes", label: "Restaurantes",        icon: Building2 },
  { href: "/ponto",        label: "Controle de Ponto",   icon: Clock },
  { href: "/ferias",       label: "Férias",              icon: Umbrella },
  { href: "/ausencias",    label: "Atestados & Faltas",  icon: FileX },
  { href: "/folha",        label: "Folha de Pagamento",  icon: DollarSign },
  { href: "/vagas",        label: "Recrutamento",        icon: Briefcase },
  { href: "/cargos",       label: "Cargos",              icon: ChefHat },
];

// Items shown in the bottom nav bar on mobile
const bottomNavItems = [
  { href: "/dashboard",    label: "Dashboard", icon: LayoutDashboard },
  { href: "/funcionarios", label: "Equipe",    icon: Users },
  { href: "/ponto",        label: "Ponto",     icon: Clock },
  { href: "/folha",        label: "Folha",     icon: DollarSign },
  { href: "/ausencias",    label: "Faltas",    icon: FileX },
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
      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/10 flex flex-col items-center">
        <Image
          src="/logo-ykedin-transparent.png"
          alt="Grupo Ykedin"
          width={148}
          height={52}
          className="object-contain"
          style={{ filter: "brightness(0) invert(1)" }}
          priority
        />
        <p className="text-red-200 text-xs mt-2 text-center font-medium tracking-wide">
          RH & GESTÃO
        </p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-all",
                active
                  ? "bg-white text-red-700 shadow-sm font-semibold"
                  : "text-white/80 hover:bg-white/10 hover:text-white"
              )}
            >
              <Icon size={18} className={active ? "text-red-600" : ""} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-white/10">
        <div className="px-3 py-2 mb-2">
          <p className="text-xs text-white/40 text-center">Grupo Ykedin © {new Date().getFullYear()}</p>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-3 rounded-lg text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white transition-all"
        >
          <LogOut size={18} />
          Sair do Sistema
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile hamburger — only shows if bottom nav "Mais" isn't covering it */}
      <button
        className="fixed top-3 left-3 z-50 lg:hidden text-white p-2.5 rounded-xl shadow-lg"
        style={{ backgroundColor: "var(--brand-red)" }}
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label="Menu"
      >
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Mobile overlay sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-72" style={{ background: "linear-gradient(to bottom, var(--brand-red), var(--brand-black))" }}>
            <SidebarContent />
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside
        className="hidden lg:flex lg:flex-col lg:w-60 min-h-screen fixed left-0 top-0 bottom-0 z-30"
        style={{ background: "linear-gradient(to bottom, var(--brand-red) 0%, var(--brand-red-dark) 40%, var(--brand-black) 100%)" }}
      >
        <SidebarContent />
      </aside>

      {/* Mobile bottom navigation bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-white border-t border-gray-200 flex safe-area-pb">
        {bottomNavItems.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 transition-colors",
                active ? "text-red-600" : "text-gray-400 hover:text-gray-600"
              )}
            >
              <Icon size={22} />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          );
        })}
        <button
          onClick={() => setMobileOpen(true)}
          className="flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <MoreHorizontal size={22} />
          <span className="text-[10px] font-medium">Mais</span>
        </button>
      </nav>
    </>
  );
}
