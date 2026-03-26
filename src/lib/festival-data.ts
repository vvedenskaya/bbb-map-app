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

type RealScheduleEvent = {
  name?: unknown;
  start_time?: unknown;
  end_time?: unknown;
  location?: unknown;
  location_candidate?: unknown;
  description?: unknown;
  category?: unknown;
  day?: unknown;
};

const LOCATIONS_PATH = path.join(process.cwd(), "locations.json");
const AIRTABLE_DUMP_PATH = path.join(process.cwd(), "tmp_airtable_table.json");
const REAL_SCHEDULE_PATH = path.join(process.cwd(), "the_real_schedule_events.json");
const SCHEDULE_START_DATE = "2026-03-25";
const FESTIVAL_DAY_TO_ISO: Record<FestivalDay, string> = {
  wed: "2026-03-25",
  thu: "2026-03-26",
  fri: "2026-03-27",
  sat: "2026-03-28",
  sun: "2026-03-29",
  mon: "2026-03-30",
  tue: "2026-03-31",
};

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((entry) => asString(entry))
      .filter(Boolean);
  }

  const single = asString(value);
  if (!single) return [];
  if (!/[|;,\n]/.test(single)) return [single];

  return single
    .split(/\s*(?:\||;|,|\n)\s*/)
    .map((entry) => entry.trim())
    .filter(Boolean);
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
  return normalizeText(value).replace(/\s+/g, "-").replace(/^-+|-+$/g, "") || "location";
}

function parseEventTypes(value: string): FestivalEvent["type"][] {
  const normalized = value.toLowerCase();
  const types = new Set<FestivalEvent["type"]>();
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
    types.add("services");
  }
  if (normalized.includes("music")) types.add("music");
  if (normalized.includes("performance")) types.add("performance");
  if (normalized.includes("exhibition")) types.add("exhibition");
  if (normalized.includes("installation") || normalized.includes("gallery") || normalized.includes("activation")) {
    types.add("installation");
  }
  if (normalized.includes("lecture") || normalized.includes("talk") || normalized.includes("philosophy")) {
    types.add("lecture");
  }
  if (normalized.includes("object")) types.add("object");
  if (normalized.includes("film")) types.add("film");
  if (normalized.includes("experience") || normalized.includes("facilitated") || normalized.includes("hang")) {
    types.add("experience");
  }
  if (normalized.includes("social gathering")) {
    types.add("social");
  }
  if (normalized.includes("after hours") || normalized.includes("dj") || normalized.includes("live music")) {
    types.add("dj");
  }
  if (normalized.includes("venue")) types.add("venue");
  if (normalized.includes("food") || normalized.includes("beverage") || normalized.includes("meal")) {
    types.add("food");
  }
  if (normalized.includes("community")) types.add("community");
  if (types.size === 0) types.add("community");
  return [...types];
}

