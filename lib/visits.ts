import { createClient } from "@/lib/supabase/client";

export interface VisitSlot {
  id: string;
  proposedBy: string;
  slotAt: string;
}

export interface Visit {
  id: string;
  listingId: string;
  listingTitle: string;
  listingImage: string;
  listingLocation: string;
  tenantId: string;
  landlordId: string;
  conversationId: string | null;
  feeAmount: number;
  codeAttempts: number;
  status: string;
  scheduledAt: string | null;
  noShow: boolean;
  createdAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
  role: "locataire" | "bailleur";
  other: {
    name: string | null;
    avatarUrl: string | null;
    verified: boolean;
  };
  slots: VisitSlot[];
}

const VISIT_SELECT =
  // confirmation_code est volontairement absent : REVOKE SELECT côté base,
  // seul get_visit_code() peut le lire.
  "id, listing_id, tenant_id, landlord_id, conversation_id, fee_amount, code_attempts, status, scheduled_at, no_show, created_at, completed_at, cancelled_at, listing:listings(title, image_url, city, neighborhood), tenant:profiles!tenant_id(full_name, avatar_url, verification), landlord:profiles!landlord_id(full_name, avatar_url, verification), visit_slots(id, proposed_by, slot_at)";

interface VisitRow {
  id: string;
  listing_id: string;
  tenant_id: string;
  landlord_id: string;
  conversation_id: string | null;
  fee_amount: number;
  code_attempts: number;
  status: string;
  scheduled_at: string | null;
  no_show: boolean;
  created_at: string;
  completed_at: string | null;
  cancelled_at: string | null;
  listing: unknown;
  tenant: unknown;
  landlord: unknown;
  visit_slots: { id: string; proposed_by: string; slot_at: string }[] | null;
}

function mapVisitRow(row: VisitRow, userId: string): Visit {
  type ListingJoin = { title: string; image_url: string | null; city: string; neighborhood: string | null };
  type PartyJoin = { full_name: string | null; avatar_url: string | null; verification: string };

  const listing = (Array.isArray(row.listing) ? row.listing[0] : row.listing) as ListingJoin | null;
  const tenant = (Array.isArray(row.tenant) ? row.tenant[0] : row.tenant) as PartyJoin | null;
  const landlord = (Array.isArray(row.landlord) ? row.landlord[0] : row.landlord) as PartyJoin | null;

  const isTenant = row.tenant_id === userId;
  const other = isTenant ? landlord : tenant;

  return {
    id: row.id,
    listingId: row.listing_id,
    listingTitle: listing?.title ?? "Logement",
    listingImage: listing?.image_url ?? "/img/listings/demo-1.jpg",
    listingLocation: [listing?.neighborhood, listing?.city].filter(Boolean).join(", "),
    tenantId: row.tenant_id,
    landlordId: row.landlord_id,
    conversationId: row.conversation_id,
    feeAmount: row.fee_amount,
    codeAttempts: row.code_attempts,
    status: row.status,
    scheduledAt: row.scheduled_at,
    noShow: row.no_show,
    createdAt: row.created_at,
    completedAt: row.completed_at,
    cancelledAt: row.cancelled_at,
    role: isTenant ? "locataire" : "bailleur",
    other: {
      name: other?.full_name ?? null,
      avatarUrl: other?.avatar_url ?? null,
      verified: other?.verification === "verifie",
    },
    slots: (row.visit_slots ?? [])
      .map((s) => ({ id: s.id, proposedBy: s.proposed_by, slotAt: s.slot_at }))
      .sort((a, b) => a.slotAt.localeCompare(b.slotAt)),
  };
}

/** Formate un créneau (date + heure) en français. */
export function formatVisitDateTime(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Fenêtre d'annulation : au-delà, le locataire ne peut plus annuler (le bailleur a bloqué son temps). */
export function canCancelVisit(visit: Pick<Visit, "status" | "scheduledAt">): boolean {
  if (visit.status === "demandee" || visit.status === "creneau_propose") return true;
  if (visit.status !== "confirmee" || !visit.scheduledAt) return false;
  return new Date(visit.scheduledAt).getTime() - Date.now() > 3 * 60 * 60 * 1000;
}

/** Demande une visite : 2 ou 3 créneaux proposés, frais figés au tarif actuel de l'annonce. */
export async function requestVisit(listingId: string, slots: Date[]): Promise<{ id?: string; error?: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "not-authenticated" };

  const { data, error } = await supabase.rpc("request_visit", {
    p_listing_id: listingId,
    p_slots: slots.map((d) => d.toISOString()),
  });

  if (error) return { error: error.message };
  return { id: data as string };
}

