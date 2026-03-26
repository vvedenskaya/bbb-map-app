import { FestivalDay, FestivalEvent, Venue } from "@/types/festival";
import { readFile } from "node:fs/promises";
import path from "node:path";

const AIRTABLE_API_BASE = "https://api.airtable.com/v0";
const LOCATIONS_2023_PATH = path.join(process.cwd(), "locations_2023.json");

type AirtableRecord = {
  id: string;
  fields: Record<string, unknown>;
};

type AirtableResponse = {
  records: AirtableRecord[];
  offset?: string;
};

type AirtableConfig = {
  token: string;
  baseId: string;
  tableName: string;
  view?: string;
};

type Location2023 = {
  Name: string;
  Category?: string;
  Openness?: string;
  Lat: number;
  Long: number;
};

type MatchingDebug = {
  totalRows: number;
  confirmedRows: number;
  matchedRows: number;
  unmatchedLocations: string[];
};

export type AirtableInstallationsResult = {
  venues: Venue[];
  events: FestivalEvent[];
  debug: MatchingDebug;
};

function cleanEnv(val?: string): string | undefined {
  if (!val) return undefined;
  let s = val.trim();
  if (s.startsWith('"') && s.endsWith('"')) s = s.slice(1, -1);
  if (s.startsWith("'") && s.endsWith("'")) s = s.slice(1, -1);
  return s;
}

function getConfig(): AirtableConfig | null {
  const token = cleanEnv(process.env.AIRTABLE_TOKEN);
  const baseId = cleanEnv(process.env.AIRTABLE_BASE_ID);
  const tableName = cleanEnv(process.env.AIRTABLE_TABLE_NAME);
  const view = cleanEnv(process.env.AIRTABLE_VIEW);

  if (!token || !baseId || !tableName) {
    return null;
  }

  return { token, baseId, tableName, view };
}

function getString(fields: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = fields[key];
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
    }

    if (Array.isArray(value)) {
      const joined = value
        .map((entry) => {
          if (typeof entry === "string") return entry.trim();
          if (typeof entry === "number") return String(entry);
          if (entry && typeof entry === "object" && "name" in entry) {
            const maybeName = (entry as { name?: unknown }).name;
            if (typeof maybeName === "string") return maybeName.trim();
          }
          return "";
        })
        .filter(Boolean)
        .join(", ")
        .trim();
      if (joined) return joined;
    }
  }
  return "";
}

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

function parseEventTypes(value: string): FestivalEvent["type"][] {
  const normalized = value.trim().toLowerCase();
  const types = new Set<FestivalEvent["type"]>();
  if (normalized.includes("music")) types.add("music");
  if (normalized.includes("performance")) types.add("performance");
  if (normalized.includes("exhibition")) types.add("exhibition");
  if (normalized.includes("installation")) types.add("installation");
  if (normalized.includes("lecture") || normalized.includes("talk")) types.add("lecture");
  if (normalized.includes("object")) types.add("object");
  if (normalized.includes("film")) types.add("film");
  if (normalized.includes("experience") || normalized.includes("facilitated")) types.add("experience");
  if (normalized.includes("social gathering")) types.add("social");
  if (normalized.includes("dj")) types.add("dj");
  if (normalized.includes("venue")) types.add("venue");
  if (normalized.includes("food") || normalized.includes("beverage")) types.add("food");
  if (types.size === 0) types.add("community");
  return [...types];
}

function parseEventType(value: string): FestivalEvent["type"] {
  return parseEventTypes(value)[0];
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
    .split(/\s+/)
    .join(" ")
    .trim();
}

