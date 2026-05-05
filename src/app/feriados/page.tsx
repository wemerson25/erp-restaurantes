import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { FeriadosContent } from "./feriados-content";

export default async function FeriadosPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return (
    <div className="flex h-full min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col lg:ml-60">
        <Header title="Feriados & Datas Importantes" subtitle="Calendário de feriados e datas especiais" user={session} />
        <main className="flex-1 p-3 sm:p-6">
          <FeriadosContent />
        </main>
      </div>
    </div>
  );
}