/** Visites de l'utilisateur connecté, comme locataire ou comme bailleur, plus récentes d'abord. */
export async function getMyVisits(): Promise<Visit[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("visits")
    .select(VISIT_SELECT)
    .or(`tenant_id.eq.${user.id},landlord_id.eq.${user.id}`)
    .order("created_at", { ascending: false });

  if (error) return [];
  return (data ?? []).map((row) => mapVisitRow(row as unknown as VisitRow, user.id));
}

/** Une visite précise, si l'utilisateur connecté y est partie (locataire ou bailleur). */
export async function getVisit(visitId: string): Promise<Visit | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase.from("visits").select(VISIT_SELECT).eq("id", visitId).maybeSingle();

  if (error || !data) return null;
  return mapVisitRow(data as unknown as VisitRow, user.id);
}

/** Dernière visite liée à une conversation (pour la bannière de statut dans le fil de messages). */
export async function getVisitByConversation(conversationId: string): Promise<Visit | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("visits")
    .select(VISIT_SELECT)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return mapVisitRow(data as unknown as VisitRow, user.id);
}

/** Le bailleur accepte l'un des créneaux proposés : la visite passe en "confirmee". */
export async function acceptSlot(visitId: string, slotAt: string): Promise<{ error?: string }> {
  const supabase = createClient();
  const { error } = await supabase
    .from("visits")
    .update({ status: "confirmee", scheduled_at: slotAt })
    .eq("id", visitId)
    .select("id")
    .single();

  if (error) return { error: error.message };
  return {};
}

/** Le bailleur contre-propose d'autres créneaux (2 ou 3). */
export async function proposeCounterSlots(visitId: string, slots: Date[]): Promise<{ error?: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Vous devez être connecté." };

  if (slots.length < 2 || slots.length > 3) {
    return { error: "Proposez 2 ou 3 créneaux." };
  }

  const { error: insertError } = await supabase
    .from("visit_slots")
    .insert(slots.map((d) => ({ visit_id: visitId, proposed_by: user.id, slot_at: d.toISOString() })));

  if (insertError) return { error: insertError.message };

  const { error } = await supabase
    .from("visits")
    .update({ status: "creneau_propose" })
    .eq("id", visitId)
    .select("id")
    .single();

  if (error) return { error: error.message };
  return {};
}

/** Le bailleur refuse la demande de visite. */
export async function refuseVisit(visitId: string): Promise<{ error?: string }> {
  const supabase = createClient();
  const { error } = await supabase
    .from("visits")
    .update({ status: "refusee" })
    .eq("id", visitId)
    .select("id")
    .single();

  if (error) return { error: error.message };
  return {};
}

/**
 * Le locataire annule sa visite (jusqu'à 3h avant le créneau retenu — au-delà,
 * la garde SQL rejette). Sert aussi à refuser une contre-proposition du
 * bailleur : depuis "creneau_propose", il n'y a pas d'état "refusee" côté
 * locataire, l'annulation est la sortie prévue par la machine à états.
 */
export async function cancelVisit(visitId: string): Promise<{ error?: string }> {
  const supabase = createClient();
  const { error } = await supabase
    .from("visits")
    .update({ status: "annulee" })
    .eq("id", visitId)
    .select("id")
    .single();

  if (error) return { error: error.message };
  return {};
}

/** Code de confirmation de la visite, visible uniquement par le locataire concerné. */
export async function getVisitCode(visitId: string): Promise<string | null> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_visit_code", { p_visit_id: visitId });
  if (error) return null;
  return (data as string | null) ?? null;
}

/** Le bailleur saisit le code remis par le locataire sur place. */
export async function confirmVisitWithCode(
  visitId: string,
  code: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("confirm_visit_with_code", {
    p_visit_id: visitId,
    p_code: code,
  });

  if (error) return { success: false, error: error.message };
  return { success: Boolean(data) };
}

/** Le bailleur signale que le locataire n'est pas venu (simple trace, aucun effet financier). */
export async function reportNoShow(visitId: string): Promise<{ error?: string }> {
  const supabase = createClient();
  const { error } = await supabase
    .from("visits")
    .update({ no_show: true })
    .eq("id", visitId)
    .select("id")
    .single();

  if (error) return { error: error.message };
  return {};
}
