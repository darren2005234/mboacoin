import { createClient } from "@/lib/supabase/client";
import { requireAdminClient } from "@/lib/admin-guard";
import type { SupportAttachment, SupportThreadMessage } from "@/lib/support";

/** Nombre de tickets "nouveau" (mise en évidence admin, comme vérifications/signalements). */
export async function getPendingSupportTicketsCount(): Promise<number> {
  const guard = await requireAdminClient();
  if (!guard.ok) return 0;

  const supabase = createClient();
  const { count } = await supabase
    .from("support_tickets")
    .select("id", { count: "exact", head: true })
    .eq("status", "nouveau");

  return count ?? 0;
}

export interface AdminSupportTicketSummary {
  id: string;
  category: string;
  subject: string;
  status: string;
  createdAt: string;
  statusChangedAt: string;
  requesterName: string | null;
  isVisitor: boolean;
}

export interface SupportTicketFilters {
  category?: string;
  status?: string;
}

/** Liste des tickets (admin uniquement), filtrable par catégorie/statut. */
export async function getSupportTickets(filters: SupportTicketFilters = {}): Promise<AdminSupportTicketSummary[]> {
  const guard = await requireAdminClient();
  if (!guard.ok) return [];

  const supabase = createClient();
  let query = supabase
    .from("support_tickets")
    .select("id, category, subject, status, created_at, status_changed_at, user_id, contact_email, contact_phone")
    .order("status_changed_at", { ascending: false });

  if (filters.category) query = query.eq("category", filters.category);
  if (filters.status) query = query.eq("status", filters.status);

  const { data, error } = await query;
  if (error || !data) return [];

  const userIds = [...new Set(data.map((t) => t.user_id).filter((id): id is string => !!id))];
  const { data: profiles } =
    userIds.length > 0 ? await supabase.from("profiles").select("id, full_name").in("id", userIds) : { data: [] };
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  return data.map((t) => ({
    id: t.id,
    category: t.category,
    subject: t.subject,
    status: t.status,
    createdAt: t.created_at,
    statusChangedAt: t.status_changed_at,
    requesterName: t.user_id ? (nameById.get(t.user_id) ?? null) : (t.contact_email ?? t.contact_phone),
    isVisitor: !t.user_id,
  }));
}

export interface SupportTicketRequesterContext {
  fullName: string | null;
  verification: string;
  accountType: string;
  listingCount: number;
  landlordLeaseCount: number;
  tenantLeaseCount: number;
  suspended: boolean;
}

/** Contexte du demandeur (profil + volumétrie) — seulement pour un ticket rattaché à un compte. */
async function getRequesterContext(userId: string): Promise<SupportTicketRequesterContext | null> {
  const supabase = createClient();
  const [{ data: profile }, { count: listingCount }, { count: landlordLeaseCount }, { count: tenantLeaseCount }] =
    await Promise.all([
      // suspended_at/suspension_reason ne sont pas lisibles en select direct
      // (colonnes révoquées) : get_user_admin_detail les expose, admin uniquement.
      supabase.rpc("get_user_admin_detail", { p_user_id: userId }).maybeSingle(),
      supabase.from("listings").select("id", { count: "exact", head: true }).eq("owner_id", userId),
      supabase.from("leases").select("id", { count: "exact", head: true }).eq("landlord_id", userId),
      supabase.from("leases").select("id", { count: "exact", head: true }).eq("tenant_id", userId),
    ]);

  if (!profile) return null;
  const row = profile as {
    full_name: string | null; verification: string; account_type: string; suspended_at: string | null;
  };
  return {
    fullName: row.full_name,
    verification: row.verification,
    accountType: row.account_type,
    listingCount: listingCount ?? 0,
    landlordLeaseCount: landlordLeaseCount ?? 0,
    tenantLeaseCount: tenantLeaseCount ?? 0,
    suspended: row.suspended_at != null,
  };
}

export interface AdminSupportTicketDetail {
  id: string;
  category: string;
  subject: string;
  description: string;
  status: string;
  createdAt: string;
  statusChangedAt: string;
  contactEmail: string | null;
  contactPhone: string | null;
  requesterContext: SupportTicketRequesterContext | null;
}

export interface AdminSupportTicketThread {
  ticket: AdminSupportTicketDetail;
  ticketAttachments: SupportAttachment[];
  messages: SupportThreadMessage[];
}

/** Détail complet d'un ticket pour l'admin : le ticket, son contexte, et le fil. */
export async function getSupportTicketDetail(ticketId: string): Promise<AdminSupportTicketThread | null> {
  const guard = await requireAdminClient();
  if (!guard.ok) return null;

  const supabase = createClient();
  const { data: ticketRow } = await supabase
    .from("support_tickets")
    .select("id, category, subject, description, status, created_at, status_changed_at, user_id, contact_email, contact_phone")
    .eq("id", ticketId)
    .maybeSingle();
  if (!ticketRow) return null;

  const [{ data: msgRows }, { data: attRows }, requesterContext] = await Promise.all([
    supabase
      .from("support_messages")
      .select("id, is_admin, body, created_at")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true }),
    supabase.from("support_ticket_attachments").select("id, message_id, storage_path").eq("ticket_id", ticketId),
    ticketRow.user_id ? getRequesterContext(ticketRow.user_id) : Promise.resolve(null),
  ]);

  const attachmentsByMessage = new Map<string | null, SupportAttachment[]>();
  for (const a of attRows ?? []) {
    const list = attachmentsByMessage.get(a.message_id) ?? [];
    list.push({ id: a.id, storagePath: a.storage_path });
    attachmentsByMessage.set(a.message_id, list);
  }

  return {
    ticket: {
      id: ticketRow.id,
      category: ticketRow.category,
      subject: ticketRow.subject,
      description: ticketRow.description,
      status: ticketRow.status,
      createdAt: ticketRow.created_at,
      statusChangedAt: ticketRow.status_changed_at,
      contactEmail: ticketRow.contact_email,
      contactPhone: ticketRow.contact_phone,
      requesterContext,
    },
    ticketAttachments: attachmentsByMessage.get(null) ?? [],
    messages: (msgRows ?? []).map((m) => ({
      id: m.id,
      isAdmin: m.is_admin,
      body: m.body,
      createdAt: m.created_at,
      attachments: attachmentsByMessage.get(m.id) ?? [],
    })),
  };
}

/** Réponse admin dans le fil (is_admin dérivé serveur par le trigger, pas envoyé ici). */
export async function replyToSupportTicket(ticketId: string, body: string): Promise<{ error?: string }> {
  const trimmed = body.trim();
  if (!trimmed) return { error: "Le message est vide." };

  const supabase = createClient();
  const { error } = await supabase.from("support_messages").insert({ ticket_id: ticketId, body: trimmed });
  if (error) return { error: "Impossible d'envoyer la réponse." };
  return {};
}

/** Change le statut d'un ticket (admin uniquement, RLS). */
export async function updateSupportTicketStatus(ticketId: string, status: string): Promise<{ error?: string }> {
  const supabase = createClient();
  const { error } = await supabase.from("support_tickets").update({ status }).eq("id", ticketId);
  if (error) return { error: "Impossible de changer le statut." };
  return {};
}
