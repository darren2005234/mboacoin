// Chantier NOTIFICATIONS-3 — rappels d'échéance et alertes de retard de loyer.
//
// Déclenchée quotidiennement par un Cron Job Supabase (Dashboard → Database →
// Cron Jobs, configuré manuellement, pas en SQL versionné — même principe que
// le Database Webhook du chantier push). Parcourt tous les baux actifs,
// détecte les échéances à J-3 et les retards, et crée des notifications via
// la même fonction SECURITY DEFINER notifications_create() que tous les
// triggers existants — ce qui déclenche automatiquement le push existant
// (Database Webhook → push-send) sans aucun branchement supplémentaire.
//
// Réutilise lib/lease-schedule.ts (fonctions pures, sans dépendance Supabase)
// au lieu de dupliquer la logique d'échéance : Deno exécute du TypeScript
// nativement, l'import relatif suffit, aucune conversion nécessaire.
//
// Ne bloque jamais une requête utilisateur (exécution 100% hors-bande). Une
// erreur sur un bail est loggée et n'interrompt pas le traitement des autres.

import { createClient } from "npm:@supabase/supabase-js@2";
import { generateDueDates, dueDateForPeriod, daysUntil } from "../../../lib/lease-schedule.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("RENT_REMINDERS_SECRET")!;

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function formatMonthLabel(period: string): string {
  const year = Number(period.slice(0, 4));
  const month = Number(period.slice(5, 7)) - 1;
  return new Date(year, month, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

function formatDateLabel(dateIso: string): string {
  const year = Number(dateIso.slice(0, 4));
  const month = Number(dateIso.slice(5, 7)) - 1;
  const day = Number(dateIso.slice(8, 10));
  return new Date(year, month, day).toLocaleDateString("fr-FR");
}

interface LeaseRow {
  id: string;
  listing_id: string;
  landlord_id: string;
  tenant_id: string | null;
  start_date: string;
  end_date: string | null;
  payment_day: number | null;
  payment_period: string;
  tenant: { full_name: string | null } | { full_name: string | null }[] | null;
  listing: { title: string | null } | { title: string | null }[] | null;
}

interface ReminderRow {
  lease_id: string;
  period: string;
  due_soon_sent_at: string | null;
  late_last_notified_at: string | null;
}

Deno.serve(async (req) => {
  // La fonction est une URL HTTPS publique par défaut : un secret partagé
  // (configuré à la fois dans le Cron Job et ici) garantit que seul le job
  // planifié peut la déclencher.
  if (req.headers.get("authorization") !== `Bearer ${CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: leaseRows, error: leasesError } = await supabase
    .from("leases")
    .select(
      "id, listing_id, landlord_id, tenant_id, start_date, end_date, payment_day, payment_period, tenant:profiles!tenant_id(full_name), listing:listings(title)"
    )
    .eq("status", "actif");

  if (leasesError || !leaseRows) {
    console.error("rent-reminders: échec de lecture des baux", leasesError);
    return new Response("error", { status: 200 });
  }

  const leaseIds = leaseRows.map((l) => l.id);
  if (leaseIds.length === 0) return new Response("ok", { status: 200 });

  const [{ data: paymentRows }, { data: reminderRows }] = await Promise.all([
    supabase.from("lease_payments").select("lease_id, period").in("lease_id", leaseIds),
    supabase
      .from("lease_payment_reminders")
      .select("lease_id, period, due_soon_sent_at, late_last_notified_at")
      .in("lease_id", leaseIds),
  ]);

  const paidSet = new Set((paymentRows ?? []).map((p) => `${p.lease_id}:${p.period}`));
  const reminderMap = new Map(
    ((reminderRows ?? []) as ReminderRow[]).map((r) => [`${r.lease_id}:${r.period}`, r])
  );

  const today = new Date();

  for (const lease of leaseRows as LeaseRow[]) {
    try {
      if (!lease.tenant_id) continue;

      const until =
        lease.end_date && new Date(lease.end_date) < today ? new Date(lease.end_date) : today;
      const periods = generateDueDates(lease.start_date, lease.payment_period, until);
      if (periods.length === 0) continue; // bail journalier : pas d'échéance fixe

      const tenant = one(lease.tenant);
      const listing = one(lease.listing);

      for (const period of periods) {
        if (paidSet.has(`${lease.id}:${period}`)) continue;

        const dueDate = dueDateForPeriod(period, lease.payment_day, lease.start_date);
        const delta = daysUntil(dueDate);
        const reminder = reminderMap.get(`${lease.id}:${period}`);
        const monthLabel = formatMonthLabel(period);

        if (delta === 3 && !reminder?.due_soon_sent_at) {
          await supabase.rpc("notifications_create", {
            p_user_id: lease.tenant_id,
            p_actor_id: null,
            p_type: "lease_payment_due_soon",
            p_title: `Votre loyer de ${monthLabel} est dû le ${formatDateLabel(dueDate)}`,
            p_link: `/my-lease/${lease.id}`,
            p_lease_id: lease.id,
            p_listing_id: lease.listing_id,
          });
          await supabase
            .from("lease_payment_reminders")
            .upsert(
              { lease_id: lease.id, period, due_soon_sent_at: new Date().toISOString() },
              { onConflict: "lease_id,period" }
            );
          continue;
        }

        if (delta < 0) {
          const lastNotified = reminder?.late_last_notified_at
            ? new Date(reminder.late_last_notified_at).getTime()
            : null;
          const shouldNotify = lastNotified === null || Date.now() - lastNotified >= WEEK_MS;
          if (!shouldNotify) continue;

          await supabase.rpc("notifications_create", {
            p_user_id: lease.tenant_id,
            p_actor_id: null,
            p_type: "lease_payment_late",
            p_title: `Votre loyer de ${monthLabel} est en retard`,
            p_link: `/my-lease/${lease.id}`,
            p_lease_id: lease.id,
            p_listing_id: lease.listing_id,
          });
          await supabase.rpc("notifications_create", {
            p_user_id: lease.landlord_id,
            p_actor_id: null,
            p_type: "lease_payment_late",
            p_title: `Le loyer de ${tenant?.full_name ?? "votre locataire"} pour ${listing?.title ?? "votre logement"} est en retard`,
            p_link: `/my-leases/${lease.id}`,
            p_lease_id: lease.id,
            p_listing_id: lease.listing_id,
          });
          await supabase
            .from("lease_payment_reminders")
            .upsert(
              { lease_id: lease.id, period, late_last_notified_at: new Date().toISOString() },
              { onConflict: "lease_id,period" }
            );
        }
      }
    } catch (error) {
      console.error("rent-reminders: échec pour le bail", lease.id, error);
    }
  }

  return new Response("ok", { status: 200 });
});
