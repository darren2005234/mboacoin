import { createClient } from "@/lib/supabase/client";

export interface LeaseAmendment {
  id: string;
  leaseId: string;
  proposedBy: string;
  status: string;
  reason: string | null;
  newRentAmount: number | null;
  newDepositAmount: number | null;
  newAdvanceAmount: number | null;
  newPaymentDay: number | null;
  newPaymentPeriod: string | null;
  newDurationMonths: number | null;
  newEndDate: string | null;
  createdAt: string;
  respondedAt: string | null;
}

const AMENDMENT_SELECT =
  "id, lease_id, proposed_by, status, reason, new_rent_amount, new_deposit_amount, new_advance_amount, new_payment_day, new_payment_period, new_duration_months, new_end_date, created_at, responded_at";

function mapAmendmentRow(row: {
  id: string;
  lease_id: string;
  proposed_by: string;
  status: string;
  reason: string | null;
  new_rent_amount: number | null;
  new_deposit_amount: number | null;
  new_advance_amount: number | null;
  new_payment_day: number | null;
  new_payment_period: string | null;
  new_duration_months: number | null;
  new_end_date: string | null;
  created_at: string;
  responded_at: string | null;
}): LeaseAmendment {
  return {
    id: row.id,
    leaseId: row.lease_id,
    proposedBy: row.proposed_by,
    status: row.status,
    reason: row.reason,
    newRentAmount: row.new_rent_amount,
    newDepositAmount: row.new_deposit_amount,
    newAdvanceAmount: row.new_advance_amount,
    newPaymentDay: row.new_payment_day,
    newPaymentPeriod: row.new_payment_period,
    newDurationMonths: row.new_duration_months,
    newEndDate: row.new_end_date,
    createdAt: row.created_at,
    respondedAt: row.responded_at,
  };
}

export interface AmendmentPatch {
  rentAmount?: number;
  depositAmount?: number;
  advanceAmount?: number;
  paymentDay?: number;
  paymentPeriod?: string;
  durationMonths?: number;
  endDate?: string;
}

/** Propose une modification des conditions d'un bail actif (bailleur du bail uniquement). */
export async function proposeLeaseAmendment(
  leaseId: string,
  patch: AmendmentPatch,
  reason?: string
): Promise<{ error?: string }> {
  const supabase = createClient();
  const { error } = await supabase
    .from("lease_amendments")
    .insert({
      lease_id: leaseId,
      reason: reason?.trim() || null,
      new_rent_amount: patch.rentAmount ?? null,
      new_deposit_amount: patch.depositAmount ?? null,
      new_advance_amount: patch.advanceAmount ?? null,
      new_payment_day: patch.paymentDay ?? null,
      new_payment_period: patch.paymentPeriod ?? null,
      new_duration_months: patch.durationMonths ?? null,
      new_end_date: patch.endDate ?? null,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") return { error: "Une proposition est déjà en attente pour ce bail." };
    return { error: "Impossible de proposer cette modification." };
  }
  return {};
}

/**
 * Toutes les propositions d'un bail (en attente et passées), la plus
 * récente d'abord — sert à la fois à afficher la proposition en cours ET
 * l'historique (une proposition refusée doit rester visible côté bailleur,
 * pas seulement pendant qu'elle est en attente).
 */
export async function getLeaseAmendments(leaseId: string): Promise<LeaseAmendment[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("lease_amendments")
    .select(AMENDMENT_SELECT)
    .eq("lease_id", leaseId)
    .order("created_at", { ascending: false });

  if (error) return [];
  return (data ?? []).map(mapAmendmentRow);
}

/** Annule une proposition en attente (bailleur qui l'a proposée). */
export async function cancelAmendment(amendmentId: string): Promise<{ error?: string }> {
  const supabase = createClient();
  const { error } = await supabase
    .from("lease_amendments")
    .update({ status: "annulee" })
    .eq("id", amendmentId)
    .select("id")
    .single();

  if (error) return { error: "Cette proposition ne peut plus être annulée." };
  return {};
}

/** Accepte ou refuse une proposition en attente (locataire du bail). */
export async function respondToAmendment(amendmentId: string, accept: boolean): Promise<{ error?: string }> {
  const supabase = createClient();
  const { error } = await supabase
    .from("lease_amendments")
    .update({ status: accept ? "acceptee" : "refusee" })
    .eq("id", amendmentId)
    .select("id")
    .single();

  if (error) return { error: "Cette proposition ne peut plus être traitée." };
  return {};
}
