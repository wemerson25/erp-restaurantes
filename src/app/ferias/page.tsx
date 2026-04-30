import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { FeriasContent } from "./ferias-content";

export default async function FeriasPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return (
    <div className="flex h-full min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col lg:ml-60">
        <Header title="Férias" subtitle="Agendamento e controle de férias" user={session} />
        <main className="flex-1 p-3 sm:p-6 pb-24 lg:pb-6"><FeriasContent /></main>
      </div>
    </div>
  );
}
