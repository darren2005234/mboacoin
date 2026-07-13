// Chantier NOTIFICATIONS-2 — envoi des notifications push web.
//
// Déclenchée par un Database Webhook Supabase (Dashboard → Database → Webhooks,
// configuré manuellement, pas en SQL versionné) sur AFTER INSERT public.notifications.
// Reçoit { record: <ligne notifications insérée> } et envoie un push à chaque
// abonnement de l'utilisateur destinataire, uniquement pour les types "poussables".
//
// Ne bloque jamais l'action d'origine : elle tourne après le COMMIT de la
// transaction qui a créé la notification, complètement hors du chemin utilisateur.

import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT")!;
const WEBHOOK_SECRET = Deno.env.get("PUSH_WEBHOOK_SECRET")!;

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

// Types de notifications qui déclenchent un push. Cohérent avec les valeurs de
// `notifications.type` listées dans supabase/migrations/20260712180000_notifications.sql,
// plus lease_payment_due_soon/lease_payment_late créés par la tâche planifiée
// supabase/functions/rent-reminders (chantier NOTIFICATIONS-3), plus les
// visit_* créés par supabase/migrations/20260713100000_visits.sql (chantier
// TRANS-1a).
// Volontairement absents (changement mineur / confirmation de sa propre action /
// purement informatif) : lease_resiliated, lease_ended, lease_amendment_accepted,
// lease_amendment_refused, lease_payment_declared, lease_document_added,
// lease_request_updated, lease_request_reopened, listing_suspended.
// Ajuster cette liste = modifier ce fichier et redéployer, rien d'autre à toucher.
const PUSHABLE_TYPES = new Set([
  "message_received",
  "lease_created",
  "lease_amendment_proposed",
  "lease_confirmed",
  "lease_rejected",
  "lease_request_created",
  "lease_request_message",
  "verification_approved",
  "verification_rejected",
  "listing_verification_approved",
  "listing_verification_rejected",
  "lease_payment_due_soon",
  "lease_payment_late",
  "visit_requested",
  "visit_slot_proposed",
  "visit_confirmed",
  "visit_refused",
  "visit_cancelled",
  "visit_completed",
  "visit_expired",
  "visit_reminder",
]);

interface NotificationRecord {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
}

Deno.serve(async (req) => {
  // La fonction est une URL HTTPS publique par défaut : un secret partagé
  // (configuré à la fois dans le Database Webhook et ici) garantit que seul
  // Supabase peut la déclencher, pas un tiers cherchant à spammer des push.
  if (req.headers.get("authorization") !== `Bearer ${WEBHOOK_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const payload = await req.json().catch(() => null);
  const record = payload?.record as NotificationRecord | undefined;

  if (!record || !PUSHABLE_TYPES.has(record.type)) {
    return new Response("ignored", { status: 200 });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: subscriptions } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", record.user_id);

  await Promise.all(
    (subscriptions ?? []).map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify({
            title: record.title,
            body: record.body,
            link: record.link,
          })
        );
      } catch (error) {
        // 404/410 = endpoint périmé (RFC Web Push) : on nettoie l'abonnement.
        // Toute autre erreur est loggée mais n'interrompt pas les autres envois.
        const statusCode = (error as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await supabase.from("push_subscriptions").delete().eq("id", sub.id);
        } else {
          console.error("push-send: échec d'envoi", sub.id, error);
        }
      }
    })
  );

  return new Response("ok", { status: 200 });
});