function buildDescription(fields: Record<string, unknown>): string {
  const entries = Object.entries(fields)
    .filter(([key, value]) => {
      if (key.toLowerCase() === "status") return false;
      if (typeof value !== "string") return false;
      return value.trim().length > 0;
    })
    .map(([key, value]) => `${formatColumnName(key)}: ${(value as string).trim()}`);

  return entries.join("\n");
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

      const loc: Location2023 = {
        Name: name,
        Category: maybe.Category,
        Openness: maybe.Openness,
        Lat: lat,
        Long: lng,
      };

      all.push(loc);
      byNormalizedName.set(normalizeText(name), loc);
    }

    return { byNormalizedName, all };
  } catch {
    return null;
  }
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
    const candidate = normalizeText(loc.Name);
    if (!candidate) continue;
    if (candidate.includes(normalized) || normalized.includes(candidate)) {
      return loc;
    }
  }

  return null;
}

export async function fetchAirtableEvents(): Promise<FestivalEvent[] | null> {
  const installations = await fetchAirtableInstallations();
  return installations?.events ?? null;
}

export async function fetchAirtableInstallations(): Promise<AirtableInstallationsResult | null> {
  const config = getConfig();
  if (!config) {
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
  let offset: string | undefined;

  do {
    const params = new URLSearchParams({
      pageSize: "100",
      // Use string cell format so linked-record fields come back as names, not record IDs.
      cellFormat: "string",
      timeZone: "America/Los_Angeles",
      userLocale: "en",
    });
    if (config.view) params.set("view", config.view);
    if (offset) params.set("offset", offset);

    const url = `${AIRTABLE_API_BASE}/${config.baseId}/${encodeURIComponent(config.tableName)}?${params.toString()}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${config.token}`,
      },
      cache: "no-store",
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as AirtableResponse;

    for (const record of payload.records) {
      totalRows += 1;
      const { fields } = record;
      const status = getString(fields, ["Status", "status"]).toLowerCase();

      // Requirement: use only confirmed rows.
      if (status && status !== "confirmed") {
        continue;
      }
      confirmedRows += 1;

      const locationInternal = getString(fields, ["Location (Internal)", "location_internal"]);
      const matched = findMatchingLocation(
        locationInternal,
        locationsBundle.byNormalizedName,
        locationsBundle.all
      );

      // Requirement: include only locations that exist in locations_2023.json.
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
      if (!venuesById.has(venueId)) {
        venuesById.set(venueId, {
          id: venueId,
          name: matched.Name,
          label: matched.Category || "Venue",
          shortDescription: matched.Openness ? `Openness: ${matched.Openness}` : "Matched from 2023 locations",
          description: `Matched from locations_2023.json using Location (Internal): ${locationInternal}`,
          x: 0,
          y: 0,
          lat: matched.Lat,
          lng: matched.Long,
          hasLocation: true,
          thumbnailUrl: "/map-layers/image_BB_map.jpg",
          accent: "#8b5cf6",
        });
      }

      const projectName = getString(fields, ["Project Name", "project_name"]) || `Installation ${record.id}`;
      const artistName = getString(fields, ["Artist Name", "artist_name"]);
      const additionalArtists = getString(fields, ["Additional Artists", "additional_artists"]);
      const schedule = getString(fields, ["Start Time", "start_time", "Schedule", "schedule"]);
      const duration = getString(fields, ["Duration", "duration"]);
      const projectType = getString(fields, ["Project Type", "project_type"]);
      const parsedProjectTypes = parseEventTypes(projectType);
      const permanence = getString(fields, ["Year or Permanent", "year_or_permanent"]);

      events.push({
        id: `event-${record.id}`,
        venueId,
        title: projectName,
        host: [artistName, additionalArtists].filter(Boolean).join(" — ") || "",
        description: buildDescription(fields),
        day: parseDayFromSchedule(schedule),
        startTime: schedule || "TBD",
        endTime: duration || "TBD",
        type: parseEventType(projectType),
        projectTypes: parsedProjectTypes.length > 1 ? parsedProjectTypes : undefined,
        thumbnailUrl: "/map-layers/image_BB_map.jpg",
        lat: matched.Lat,
        lng: matched.Long,
        hasLocation: true,
        permanence,
      });
    }

    offset = payload.offset;
  } while (offset);

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
}
