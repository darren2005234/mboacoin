import { requireAccountType } from "@/lib/profile";
import { EditResidenceForm } from "@/components/mboacoin/edit-residence-form";

export default async function EditResidencePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAccountType("residence");
  const { id } = await params;
  return <EditResidenceForm id={id} />;
}
