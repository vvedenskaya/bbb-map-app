import { FestivalMapApp } from "@/components/festival-map-app";
import { getFestivalData } from "@/lib/festival-data";

export default async function Home() {
  const { venues, events, sourceLabel } = await getFestivalData();
  return <FestivalMapApp venues={venues} events={events} dataSourceLabel={sourceLabel} />;
}
