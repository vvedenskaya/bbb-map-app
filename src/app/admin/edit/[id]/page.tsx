import { PinEditor } from "@/components/admin/pin-editor";
import { fetchAirtableInstallations } from "@/lib/airtable";
import { notFound } from "next/navigation";

export default async function EditPinPage(
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const data = await fetchAirtableInstallations();
  
  if (!data || !data.venues.length) {
    return notFound();
  }

  const venue = data.venues.find((v) => v.id === params.id);
  
  if (!venue) {
    return notFound();
  }

  return <PinEditor initialData={venue} />;
}
