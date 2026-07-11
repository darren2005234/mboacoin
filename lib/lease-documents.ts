import imageCompression from "browser-image-compression";
import { createClient } from "@/lib/supabase/client";

const COMPRESSION_OPTIONS = {
  maxSizeMB: 1,
  maxWidthOrHeight: 1600,
  useWebWorker: true,
};

export interface LeaseDocument {
  id: string;
  documentType: string;
  storagePath: string;
  createdAt: string;
}

/** Documents d'un bail (contrat, avenants), le plus récent d'abord. */
export async function getLeaseDocuments(leaseId: string): Promise<LeaseDocument[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("lease_documents")
    .select("id, document_type, storage_path, created_at")
    .eq("lease_id", leaseId)
    .order("created_at", { ascending: false });

  if (error) return [];
  return (data ?? []).map((row) => ({
    id: row.id,
    documentType: row.document_type,
    storagePath: row.storage_path,
    createdAt: row.created_at,
  }));
}

/** Upload le contrat signé d'un bail (bailleur du bail uniquement). Accepte image ou PDF. */
export async function uploadLeaseContract(leaseId: string, file: File): Promise<{ error?: string }> {
  const supabase = createClient();

  let toUpload = file;
  if (file.type.startsWith("image/")) {
    try {
      toUpload = await imageCompression(file, COMPRESSION_OPTIONS);
    } catch {
      toUpload = file;
    }
  }

  const ext = file.name.split(".").pop() ?? "pdf";
  const path = `${leaseId}/${Date.now()}-contrat.${ext}`;
  const { error: upErr } = await supabase.storage.from("lease-contracts").upload(path, toUpload, { upsert: false });
  if (upErr) return { error: "Envoi du contrat impossible." };

  const { error } = await supabase.from("lease_documents").insert({
    lease_id: leaseId,
    document_type: "contrat",
    storage_path: path,
  });
  if (error) return { error: "Impossible d'enregistrer le contrat." };

  return {};
}

/** URL signée (1h) pour consulter un document privé. */
export async function getContractSignedUrl(path: string): Promise<string | null> {
  const supabase = createClient();
  const { data } = await supabase.storage.from("lease-contracts").createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}
