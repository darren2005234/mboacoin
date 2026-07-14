import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/profile";
import { loginUrl } from "@/lib/auth-redirect";
import { MyLeasesFlatList } from "@/components/mboacoin/my-leases-flat-list";
import { MyLeasesByResidence } from "@/components/mboacoin/my-leases-by-residence";

/**
 * Un compte résidence pilote des dizaines de logements : la liste plate ne
 * répond pas à "où en est ma résidence X ?", d'où le regroupement dédié.
 * Les autres types de compte (particulier, agence) n'ont pas de résidence :
 * leur espace reste la liste plate, strictement inchangée (même composant,
 * extrait tel quel — voir components/mboacoin/my-leases-flat-list.tsx).
 */
export default async function MyLeasesPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect(loginUrl("/my-leases"));

  return profile.accountType === "residence" ? <MyLeasesByResidence /> : <MyLeasesFlatList />;
}
