import { requireAccountType } from "@/lib/profile";
import { PerformanceDashboard } from "@/components/mboacoin/performance-dashboard";

export default async function AnalyticsPage() {
  const profile = await requireAccountType(["agence", "residence"], "/profile", "/analytics");
  return <PerformanceDashboard accountType={profile.accountType} />;
}
