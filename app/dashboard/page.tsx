import { createClient } from "@/lib/supabase/server";
import PhotographerDashboard from "@/components/dashboards/photographer";
import AgentDashboard from "@/components/dashboards/agent";
import ChooseRole from "@/app/(authenticated)/onboarding/role";

export default async function Dashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile?.role) return <ChooseRole />;

  if (profile.role === "photographer") return <PhotographerDashboard />;
  if (profile.role === "agent") return <AgentDashboard />;

  return <ChooseRole />;
}
