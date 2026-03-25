import { PinEditor } from "@/components/admin/pin-editor";
import { getAdminEntryById } from "@/lib/admin-entries";
import { readPredefinedLocations } from "@/lib/predefined-locations";
import { notFound } from "next/navigation";

export default async function EditPinPage(
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const entry = await getAdminEntryById(params.id);
  const locationOptions = await readPredefinedLocations();
  if (!entry) {
    return notFound();
  }

  return <PinEditor initialData={entry} locationOptions={locationOptions} />;
}
