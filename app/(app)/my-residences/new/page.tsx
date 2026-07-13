import { requireAccountType } from "@/lib/profile";
import { NewResidenceForm } from "@/components/mboacoin/new-residence-form";

export default async function NewResidencePage() {
  await requireAccountType("residence", "/profile", "/my-residences/new");
  return <NewResidenceForm />;
}
