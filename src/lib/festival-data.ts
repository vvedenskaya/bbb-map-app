import { readFile } from "node:fs/promises";
import path from "node:path";
import { events as seedEvents, venues } from "@/data/festival";
import { FestivalDay, FestivalEvent, Venue } from "@/types/festival";
import { fetchAirtableInstallations } from "@/lib/airtable";
import { parseCsv } from "@/lib/csv";

const CSV_FILE_PATH = path.join(process.cwd(), "data", "Installations_Art Pieces-BBB '26 Digital Data.csv");
const PARSED_LOCATIONS_PATH = path.join(process.cwd(), "data", "parsed_locations_output.csv");

type DataSource = "csv" | "airtable" | "seed";

export type FestivalDataResult = {
  venues: Venue[];
  events: FestivalEvent[];
  sourceLabel: string;
};

function parseDay(value: string): FestivalDay | null {
  const normalized = value.trim().toLowerCase();
  if (normalized === "fri" || normalized === "friday") return "fri";
  if (normalized === "sat" || normalized === "saturday") return "sat";
  if (normalized === "sun" || normalized === "sunday") return "sun";
  return null;
}

function parseCoordinates(urlOrString?: string): { lat: number; lng: number } | undefined {
  if (!urlOrString) return undefined;
  const match = urlOrString.match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
  if (match) {
    return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
  }
  return undefined;
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

function getEventAccentColor(type: string): string {
  switch (type) {
    case 'performance': return '#86efac';
    case 'object': return '#7dd3fc';
    case 'experience': return '#a855f7';
    case 'dj': return '#fef08a';
    case 'music': return '#166534';
    case 'venue': return '#8b5cf6';
    case 'food': return '#d8b4fe';
    default: return '#1e3a8a';
  }
}

function buildVenueLookup() {
  const byId = new Map<string, string>();
  const byName = new Map<string, string>();

  for (const venue of venues) {
    byId.set(venue.id.toLowerCase(), venue.id);
    byName.set(venue.name.toLowerCase(), venue.id);
    byName.set(venue.label.toLowerCase(), venue.id);
  }

  return { byId, byName };
}

async function loadCsvEvents(): Promise<FestivalEvent[] | null> {
  try {
    const text = await readFile(CSV_FILE_PATH, "utf-8");
    // Handle potential BOM issue by cleaning first character if it's BOM
    const cleanText = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
    const rows = parseCsv(cleanText);
    if (rows.length === 0) {
      return null;
    }

    const locationMap = new Map<string, { lat: number; lng: number }>();
    try {
      const locText = await readFile(PARSED_LOCATIONS_PATH, "utf-8");
      const cleanLocText = locText.charCodeAt(0) === 0xFEFF ? locText.slice(1) : locText;
      const parsedLocs = parseCsv(cleanLocText);
      for (const loc of parsedLocs) {
        if (loc.project_name && loc.latitude && loc.longitude && loc.latitude !== "not found") {
          locationMap.set(loc.project_name.trim().toLowerCase(), {
            lat: parseFloat(loc.latitude),
            lng: parseFloat(loc.longitude)
          });
        }
      }
    } catch (e) {
      console.warn("Could not load parsed locations file:", e);
    }

    const venueLookup = buildVenueLookup();

    const firstRow = rows[0];
    const isInstallationExport = Object.prototype.hasOwnProperty.call(firstRow, "project_name");

    const parsed = rows
      .map((row, index) => {
        // New path: Installation / Art Pieces export (Project Name, Artist Name, Status, etc.)
        if (isInstallationExport) {
          const status = (row.status || "").trim().toLowerCase();
          if (status && status !== "confirmed") {
            return null;
          }

          const title = row.project_name;
          if (!title) {
            return null;
          }

          const artistName = row.artist_name;
          const additionalArtists = row.additional_artists;
          const projectType = row.project_type;
          const abridgedText = row.abridged_project_text;
          const locationInternal = row.location_internal;
          const schedule = row.schedule;
          const duration = row.duration;
          const gps = row.gps_coordinates_link_from_location_new;
          const yearOrPermanent = row.year_or_permanent;
          const r2 = row.r2;

          const metaLines: string[] = [];
          if (projectType) metaLines.push(`Type: ${projectType}`);
          if (locationInternal) metaLines.push(`Location: ${locationInternal}`);
          if (schedule) metaLines.push(`Schedule: ${schedule}`);
          if (duration) metaLines.push(`Duration: ${duration}`);
          if (gps) metaLines.push(`Map: ${gps}`);
          if (yearOrPermanent) metaLines.push(`Year/Permanent: ${yearOrPermanent}`);
          if (r2) metaLines.push(`Notes: ${r2}`);

          const descriptionParts: string[] = [];
          if (abridgedText) {
            descriptionParts.push(abridgedText);
          }
          if (metaLines.length > 0) {
            descriptionParts.push(metaLines.join("\n"));
          }

          const hostPieces: string[] = [];
          if (artistName) hostPieces.push(artistName);
          if (additionalArtists) hostPieces.push(additionalArtists);

          // Get coords strictly and ONLY from parsed_locations_output.csv map!
          const coords = locationMap.get(title.trim().toLowerCase());
          let lat = coords?.lat;
          let lng = coords?.lng;

          const eventId = row.id || `csv-installation-${index + 1}`;
          
          return {
            id: eventId,
            // Draw this installation as its own pin on the map by mapping the venueId to its own ID
            venueId: eventId,
            title,
            host: hostPieces.join(" — ") || "TBD",
            description:
              descriptionParts.join("\n\n") || "No description yet.",
            // For now, pin everything to a single festival day so it appears in filters.
            day: "fri",
            startTime: schedule || "TBD",
            endTime: duration || "TBD",
            type: parseEventType(projectType || ""),
            thumbnailUrl: "/map-layers/image_BB_map.jpg",
            lat: lat,
            lng: lng,
            hasLocation: (lat !== undefined && lng !== undefined),
            permanence: yearOrPermanent || "",
          } as unknown as FestivalEvent;
        }

        // Original path: schedule-style CSV with explicit day/venue fields.
        const title = row.title || row.event_title;
        const day = parseDay(row.day || row.event_day || "");
        const venueIdValue = (row.venue_id || row.venue || "").toLowerCase();
        const venueNameValue = (row.venue_name || row.venue || "").toLowerCase();
        const venueId =
          venueLookup.byId.get(venueIdValue) ||
          venueLookup.byName.get(venueNameValue) ||
          row.venue_id ||
          "";

        if (!title || !day || !venueId) {
          return null;
        }

        return {
          id: row.id || row.event_id || `csv-event-${index + 1}`,
          venueId,
          title,
          host: row.host || row.presenter || "TBD",
          description: row.description || "No description yet.",
          day,
          startTime: row.start_time || row.start || "TBD",
          endTime: row.end_time || row.end || "TBD",
          type: parseEventType(row.type || row.event_type || "community"),
          thumbnailUrl: row.thumbnail_url || "/map-layers/image_BB_map.jpg",
        } satisfies FestivalEvent;
      })
      .filter((event): event is FestivalEvent => event !== null);

    return parsed.length > 0 ? parsed : null;
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
    if (airtableData && airtableData.venues.length > 0) {
      return {
        venues: airtableData.venues,
        events: airtableData.events,
        sourceLabel: "Airtable API",
      };
    }
  }

  if (source === "csv" || source === "airtable") {
    const csvEvents = await loadCsvEvents();
    if (csvEvents && csvEvents.length > 0) {
      
      // Generate dynamic venues for the CSV installations so they appear on the map
      const csvVenues = csvEvents.map(ev => {
        return {
          id: ev.venueId,
          name: ev.title,
          label: ev.type,
          shortDescription: `By ${ev.host}`,
          description: ev.description,
          lat: ev.lat !== undefined ? ev.lat : 33.351000,
          lng: ev.lng !== undefined ? ev.lng : -115.731000,
          hasLocation: ev.hasLocation,
          permanence: ev.permanence,
          x: 0,
          y: 0,
          thumbnailUrl: ev.thumbnailUrl || "/map-layers/image_BB_map.jpg",
          accent: getEventAccentColor(ev.type)
        } as Venue;
      });

      // We only return csvVenues now because the original 'venues' array was just the same set
      // of art pieces with old scattered coordinates! We don't want to duplicate all 266 locations.
      return {
        venues: csvVenues,
        events: csvEvents,
        sourceLabel: "CSV import",
      };
    }
  }

  return {
    venues,
    events: seedEvents,
    sourceLabel: "Seed data fallback",
  };
}
