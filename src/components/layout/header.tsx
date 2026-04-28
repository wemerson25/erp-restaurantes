"use client";
import { Bell, User } from "lucide-react";

interface HeaderProps {
  title: string;
  subtitle?: string;
  user?: { name: string; role: string } | null;
}

export function Header({ title, subtitle, user }: HeaderProps) {
  return (
    <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4 pl-16 lg:pl-6 flex items-center justify-between">
      <div className="min-w-0">
        <h1 className="text-lg sm:text-xl font-bold text-gray-900 truncate">{title}</h1>
        {subtitle && <p className="text-xs sm:text-sm text-gray-500 mt-0.5 hidden sm:block">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
          <Bell size={18} />
          <span className="absolute top-1 right-1 w-2 h-2 bg-orange-500 rounded-full" />
        </button>
        <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-200">
          <div className="w-7 h-7 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
            <User size={14} className="text-orange-600" />
          </div>
          <div className="text-xs hidden sm:block">
            <p className="font-semibold text-gray-800 leading-tight">{user?.name ?? "Usuário"}</p>
            <p className="text-gray-500">{user?.role ?? "RH"}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
