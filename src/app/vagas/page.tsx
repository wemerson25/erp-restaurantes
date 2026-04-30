import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { VagasContent } from "./vagas-content";

export default async function VagasPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return (
    <div className="flex h-full min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col lg:ml-60">
        <Header title="Recrutamento & Seleção" subtitle="Gestão de vagas e candidaturas" user={session} />
        <main className="flex-1 p-3 sm:p-6"><VagasContent /></main>
      </div>
    </div>
  );
}
