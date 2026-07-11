import { createClient } from "@/lib/supabase/server";
import { renderReceiptPdf, type ReceiptData } from "@/lib/receipt-pdf";

export const runtime = "nodejs";

interface PaymentRow {
  period: string;
  amount: number;
  paid_at: string;
  method: string;
  receipt_number: string;
  lease:
    | {
        listing: { title: string; city: string; neighborhood: string | null; address_description: string | null } | { title: string; city: string; neighborhood: string | null; address_description: string | null }[] | null;
        landlord: { full_name: string | null } | { full_name: string | null }[] | null;
        tenant: { full_name: string | null } | { full_name: string | null }[] | null;
      }
    | {
        listing: { title: string; city: string; neighborhood: string | null; address_description: string | null } | { title: string; city: string; neighborhood: string | null; address_description: string | null }[] | null;
        landlord: { full_name: string | null } | { full_name: string | null }[] | null;
        tenant: { full_name: string | null } | { full_name: string | null }[] | null;
      }[]
    | null;
}

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export async function GET(_req: Request, { params }: { params: Promise<{ paymentId: string }> }) {
  const { paymentId } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("lease_payments")
    .select(
      "period, amount, paid_at, method, receipt_number, lease:leases(listing:listings(title, city, neighborhood, address_description), landlord:profiles!landlord_id(full_name), tenant:profiles!tenant_id(full_name))"
    )
    .eq("id", paymentId)
    .maybeSingle();

  if (!data) return new Response("Introuvable", { status: 404 });

  const row = data as PaymentRow;
  const lease = one(row.lease);
  const listing = one(lease?.listing ?? null);
  const landlord = one(lease?.landlord ?? null);
  const tenant = one(lease?.tenant ?? null);

  const receiptData: ReceiptData = {
    receiptNumber: row.receipt_number,
    tenantName: tenant?.full_name ?? "Locataire",
    landlordName: landlord?.full_name ?? "Bailleur",
    listingLabel: listing?.title ?? "Logement",
    listingAddress: listing
      ? (listing.address_description ?? [listing.neighborhood, listing.city].filter(Boolean).join(", "))
      : null,
    period: row.period,
    amount: row.amount,
    paidAt: row.paid_at,
    method: row.method,
    issuedAt: new Date(),
  };

  const pdf = await renderReceiptPdf(receiptData);

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="quittance-${row.receipt_number}.pdf"`,
    },
  });
}
