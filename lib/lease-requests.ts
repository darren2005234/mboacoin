import imageCompression from "browser-image-compression";
import { createClient } from "@/lib/supabase/client";

/** Types de demande, source unique de vérité pour l'UI. */
export const REQUEST_TYPES = [
  "reparation",
  "probleme_logement",
  "question_bail",
  "demande_administrative",
  "autre",
] as const;

export const REQUEST_TYPE_LABELS: Record<string, string> = {
  reparation: "Réparation / panne",
  probleme_logement: "Problème dans le logement",
  question_bail: "Question sur le bail",
  demande_administrative: "Demande administrative",
  autre: "Autre",
};

const COMPRESSION_OPTIONS = {
  maxSizeMB: 1,
  maxWidthOrHeight: 1600,
  useWebWorker: true,
};

/** Compresse les photos (images uniquement) avant envoi, même convention que publish-form.tsx. */
export async function compressImages(files: File[]): Promise<File[]> {
  return Promise.all(
    files.map(async (file) => {
      if (!file.type.startsWith("image/")) return file;
      try {
        return await imageCompression(file, COMPRESSION_OPTIONS);
      } catch {
        return file;
      }
    })
  );
}

async function uploadAttachment(leaseId: string, requestId: string, file: File): Promise<string | null> {
  const supabase = createClient();
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${leaseId}/${requestId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from("lease-requests").upload(path, file, { upsert: false });
  return error ? null : path;
}

/** URL signée (1h) pour consulter une pièce jointe privée. */
export async function getAttachmentSignedUrl(path: string): Promise<string | null> {
  const supabase = createClient();
  const { data } = await supabase.storage.from("lease-requests").createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

export interface LeaseRequestSummary {
  id: string;
  leaseId: string;
  type: string;
  subject: string;
  status: string;
  createdAt: string;
  statusChangedAt: string;
}

/** Demandes d'un bail précis (RLS scope déjà bailleur/locataire/admin du bail). */
export async function getLeaseRequests(leaseId: string): Promise<LeaseRequestSummary[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("lease_requests")
    .select("id, lease_id, type, subject, status, created_at, status_changed_at")
    .eq("lease_id", leaseId)
    .order("status_changed_at", { ascending: false });

  if (error) return [];
  return (data ?? []).map((row) => ({
    id: row.id,
    leaseId: row.lease_id,
    type: row.type,
    subject: row.subject,
    status: row.status,
    createdAt: row.created_at,
    statusChangedAt: row.status_changed_at,
  }));
}

export interface LandlordLeaseRequestSummary extends LeaseRequestSummary {
  listingTitle: string;
  tenantName: string | null;
}

/** Toutes les demandes des baux du bailleur connecté, tous logements confondus. */
export async function getMyLandlordRequests(): Promise<LandlordLeaseRequestSummary[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("lease_requests")
    .select(
      "id, lease_id, type, subject, status, created_at, status_changed_at, lease:leases!inner(listing:listings(title), tenant:profiles!tenant_id(full_name))"
    )
    .eq("lease.landlord_id", user.id)
    .order("status_changed_at", { ascending: false });

  if (error) return [];

  return (data ?? []).map((row) => {
    const lease = Array.isArray(row.lease) ? row.lease[0] : row.lease;
    const listing = lease ? (Array.isArray(lease.listing) ? lease.listing[0] : lease.listing) : null;
    const tenant = lease ? (Array.isArray(lease.tenant) ? lease.tenant[0] : lease.tenant) : null;
    return {
      id: row.id,
      leaseId: row.lease_id,
      type: row.type,
      subject: row.subject,
      status: row.status,
      createdAt: row.created_at,
      statusChangedAt: row.status_changed_at,
      listingTitle: listing?.title ?? "Logement",
      tenantName: tenant?.full_name ?? null,
    };
  });
}

/** Nombre de demandes "nouvelle" tous baux confondus (mise en évidence bailleur). */
export async function countNewLeaseRequestsForLandlord(): Promise<number> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;

  const { count } = await supabase
    .from("lease_requests")
    .select("id, lease:leases!inner(landlord_id)", { count: "exact", head: true })
    .eq("lease.landlord_id", user.id)
    .eq("status", "nouvelle");

  return count ?? 0;
}

export interface CreateLeaseRequestInput {
  leaseId: string;
  type: string;
  subject: string;
  description: string;
  files: File[];
}

/** Crée une demande (locataire uniquement, sur un bail actif) avec pièces jointes éventuelles. */
export async function createLeaseRequest(input: CreateLeaseRequestInput): Promise<{ id?: string; error?: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Vous devez être connecté." };

  const { data, error } = await supabase
    .from("lease_requests")
    .insert({
      lease_id: input.leaseId,
      type: input.type,
      subject: input.subject,
      description: input.description,
    })
    .select("id")
    .single();

  if (error || !data) return { error: "Impossible de créer la demande." };

  if (input.files.length > 0) {
    const compressed = await compressImages(input.files);
    for (const file of compressed) {
      const path = await uploadAttachment(input.leaseId, data.id, file);
      if (path) {
        await supabase.from("lease_request_attachments").insert({ request_id: data.id, storage_path: path });
      }
    }
  }

  return { id: data.id };
}

/** Fait transitionner le statut d'une demande (légalité vérifiée par le trigger). */
export async function updateLeaseRequestStatus(requestId: string, status: string): Promise<{ error?: string }> {
  const supabase = createClient();
  const { error } = await supabase
    .from("lease_requests")
    .update({ status })
    .eq("id", requestId)
    .select("id")
    .single();

  if (error) return { error: "Cette transition de statut n'est pas autorisée." };
  return {};
}

export interface LeaseRequestDetail {
  id: string;
  leaseId: string;
  type: string;
  subject: string;
  description: string;
  status: string;
  createdBy: string;
  createdAt: string;
  statusChangedAt: string;
  landlordId: string;
  tenantId: string;
  listingTitle: string;
}

export interface LeaseRequestAttachment {
  id: string;
  storagePath: string;
}

export interface LeaseRequestThreadMessage {
  id: string;
  senderId: string;
  body: string;
  createdAt: string;
  attachments: LeaseRequestAttachment[];
}

export interface LeaseRequestThread {
  request: LeaseRequestDetail;
  requestAttachments: LeaseRequestAttachment[];
  messages: LeaseRequestThreadMessage[];
}

/** Détail complet d'une demande : la demande, ses pièces jointes initiales, et son fil de messages. */
export async function getLeaseRequestThread(requestId: string): Promise<LeaseRequestThread | null> {
  const supabase = createClient();

  const { data: reqRow, error: reqErr } = await supabase
    .from("lease_requests")
    .select(
      "id, lease_id, type, subject, description, status, created_by, created_at, status_changed_at, lease:leases(landlord_id, tenant_id, listing:listings(title))"
    )
    .eq("id", requestId)
    .maybeSingle();

  if (reqErr || !reqRow) return null;

  const lease = Array.isArray(reqRow.lease) ? reqRow.lease[0] : reqRow.lease;
  const listing = lease ? (Array.isArray(lease.listing) ? lease.listing[0] : lease.listing) : null;

  const { data: msgRows } = await supabase
    .from("lease_request_messages")
    .select("id, sender_id, body, created_at")
    .eq("request_id", requestId)
    .order("created_at", { ascending: true });

  const { data: attRows } = await supabase
    .from("lease_request_attachments")
    .select("id, message_id, storage_path")
    .eq("request_id", requestId);

  const attachmentsByMessage = new Map<string | null, LeaseRequestAttachment[]>();
  for (const a of attRows ?? []) {
    const key = a.message_id;
    const list = attachmentsByMessage.get(key) ?? [];
    list.push({ id: a.id, storagePath: a.storage_path });
    attachmentsByMessage.set(key, list);
  }

  return {
    request: {
      id: reqRow.id,
      leaseId: reqRow.lease_id,
      type: reqRow.type,
      subject: reqRow.subject,
      description: reqRow.description,
      status: reqRow.status,
      createdBy: reqRow.created_by,
      createdAt: reqRow.created_at,
      statusChangedAt: reqRow.status_changed_at,
      landlordId: lease?.landlord_id ?? "",
      tenantId: lease?.tenant_id ?? "",
      listingTitle: listing?.title ?? "Logement",
    },
    requestAttachments: attachmentsByMessage.get(null) ?? [],
    messages: (msgRows ?? []).map((m) => ({
      id: m.id,
      senderId: m.sender_id,
      body: m.body,
      createdAt: m.created_at,
      attachments: attachmentsByMessage.get(m.id) ?? [],
    })),
  };
}

/** Envoie un message dans le fil d'une demande, avec pièces jointes éventuelles. */
export async function sendLeaseRequestMessage(
  requestId: string,
  body: string,
  files: File[] = []
): Promise<{ error?: string }> {
  const trimmed = body.trim();
  if (!trimmed) return { error: "Le message est vide." };

  const supabase = createClient();
  const { data: request } = await supabase
    .from("lease_requests")
    .select("lease_id")
    .eq("id", requestId)
    .maybeSingle();
  if (!request) return { error: "Demande introuvable." };

  const { data, error } = await supabase
    .from("lease_request_messages")
    .insert({ request_id: requestId, body: trimmed })
    .select("id")
    .single();

  if (error || !data) return { error: "Impossible d'envoyer le message." };

  if (files.length > 0) {
    const compressed = await compressImages(files);
    for (const file of compressed) {
      const path = await uploadAttachment(request.lease_id, requestId, file);
      if (path) {
        await supabase
          .from("lease_request_attachments")
          .insert({ request_id: requestId, message_id: data.id, storage_path: path });
      }
    }
  }

  return {};
}
