import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { ConfiguracoesContent } from "./configuracoes-content";

export default async function ConfiguracoesPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return (
    <div className="flex h-full min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col lg:ml-60">
        <Header title="Configurações" subtitle="Gestores e preferências do sistema" user={session} />
        <main className="flex-1 p-3 sm:p-6"><ConfiguracoesContent /></main>
      </div>
    </div>
  );
}
