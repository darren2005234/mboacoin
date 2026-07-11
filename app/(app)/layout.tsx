import { BottomNav } from "@/components/mboacoin/bottom-nav";
import { PendingLeaseBanner } from "@/components/mboacoin/pending-lease-banner";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let pendingLeaseCount = 0;
  if (user) {
    const { count } = await supabase
      .from("leases")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", user.id)
      .eq("status", "en_attente_confirmation");
    pendingLeaseCount = count ?? 0;
  }

  return (
    <div className="app-ambient flex min-h-dvh w-full flex-col items-center justify-center lg:py-8">
      <div className="relative flex h-dvh w-full flex-col overflow-hidden bg-card lg:h-[860px] lg:w-[392px] lg:rounded-[2.6rem] lg:border lg:border-border lg:shadow-soft lg:ring-1 lg:ring-black/5">
        <PendingLeaseBanner count={pendingLeaseCount} />
        <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto">{children}</div>
        <BottomNav isAuthenticated={Boolean(user)} />
      </div>
    </div>
  );
}