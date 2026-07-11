import { requireAccountType } from "@/lib/profile";
import { PerformanceDashboard } from "@/components/mboacoin/performance-dashboard";

export default async function AnalyticsPage() {
  const profile = await requireAccountType(["agence", "residence"]);
  return <PerformanceDashboard accountType={profile.accountType} />;
}
