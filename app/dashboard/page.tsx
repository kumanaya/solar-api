import { createClient } from "@/lib/supabase/server";
import { DashboardAnalysesWrapper } from "@/components/dashboard/dashboard-analyses-wrapper";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm md:text-base">
          Bem-vindo de volta, {user.user?.email?.split('@')[0]}!
        </p>
      </div>

      {/* Lista de análises salvas */}
      <DashboardAnalysesWrapper />
    </div>
  );
}