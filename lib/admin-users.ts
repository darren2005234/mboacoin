import { createClient } from "@/lib/supabase/client";
import { requireAdminClient } from "@/lib/admin-guard";
import { friendlyErrorMessage } from "@/lib/supabase-error";

export interface UserAdminDetail {
  id: string;
  fullName: string;
  city: string | null;
  accountType: string;
  verification: string;
  createdAt: string;
  suspendedAt: string | null;
  suspensionReason: string | null;
}

export interface SuspendedAccount {
  id: string;
  fullName: string;
  accountType: string;
  suspendedAt: string;
  suspensionReason: string | null;
}

/** Fiche utilisateur pour l'admin (nom, type de compte, statut de suspension...). Admin uniquement. */
export async function getUserAdminDetail(userId: string): Promise<UserAdminDetail | null> {
  const guard = await requireAdminClient();
  if (!guard.ok) return null;

  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_user_admin_detail", { p_user_id: userId }).maybeSingle();
  if (error || !data) return null;

  const row = data as {
    id: string; full_name: string | null; city: string | null; account_type: string;
    verification: string; created_at: string; suspended_at: string | null; suspension_reason: string | null;
  };
  return {
    id: row.id,
    fullName: row.full_name ?? "Utilisateur",
    city: row.city,
    accountType: row.account_type,
    verification: row.verification,
    createdAt: row.created_at,
    suspendedAt: row.suspended_at,
    suspensionReason: row.suspension_reason,
  };
}

/** Liste des comptes actuellement suspendus. Admin uniquement. */
export async function listSuspendedAccounts(): Promise<SuspendedAccount[]> {
  const guard = await requireAdminClient();
  if (!guard.ok) return [];

  const supabase = createClient();
  const { data, error } = await supabase.rpc("list_suspended_accounts");
  if (error || !data) return [];

  return data.map((row: {
    id: string; full_name: string | null; account_type: string;
    suspended_at: string; suspension_reason: string | null;
  }) => ({
    id: row.id,
    fullName: row.full_name ?? "Utilisateur",
    accountType: row.account_type,
    suspendedAt: row.suspended_at,
    suspensionReason: row.suspension_reason,
  }));
}

/**
 * Suspend un compte (motif interne, jamais affiché à l'utilisateur). Bloque
 * en base toute nouvelle publication/bail/visite/conversation de ce compte
 * et masque ses annonces publiées — voir suspend_account() côté SQL.
 */
export async function suspendAccount(userId: string, reason: string): Promise<{ success?: boolean; error?: string }> {
  const guard = await requireAdminClient();
  if (!guard.ok) return { error: guard.error };

  const supabase = createClient();
  const { error } = await supabase.rpc("suspend_account", { p_user_id: userId, p_reason: reason });
  if (error) return { error: friendlyErrorMessage(error, "Impossible de suspendre ce compte. Réessayez.") };
  return { success: true };
}

/** Lève la suspension d'un compte : republie ses annonces gelées par ce mécanisme. */
export async function unsuspendAccount(userId: string): Promise<{ success?: boolean; error?: string }> {
  const guard = await requireAdminClient();
  if (!guard.ok) return { error: guard.error };

  const supabase = createClient();
  const { error } = await supabase.rpc("unsuspend_account", { p_user_id: userId });
  if (error) return { error: friendlyErrorMessage(error, "Impossible de lever cette suspension. Réessayez.") };
  return { success: true };
}
