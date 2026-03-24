import { FestivalDay, FestivalEvent, Venue } from "@/types/festival";
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
  Category?: unknown;
  Lat?: unknown;
  Long?: unknown;
};

type AirtableExportRecord = {
  id?: unknown;
  fields?: Record<string, unknown>;
};

type AirtableExport = {
  records?: AirtableExportRecord[];
};

const LOCATIONS_PATH = path.join(process.cwd(), "new_locations.json");
const LEGACY_LOCATIONS_PATH = path.join(process.cwd(), "locations.json");
const AIRTABLE_DUMP_PATH = path.join(process.cwd(), "tmp_airtable_table.json");

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
  return (
    normalizeText(value).replace(/\s+/g, "-").replace(/^-+|-+$/g, "") || "location"
  );
}

function parseEventType(value: string): FestivalEvent["type"] {
  const normalized = value.toLowerCase();
  if (normalized.includes("music")) return "music";
  if (normalized.includes("performance")) return "performance";
  if (normalized.includes("installation")) return "installation";
  if (normalized.includes("lecture") || normalized.includes("talk")) return "lecture";
  if (normalized.includes("object")) return "object";
  if (normalized.includes("experience") || normalized.includes("facilitated")) return "experience";
  if (normalized.includes("dj")) return "dj";
  if (normalized.includes("venue")) return "venue";
  if (normalized.includes("food")) return "food";
  return "community";
}

function parseDay(rawStart: string): FestivalDay {
  if (!rawStart) return "fri";
  const match = rawStart.match(/^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!match) return "fri";

  const month = Number(match[1]);
  const dayOfMonth = Number(match[2]);
  const year = Number(match[3]);
  if (
    Number.isNaN(month) ||
    Number.isNaN(dayOfMonth) ||
    Number.isNaN(year) ||
    month < 1 ||
    month > 12 ||
    dayOfMonth < 1 ||
    dayOfMonth > 31
  ) {
    return "fri";
  }

  // Use UTC noon to avoid timezone shifts changing the weekday.
  const parsed = new Date(Date.UTC(year, month - 1, dayOfMonth, 12, 0, 0));
  if (Number.isNaN(parsed.getTime())) return "fri";
  const day = parsed.getUTCDay();
  if (day === 5) return "fri";
  if (day === 6) return "sat";
  if (day === 0) return "sun";
  return "fri";
}

function splitLocationInternal(raw: string): string[] {
  return raw
    .split(/[,\n;]/g)
    .map((value) => value.replace(/^"+|"+$/g, "").trim())
    .filter(Boolean);
}

function findMatchingLocation(locationName: string, byNormalizedName: Map<string, LocationRow>, all: LocationRow[]): LocationRow | null {
  const normalized = normalizeText(locationName);
  if (!normalized) return null;
  const exact = byNormalizedName.get(normalized);
  if (exact) return exact;

  for (const loc of all) {
    const candidate = normalizeText(asString(loc.Name));
    if (!candidate) continue;
    if (candidate.includes(normalized) || normalized.includes(candidate)) {
      return loc;
    }
  }

  return null;
}

