import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { FuncionarioDetalhe } from "./funcionario-detalhe";

export default async function FuncionarioPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;
  return (
    <div className="flex h-full min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col lg:ml-60">
        <Header title="Perfil do Funcionário" subtitle="Informações completas" user={session} />
        <main className="flex-1 p-3 sm:p-6 pb-24 lg:pb-6">
          <FuncionarioDetalhe id={id} />
        </main>
      </div>
    </div>
  );
}
