import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { CandidaturasContent } from "./candidaturas-content";

export default async function CandidaturasPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;
  return (
    <div className="flex h-full min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col lg:ml-60">
        <Header title="Candidaturas" subtitle="Candidatos por vaga" user={session} />
        <main className="flex-1 p-3 sm:p-6">
          <CandidaturasContent vagaId={id} />
        </main>
      </div>
    </div>
  );
}