export async function getFestivalData(): Promise<FestivalDataResult> {
  try {
    const [locationsRaw, legacyLocationsRaw, airtableRaw] = await Promise.all([
      readFile(LOCATIONS_PATH, "utf-8"),
      readFile(LEGACY_LOCATIONS_PATH, "utf-8"),
      readFile(AIRTABLE_DUMP_PATH, "utf-8"),
    ]);

    const parsedLocations = JSON.parse(locationsRaw) as unknown;
    const parsedLegacyLocations = JSON.parse(legacyLocationsRaw) as unknown;
    const parsedAirtable = JSON.parse(airtableRaw) as unknown;

    if (!Array.isArray(parsedLocations)) {
      throw new Error("new_locations.json must be an array");
    }
    if (!Array.isArray(parsedLegacyLocations)) {
      throw new Error("locations.json must be an array");
    }
    if (!parsedAirtable || typeof parsedAirtable !== "object" || !Array.isArray((parsedAirtable as AirtableExport).records)) {
      throw new Error("tmp_airtable_table.json must include records[]");
    }

    const locationRows = parsedLocations as LocationRow[];
    const legacyLocationRows = parsedLegacyLocations as LocationRow[];
    const airtableRecords = (parsedAirtable as AirtableExport).records ?? [];
    const byNormalizedName = new Map<string, LocationRow>();
    const allLocations: LocationRow[] = [];
    const legacyCategoryByName = new Map<string, string>();

    for (const locationRow of locationRows) {
      const name = asString(locationRow.Name);
      const lat = asNumber(locationRow.Lat);
      const lng = asNumber(locationRow.Long);
      if (!name || lat === null || lng === null) {
        continue;
      }
      const normalized = normalizeText(name);
      if (!normalized) continue;
      byNormalizedName.set(normalized, locationRow);
      allLocations.push(locationRow);
    }

    for (const legacyRow of legacyLocationRows) {
      const legacyName = asString(legacyRow.Name);
      const legacyCategory = asString(legacyRow.Category);
      const normalized = normalizeText(legacyName);
      if (!normalized || !legacyCategory) continue;
      legacyCategoryByName.set(normalized, legacyCategory);
    }

    const usedIds = new Set<string>();
    const venueIdByKey = new Map<string, string>();
    const venuesById = new Map<string, Venue>();
    const venues: Venue[] = [];
    const events: FestivalEvent[] = [];
    const unmatchedSet = new Set<string>();
    let rowsWithLocation = 0;
    let rowsMatchedToLocation = 0;

    function ensureVenue(params: {
      key: string;
      name: string;
      lat?: number;
      lng?: number;
      hasLocation: boolean;
      locationInternalRaw: string;
    }): string {
      let venueId = venueIdByKey.get(params.key) ?? "";
      if (!venueId) {
        const baseId = `loc-${slugify(params.name)}`;
        venueId = baseId;
        let suffix = 2;
        while (usedIds.has(venueId)) {
          venueId = `${baseId}-${suffix}`;
          suffix += 1;
        }
        usedIds.add(venueId);
        venueIdByKey.set(params.key, venueId);
      }

      if (!venuesById.has(venueId)) {
        const venue: Venue = {
          id: venueId,
          name: params.name,
          label: params.hasLocation ? "Venue" : "Unmapped location",
          shortDescription: params.hasLocation
            ? "Lookup from new_locations.json"
            : "No coordinates found in new_locations.json",
          description: `Mapped from Location (Internal): ${params.locationInternalRaw || "(empty)"}`,
          x: 0,
          y: 0,
          lat: params.lat,
          lng: params.lng,
          hasLocation: params.hasLocation,
          thumbnailUrl: "/map-layers/image_BB_map.jpg",
          accent: params.hasLocation ? "#8b5cf6" : "#6b7280",
        };
        venuesById.set(venueId, venue);
        venues.push(venue);
      }

      return venueId;
    }

    for (const [index, record] of airtableRecords.entries()) {
      const fields = record.fields ?? {};
      const projectName = asString(fields["Project Name"]) || `Untitled project ${index + 1}`;
      const locationInternalRaw = asString(fields["Location (Internal)"]);
      const locationCandidates = splitLocationInternal(locationInternalRaw);

      if (locationCandidates.length > 0) {
        rowsWithLocation += 1;
      }

      let matchedLocation: LocationRow | null = null;
      for (const candidate of locationCandidates) {
        matchedLocation = findMatchingLocation(candidate, byNormalizedName, allLocations);
        if (matchedLocation) {
          break;
        }
      }

      let venueId: string;
      let lat: number | undefined;
      let lng: number | undefined;
      let hasLocation = false;

      if (matchedLocation) {
        const venueName = asString(matchedLocation.Name);
        const parsedLat = asNumber(matchedLocation.Lat);
        const parsedLng = asNumber(matchedLocation.Long);
        if (venueName && parsedLat !== null && parsedLng !== null) {
          rowsMatchedToLocation += 1;
          hasLocation = true;
          lat = parsedLat;
          lng = parsedLng;
          const venueKey = `mapped:${normalizeText(venueName)}`;
          const legacyCategory = legacyCategoryByName.get(normalizeText(venueName)) || "Venue";
          venueId = ensureVenue({
            key: venueKey,
            name: venueName,
            lat,
            lng,
            hasLocation: true,
            locationInternalRaw,
          });
          const existingVenue = venuesById.get(venueId);
          if (existingVenue) {
            existingVenue.label = legacyCategory;
          }
        } else {
          const fallbackName = locationInternalRaw || "Unassigned location";
          unmatchedSet.add(locationInternalRaw || "(empty Location (Internal))");
          venueId = ensureVenue({
            key: `unmapped:${normalizeText(fallbackName) || "unassigned-location"}`,
            name: fallbackName,
            hasLocation: false,
            locationInternalRaw,
          });
        }
      } else {
        const fallbackName = locationInternalRaw || "Unassigned location";
        unmatchedSet.add(locationInternalRaw || "(empty Location (Internal))");
        venueId = ensureVenue({
          key: `unmapped:${normalizeText(fallbackName) || "unassigned-location"}`,
          name: fallbackName,
          hasLocation: false,
          locationInternalRaw,
        });
      }

      const artistName = asString(fields["Artist Name"]);
      const projectType = asString(fields["Project Type"]);
      const abridgedText = asString(fields["Abridged Project Text"]);
      const projectDescription = asString(fields["Project Description"]);
      const startTime = asString(fields["Start Time"]);
      const duration = asString(fields["Duration"]);
      const permanence = asString(fields["Year or Permanent"]);
      const recordId = typeof record.id === "string" ? record.id : `row-${index}`;

      events.push({
        id: `event-${recordId}`,
        venueId,
        title: projectName,
        host: artistName || "TBD",
        description: abridgedText || projectDescription || "No abridged text provided.",
        day: parseDay(startTime),
        startTime: startTime || "TBD",
        endTime: duration || "TBD",
        type: parseEventType(projectType),
        thumbnailUrl: "/map-layers/image_BB_map.jpg",
        lat,
        lng,
        hasLocation,
        permanence: permanence || undefined,
      });
    }

    // Also expose every coordinate from new_locations.json as a mappable venue.
    // This keeps the map in sync when coordinates are added before Airtable rows reference them.
    for (const locationRow of allLocations) {
      const venueName = asString(locationRow.Name);
      const lat = asNumber(locationRow.Lat);
      const lng = asNumber(locationRow.Long);
      if (!venueName || lat === null || lng === null) {
        continue;
      }

      const normalized = normalizeText(venueName);
      const venueKey = `mapped:${normalized}`;
      const legacyCategory = legacyCategoryByName.get(normalized) || "Venue";
      const venueId = ensureVenue({
        key: venueKey,
        name: venueName,
        lat,
        lng,
        hasLocation: true,
        locationInternalRaw: venueName,
      });
      const existingVenue = venuesById.get(venueId);
      if (existingVenue) {
        existingVenue.label = legacyCategory;
        if (!existingVenue.shortDescription) {
          existingVenue.shortDescription = "Lookup from new_locations.json";
        }
      }
    }

    return {
      venues,
      events,
      sourceLabel: "tmp_airtable_table.json + new_locations.json",
      debug: {
        totalRows: airtableRecords.length,
        confirmedRows: rowsWithLocation,
        matchedRows: rowsMatchedToLocation,
        unmatchedLocations: Array.from(unmatchedSet).sort((a, b) => a.localeCompare(b)),
      },
    };
  } catch {
    // Fail-safe: keep app renderable even if locations file is malformed/unavailable.
  }

  return {
    venues: [],
    events: [],
    sourceLabel: "tmp_airtable_table.json/new_locations.json unavailable",
    debug: {
      totalRows: 0,
      confirmedRows: 0,
      matchedRows: 0,
      unmatchedLocations: [],
    },
  };
}
