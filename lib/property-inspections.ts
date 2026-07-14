import imageCompression from "browser-image-compression";
import { createClient } from "@/lib/supabase/client";

export const ROOM_TYPES = ["salon", "chambre", "cuisine", "salle_de_bain", "exterieur", "autre"] as const;

export const ROOM_TYPE_LABELS: Record<string, string> = {
  salon: "Salon",
  chambre: "Chambre",
  cuisine: "Cuisine",
  salle_de_bain: "Salle de bain",
  exterieur: "Extérieur",
  autre: "Autre",
};

export const INSPECTION_STATUS_LABELS: Record<string, string> = {
  brouillon: "Brouillon",
  soumis: "En attente de validation",
  conteste: "Contesté",
  valide: "Validé",
};

const COMPRESSION_OPTIONS = {
  maxSizeMB: 1,
  maxWidthOrHeight: 1600,
  useWebWorker: true,
};

async function compressPhoto(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  try {
    return await imageCompression(file, COMPRESSION_OPTIONS);
  } catch {
    return file;
  }
}

/** URL signée (1h) pour consulter une photo privée d'état des lieux. */
export async function getInspectionPhotoSignedUrl(path: string): Promise<string | null> {
  const supabase = createClient();
  const { data } = await supabase.storage.from("etat-des-lieux").createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

export interface InspectionPhoto {
  id: string;
  storagePath: string;
  auteurRole: "bailleur" | "locataire";
  createdAt: string;
}

export interface InspectionObservation {
  id: string;
  auteurRole: "bailleur" | "locataire";
  texte: string;
  createdAt: string;
}

export interface InspectionRoom {
  id: string;
  typePiece: string;
  libelle: string;
  photos: InspectionPhoto[];
  observations: InspectionObservation[];
}

export interface Inspection {
  id: string;
  leaseId: string;
  type: "entree" | "sortie";
  status: string;
  submittedAt: string | null;
  validatedAt: string | null;
  disputedAt: string | null;
  disputeReason: string | null;
  rooms: InspectionRoom[];
}

/** État des lieux d'un bail pour un type donné, avec ses pièces/photos/observations. Null s'il n'existe pas encore. */
export async function getInspection(leaseId: string, type: "entree" | "sortie"): Promise<Inspection | null> {
  const supabase = createClient();

  const { data: insp } = await supabase
    .from("etat_des_lieux")
    .select("id, lease_id, type, status, submitted_at, validated_at, disputed_at, dispute_reason")
    .eq("lease_id", leaseId)
    .eq("type", type)
    .maybeSingle();

  if (!insp) return null;

  const { data: pieces } = await supabase
    .from("etat_des_lieux_pieces")
    .select("id, type_piece, libelle")
    .eq("etat_des_lieux_id", insp.id)
    .order("created_at", { ascending: true });

  const pieceIds = (pieces ?? []).map((p) => p.id);

  const [{ data: photos }, { data: observations }] = pieceIds.length
    ? await Promise.all([
        supabase
          .from("etat_des_lieux_photos")
          .select("id, piece_id, storage_path, auteur_role, created_at")
          .in("piece_id", pieceIds)
          .order("created_at", { ascending: true }),
        supabase
          .from("etat_des_lieux_observations")
          .select("id, piece_id, auteur_role, texte, created_at")
          .in("piece_id", pieceIds)
          .order("created_at", { ascending: true }),
      ])
    : [{ data: [] }, { data: [] }];

  const rooms: InspectionRoom[] = (pieces ?? []).map((p) => ({
    id: p.id,
    typePiece: p.type_piece,
    libelle: p.libelle,
    photos: (photos ?? [])
      .filter((ph) => ph.piece_id === p.id)
      .map((ph) => ({ id: ph.id, storagePath: ph.storage_path, auteurRole: ph.auteur_role, createdAt: ph.created_at })),
    observations: (observations ?? [])
      .filter((o) => o.piece_id === p.id)
      .map((o) => ({ id: o.id, auteurRole: o.auteur_role, texte: o.texte, createdAt: o.created_at })),
  }));

  return {
    id: insp.id,
    leaseId: insp.lease_id,
    type: insp.type,
    status: insp.status,
    submittedAt: insp.submitted_at,
    validatedAt: insp.validated_at,
    disputedAt: insp.disputed_at,
    disputeReason: insp.dispute_reason,
    rooms,
  };
}

export interface InspectionSummary {
  id: string;
  type: "entree" | "sortie";
  status: string;
}

/** Statut résumé des états des lieux d'un bail (au plus un par type), pour affichage compact. */
export async function getInspectionsSummary(leaseId: string): Promise<InspectionSummary[]> {
  const supabase = createClient();
  const { data } = await supabase.from("etat_des_lieux").select("id, type, status").eq("lease_id", leaseId);
  return data ?? [];
}

/** Crée l'état des lieux (bailleur uniquement ; disponibilité de la sortie vérifiée par le trigger). */
export async function createInspection(
  leaseId: string,
  type: "entree" | "sortie"
): Promise<{ id?: string; error?: string }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("etat_des_lieux")
    .insert({ lease_id: leaseId, type })
    .select("id")
    .single();

  if (error || !data) return { error: "Impossible de créer l'état des lieux." };
  return { id: data.id };
}

