export const dynamic = "force-dynamic";

import { getSession } from "@/lib/auth";
import { ensureComprasTables } from "@/lib/compras-setup";
import { redirect } from "next/navigation";
import { SidebarCompras } from "@/components/layout/sidebar-compras";

export default async function ComprasLayout({ children }: { children: React.ReactNode }) {
  await ensureComprasTables();
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="flex h-full min-h-screen">
      <SidebarCompras />
      <div className="flex-1 flex flex-col lg:ml-60">
        {children}
      </div>
    </div>
  );
}
