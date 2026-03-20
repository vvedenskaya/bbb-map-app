import { getFestivalData } from './src/lib/festival-data';
import * as dotenv from 'dotenv';
dotenv.config();

async function run() {
  const data = await getFestivalData();
  console.log('Source:', data.sourceLabel);
  console.log('Venues Count:', data.venues.length);
  console.log('Events Count:', data.events.length);
}
run();
