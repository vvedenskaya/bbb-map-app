import { readFile } from "node:fs/promises";
import path from "node:path";
import { events as seedEvents, venues as seedVenues } from "@/data/festival";
import { FestivalDay, FestivalEvent, Venue } from "@/types/festival";
import { fetchAirtableInstallations } from "@/lib/airtable";
import { parseCsv } from "@/lib/csv";

const INSTALLATIONS_CSV_PATH = path.join(
  process.cwd(),
  "data",
  "Installations_Art Pieces-BBB '26 Digital Data.csv"
);
const LOCATIONS_2023_PATH = path.join(process.cwd(), "locations_2023.json");

type DataSource = "csv" | "airtable" | "seed";

type Location2023 = {
  Name: string;
  Category?: string;
  Openness?: string;
  Lat: number | string;
  Long: number | string;
};

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

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\u2019']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\bthe\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(value: string): string {
  return normalizeText(value).replace(/\s+/g, "-") || "unknown-venue";
}

function parseEventType(value: string): FestivalEvent["type"] {
  const normalized = value.trim().toLowerCase();
  if (normalized.includes("music")) return "music";
  if (normalized.includes("performance")) return "performance";
  if (normalized.includes("installation")) return "installation";
  if (normalized.includes("lecture")) return "lecture";
  if (normalized.includes("object")) return "object";
  if (normalized.includes("experience") || normalized.includes("facilitated")) return "experience";
  if (normalized.includes("dj")) return "dj";
  if (normalized.includes("venue")) return "venue";
  if (normalized.includes("food")) return "food";
  return "community";
}

function parseDayFromSchedule(rawSchedule: string): FestivalDay {
  if (!rawSchedule) return "fri";
  const parsed = new Date(rawSchedule);
  if (Number.isNaN(parsed.getTime())) return "fri";
  const day = parsed.getDay();
  if (day === 5) return "fri";
  if (day === 6) return "sat";
  if (day === 0) return "sun";
  return "fri";
}

