import { FestivalMapApp } from "@/components/festival-map-app";
import { getFestivalData } from "@/lib/festival-data";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function Home() {
  const { venues, events, sourceLabel, debug } = await getFestivalData();
  return (
    <FestivalMapApp
      venues={venues}
      events={events}
      dataSourceLabel={sourceLabel}
      debug={debug}
    />
  );
}
