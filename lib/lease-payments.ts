import { createClient } from "@/lib/supabase/client";
import { generateDueDates } from "@/lib/lease-schedule";

export interface LeasePayment {
  id: string;
  period: string;
  amount: number;
  paidAt: string;
  method: string;
  receiptNumber: string;
  createdAt: string;
}

function mapPaymentRow(row: {
  id: string;
  period: string;
  amount: number;
  paid_at: string;
  method: string;
  receipt_number: string;
  created_at: string;
}): LeasePayment {
  return {
    id: row.id,
    period: row.period,
    amount: row.amount,
    paidAt: row.paid_at,
    method: row.method,
    receiptNumber: row.receipt_number,
    createdAt: row.created_at,
  };
}

const PAYMENT_SELECT = "id, period, amount, paid_at, method, receipt_number, created_at";

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
    return { error: "Impossible de déclarer ce paiement." };
  }
  return {};
}

export interface DueInstallment {
  period: string;
  paid: LeasePayment | null;
  late: boolean;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Planning complet d'un bail mensuel : chaque échéance, payée ou non, en retard ou non. */
export async function getLeaseSchedule(lease: {
  id: string;
  startDate: string;
  paymentDay: number | null;
  paymentPeriod: string;
  endDate: string | null;
}): Promise<DueInstallment[]> {
  const payments = await getLeasePayments(lease.id);
  const paidByPeriod = new Map(payments.map((p) => [p.period, p]));

  const until = lease.endDate && new Date(lease.endDate) < new Date() ? new Date(lease.endDate) : new Date();
  const dueDates = generateDueDates(lease.startDate, lease.paymentDay, lease.paymentPeriod, until);
  const today = todayIso();

  return dueDates
    .map((period) => {
      const paid = paidByPeriod.get(period) ?? null;
      return { period, paid, late: !paid && period < today };
    })
    .sort((a, b) => (a.period < b.period ? 1 : -1));
}

/** À jour / en retard pour une liste de baux, en une seule requête (pas de N+1). */
export async function getLeasesLateStatus(
  leases: { id: string; startDate: string; paymentDay: number | null; paymentPeriod: string }[]
): Promise<Record<string, boolean>> {
  const ids = leases.map((l) => l.id);
  const result: Record<string, boolean> = {};
  if (ids.length === 0) return result;

  const supabase = createClient();
  const { data } = await supabase.from("lease_payments").select("lease_id, period").in("lease_id", ids);

  const paidSet = new Set((data ?? []).map((p) => `${p.lease_id}:${p.period}`));
  const today = todayIso();

  for (const lease of leases) {
    const dueDates = generateDueDates(lease.startDate, lease.paymentDay, lease.paymentPeriod);
    result[lease.id] = dueDates.some((d) => d < today && !paidSet.has(`${lease.id}:${d}`));
  }
  return result;
}
