// Chantier CONFORMITÉ-1 — purge quotidienne (loi n°2024/017).
//
// Trois volets indépendants, un seul déclenchement quotidien : documents de
// vérification d'identité (+ entité), vidéos de vérification de logement,
// exécution des demandes d'effacement de compte arrivées à échéance.
//
// Mode simulation par défaut (dry_run=true) : aucune écriture, ni en base ni
// dans le stockage. Il faut passer explicitement dry_run=false pour purger
// réellement — un appel nu ne détruit jamais rien par accident.
//
// Ordre systématique pour les trois volets : fichier(s) du stockage supprimés
// D'ABORD, référence en base ensuite (jamais l'inverse) — une ligne de base
// qui pointe encore vers un fichier n'existant plus serait pire qu'un fichier
// orphelin. Chaque candidat est traité indépendamment : l'échec d'un candidat
// n'interrompt jamais le traitement des autres (même principe que
// rent-reminders).
//
// ⚠️ Cette fonction n'est PAS programmée par la migration qui l'accompagne
// (20260717100000_data_retention_purge.sql) : geste manuel après déploiement,
// à valider en dry_run avant d'activer un Cron Job quotidien.

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("DATA_RETENTION_PURGE_SECRET")!;

interface IdentityCandidate {
  request_id: string;
  user_id: string;
  rule: string;
  document_path: string | null;
  selfie_path: string | null;
  entity_document_path: string | null;
}

interface VideoCandidate {
  verification_id: string;
  listing_id: string;
  owner_id: string;
  video_path: string;
  rule: string;
}

interface ErasureCandidate {
  request_id: string;
  user_id: string;
  scheduled_for: string;
  blocked: boolean;
}

interface StoragePathRow {
  bucket: string;
  storage_path: string;
}

interface Report {
  identityDocuments: { requestId: string; rule: string; purged: string[]; failed: string[] }[];
  listingVideos: { verificationId: string; rule: string; purged: boolean }[];
  accountErasures: { requestId: string; userId: string; outcome: string; filesRemoved: number; filesFailed: number }[];
}

