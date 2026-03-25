import { PinEditor } from "@/components/admin/pin-editor";
import { getAdminEntryById } from "@/lib/admin-entries";
import { notFound } from "next/navigation";

export default async function EditPinPage(
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const entry = await getAdminEntryById(params.id);
  if (!entry) {
    return notFound();
  }

  return <PinEditor initialData={entry} />;
}