function formatColumnName(key: string): string {
  return key
    .split("_")
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

function buildDescriptionFromRow(row: Record<string, string>): string {
  const details = Object.entries(row)
    .filter(([key, value]) => key !== "status" && value && value.trim().length > 0)
    .map(([key, value]) => `${formatColumnName(key)}: ${value.trim()}`);

  return details.join("\n");
}

function findMatchingLocation(
  locationInternal: string,
  byNormalizedName: Map<string, Location2023>,
  allLocations: Location2023[]
): Location2023 | null {
  if (!locationInternal) return null;

  const normalized = normalizeText(locationInternal);
  if (!normalized) return null;

  const exact = byNormalizedName.get(normalized);
  if (exact) return exact;

  for (const loc of allLocations) {
    const candidate = normalizeText(loc.Name || "");
    if (!candidate) continue;

    if (candidate.includes(normalized) || normalized.includes(candidate)) {
      return loc;
    }
  }

  return null;
}

async function loadLocations2023(): Promise<{ byNormalizedName: Map<string, Location2023>; all: Location2023[] } | null> {
  try {
    const text = await readFile(LOCATIONS_2023_PATH, "utf-8");
    const parsed = JSON.parse(text) as unknown;

    if (!Array.isArray(parsed)) {
      return null;
    }

    const all: Location2023[] = [];
    const byNormalizedName = new Map<string, Location2023>();

    for (const item of parsed) {
      const maybe = item as Partial<Location2023>;
      const name = typeof maybe.Name === "string" ? maybe.Name : "";
      const lat = typeof maybe.Lat === "number" ? maybe.Lat : Number(maybe.Lat);
      const lng = typeof maybe.Long === "number" ? maybe.Long : Number(maybe.Long);

      if (!name || Number.isNaN(lat) || Number.isNaN(lng)) {
        continue;
      }

      const normalized = normalizeText(name);
      const location: Location2023 = {
        Name: name,
        Category: maybe.Category,
        Openness: maybe.Openness,
        Lat: lat,
        Long: lng,
      };

      all.push(location);
      if (normalized) {
        byNormalizedName.set(normalized, location);
      }
    }

    return { byNormalizedName, all };
  } catch {
    return null;
  }
}

async function loadCsvInstallations(): Promise<
  { venues: Venue[]; events: FestivalEvent[]; debug: LocationMatchDebug } | null
> {
  try {
    const csvText = await readFile(INSTALLATIONS_CSV_PATH, "utf-8");
    const cleanText = csvText.charCodeAt(0) === 0xfeff ? csvText.slice(1) : csvText;
    const rows = parseCsv(cleanText);

    if (rows.length === 0) {
      return null;
    }

    const locationsBundle = await loadLocations2023();
    if (!locationsBundle) {
      return null;
    }

    const venuesById = new Map<string, Venue>();
    const events: FestivalEvent[] = [];
    let totalRows = 0;
    let confirmedRows = 0;
    let matchedRows = 0;
    const unmatchedSet = new Set<string>();

    for (let index = 0; index < rows.length; index += 1) {
      totalRows += 1;
      const row = rows[index];
      const status = (row.status || "").trim().toLowerCase();

      // Requirement: only confirmed rows from current table.
      if (status && status !== "confirmed") {
        continue;
      }
      confirmedRows += 1;

      const locationInternal = row.location_internal || "";
      const matched = findMatchingLocation(
        locationInternal,
        locationsBundle.byNormalizedName,
        locationsBundle.all
      );

      // Requirement: only map locations that exist in locations_2023.json.
      if (!matched) {
        if (locationInternal) {
          unmatchedSet.add(locationInternal);
        } else {
          unmatchedSet.add("(empty Location (Internal))");
        }
        continue;
      }
      matchedRows += 1;

      const venueId = `loc-${slugify(matched.Name)}`;
      const lat = Number(matched.Lat);
      const lng = Number(matched.Long);

      if (!venuesById.has(venueId)) {
        venuesById.set(venueId, {
          id: venueId,
          name: matched.Name,
          label: matched.Category || "Venue",
          shortDescription: matched.Openness ? `Openness: ${matched.Openness}` : "Matched from 2023 locations",
          description: `Matched from locations_2023.json using Location (Internal): ${locationInternal}`,
          x: 0,
          y: 0,
          lat,
          lng,
          hasLocation: true,
          thumbnailUrl: "/map-layers/image_BB_map.jpg",
          accent: "#8b5cf6",
        });
      }

      const projectName = row.project_name || row.artist_name || `Installation ${index + 1}`;
      const eventId = row.id || `csv-installation-${index + 1}`;

      events.push({
        id: eventId,
        venueId,
        title: projectName,
        host: [row.artist_name, row.additional_artists].filter(Boolean).join(" — ") || "TBD",
        description: buildDescriptionFromRow(row),
        day: parseDayFromSchedule(row.schedule || ""),
        startTime: row.schedule || "TBD",
        endTime: row.duration || "TBD",
        type: parseEventType(row.project_type || ""),
        thumbnailUrl: "/map-layers/image_BB_map.jpg",
        lat,
        lng,
        hasLocation: true,
        permanence: row.year_or_permanent || "",
      });
    }

    const venues = Array.from(venuesById.values());
    if (venues.length === 0 || events.length === 0) {
      return null;
    }

    return {
      venues,
      events,
      debug: {
        totalRows,
        confirmedRows,
        matchedRows,
        unmatchedLocations: Array.from(unmatchedSet).sort((a, b) => a.localeCompare(b)),
      },
    };
  } catch {
    return null;
  }
}

function getSourcePreference(): DataSource {
  const source = process.env.FESTIVAL_DATA_SOURCE?.trim().toLowerCase();
  if (source === "airtable") return "airtable";
  if (source === "seed") return "seed";
  return "csv";
}

export async function getFestivalData(): Promise<FestivalDataResult> {
  const source = getSourcePreference();

  if (source === "airtable") {
    const airtableData = await fetchAirtableInstallations();
    if (airtableData && airtableData.venues.length > 0 && airtableData.events.length > 0) {
      return {
        venues: airtableData.venues,
        events: airtableData.events,
        sourceLabel: "Airtable API + 2023 location match",
        debug: airtableData.debug,
      };
    }
  }

  if (source === "csv" || source === "airtable") {
    const csvData = await loadCsvInstallations();
    if (csvData) {
      return {
        venues: csvData.venues,
        events: csvData.events,
        sourceLabel: "CSV + 2023 location match",
        debug: csvData.debug,
      };
    }
  }

  return {
    venues: seedVenues,
    events: seedEvents,
    sourceLabel: "Seed data fallback",
    debug: {
      totalRows: 0,
      confirmedRows: 0,
      matchedRows: 0,
      unmatchedLocations: [],
    },
  };
}
