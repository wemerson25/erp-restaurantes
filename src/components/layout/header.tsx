"use client";
import { Bell, User } from "lucide-react";
import Image from "next/image";

interface HeaderProps {
  title: string;
  subtitle?: string;
  user?: { name: string; role: string } | null;
}

export function Header({ title, subtitle, user }: HeaderProps) {
  return (
    <header className="bg-white border-b-2 border-red-600 px-4 sm:px-6 py-3 pl-16 lg:pl-6 flex items-center justify-between shadow-sm">
      <div className="flex items-center gap-3 min-w-0">
        {/* Logo mark — só no desktop, integra a marca no header */}
        <div className="hidden lg:flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0" style={{ backgroundColor: "var(--brand-red)" }}>
          <Image src="/logo-ykedin.png" alt="" width={24} height={24} className="object-contain brightness-0 invert" />
        </div>
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-bold text-gray-900 truncate">{title}</h1>
          {subtitle && <p className="text-xs text-gray-400 mt-0.5 hidden sm:block">{subtitle}</p>}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <button className="relative p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
          <Bell size={18} />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full" />
        </button>
        <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-200">
          <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "var(--brand-red)" }}>
            <User size={14} className="text-white" />
          </div>
          <div className="text-xs hidden sm:block">
            <p className="font-semibold text-gray-800 leading-tight">{user?.name ?? "Usuário"}</p>
            <p className="text-gray-400">{user?.role ?? "RH"}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
