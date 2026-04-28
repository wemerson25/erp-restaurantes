import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { FuncionariosContent } from "./funcionarios-content";

export default async function FuncionariosPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return (
    <div className="flex h-full min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col lg:ml-60">
        <Header title="Funcionários" subtitle="Gestão de colaboradores" user={session} />
        <main className="flex-1 p-3 sm:p-6">
          <FuncionariosContent />
        </main>
      </div>
    </div>
  );
}
