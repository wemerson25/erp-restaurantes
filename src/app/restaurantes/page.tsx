import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { RestaurantesContent } from "./restaurantes-content";

export default async function RestaurantesPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return (
    <div className="flex h-full min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col lg:ml-60">
        <Header title="Restaurantes" subtitle="Unidades do grupo" user={session} />
        <main className="flex-1 p-6"><RestaurantesContent /></main>
      </div>
    </div>
  );
}
