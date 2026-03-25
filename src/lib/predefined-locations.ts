import { readFile } from "node:fs/promises";
import path from "node:path";

type RawLocation = {
  Name?: unknown;
  Category?: unknown;
  Lat?: unknown;
  Long?: unknown;
};

export type PredefinedLocation = {
  name: string;
  category: string;
  lat: number;
  lng: number;
};

const LOCATIONS_PATH = path.join(process.cwd(), "locations.json");

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

export async function readPredefinedLocations(): Promise<PredefinedLocation[]> {
  try {
    const raw = await readFile(LOCATIONS_PATH, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return (parsed as RawLocation[])
      .map((entry) => {
        const name = asString(entry.Name);
        const category = asString(entry.Category) || "Venue";
        const lat = asNumber(entry.Lat);
        const lng = asNumber(entry.Long);
        if (!name || lat === null || lng === null) return null;
        return { name, category, lat, lng };
      })
      .filter((entry): entry is PredefinedLocation => Boolean(entry))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}
