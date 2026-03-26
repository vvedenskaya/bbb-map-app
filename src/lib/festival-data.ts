import { FestivalDay, FestivalEvent, Venue } from "@/types/festival";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { readAdminEntries } from "@/lib/admin-entries";

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
  Alias?: unknown;
  Label?: unknown;
  Category?: unknown;
  "Artist Name"?: unknown;
  artist_name?: unknown;
  "Abridged Project Text"?: unknown;
  abridged_project_text?: unknown;
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

type ScheduleMappedEvent = {
  source?: { row?: number; col?: number };
  date?: unknown;
  title?: unknown;
  scheduled_time?: unknown;
  category?: unknown;
  location_hint?: unknown;
  location_match?: {
    location_name?: unknown;
    lat?: unknown;
    long?: unknown;
    confidence?: unknown;
  } | null;
  airtable_match?: {
    airtable_id?: unknown;
    project_name?: unknown;
    project_type?: unknown;
    artist_name?: unknown;
  } | null;
  raw_text?: unknown;
};

type ScheduleMappedPayload = {
  summary?: {
    event_count?: unknown;
    location_match_counts?: { none?: unknown };
    unmatched_location_events?: Array<{ title?: unknown; date?: unknown }>;
  };
  events?: ScheduleMappedEvent[];
};

const LOCATIONS_PATH = path.join(process.cwd(), "locations.json");
const AIRTABLE_DUMP_PATH = path.join(process.cwd(), "tmp_airtable_table.json");
const SCHEDULE_MAPPED_PATH = path.join(process.cwd(), "schedule_events_mapped.json");
const SCHEDULE_START_DATE = "2026-03-25";

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

function asInteger(value: unknown): number | null {
  const parsed = asNumber(value);
  if (parsed === null) return null;
  return Number.isInteger(parsed) ? parsed : null;
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
  return normalizeText(value).replace(/\s+/g, "-").replace(/^-+|-+$/g, "") || "location";
}

function parseEventType(value: string): FestivalEvent["type"] {
  const normalized = value.toLowerCase();
  if (
    normalized.includes("garbage") ||
    normalized.includes("trash") ||
    normalized.includes("water") ||
    normalized.includes("toilet") ||
    normalized.includes("restroom") ||
    normalized.includes("medic") ||
    normalized.includes("medical") ||
    normalized.includes("first aid")
  ) {
    return "services";
  }
  if (normalized.includes("music")) return "music";
  if (normalized.includes("performance")) return "performance";
  if (normalized.includes("installation")) return "installation";
  if (normalized.includes("lecture") || normalized.includes("talk")) return "lecture";
  if (normalized.includes("object")) return "object";
  if (normalized.includes("film")) return "film";
  if (normalized.includes("experience") || normalized.includes("facilitated")) return "experience";
  if (normalized.includes("social gathering")) return "social";
  if (normalized.includes("dj")) return "dj";
  if (normalized.includes("venue")) return "venue";
  if (normalized.includes("food") || normalized.includes("beverage")) return "food";
  return "community";
}

