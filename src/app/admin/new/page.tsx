import { PinEditor } from "@/components/admin/pin-editor";
import { readPredefinedLocations } from "@/lib/predefined-locations";

export default async function NewPinPage() {
  const locationOptions = await readPredefinedLocations();
  return <PinEditor locationOptions={locationOptions} />;
}