/** Ajoute une pièce (bailleur uniquement, tant que l'état des lieux est en brouillon ou contesté). */
export async function addRoom(
  inspectionId: string,
  typePiece: string,
  libelle: string
): Promise<{ id?: string; error?: string }> {
  const trimmed = libelle.trim();
  if (!trimmed) return { error: "Le libellé de la pièce est requis." };

  const supabase = createClient();
  const { data, error } = await supabase
    .from("etat_des_lieux_pieces")
    .insert({ etat_des_lieux_id: inspectionId, type_piece: typePiece, libelle: trimmed })
    .select("id")
    .single();

  if (error || !data) return { error: "Impossible d'ajouter la pièce." };
  return { id: data.id };
}

/** Renomme/recatégorise une pièce (bailleur uniquement, tant que l'état des lieux est en brouillon). */
export async function renameRoom(
  pieceId: string,
  typePiece: string,
  libelle: string
): Promise<{ error?: string }> {
  const trimmed = libelle.trim();
  if (!trimmed) return { error: "Le libellé de la pièce est requis." };

  const supabase = createClient();
  const { error } = await supabase
    .from("etat_des_lieux_pieces")
    .update({ type_piece: typePiece, libelle: trimmed })
    .eq("id", pieceId);

  if (error) return { error: "Impossible de modifier la pièce." };
  return {};
}

/** Supprime une pièce (bailleur uniquement, tant que l'état des lieux est en brouillon). */
export async function deleteRoom(pieceId: string): Promise<{ error?: string }> {
  const supabase = createClient();
  const { error } = await supabase.from("etat_des_lieux_pieces").delete().eq("id", pieceId);
  if (error) return { error: "Impossible de supprimer la pièce." };
  return {};
}

/** Ajoute une photo à une pièce (compression avant envoi, comme lease-requests). */
export async function addRoomPhoto(
  leaseId: string,
  pieceId: string,
  file: File
): Promise<{ error?: string }> {
  const supabase = createClient();
  const compressed = await compressPhoto(file);
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${leaseId}/${pieceId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const { error: upErr } = await supabase.storage.from("etat-des-lieux").upload(path, compressed, { upsert: false });
  if (upErr) return { error: "Envoi de la photo impossible." };

  const { error } = await supabase.from("etat_des_lieux_photos").insert({ piece_id: pieceId, storage_path: path });
  if (error) return { error: "Impossible d'enregistrer la photo." };

  return {};
}

/** Ajoute une observation textuelle à une pièce (append-only, attribuée à son auteur). */
export async function addRoomObservation(pieceId: string, texte: string): Promise<{ error?: string }> {
  const trimmed = texte.trim();
  if (!trimmed) return { error: "L'observation est vide." };

  const supabase = createClient();
  const { error } = await supabase.from("etat_des_lieux_observations").insert({ piece_id: pieceId, texte: trimmed });
  if (error) return { error: "Impossible d'enregistrer l'observation." };

  return {};
}

/** Soumet l'état des lieux au locataire (bailleur uniquement ; légalité vérifiée par le trigger). */
export async function submitInspection(inspectionId: string): Promise<{ error?: string }> {
  const supabase = createClient();
  const { error } = await supabase.from("etat_des_lieux").update({ status: "soumis" }).eq("id", inspectionId);
  if (error) return { error: "Impossible de soumettre l'état des lieux." };
  return {};
}

/** Valide l'état des lieux (locataire uniquement) : verrouille définitivement le document. */
export async function validateInspection(inspectionId: string): Promise<{ error?: string }> {
  const supabase = createClient();
  const { error } = await supabase.from("etat_des_lieux").update({ status: "valide" }).eq("id", inspectionId);
  if (error) return { error: "Impossible de valider l'état des lieux." };
  return {};
}

/** Conteste l'état des lieux (locataire uniquement), avec motif obligatoire. */
export async function disputeInspection(inspectionId: string, reason: string): Promise<{ error?: string }> {
  const trimmed = reason.trim();
  if (!trimmed) return { error: "Indiquez le motif de la contestation." };

  const supabase = createClient();
  const { error } = await supabase
    .from("etat_des_lieux")
    .update({ status: "conteste", dispute_reason: trimmed })
    .eq("id", inspectionId);

  if (error) return { error: "Impossible de contester l'état des lieux." };
  return {};
}

export interface RoomComparison {
  key: string;
  typePiece: string;
  libelle: string;
  entree: InspectionRoom | null;
  sortie: InspectionRoom | null;
}

/** Rapproche les pièces d'un état des lieux d'entrée et de sortie pour la vue de comparaison (par type + libellé normalisé, en base de données les deux jeux de pièces sont indépendants). */
export function compareInspectionRooms(entree: Inspection | null, sortie: Inspection | null): RoomComparison[] {
  const norm = (r: InspectionRoom) => `${r.typePiece}::${r.libelle.trim().toLowerCase()}`;
  const byKey = new Map<string, RoomComparison>();

  for (const r of entree?.rooms ?? []) {
    byKey.set(norm(r), { key: norm(r), typePiece: r.typePiece, libelle: r.libelle, entree: r, sortie: null });
  }
  for (const r of sortie?.rooms ?? []) {
    const key = norm(r);
    const existing = byKey.get(key);
    if (existing) {
      existing.sortie = r;
    } else {
      byKey.set(key, { key, typePiece: r.typePiece, libelle: r.libelle, entree: null, sortie: r });
    }
  }

  return Array.from(byKey.values());
}
