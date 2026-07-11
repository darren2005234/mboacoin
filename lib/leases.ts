import { createClient } from "@/lib/supabase/client";

export interface LeasableListing {
  id: string;
  title: string;
  city: string;
  neighborhood: string | null;
  price: number;
  pricePeriod: string;
  image: string;
}

/** Logements de l'utilisateur connecté éligibles à un nouveau bail (publiés, donc pas déjà loués). */
export async function getMyLeasableListings(): Promise<LeasableListing[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("listings")
    .select("id, title, city, neighborhood, price, price_period, image_url")
    .eq("owner_id", user.id)
    .eq("status", "publiee")
    .order("created_at", { ascending: false });

  if (error) return [];

  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    city: row.city,
    neighborhood: row.neighborhood,
    price: row.price,
    pricePeriod: row.price_period,
    image: row.image_url ?? "/img/listings/demo-1.jpg",
  }));
}

export interface NewLeaseInput {
  listingId: string;
  tenantPhone: string;
  startDate: string;
  durationMonths: number | null;
  rentAmount: number;
  depositAmount: number | null;
  advanceAmount: number | null;
  paymentDay: number | null;
  paymentPeriod: string;
}

export interface CreateLeaseResult {
  id?: string;
  error?: string;
}

function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

/** Crée un bail sur un logement dont l'utilisateur connecté est propriétaire. */
export async function createLease(input: NewLeaseInput): Promise<CreateLeaseResult> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Vous devez être connecté." };

  const { data: listing } = await supabase
    .from("listings")
    .select("owner_id, status")
    .eq("id", input.listingId)
    .maybeSingle();

  if (!listing || listing.owner_id !== user.id) {
    return { error: "Ce logement ne vous appartient pas." };
  }
  if (listing.status !== "publiee") {
    return { error: "Ce logement n'est pas disponible pour la création d'un bail." };
  }

  const endDate = input.durationMonths ? addMonths(input.startDate, input.durationMonths) : null;

  const { data, error } = await supabase
    .from("leases")
    .insert({
      listing_id: input.listingId,
      landlord_id: user.id,
      tenant_phone: input.tenantPhone,
      start_date: input.startDate,
      duration_months: input.durationMonths,
      end_date: endDate,
      rent_amount: input.rentAmount,
      deposit_amount: input.depositAmount,
      advance_amount: input.advanceAmount,
      payment_day: input.paymentDay,
      payment_period: input.paymentPeriod,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { error: "Ce logement a déjà un bail en cours." };
    }
    return { error: "Ce logement n'est pas disponible pour la création d'un bail." };
  }
  return { id: data.id };
}

export interface MyLease {
  id: string;
  listingId: string;
  listingTitle: string;
  listingImage: string;
  tenantPhone: string;
  tenantName: string | null;
  status: string;
  startDate: string;
  durationMonths: number | null;
  endDate: string | null;
  rentAmount: number;
  paymentPeriod: string;
  createdAt: string;
}

