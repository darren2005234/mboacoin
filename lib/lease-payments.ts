import { createClient } from "@/lib/supabase/client";
import { generateDueDates, dueDateForPeriod, nextUnpaidDueDate, todayIso } from "@/lib/lease-schedule";

export interface LeasePayment {
  id: string;
  period: string;
  amount: number;
  paidAt: string;
  method: string;
  receiptNumber: string;
  createdAt: string;
  paymentBatchId: string | null;
}

function mapPaymentRow(row: {
  id: string;
  period: string;
  amount: number;
  paid_at: string;
  method: string;
  receipt_number: string;
  created_at: string;
  payment_batch_id: string | null;
}): LeasePayment {
  return {
    id: row.id,
    period: row.period,
    amount: row.amount,
    paidAt: row.paid_at,
    method: row.method,
    receiptNumber: row.receipt_number,
    createdAt: row.created_at,
    paymentBatchId: row.payment_batch_id,
  };
}

const PAYMENT_SELECT = "id, period, amount, paid_at, method, receipt_number, created_at, payment_batch_id";

/** Paiements d'un bail (RLS scope déjà bailleur/locataire/admin du bail). */
export async function getLeasePayments(leaseId: string): Promise<LeasePayment[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("lease_payments")
    .select(PAYMENT_SELECT)
    .eq("lease_id", leaseId)
    .order("period", { ascending: false });

  if (error) return [];
  return (data ?? []).map(mapPaymentRow);
}

/** Déclare un loyer payé pour une période donnée d'un bail (bailleur uniquement). */
export async function declarePayment(
  leaseId: string,
  period: string,
  paidAt: string
): Promise<{ error?: string }> {
  const supabase = createClient();
  const { error } = await supabase
    .from("lease_payments")
    .insert({ lease_id: leaseId, period, paid_at: paidAt })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { error: "Cette période a déjà été déclarée payée." };
    }
    return { error: error.message || "Impossible de déclarer ce paiement." };
  }
  return {};
}

export interface DeclarePaymentBatchInput {
  leaseId: string;
  /** N'importe quel jour du mois de départ ; tronqué au premier du mois côté serveur. */
  startPeriod: string;
  months: number;
  paidAt: string;
}

/**
 * Déclare un versement couvrant plusieurs mois d'un coup (bailleur
 * uniquement) : une ligne par mois dans lease_payments, reliées par un
 * payment_batch_id commun. Utilisé à la fois pour un bail en mode avance
 * (où ça définit/prolonge end_date) et pour un versement ponctuel en mode
 * mensuel (où ça n'a aucun effet sur end_date). Toute la validation (période
 * déjà payée, hors bornes du bail) est faite côté SQL — les messages
 * d'erreur remontent tels quels.
 */
export async function declarePaymentBatch(
  input: DeclarePaymentBatchInput
): Promise<{ batchId?: string; error?: string }> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("declare_payment_batch", {
    p_lease_id: input.leaseId,
    p_start_period: input.startPeriod,
    p_months: input.months,
    p_paid_at: input.paidAt,
  });

  if (error) return { error: error.message || "Impossible de déclarer ce versement." };
  return { batchId: data as string };
}

export interface DueInstallment {
  period: string;
  dueDate: string;
  paid: LeasePayment | null;
  late: boolean;
}

export interface LeaseSchedule {
  installments: DueInstallment[];
  /** Échéance de la première période sans paiement enregistré (voir nextUnpaidDueDate) — la
   * seule source de vérité pour "prochain loyer dû", partagée avec getLeasesScheduleStatus. */
  nextDueDate: string | null;
}

/** Planning complet d'un bail mensuel : chaque échéance, payée ou non, en retard ou non. */
export async function getLeaseSchedule(lease: {
  id: string;
  startDate: string;
  paymentDay: number | null;
  paymentPeriod: string;
  endDate: string | null;
}): Promise<LeaseSchedule> {
  const payments = await getLeasePayments(lease.id);
  const paidByPeriod = new Map(payments.map((p) => [p.period, p]));
  const paidPeriods = new Set(paidByPeriod.keys());

  let until = lease.endDate && new Date(lease.endDate) < new Date() ? new Date(lease.endDate) : new Date();
  // Un versement groupé peut couvrir des mois futurs (point 7) : ils doivent
  // apparaître dans le planning dès la déclaration, sans attendre que le
  // mois arrive, pour que leur quittance soit immédiatement accessible.
  const maxPaidPeriod = payments.reduce((max, p) => (p.period > max ? p.period : max), "");
  if (maxPaidPeriod) {
    const maxPaidDate = new Date(Number(maxPaidPeriod.slice(0, 4)), Number(maxPaidPeriod.slice(5, 7)) - 1, 1);
    if (maxPaidDate > until) until = maxPaidDate;
  }
  const dueDates = generateDueDates(lease.startDate, lease.paymentPeriod, until);
  const today = todayIso();

  const installments = dueDates
    .map((period) => {
      const paid = paidByPeriod.get(period) ?? null;
      const dueDate = dueDateForPeriod(period, lease.paymentDay, lease.startDate);
      return { period, dueDate, paid, late: !paid && dueDate < today };
    })
    .sort((a, b) => (a.period < b.period ? 1 : -1));

  const nextDueDate = nextUnpaidDueDate(lease.startDate, lease.paymentDay, lease.paymentPeriod, paidPeriods);

  return { installments, nextDueDate };
}

export interface LeaseScheduleStatus {
  late: boolean;
  nextDueDate: string | null;
}

/**
 * À jour / en retard + prochaine échéance pour une liste de baux, en une
 * seule requête (pas de N+1). Dérivées de la même fonction que
 * getLeaseSchedule (nextUnpaidDueDate) : "en retard" est simplement "la
 * première période sans paiement est déjà passée" — les deux ne peuvent
 * jamais diverger puisqu'ils viennent du même calcul.
 */
export async function getLeasesScheduleStatus(
  leases: {
    id: string;
    startDate: string;
    paymentDay: number | null;
    paymentPeriod: string;
    paymentMode: string;
  }[]
): Promise<Record<string, LeaseScheduleStatus>> {
  const ids = leases.map((l) => l.id);
  const result: Record<string, LeaseScheduleStatus> = {};
  if (ids.length === 0) return result;

  const supabase = createClient();
  const { data } = await supabase.from("lease_payments").select("lease_id, period").in("lease_id", ids);

  const paidByLease = new Map<string, Set<string>>();
  for (const row of data ?? []) {
    const set = paidByLease.get(row.lease_id) ?? new Set<string>();
    set.add(row.period);
    paidByLease.set(row.lease_id, set);
  }

  const today = todayIso();

  for (const lease of leases) {
    // Un bail en mode avance n'a jamais de retard : soit la période est
    // couverte, soit le bail arrive à son terme (voir la bannière dédiée).
    if (lease.paymentMode === "avance") {
      result[lease.id] = { late: false, nextDueDate: null };
      continue;
    }
    const paidPeriods = paidByLease.get(lease.id) ?? new Set<string>();
    const nextDueDate = nextUnpaidDueDate(lease.startDate, lease.paymentDay, lease.paymentPeriod, paidPeriods);
    result[lease.id] = { late: nextDueDate !== null && nextDueDate < today, nextDueDate };
  }
  return result;
}