function parseDayFromIsoDate(rawDate: string): FestivalDay {
  const parsed = new Date(`${rawDate}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return "fri";
  const day = parsed.getUTCDay();
  if (day === 0) return "sun";
  if (day === 1) return "mon";
  if (day === 2) return "tue";
  if (day === 3) return "wed";
  if (day === 4) return "thu";
  if (day === 5) return "fri";
  return "sat";
}

function parseDayFromLabel(raw: string): FestivalDay | null {
  const normalized = raw.trim().toLowerCase();
  if (normalized === "sunday") return "sun";
  if (normalized === "monday") return "mon";
  if (normalized === "tuesday") return "tue";
  if (normalized === "wednesday") return "wed";
  if (normalized === "thursday") return "thu";
  if (normalized === "friday") return "fri";
  if (normalized === "saturday") return "sat";
  return null;
}

function dayOfWeek(dateIso: string): FestivalDay | null {
  if (!dateIso) return null;
  const parsed = new Date(`${dateIso}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  const day = parsed.getUTCDay();
  if (day === 0) return "sun";
  if (day === 1) return "mon";
  if (day === 2) return "tue";
  if (day === 3) return "wed";
  if (day === 4) return "thu";
  if (day === 5) return "fri";
  return "sat";
}

function normalizeScheduleDate(rawDate: string, preferredDay: FestivalDay | null): string {
  if (!rawDate || !preferredDay) return rawDate;
  const parsed = new Date(`${rawDate}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return rawDate;
  let guard = 0;
  while (guard < 7) {
    const iso = parsed.toISOString().slice(0, 10);
    const weekday = dayOfWeek(iso);
    if (weekday === preferredDay) return iso;
    parsed.setUTCDate(parsed.getUTCDate() + 1);
    guard += 1;
  }
  return rawDate;
}

function parseScheduleCategoryToType(category: string): FestivalEvent["type"] {
  const normalized = normalizeText(category);
  if (normalized.includes("food") || normalized.includes("meal")) return "food";
  if (normalized.includes("live music") || normalized.includes("after hours")) return "dj";
  if (normalized.includes("film")) return "film";
  if (normalized.includes("gallery") || normalized.includes("activation")) return "installation";
  if (normalized.includes("philosophy")) return "lecture";
  if (normalized.includes("performance")) return "performance";
  if (normalized.includes("experience") || normalized.includes("hang")) return "experience";
  return "community";
}

function extractHostFromScheduleCellText(rawText: string): string {
  const text = asString(rawText);
  if (!text) return "";
  const byMatch = text.match(/\bby\s+([^|]+?)(?=\s+\d{1,2}(?::\d{2})?\s*(?:AM|PM)\b|$)/i);
  if (byMatch?.[1]) return asString(byMatch[1]);
  const hostedMatch = text.match(/\bhosted by\s+([^|]+?)(?=\s+\d{1,2}(?::\d{2})?\s*(?:AM|PM)\b|$)/i);
  if (hostedMatch?.[1]) return asString(hostedMatch[1]);
  return "";
}

function splitTimeRange(raw: string): { startTime: string; endTime: string } {
  const normalized = asString(raw);
  if (!normalized) return { startTime: "TBD", endTime: "TBD" };
  const match = normalized.match(/^(.+?)\s*-\s*(.+)$/);
  if (!match) return { startTime: normalized, endTime: "TBD" };
  let startTime = match[1].trim();
  const endTime = match[2].trim() || "TBD";
  const startHasMeridiem = /\b(?:AM|PM)\b/i.test(startTime);
  const endMeridiem = endTime.match(/\b(AM|PM)\b/i)?.[1]?.toUpperCase();
  if (!startHasMeridiem && endMeridiem && /^\d{1,2}(?::\d{2})?$/i.test(startTime)) {
    startTime = `${startTime} ${endMeridiem}`;
  }
  return {
    startTime,
    endTime,
  };
}

function findMatchingLocation(
  locationName: string,
  byNormalizedName: Map<string, LocationRow>,
  all: LocationRow[]
): LocationRow | null {
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

function getLocationDisplayName(locationRow: LocationRow, fallbackName = ""): string {
  return asString(locationRow.Alias) || asString(locationRow.Name) || fallbackName;
}

function getLocationCanonicalKey(locationRow: LocationRow, fallbackName = ""): string {
  return normalizeText(asString(locationRow.Name) || asString(locationRow.Alias) || fallbackName);
}

function getLocationMapLabel(locationRow: LocationRow): string {
  return asString(locationRow.Label);
}

function getLocationArtist(locationRow: LocationRow): string {
  const direct = asString(locationRow["Artist Name"]) || asString(locationRow.artist_name);
  if (direct) return direct;
  for (const [key, value] of Object.entries(locationRow)) {
    const normalizedKey = normalizeText(key);
    if (normalizedKey === "artist name" || normalizedKey === "artist") {
      const resolved = asString(value);
      if (resolved) return resolved;
    }
  }
  return "";
}

function getLocationAbridgedText(locationRow: LocationRow): string {
  const direct = asString(locationRow["Abridged Project Text"]) || asString(locationRow.abridged_project_text);
  if (direct) return direct;
  for (const [key, value] of Object.entries(locationRow)) {
    const normalizedKey = normalizeText(key);
    if (
      normalizedKey === "abridged project text" ||
      normalizedKey === "abridged project" ||
      normalizedKey === "project text"
    ) {
      const resolved = asString(value);
      if (resolved) return resolved;
    }
  }
  return "";
}

function getAdminVenueLabel(projectType: FestivalEvent["type"]): string {
  if (projectType === "services") return "Services";
  if (projectType === "installation") return "Installation";
  if (projectType === "object") return "Object";
  if (projectType === "experience") return "Facilitated Experience";
  if (projectType === "venue") return "Venue";
  return "Venue";
}

export async function getFestivalData(): Promise<FestivalDataResult> {
  try {
    const [locationsRaw, airtableRaw, mappedScheduleRaw] = await Promise.all([
      readFile(LOCATIONS_PATH, "utf-8"),
      readFile(AIRTABLE_DUMP_PATH, "utf-8"),
      readFile(SCHEDULE_MAPPED_PATH, "utf-8"),
    ]);

    const parsedLocations = JSON.parse(locationsRaw) as unknown;
    const parsedAirtable = JSON.parse(airtableRaw) as unknown;
    const parsedSchedule = JSON.parse(mappedScheduleRaw) as unknown;

    if (!Array.isArray(parsedLocations)) {
      throw new Error("locations.json must be an array");
    }
    if (!parsedAirtable || typeof parsedAirtable !== "object" || !Array.isArray((parsedAirtable as AirtableExport).records)) {
      throw new Error("tmp_airtable_table.json must include records[]");
    }
    if (!parsedSchedule || typeof parsedSchedule !== "object" || !Array.isArray((parsedSchedule as ScheduleMappedPayload).events)) {
      throw new Error("schedule_events_mapped.json must include events[]");
    }

    const locationRows = parsedLocations as LocationRow[];
    const airtableRecords = (parsedAirtable as AirtableExport).records ?? [];
    const mappedEvents = (parsedSchedule as ScheduleMappedPayload).events ?? [];
    const mappedSummary = (parsedSchedule as ScheduleMappedPayload).summary;
    const byNormalizedName = new Map<string, LocationRow>();
    const allLocations: LocationRow[] = [];
    const byAirtableId = new Map<string, AirtableExportRecord>();
    const airtableProjectNames = new Set<string>();

    for (const row of airtableRecords) {
      if (typeof row.id === "string" && row.id) {
        byAirtableId.set(row.id, row);
      }
      const fields = row.fields ?? {};
      const projectName = asString(fields["Project Name"]) || asString(fields.project_name);
      if (projectName) {
        airtableProjectNames.add(normalizeText(projectName));
      }
    }

    for (const locationRow of locationRows) {
      const name = asString(locationRow.Name);
      const lat = asNumber(locationRow.Lat);
      const lng = asNumber(locationRow.Long);
      if (!name || lat === null || lng === null) continue;
      byNormalizedName.set(normalizeText(name), locationRow);
      const alias = asString(locationRow.Alias);
      if (alias) byNormalizedName.set(normalizeText(alias), locationRow);
      allLocations.push(locationRow);
    }

    const usedIds = new Set<string>();
    const venueIdByKey = new Map<string, string>();
    const venuesById = new Map<string, Venue>();
    const venues: Venue[] = [];
    const events: FestivalEvent[] = [];
    const seenScheduleEventKeys = new Set<string>();

    function ensureVenue(params: {
      key: string;
      name: string;
      lat?: number;
      lng?: number;
      hasLocation: boolean;
      categoryLabel?: string;
      mapLabel?: string;
      descriptionSource?: string;
      serviceType?: Venue["serviceType"];
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
        venuesById.set(venueId, {
          id: venueId,
          name: params.name,
          label: params.categoryLabel || "Venue",
          mapLabel: params.mapLabel,
          shortDescription: params.hasLocation
            ? "Lookup from locations.json"
            : "No coordinates found in locations.json",
          description: params.descriptionSource || "Mapped from schedule_events_mapped.json",
          x: 0,
          y: 0,
          lat: params.lat,
          lng: params.lng,
          hasLocation: params.hasLocation,
          serviceType: params.serviceType,
          thumbnailUrl: "/map-layers/image_BB_map.jpg",
          accent: params.hasLocation ? "#8b5cf6" : "#6b7280",
        });
        venues.push(venuesById.get(venueId)!);
      } else if (params.mapLabel) {
        const existingVenue = venuesById.get(venueId);
        if (existingVenue) {
          existingVenue.mapLabel = params.mapLabel;
        }
      }

      return venueId;
    }

    // Seed all known locations as mappable venues.
    for (const locationRow of allLocations) {
      const venueName = getLocationDisplayName(locationRow);
      const lat = asNumber(locationRow.Lat);
      const lng = asNumber(locationRow.Long);
      if (!venueName || lat === null || lng === null) continue;
      const category = asString(locationRow.Category) || "Venue";
      const locationArtist = getLocationArtist(locationRow);
      const locationAbridgedText = getLocationAbridgedText(locationRow);
      ensureVenue({
        key: `mapped:${getLocationCanonicalKey(locationRow, venueName)}`,
        name: venueName,
        lat,
        lng,
        hasLocation: true,
        categoryLabel: category,
        mapLabel: getLocationMapLabel(locationRow),
        descriptionSource: locationAbridgedText || `Mapped from locations.json (${venueName})`,
      });
      const seededVenue = venuesById.get(venueIdByKey.get(`mapped:${getLocationCanonicalKey(locationRow, venueName)}`) ?? "");
      if (seededVenue && locationArtist) {
        seededVenue.shortDescription = `By ${locationArtist}`;
      }
    }

    // Primary schedule source from prepared spreadsheet mapping.
    for (const mapped of mappedEvents) {
      const title = asString(mapped.title) || "Untitled schedule event";
      const scheduleDateRaw = asString(mapped.date);
      const dayFromLabel = parseDayFromLabel(asString((mapped as { day?: unknown }).day));
      const scheduleDate = normalizeScheduleDate(scheduleDateRaw, dayFromLabel);
      if (scheduleDate && scheduleDate < SCHEDULE_START_DATE) {
        continue;
      }
      const scheduleCategory = asString(mapped.category);
      const locationName = asString(mapped.location_match?.location_name);
      const locationHint = asString(mapped.location_hint);
      const scheduleTime = asString(mapped.scheduled_time);
      const rawText = asString(mapped.raw_text);
      const airtableMatch = mapped.airtable_match;
      const airtableId = asString(airtableMatch?.airtable_id);
      const row = asInteger(mapped.source?.row);
      const col = asInteger(mapped.source?.col);
      const sourceId = row !== null && col !== null ? `${row}-${col}` : slugify(`${scheduleDate}-${title}`);

      const matchedAirtableRecord = airtableId ? byAirtableId.get(airtableId) : undefined;
      const matchedAirtableFields = matchedAirtableRecord?.fields ?? {};
      const hostFromAirtable = asString(matchedAirtableFields["Artist Name"]) || asString(airtableMatch?.artist_name);
      const hostFromScheduleCell = extractHostFromScheduleCellText(rawText);
      const typeFromAirtable = asString(matchedAirtableFields["Project Type"]) || asString(airtableMatch?.project_type);
      const abridgedFromAirtable = asString(matchedAirtableFields["Abridged Project Text"]);
      const projectDescriptionFromAirtable = asString(matchedAirtableFields["Project Description"]);

      let venueId = "";
      let eventLat: number | undefined;
      let eventLng: number | undefined;
      let hasLocation = false;

      if (locationName) {
        const matchedLocation = findMatchingLocation(locationName, byNormalizedName, allLocations);
        const hostFromLocation = matchedLocation ? getLocationArtist(matchedLocation) : "";
        const abridgedFromLocation = matchedLocation ? getLocationAbridgedText(matchedLocation) : "";
        const resolvedLocationName = matchedLocation ? getLocationDisplayName(matchedLocation, locationName) : locationName;
        const venueLocationKey = matchedLocation
          ? getLocationCanonicalKey(matchedLocation, locationName)
          : normalizeText(locationName);
        const locationSource = matchedLocation || mapped.location_match;
        const lat = asNumber((locationSource as { Lat?: unknown; lat?: unknown }).Lat ?? (locationSource as { lat?: unknown }).lat);
        const lng = asNumber((locationSource as { Long?: unknown; long?: unknown }).Long ?? (locationSource as { long?: unknown }).long);
        if (lat !== null && lng !== null) {
          hasLocation = true;
          eventLat = lat;
          eventLng = lng;
        }
        const category = matchedLocation ? asString(matchedLocation.Category) || "Venue" : "Venue";
        venueId = ensureVenue({
          key: `mapped:${venueLocationKey}`,
          name: resolvedLocationName,
          lat: eventLat,
          lng: eventLng,
          hasLocation,
          categoryLabel: category,
          mapLabel: matchedLocation ? getLocationMapLabel(matchedLocation) : undefined,
          descriptionSource: abridgedFromLocation || `Mapped from schedule: ${resolvedLocationName}`,
        });
        const matchedVenue = venuesById.get(venueId);
        if (matchedVenue && hostFromLocation && !matchedVenue.shortDescription.startsWith("By ")) {
          matchedVenue.shortDescription = `By ${hostFromLocation}`;
        }
        const { startTime, endTime } = splitTimeRange(scheduleTime);
        const day = dayFromLabel ?? (scheduleDate ? parseDayFromIsoDate(scheduleDate) : "fri");
        const dedupeKey = [
          scheduleDate || "unknown-date",
          day,
          normalizeText(title),
          normalizeText(startTime),
          normalizeText(endTime),
          venueId,
        ].join("|");
        if (seenScheduleEventKeys.has(dedupeKey)) {
          continue;
        }
        seenScheduleEventKeys.add(dedupeKey);

        events.push({
          id: `schedule-${sourceId}`,
          venueId,
          title,
          host: hostFromAirtable || hostFromLocation || hostFromScheduleCell || "TBD",
          // Prefer Airtable abridged text; then locations.json abridged text; then preserve XLSX cell text.
          description: abridgedFromAirtable || abridgedFromLocation || rawText || projectDescriptionFromAirtable || "No abridged text provided.",
          day,
          startTime,
          endTime,
          type: typeFromAirtable
            ? parseEventType(typeFromAirtable)
            : parseScheduleCategoryToType(scheduleCategory),
          thumbnailUrl: "/map-layers/image_BB_map.jpg",
          lat: eventLat,
          lng: eventLng,
          hasLocation,
          source: "schedule",
          scheduleDate: scheduleDate || undefined,
          scheduleCategory: scheduleCategory || undefined,
          airtableRecordId: airtableId || undefined,
          airtableProjectName: asString(airtableMatch?.project_name) || undefined,
        });
        continue;
      } else {
        const fallbackName = locationHint || "Location TBD";
        venueId = ensureVenue({
          key: `unmapped:${normalizeText(fallbackName) || sourceId}`,
          name: fallbackName,
          hasLocation: false,
          categoryLabel: "Unmapped location",
          descriptionSource: `No location match from schedule for "${title}"`,
        });
      }

      const { startTime, endTime } = splitTimeRange(scheduleTime);
      const day = dayFromLabel ?? (scheduleDate ? parseDayFromIsoDate(scheduleDate) : "fri");
      const dedupeKey = [
        scheduleDate || "unknown-date",
        day,
        normalizeText(title),
        normalizeText(startTime),
        normalizeText(endTime),
        venueId,
      ].join("|");
      if (seenScheduleEventKeys.has(dedupeKey)) {
        continue;
      }
      seenScheduleEventKeys.add(dedupeKey);

      events.push({
        id: `schedule-${sourceId}`,
        venueId,
        title,
        host: hostFromAirtable || hostFromScheduleCell || "TBD",
        // Prefer Airtable abridged text; otherwise preserve XLSX cell text before long project descriptions.
        description: abridgedFromAirtable || rawText || projectDescriptionFromAirtable || "No abridged text provided.",
        day,
        startTime,
        endTime,
        type: typeFromAirtable
          ? parseEventType(typeFromAirtable)
          : parseScheduleCategoryToType(scheduleCategory),
        thumbnailUrl: "/map-layers/image_BB_map.jpg",
        lat: eventLat,
        lng: eventLng,
        hasLocation,
        source: "schedule",
        scheduleDate: scheduleDate || undefined,
        scheduleCategory: scheduleCategory || undefined,
        airtableRecordId: airtableId || undefined,
        airtableProjectName: asString(airtableMatch?.project_name) || undefined,
      });
    }

    const adminEntries = await readAdminEntries();
    for (const entry of adminEntries) {
      const matchedAdminLocation = entry.locationInternal
        ? findMatchingLocation(entry.locationInternal, byNormalizedName, allLocations)
        : null;
      const matchedAdminLat = matchedAdminLocation ? asNumber(matchedAdminLocation.Lat) : null;
      const matchedAdminLng = matchedAdminLocation ? asNumber(matchedAdminLocation.Long) : null;
      const hasMappedAdminLocation = matchedAdminLat !== null && matchedAdminLng !== null;
      const resolvedLat = hasMappedAdminLocation ? matchedAdminLat ?? undefined : entry.lat;
      const resolvedLng = hasMappedAdminLocation ? matchedAdminLng ?? undefined : entry.lng;
      const resolvedHasLocation = hasMappedAdminLocation || entry.hasLocation;
      const venueKey = `admin:${normalizeText(entry.name)}:${entry.id}`;
      const venueId = ensureVenue({
        key: venueKey,
        name: entry.name,
        lat: resolvedLat,
        lng: resolvedLng,
        hasLocation: resolvedHasLocation,
        categoryLabel: entry.projectType === "services" ? "Services" : "Venue",
        descriptionSource: entry.abridgedProjectText || "Manually added from admin dashboard",
        serviceType: entry.serviceType,
      });

      const existingVenue = venuesById.get(venueId);
      if (existingVenue) {
        existingVenue.label = getAdminVenueLabel(entry.projectType);
        existingVenue.shortDescription = entry.artist ? `By ${entry.artist}` : "Manually added from admin dashboard";
        existingVenue.description = entry.abridgedProjectText || "No abridged text provided.";
        existingVenue.permanence = entry.permanence || undefined;
        existingVenue.hasLocation = resolvedHasLocation;
        existingVenue.lat = resolvedLat;
        existingVenue.lng = resolvedLng;
        existingVenue.serviceType = entry.serviceType;
      }

      if (!entry.hasSchedule) continue;
      events.push({
        id: `event-${entry.id}`,
        venueId,
        title: entry.name,
        host: entry.artist || "TBD",
        description: entry.abridgedProjectText || "No abridged text provided.",
        day: entry.day,
        startTime: entry.startTime || "TBD",
        endTime: entry.endTime || "TBD",
        type: entry.projectType,
        thumbnailUrl: "/map-layers/image_BB_map.jpg",
        lat: entry.lat,
        lng: entry.lng,
        hasLocation: entry.hasLocation,
        permanence: entry.permanence || undefined,
        serviceType: entry.serviceType,
        source: "admin",
      });
    }

    // Treat locations.json-only art installations as listing events when they have no Airtable entry.
    const existingEventKeys = new Set(events.map((event) => `${event.venueId}|${normalizeText(event.title)}`));
    for (const locationRow of allLocations) {
      const category = asString(locationRow.Category);
      if (!normalizeText(category).includes("art installation")) continue;

      const canonicalName = asString(locationRow.Name);
      const displayName = getLocationDisplayName(locationRow, canonicalName);
      if (!displayName) continue;

      const canonicalKey = getLocationCanonicalKey(locationRow, displayName);
      if (!canonicalKey) continue;

      const hasAirtableProjectMatch =
        (canonicalName && airtableProjectNames.has(normalizeText(canonicalName))) ||
        airtableProjectNames.has(normalizeText(displayName));
      if (hasAirtableProjectMatch) continue;

      const venueId = venueIdByKey.get(`mapped:${canonicalKey}`);
      if (!venueId) continue;

      const title = canonicalName || displayName;
      const dedupeCandidates = [
        `${venueId}|${normalizeText(title)}`,
        `${venueId}|${normalizeText(displayName)}`,
      ];
      if (dedupeCandidates.some((candidate) => existingEventKeys.has(candidate))) {
        continue;
      }

      const host = getLocationArtist(locationRow) || "TBD";
      const description = getLocationAbridgedText(locationRow) || "No abridged text provided.";
      const existingVenue = venuesById.get(venueId);
      if (existingVenue) {
        existingVenue.shortDescription = host !== "TBD" ? `By ${host}` : existingVenue.shortDescription;
        existingVenue.description = description;
      }

      events.push({
        id: `locations-only-${slugify(canonicalKey)}`,
        venueId,
        title,
        host,
        description,
        day: "fri",
        startTime: "TBD",
        endTime: "TBD",
        type: parseEventType(category || "installation"),
        thumbnailUrl: "/map-layers/image_BB_map.jpg",
        lat: asNumber(locationRow.Lat) ?? undefined,
        lng: asNumber(locationRow.Long) ?? undefined,
        hasLocation: true,
        source: "airtable",
        airtableProjectName: title,
      });
      dedupeCandidates.forEach((candidate) => existingEventKeys.add(candidate));
    }

    const unmatchedLocationEvents = (mappedSummary?.unmatched_location_events ?? [])
      .map((item) => {
        const title = asString(item.title);
        const date = asString(item.date);
        if (!title) return "";
        return date ? `${date}: ${title}` : title;
      })
      .filter(Boolean);

    const totalRows = asInteger(mappedSummary?.event_count) ?? events.length;
    const locationNoneCount = asInteger(mappedSummary?.location_match_counts?.none) ?? unmatchedLocationEvents.length;

    return {
      venues,
      events,
      sourceLabel: "schedule_events_mapped.json + locations.json + tmp_airtable_table.json + admin_entries.json",
      debug: {
        totalRows,
        confirmedRows: totalRows,
        matchedRows: Math.max(totalRows - locationNoneCount, 0),
        unmatchedLocations: unmatchedLocationEvents,
      },
    };
  } catch {
    // Fail-safe: keep app renderable even if source files are malformed/unavailable.
  }

  return {
    venues: [],
    events: [],
    sourceLabel: "schedule_events_mapped.json/locations.json/tmp_airtable_table.json unavailable",
    debug: {
      totalRows: 0,
      confirmedRows: 0,
      matchedRows: 0,
      unmatchedLocations: [],
    },
  };
}
