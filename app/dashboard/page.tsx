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

  // Fallback for old users with no stored role:
  if (!profile?.role) {
    return <ChooseRole />;
  }

  if (profile.role === "photographer") {
    return <PhotographerDashboard />;
  }

  // Default: treat everything else as agent/broker/owner style
  return <AgentDashboard />;
}