function parseEventType(value: string): FestivalEvent["type"] {
  return parseEventTypes(value)[0];
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

function getScheduleDateFromDay(day: FestivalDay | null): string {
  if (!day) return "";
  return FESTIVAL_DAY_TO_ISO[day] || "";
}

function parseAirtableDateTime(raw: string): Date | null {
  const value = asString(raw);
  if (!value) return null;
  const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
  if (!match) return null;

  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);
  let hour = Number(match[4]);
  const minute = Number(match[5] ?? "0");
  const meridiem = match[6].toLowerCase();
  if ([month, day, year, hour, minute].some((part) => Number.isNaN(part))) return null;
  if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return null;

  if (hour === 12) hour = 0;
  if (meridiem === "pm") hour += 12;
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

function parseDurationMinutes(raw: string): number | null {
  const value = asString(raw);
  if (!value) return null;
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (Number.isNaN(hours) || Number.isNaN(minutes) || minutes > 59) return null;
  return hours * 60 + minutes;
}

function formatClockLabel(date: Date): string {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const suffix = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 === 0 ? 12 : hours % 12;
  return minutes === 0 ? `${displayHour} ${suffix}` : `${displayHour}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

function buildAirtableTimeLabel(startRaw: string, endRaw: string, durationRaw: string): string {
  const start = parseAirtableDateTime(startRaw);
  if (!start) return "";
  let end = parseAirtableDateTime(endRaw);
  if (!end) {
    const durationMinutes = parseDurationMinutes(durationRaw);
    if (durationMinutes && durationMinutes > 0) {
      end = new Date(start.getTime() + durationMinutes * 60_000);
    }
  }

  const weekday = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][start.getDay()];
  const startLabel = formatClockLabel(start);
  const endLabel = end ? formatClockLabel(end) : "";
  return endLabel ? `${weekday} | ${startLabel} - ${endLabel}` : `${weekday} | ${startLabel}`;
}

function extractHostFromScheduleCellText(rawText: string): string {
  const text = asString(rawText);
  if (!text) return "";

  // Ignore invisible joiner/zero-width chars that often appear in copied schedule text.
  const normalized = text.replace(/[\u200B-\u200D\u2060\uFEFF]/g, "").trim();
  if (!normalized) return "";

  // Only treat leading "by ..." / "hosted by ..." as host metadata.
  // This avoids capturing normal prose such as "... collected by a musician ...".
  const leadingHostMatch = normalized.match(
    /^(?:by|hosted by)\s+(.+?)(?=(?:\n|["“”]|[|]|\s+\d{1,2}(?::\d{2})?\s*(?:AM|PM)\b|$))/i
  );
  if (leadingHostMatch?.[1]) return asString(leadingHostMatch[1]);

  return "";
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
  const aliases = asStringList(locationRow.Alias);
  // Use canonical Name for UI display; aliases are for matching only.
  return asString(locationRow.Name) || aliases[0] || fallbackName;
}

function getLocationCanonicalKey(locationRow: LocationRow, fallbackName = ""): string {
  const aliases = asStringList(locationRow.Alias);
  return normalizeText(asString(locationRow.Name) || aliases[0] || fallbackName);
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
  if (projectType === "exhibition") return "Exhibition";
  if (projectType === "object") return "Object";
  if (projectType === "experience") return "Facilitated Experience";
  if (projectType === "venue") return "Venue";
  return "Venue";
}

export async function getFestivalData(): Promise<FestivalDataResult> {
  try {
    const [locationsRaw, airtableRaw, realScheduleRaw] = await Promise.all([
      readFile(LOCATIONS_PATH, "utf-8"),
      readFile(AIRTABLE_DUMP_PATH, "utf-8"),
      readFile(REAL_SCHEDULE_PATH, "utf-8"),
    ]);

    const parsedLocations = JSON.parse(locationsRaw) as unknown;
    const parsedAirtable = JSON.parse(airtableRaw) as unknown;
    const parsedSchedule = JSON.parse(realScheduleRaw) as unknown;

    if (!Array.isArray(parsedLocations)) {
      throw new Error("locations.json must be an array");
    }
    if (!parsedAirtable || typeof parsedAirtable !== "object" || !Array.isArray((parsedAirtable as AirtableExport).records)) {
      throw new Error("tmp_airtable_table.json must include records[]");
    }
    if (!Array.isArray(parsedSchedule)) {
      throw new Error("the_real_schedule_events.json must be an array");
    }

    const locationRows = parsedLocations as LocationRow[];
    const airtableRecords = (parsedAirtable as AirtableExport).records ?? [];
    const mappedEvents = parsedSchedule as RealScheduleEvent[];
    const byNormalizedName = new Map<string, LocationRow>();
    const allLocations: LocationRow[] = [];
    const byAirtableProjectName = new Map<string, AirtableExportRecord>();
    const airtableProjectNames = new Set<string>();

    for (const row of airtableRecords) {
      const fields = row.fields ?? {};
      const projectName = asString(fields["Project Name"]) || asString(fields.project_name);
      if (projectName) {
        const normalizedProjectName = normalizeText(projectName);
        airtableProjectNames.add(normalizedProjectName);
        if (!byAirtableProjectName.has(normalizedProjectName)) {
          byAirtableProjectName.set(normalizedProjectName, row);
        }
      }
    }

    for (const locationRow of locationRows) {
      const name = asString(locationRow.Name);
      const lat = asNumber(locationRow.Lat);
      const lng = asNumber(locationRow.Long);
      if (!name || lat === null || lng === null) continue;
      byNormalizedName.set(normalizeText(name), locationRow);
      const aliases = asStringList(locationRow.Alias);
      for (const alias of aliases) {
        byNormalizedName.set(normalizeText(alias), locationRow);
      }
      allLocations.push(locationRow);
    }

    const getAirtableRecordByProjectNames = (names: string[]): AirtableExportRecord | null => {
      for (const name of names) {
        const normalized = normalizeText(name);
        if (!normalized) continue;
        const match = byAirtableProjectName.get(normalized);
        if (match) return match;
      }
      return null;
    };

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
          description: params.descriptionSource || "Mapped from the_real_schedule_events.json",
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
      const locationNamesForAirtableMatch = [asString(locationRow.Name), venueName, ...asStringList(locationRow.Alias)];
      const matchedLocationAirtableRecord = getAirtableRecordByProjectNames(locationNamesForAirtableMatch);
      const matchedLocationAirtableFields = matchedLocationAirtableRecord?.fields ?? {};
      const airtableArtist = asString(matchedLocationAirtableFields["Artist Name"]);
      const airtableAbridgedText = asString(matchedLocationAirtableFields["Abridged Project Text"]);
      ensureVenue({
        key: `mapped:${getLocationCanonicalKey(locationRow, venueName)}`,
        name: venueName,
        lat,
        lng,
        hasLocation: true,
        categoryLabel: category,
        mapLabel: getLocationMapLabel(locationRow),
        descriptionSource: airtableAbridgedText || locationAbridgedText || `Mapped from locations.json (${venueName})`,
      });
      const seededVenue = venuesById.get(venueIdByKey.get(`mapped:${getLocationCanonicalKey(locationRow, venueName)}`) ?? "");
      if (seededVenue) {
        const preferredArtist = airtableArtist || locationArtist;
        if (preferredArtist) {
          seededVenue.shortDescription = `By ${preferredArtist}`;
        }
        if (airtableAbridgedText) {
          seededVenue.description = airtableAbridgedText;
        }
      }
    }

    // Primary schedule source from the_real_schedule_events.json.
    const unmatchedLocationEvents: string[] = [];
    for (let idx = 0; idx < mappedEvents.length; idx += 1) {
      const mapped = mappedEvents[idx];
      const title = asString(mapped.name) || "Untitled schedule event";
      const dayFromLabel = parseDayFromLabel(asString(mapped.day));
      const scheduleDate = getScheduleDateFromDay(dayFromLabel);
      if (scheduleDate && scheduleDate < SCHEDULE_START_DATE) {
        continue;
      }
      const scheduleCategory = asString(mapped.category);
      const locationName = asString(mapped.location);
      const locationHint = asString(mapped.location_candidate);
      const rawText = asString(mapped.description);
      const startTimeRaw = asString(mapped.start_time);
      const endTimeRaw = asString(mapped.end_time);
      const sourceId = slugify(`${scheduleDate || "unknown-date"}-${title}-${idx}`);

      const matchedAirtableRecord = byAirtableProjectName.get(normalizeText(title));
      const matchedAirtableFields = matchedAirtableRecord?.fields ?? {};
      const hostFromAirtable = asString(matchedAirtableFields["Artist Name"]);
      const hostFromScheduleCell = extractHostFromScheduleCellText(rawText);
      const typeFromAirtable = asString(matchedAirtableFields["Project Type"]);
      const parsedAirtableTypes = typeFromAirtable ? parseEventTypes(typeFromAirtable) : [];
      const parsedScheduleCategoryTypes = scheduleCategory ? parseEventTypes(scheduleCategory) : [];
      // Prefer schedule categories for chips; keep Airtable-derived types as secondary enrichments.
      const resolvedProjectTypes = parsedScheduleCategoryTypes.length > 0
        ? [...new Set([...parsedScheduleCategoryTypes, ...parsedAirtableTypes])]
        : parsedAirtableTypes;
      const abridgedFromAirtable = asString(matchedAirtableFields["Abridged Project Text"]);
      const projectDescriptionFromAirtable = asString(matchedAirtableFields["Project Description"]);

      let venueId = "";
      let eventLat: number | undefined;
      let eventLng: number | undefined;
      let hasLocation = false;

      if (locationName) {
        const matchedLocation = findMatchingLocation(locationName, byNormalizedName, allLocations);
        if (!matchedLocation) {
          unmatchedLocationEvents.push(`${asString(mapped.day) || "Unknown day"}: ${title} (${locationName})`);
        }
        const hostFromLocation = matchedLocation ? getLocationArtist(matchedLocation) : "";
        const abridgedFromLocation = matchedLocation ? getLocationAbridgedText(matchedLocation) : "";
        const resolvedLocationName = matchedLocation ? getLocationDisplayName(matchedLocation, locationName) : locationName;
        const venueLocationKey = matchedLocation
          ? getLocationCanonicalKey(matchedLocation, locationName)
          : normalizeText(locationName);
        const locationSource = matchedLocation;
        const lat = asNumber((locationSource as { Lat?: unknown })?.Lat);
        const lng = asNumber((locationSource as { Long?: unknown })?.Long);
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
        const startTime = startTimeRaw || "TBD";
        const endTime = endTimeRaw || "TBD";
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
          host: hostFromAirtable || hostFromLocation || hostFromScheduleCell || "",
          // Prefer schedule text when present; otherwise fall back to Airtable/location summaries.
          description: rawText || abridgedFromAirtable || abridgedFromLocation || projectDescriptionFromAirtable || "",
          day,
          startTime,
          endTime,
          type: resolvedProjectTypes[0] ?? "community",
          projectTypes: resolvedProjectTypes.length > 1 ? resolvedProjectTypes : undefined,
          thumbnailUrl: "/map-layers/image_BB_map.jpg",
          lat: eventLat,
          lng: eventLng,
          hasLocation,
          source: "schedule",
          scheduleDate: scheduleDate || undefined,
          scheduleCategory: scheduleCategory || undefined,
          airtableRecordId: undefined,
          airtableProjectName: undefined,
        });
        continue;
      } else {
        const fallbackName = locationHint || "Location TBD";
        if (!locationName) {
          unmatchedLocationEvents.push(`${asString(mapped.day) || "Unknown day"}: ${title}`);
        }
        venueId = ensureVenue({
          key: `unmapped:${normalizeText(fallbackName) || sourceId}`,
          name: fallbackName,
          hasLocation: false,
          categoryLabel: "Unmapped location",
          descriptionSource: `No location match from schedule for "${title}"`,
        });
      }

      const startTime = startTimeRaw || "TBD";
      const endTime = endTimeRaw || "TBD";
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
        host: hostFromAirtable || hostFromScheduleCell || "",
        // Prefer schedule text when present; otherwise fall back to Airtable summaries.
        description: rawText || abridgedFromAirtable || projectDescriptionFromAirtable || "",
        day,
        startTime,
        endTime,
        type: resolvedProjectTypes[0] ?? "community",
        projectTypes: resolvedProjectTypes.length > 1 ? resolvedProjectTypes : undefined,
        thumbnailUrl: "/map-layers/image_BB_map.jpg",
        lat: eventLat,
        lng: eventLng,
        hasLocation,
        source: "schedule",
        scheduleDate: scheduleDate || undefined,
        scheduleCategory: scheduleCategory || undefined,
        airtableRecordId: undefined,
        airtableProjectName: undefined,
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
        existingVenue.description = entry.abridgedProjectText || "";
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
        host: entry.artist || "",
        description: entry.abridgedProjectText || "",
        day: entry.day,
        startTime: entry.startTime || "TBD",
        endTime: entry.endTime || "TBD",
        type: entry.projectType,
        projectTypes: entry.projectTypes && entry.projectTypes.length > 1 ? entry.projectTypes : undefined,
        thumbnailUrl: "/map-layers/image_BB_map.jpg",
        lat: entry.lat,
        lng: entry.lng,
        hasLocation: entry.hasLocation,
        permanence: entry.permanence || undefined,
        serviceType: entry.serviceType,
        source: "admin",
      });
    }

    // Prevent duplicate listings when synthesizing events from multiple data sources.
    const existingEventKeys = new Set(events.map((event) => `${event.venueId}|${normalizeText(event.title)}`));

    // Fallback: include confirmed Airtable venue items even when they are not on schedule.
    for (const record of airtableRecords) {
      const fields = record.fields ?? {};
      const projectName = asString(fields["Project Name"]) || asString(fields.project_name);
      if (!projectName) continue;

      const projectType = asString(fields["Project Type"]) || asString(fields.project_type);
      const parsedProjectTypes = parseEventTypes(projectType || "community");

      const status = asString(fields.Status).toLowerCase();
      if (status && status !== "confirmed") continue;

      const locationInternal = asString(fields["Location (Internal)"]) || asString(fields.location_internal);
      if (!locationInternal) continue;

      const matchedLocation = findMatchingLocation(locationInternal, byNormalizedName, allLocations);
      if (!matchedLocation) continue;

      const resolvedLocationName = getLocationDisplayName(matchedLocation, locationInternal);
      const venueLocationKey = getLocationCanonicalKey(matchedLocation, locationInternal);
      const lat = asNumber((matchedLocation as { Lat?: unknown }).Lat);
      const lng = asNumber((matchedLocation as { Long?: unknown }).Long);
      const hasLocation = lat !== null && lng !== null;
      const venueId = ensureVenue({
        key: `mapped:${venueLocationKey}`,
        name: resolvedLocationName,
        lat: lat ?? undefined,
        lng: lng ?? undefined,
        hasLocation,
        categoryLabel: asString(matchedLocation.Category) || "Venue",
        mapLabel: getLocationMapLabel(matchedLocation),
        descriptionSource: asString(fields["Abridged Project Text"]) || `Mapped from Airtable: ${projectName}`,
      });

      const dedupeKey = `${venueId}|${normalizeText(projectName)}`;
      if (existingEventKeys.has(dedupeKey)) continue;
      existingEventKeys.add(dedupeKey);
      const airtableTimeLabel = buildAirtableTimeLabel(
        asString(fields["Start Time"]) || asString(fields.start_time),
        asString(fields["End Time"]) || asString(fields.end_time),
        asString(fields.Duration) || asString(fields.duration)
      );

      events.push({
        id: `airtable-${asString(record.id) || slugify(`${projectName}-${venueId}`)}`,
        venueId,
        title: projectName,
        host: asString(fields["Artist Name"]),
        description:
          asString(fields["Abridged Project Text"]) ||
          asString(fields["Project Description"]) ||
          getLocationAbridgedText(matchedLocation),
        day: "fri",
        startTime: "TBD",
        endTime: "TBD",
        type: parsedProjectTypes[0] ?? "installation",
        projectTypes: parsedProjectTypes.length > 1 ? parsedProjectTypes : undefined,
        thumbnailUrl: "/map-layers/image_BB_map.jpg",
        lat: lat ?? undefined,
        lng: lng ?? undefined,
        hasLocation,
        permanence: asString(fields["Year or Permanent"]) || undefined,
        source: "airtable",
        airtableRecordId: asString(record.id) || undefined,
        airtableProjectName: projectName,
        airtableTimeLabel: airtableTimeLabel || undefined,
      });
    }

    // Treat locations.json-only art installations as listing events when they have no Airtable entry.
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

      const host = getLocationArtist(locationRow) || "";
      const description = getLocationAbridgedText(locationRow) || "";
      const existingVenue = venuesById.get(venueId);
      if (existingVenue) {
        existingVenue.shortDescription = host ? `By ${host}` : existingVenue.shortDescription;
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

    const totalRows = mappedEvents.length;
    const locationNoneCount = unmatchedLocationEvents.length;

    return {
      venues,
      events,
      sourceLabel: "the_real_schedule_events.json + locations.json + tmp_airtable_table.json + admin_entries.json",
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
    sourceLabel: "the_real_schedule_events.json/locations.json/tmp_airtable_table.json unavailable",
    debug: {
      totalRows: 0,
      confirmedRows: 0,
      matchedRows: 0,
      unmatchedLocations: [],
    },
  };
}