Deno.serve(async (req) => {
  if (req.headers.get("authorization") !== `Bearer ${CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const url = new URL(req.url);
  // dry_run=true par défaut : il faut le désactiver explicitement.
  const dryRun = url.searchParams.get("dry_run") !== "false";

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const report: Report = { identityDocuments: [], listingVideos: [], accountErasures: [] };

  // ==========================================================================
  // Volet 1 — documents de vérification d'identité (+ entité)
  // ==========================================================================
  const { data: identityCandidates } = await supabase.rpc("preview_identity_document_purge");
  for (const c of (identityCandidates ?? []) as IdentityCandidate[]) {
    const toRemove: { field: "document" | "selfie" | "entity"; path: string }[] = [];
    if (c.document_path) toRemove.push({ field: "document", path: c.document_path });
    if (c.selfie_path) toRemove.push({ field: "selfie", path: c.selfie_path });
    if (c.entity_document_path) toRemove.push({ field: "entity", path: c.entity_document_path });

    if (dryRun) {
      report.identityDocuments.push({
        requestId: c.request_id,
        rule: c.rule,
        purged: toRemove.map((t) => t.path),
        failed: [],
      });
      continue;
    }

    const purged: string[] = [];
    const failed: string[] = [];
    let purgeDocument = false;
    let purgeSelfie = false;
    let purgeEntity = false;

    for (const t of toRemove) {
      const { error } = await supabase.storage.from("identity-documents").remove([t.path]);
      if (error) {
        console.error("data-retention-purge: échec suppression identité", c.request_id, t.path, error);
        failed.push(t.path);
        continue;
      }
      purged.push(t.path);
      if (t.field === "document") purgeDocument = true;
      else if (t.field === "selfie") purgeSelfie = true;
      else purgeEntity = true;
    }

    if (purgeDocument || purgeSelfie || purgeEntity) {
      await supabase.rpc("commit_identity_document_purge", {
        p_request_id: c.request_id,
        p_purge_document: purgeDocument,
        p_purge_selfie: purgeSelfie,
        p_purge_entity_document: purgeEntity,
      });
    }
    report.identityDocuments.push({ requestId: c.request_id, rule: c.rule, purged, failed });
  }

  // ==========================================================================
  // Volet 2 — vidéos de vérification de logement
  // ==========================================================================
  const { data: videoCandidates } = await supabase.rpc("preview_listing_video_purge");
  for (const c of (videoCandidates ?? []) as VideoCandidate[]) {
    if (dryRun) {
      report.listingVideos.push({ verificationId: c.verification_id, rule: c.rule, purged: false });
      continue;
    }

    const { error } = await supabase.storage.from("property-videos").remove([c.video_path]);
    if (error) {
      console.error("data-retention-purge: échec suppression vidéo", c.verification_id, error);
      report.listingVideos.push({ verificationId: c.verification_id, rule: c.rule, purged: false });
      continue;
    }

    await supabase.rpc("commit_listing_video_purge", { p_verification_id: c.verification_id, p_rule: c.rule });
    report.listingVideos.push({ verificationId: c.verification_id, rule: c.rule, purged: true });
  }

  // ==========================================================================
  // Volet 3 — exécution des demandes d'effacement de compte échues
  // ==========================================================================
  const { data: erasureCandidates } = await supabase.rpc("preview_account_erasures");
  for (const c of (erasureCandidates ?? []) as ErasureCandidate[]) {
    if (dryRun) {
      report.accountErasures.push({
        requestId: c.request_id,
        userId: c.user_id,
        outcome: c.blocked ? "serait_bloquée" : "serait_exécutée",
        filesRemoved: 0,
        filesFailed: 0,
      });
      continue;
    }

    if (c.blocked) {
      // execute_account_erasure revérifiera et journalisera lui-même le
      // blocage ; on ne touche à aucun fichier tant que ce n'est pas confirmé
      // exécutable, pour ne jamais supprimer un fichier sans effacement
      // correspondant.
      const outcome = await supabase.rpc("execute_account_erasure", { p_request_id: c.request_id });
      report.accountErasures.push({
        requestId: c.request_id,
        userId: c.user_id,
        outcome: String(outcome.data ?? "blocked"),
        filesRemoved: 0,
        filesFailed: 0,
      });
      continue;
    }

    // Fenêtre résiduelle assumée : entre ce SELECT et l'exécution ci-dessous,
    // un nouveau bail pourrait théoriquement apparaître. execute_account_erasure
    // revérifie systématiquement et ne touche alors ni au profil ni aux
    // baux/paiements si c'est le cas — seuls des fichiers annexes (avatar,
    // photos d'annonces déjà dépubliées, pièces jointes de tickets) auraient
    // pu être supprimés en pure perte dans ce cas extrêmement rare.
    const { data: pathRows } = await supabase.rpc("get_account_erasure_storage_paths", { p_user_id: c.user_id });
    let filesRemoved = 0;
    let filesFailed = 0;
    for (const p of (pathRows ?? []) as StoragePathRow[]) {
      const { error } = await supabase.storage.from(p.bucket).remove([p.storage_path]);
      if (error) {
        // L'avatar peut légitimement ne jamais avoir existé — pas une vraie
        // erreur dans ce cas précis, mais on la compte quand même : mieux
        // vaut un compteur trop prudent que masquer un échec réel.
        filesFailed++;
      } else {
        filesRemoved++;
      }
    }

    const outcome = await supabase.rpc("execute_account_erasure", { p_request_id: c.request_id });

    if (outcome.data === "executed") {
      // Empêche toute reconnexion : la neutralisation en base (pseudonymisation
      // du profil) est déjà faite par execute_account_erasure ; ceci coupe
      // l'accès Auth. UPDATE, jamais DELETE — voir l'en-tête de la migration.
      // Non vérifié en conditions réelles : à confirmer lors du premier essai
      // (sur un compte jetable) que l'API Admin GoTrue accepte bien une chaîne
      // vide pour phone/email plutôt que de la rejeter comme format invalide —
      // sans quoi il faudra remplacer par une valeur de substitution non réutilisable.
      const { error: authError } = await supabase.auth.admin.updateUserById(c.user_id, {
        phone: "",
        email: "",
        user_metadata: {},
      });
      if (authError) {
        console.error("data-retention-purge: échec neutralisation auth.users", c.user_id, authError);
      }
    }

    report.accountErasures.push({
      requestId: c.request_id,
      userId: c.user_id,
      outcome: String(outcome.data ?? "unknown"),
      filesRemoved,
      filesFailed,
    });
  }

  return new Response(JSON.stringify({ dryRun, report }, null, 2), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
});
