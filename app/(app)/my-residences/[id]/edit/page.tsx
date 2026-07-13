import { requireAccountType } from "@/lib/profile";
import { EditResidenceForm } from "@/components/mboacoin/edit-residence-form";

export default async function EditResidencePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireAccountType("residence", "/profile", `/my-residences/${id}/edit`);
  return <EditResidenceForm id={id} />;
}
