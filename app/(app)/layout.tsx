import { BottomNav } from "@/components/mboacoin/bottom-nav";
import { PendingLeaseBanner } from "@/components/mboacoin/pending-lease-banner";
import { PendingDeletionBanner } from "@/components/mboacoin/pending-deletion-banner";
import { ServiceWorkerRegistrar } from "@/components/mboacoin/service-worker-registrar";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let pendingLeaseCount = 0;
  let deletionScheduledFor: string | null = null;
  if (user) {
    // Rattache par téléphone les baux créés depuis la dernière visite. La
    // session persiste sans nouvel OTP, donc l'appel fait une seule fois à
    // la vérification du code (app/(auth)/verify/page.tsx) ne suffit pas :
    // un bail créé après la dernière connexion OTP restait orphelin. On le
    // rejoue ici à chaque chargement du layout authentifié (opération
    // idempotente, sans effet si rien de nouveau à rattacher).
    const { error: linkError } = await supabase.rpc("link_my_pending_leases");
    if (linkError) {
      // Ne doit normalement jamais arriver (cf. 20260715130000) : loggé pour
      // ne plus jamais échouer silencieusement comme la première fois.
      console.error("link_my_pending_leases a échoué", { userId: user.id, error: linkError.message });
    }

    const { count } = await supabase
      .from("leases")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", user.id)
      .eq("status", "en_attente_confirmation");
    pendingLeaseCount = count ?? 0;

    const { data: deletionRequest } = await supabase
      .from("account_deletion_requests")
      .select("scheduled_for")
      .eq("user_id", user.id)
      .eq("status", "en_attente")
      .maybeSingle();
    deletionScheduledFor = deletionRequest?.scheduled_for ?? null;
  }

  return (
    <div className="app-ambient flex min-h-dvh w-full flex-col items-center justify-center lg:py-8">
      <div className="relative flex h-dvh w-full flex-col overflow-hidden bg-card lg:h-[860px] lg:w-[392px] lg:rounded-[2.6rem] lg:border lg:border-border lg:shadow-soft lg:ring-1 lg:ring-black/5">
        <ServiceWorkerRegistrar />
        <PendingLeaseBanner count={pendingLeaseCount} />
        <PendingDeletionBanner scheduledFor={deletionScheduledFor} />
        <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto">{children}</div>
        <BottomNav isAuthenticated={Boolean(user)} />
      </div>
    </div>
  );
}