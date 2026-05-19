"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ShoppingCart, Wrench, Package, LogOut, Menu, X, ArrowLeftRight } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { useState } from "react";

const navItems = [
  { href: "/compras",             label: "Dashboard",          icon: LayoutDashboard, exact: true },
  { href: "/compras/requisicoes", label: "Requisições de Compra", icon: ShoppingCart },
  { href: "/compras/servicos",    label: "Serviços & Reparos",  icon: Wrench },
  { href: "/compras/estoque",     label: "Controle de Estoque", icon: Package },
];

export function SidebarCompras() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
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
        <p className="text-blue-200 text-xs mt-2 text-center font-medium tracking-wide">
          COMPRAS & ESTOQUE
        </p>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-all",
                active
                  ? "bg-white text-blue-700 shadow-sm font-semibold"
                  : "text-white/80 hover:bg-white/10 hover:text-white"
              )}
            >
              <Icon size={18} className={active ? "text-blue-600" : ""} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-white/10 space-y-1">
        <Link
          href="/"
          className="flex items-center gap-3 w-full px-3 py-3 rounded-lg text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white transition-all"
        >
          <ArrowLeftRight size={18} />
          Trocar Sistema
        </Link>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-3 rounded-lg text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white transition-all"
        >
          <LogOut size={18} />
          Sair do Sistema
        </button>
        <p className="text-xs text-white/30 text-center pt-2">Grupo Ykedin © {new Date().getFullYear()}</p>
      </div>
    </div>
  );

  return (
    <>
      <button
        className="fixed top-3 left-3 z-50 lg:hidden text-white p-2.5 rounded-xl shadow-lg bg-blue-700"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label="Menu"
      >
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div
            className="absolute left-0 top-0 bottom-0 w-72"
            style={{ background: "linear-gradient(to bottom, #1e40af, #1e3a8a, #0f172a)" }}
          >
            <SidebarContent />
          </div>
        </div>
      )}

      <aside
        className="hidden lg:flex lg:flex-col lg:w-60 min-h-screen fixed left-0 top-0 bottom-0 z-30"
        style={{ background: "linear-gradient(to bottom, #1e40af 0%, #1e3a8a 40%, #0f172a 100%)" }}
      >
        <SidebarContent />
      </aside>
    </>
  );
}
