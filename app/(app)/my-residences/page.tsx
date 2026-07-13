import { requireAccountType } from "@/lib/profile";
import { MyResidencesList } from "@/components/mboacoin/my-residences-list";

export default async function MyResidencesPage() {
  await requireAccountType("residence", "/profile", "/my-residences");
  return <MyResidencesList />;
}