/** Baux de l'utilisateur connecté en tant que bailleur. */
export async function getMyLeases(): Promise<MyLease[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("leases")
    .select(
      "id, listing_id, tenant_phone, status, start_date, duration_months, end_date, rent_amount, payment_period, created_at, listing:listings(title, image_url), tenant:profiles!tenant_id(full_name)"
    )
    .eq("landlord_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return [];

  return (data ?? []).map((row) => {
    const listing = Array.isArray(row.listing) ? row.listing[0] : row.listing;
    const tenant = Array.isArray(row.tenant) ? row.tenant[0] : row.tenant;
    return {
      id: row.id,
      listingId: row.listing_id,
      listingTitle: listing?.title ?? "Logement",
      listingImage: listing?.image_url ?? "/img/listings/demo-1.jpg",
      tenantPhone: row.tenant_phone,
      tenantName: tenant?.full_name ?? null,
      status: row.status,
      startDate: row.start_date,
      durationMonths: row.duration_months,
      endDate: row.end_date,
      rentAmount: row.rent_amount,
      paymentPeriod: row.payment_period,
      createdAt: row.created_at,
    };
  });
}

export interface LeaseCounterparty {
  fullName: string | null;
  avatarUrl: string | null;
  verified: boolean;
}

export interface PendingLease {
  id: string;
  listingId: string;
  listingTitle: string;
  listingImage: string;
  listingLocation: string;
  landlord: LeaseCounterparty;
  startDate: string;
  durationMonths: number | null;
  endDate: string | null;
  rentAmount: number;
  depositAmount: number | null;
  advanceAmount: number | null;
  paymentDay: number | null;
  paymentPeriod: string;
}

const PENDING_LEASE_SELECT =
  "id, listing_id, start_date, duration_months, end_date, rent_amount, deposit_amount, advance_amount, payment_day, payment_period, listing:listings(title, image_url, city, neighborhood), landlord:profiles!landlord_id(full_name, avatar_url, verification)";

function mapPendingLeaseRow(row: {
  id: string;
  listing_id: string;
  start_date: string;
  duration_months: number | null;
  end_date: string | null;
  rent_amount: number;
  deposit_amount: number | null;
  advance_amount: number | null;
  payment_day: number | null;
  payment_period: string;
  listing: unknown;
  landlord: unknown;
}): PendingLease {
  type ListingJoin = { title: string; image_url: string | null; city: string; neighborhood: string | null };
  type LandlordJoin = { full_name: string | null; avatar_url: string | null; verification: string };

  const listingRaw = row.listing;
  const landlordRaw = row.landlord;
  const listing = (Array.isArray(listingRaw) ? listingRaw[0] : listingRaw) as ListingJoin | null;
  const landlord = (Array.isArray(landlordRaw) ? landlordRaw[0] : landlordRaw) as LandlordJoin | null;

  return {
    id: row.id,
    listingId: row.listing_id,
    listingTitle: listing?.title ?? "Logement",
    listingImage: listing?.image_url ?? "/img/listings/demo-1.jpg",
    listingLocation: [listing?.neighborhood, listing?.city].filter(Boolean).join(", "),
    landlord: {
      fullName: landlord?.full_name ?? null,
      avatarUrl: landlord?.avatar_url ?? null,
      verified: landlord?.verification === "verifie",
    },
    startDate: row.start_date,
    durationMonths: row.duration_months,
    endDate: row.end_date,
    rentAmount: row.rent_amount,
    depositAmount: row.deposit_amount,
    advanceAmount: row.advance_amount,
    paymentDay: row.payment_day,
    paymentPeriod: row.payment_period,
  };
}

/** Baux en attente de confirmation où l'utilisateur connecté est le locataire rattaché. */
export async function getMyPendingLeases(): Promise<PendingLease[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("leases")
    .select(PENDING_LEASE_SELECT)
    .eq("tenant_id", user.id)
    .eq("status", "en_attente_confirmation")
    .order("created_at", { ascending: false });

  if (error) return [];
  return (data ?? []).map(mapPendingLeaseRow);
}

export interface ActiveLease extends PendingLease {
  confirmedAt: string | null;
}

/** Baux actifs où l'utilisateur connecté est le locataire. */
export async function getMyActiveLeases(): Promise<ActiveLease[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("leases")
    .select(`${PENDING_LEASE_SELECT}, confirmed_at`)
    .eq("tenant_id", user.id)
    .eq("status", "actif")
    .order("created_at", { ascending: false });

  if (error) return [];
  return (data ?? []).map((row) => ({
    ...mapPendingLeaseRow(row),
    confirmedAt: row.confirmed_at,
  }));
}

/** Confirme un bail en attente dont l'utilisateur connecté est le locataire rattaché. */
export async function confirmLease(leaseId: string): Promise<{ error?: string }> {
  const supabase = createClient();
  const { error } = await supabase
    .from("leases")
    .update({ status: "actif" })
    .eq("id", leaseId)
    .select("id")
    .single();

  if (error) return { error: "Ce bail n'est plus en attente de confirmation." };
  return {};
}

/** Refuse un bail en attente dont l'utilisateur connecté est le locataire rattaché. */
export async function rejectLease(leaseId: string): Promise<{ error?: string }> {
  const supabase = createClient();
  const { error } = await supabase
    .from("leases")
    .update({ status: "rejete" })
    .eq("id", leaseId)
    .select("id")
    .single();

  if (error) return { error: "Ce bail n'est plus en attente de confirmation." };
  return {};
}
