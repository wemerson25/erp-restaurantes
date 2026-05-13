import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { EscalaContent } from "./escala-content";

export default async function EscalaPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return (
    <div className="flex h-full min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col lg:ml-60">
        <Header
          title="Escala Semanal"
          subtitle="Planejamento de turnos e setores por restaurante"
          user={session}
        />
        <main className="flex-1 p-3 sm:p-6">
          <EscalaContent />
        </main>
      </div>
    </div>
  );
}
