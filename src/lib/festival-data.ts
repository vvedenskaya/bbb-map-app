import { FestivalEvent, Venue } from "@/types/festival";
import { readFile } from "node:fs/promises";
import path from "node:path";

export type LocationMatchDebug = {
  totalRows: number;
  confirmedRows: number;
  matchedRows: number;
  unmatchedLocations: string[];
};

export type FestivalDataResult = {
  venues: Venue[];
  events: FestivalEvent[];
  sourceLabel: string;
  debug: LocationMatchDebug;
};

type LocationRow = {
  Name?: unknown;
  categoriees?: unknown;
  Category?: unknown;
  Openness?: unknown;
  "Artist(s)"?: unknown;
  "Artist Website"?: unknown;
  Lat?: unknown;
  Long?: unknown;
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

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[\u2019']/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "location"
  );
}

export async function getFestivalData(): Promise<FestivalDataResult> {
  try {
    const raw = await readFile(LOCATIONS_PATH, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      throw new Error("locations.json must be an array");
    }

    const usedIds = new Set<string>();
    const venues: Venue[] = [];

    for (const rowUnknown of parsed) {
      const row = rowUnknown as LocationRow;
      const name = asString(row.Name);
      const category = asString(row.categoriees) || asString(row.Category) || "Venue";
      const openness = asString(row.Openness) || "Unknown openness";
      const artists = asString(row["Artist(s)"]);
      const artistWebsite = asString(row["Artist Website"]);
      const lat = asNumber(row.Lat);
      const lng = asNumber(row.Long);

      if (!name || lat === null || lng === null) {
        continue;
      }

      const baseId = `loc-${slugify(name)}`;
      let venueId = baseId;
      let suffix = 2;
      while (usedIds.has(venueId)) {
        venueId = `${baseId}-${suffix}`;
        suffix += 1;
      }
      usedIds.add(venueId);

      const descriptionLines = [
        `Category: ${category}`,
        `Openness: ${openness}`,
        artists ? `Artist(s): ${artists}` : "",
        artistWebsite ? `Artist Website: ${artistWebsite}` : "",
      ].filter(Boolean);

      venues.push({
        id: venueId,
        name,
        label: category,
        shortDescription: `Openness: ${openness}`,
        description: descriptionLines.join("\n"),
        x: 0,
        y: 0,
        lat,
        lng,
        hasLocation: true,
        thumbnailUrl: "/map-layers/image_BB_map.jpg",
        accent: "#8b5cf6",
      });
    }

    return {
      venues,
      events: [],
      sourceLabel: "locations.json",
      debug: {
        totalRows: parsed.length,
        confirmedRows: venues.length,
        matchedRows: venues.length,
        unmatchedLocations: [],
      },
    };
  } catch {
    // Fail-safe: keep app renderable even if locations file is malformed/unavailable.
  }

  return {
    venues: [],
    events: [],
    sourceLabel: "locations.json unavailable",
    debug: {
      totalRows: 0,
      confirmedRows: 0,
      matchedRows: 0,
      unmatchedLocations: [],
    },
  };
}
