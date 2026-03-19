import { FestivalDay, FestivalEvent, Venue } from "@/types/festival";

const AIRTABLE_API_BASE = "https://api.airtable.com/v0";

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

function getString(fields: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = fields[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

function parseDay(value: string): FestivalDay | null {
  const normalized = value.trim().toLowerCase();
  if (normalized === "fri" || normalized === "friday") return "fri";
  if (normalized === "sat" || normalized === "saturday") return "sat";
  if (normalized === "sun" || normalized === "sunday") return "sun";
  return null;
}

function parseEventType(value: string): FestivalEvent["type"] {
  const normalized = value.trim().toLowerCase();
  if (normalized === "music") return "music";
  if (normalized === "performance") return "performance";
  if (normalized === "installation") return "installation";
  if (normalized === "lecture") return "lecture";
  return "community";
}

function toEvent(record: AirtableRecord): FestivalEvent | null {
  const { fields } = record;

  const title = getString(fields, ["title", "Title"]);
  const venueId = getString(fields, ["venueId", "venue_id", "Venue ID", "venue"]);
  const dayValue = getString(fields, ["day", "Day"]);
  const day = parseDay(dayValue);

  if (!title || !venueId || !day) {
    return null;
  }

  return {
    id: getString(fields, ["id", "eventId", "event_id"]) || record.id,
    venueId,
    title,
    host: getString(fields, ["host", "Host", "presenter"]) || "TBD",
    description: getString(fields, ["description", "Description"]) || "No description yet.",
    day,
    startTime: getString(fields, ["startTime", "start_time", "Start", "start"]) || "TBD",
    endTime: getString(fields, ["endTime", "end_time", "End", "end"]) || "TBD",
    type: parseEventType(getString(fields, ["type", "eventType", "event_type", "Type"])),
    thumbnailUrl:
      getString(fields, ["thumbnailUrl", "thumbnail_url", "image", "Image"]) ||
      "/map-layers/image_BB_map.jpg",
  };
}

function getConfig(): AirtableConfig | null {
  const token = process.env.AIRTABLE_TOKEN;
  const baseId = process.env.AIRTABLE_BASE_ID;
  const tableName = process.env.AIRTABLE_TABLE_NAME;
  const view = process.env.AIRTABLE_VIEW;

  if (!token || !baseId || !tableName) {
    return null;
  }

  return {
    token,
    baseId,
    tableName,
    view,
  };
}

export async function fetchAirtableEvents(): Promise<FestivalEvent[] | null> {
  const config = getConfig();
  if (!config) {
    return null;
  }

  const events: FestivalEvent[] = [];
  let offset: string | undefined;

  do {
    const params = new URLSearchParams({
      pageSize: "100",
    });

    if (config.view) {
      params.set("view", config.view);
    }

    if (offset) {
      params.set("offset", offset);
    }

    const url = `${AIRTABLE_API_BASE}/${config.baseId}/${encodeURIComponent(config.tableName)}?${params.toString()}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${config.token}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as AirtableResponse;
    for (const record of payload.records) {
      const mapped = toEvent(record);
      if (mapped) {
        events.push(mapped);
      }
    }

    offset = payload.offset;
  } while (offset);

  return events;
}

function extractCoordinates(input?: string): { lat: number; lng: number } | null {
  if (!input) return null;

  // Look for @33.351050,-115.732958 in URLs
  const linkMatch = input.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (linkMatch) {
    return { lat: parseFloat(linkMatch[1]), lng: parseFloat(linkMatch[2]) };
  }

  // Look for raw coordinates 33.351050, -115.732958
  const coordMatch = input.match(/(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
  if (coordMatch) {
    return { lat: parseFloat(coordMatch[1]), lng: parseFloat(coordMatch[2]) };
  }

  return null;
}

export async function fetchAirtableInstallations(): Promise<{ venues: Venue[], events: FestivalEvent[] } | null> {
  const config = getConfig();
  if (!config) {
    return null;
  }

  const venues: Venue[] = [];
  const events: FestivalEvent[] = [];
  let offset: string | undefined;

  do {
    const params = new URLSearchParams({
      pageSize: "100",
    });

    if (config.view) {
      params.set("view", config.view);
    }

    if (offset) {
      params.set("offset", offset);
    }

    const url = `${AIRTABLE_API_BASE}/${config.baseId}/${encodeURIComponent(config.tableName)}?${params.toString()}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${config.token}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as AirtableResponse;
    const isInstallationExport = payload.records.length > 0 && !!getString(payload.records[0].fields, ["Project Name", "Artist Name"]);
    
    for (const record of payload.records) {
      const { fields } = record;
      
      const projectName = getString(fields, ["Project Name", "project_name"]);
      const artistName = getString(fields, ["Artist Name", "artist_name"]);
      
      if (!projectName && !artistName && isInstallationExport) continue;
      
      const gpsData = getString(fields, ["GPS Coordinates/Link (from Location NEW)"]);
      let coords = extractCoordinates(gpsData);
      
      const explicitLat = getString(fields, ["Latitude", "lat", "Lat"]);
      const explicitLng = getString(fields, ["Longitude", "lng", "Lng", "Lon", "lon"]);

      if (explicitLat && explicitLng) {
        coords = { lat: parseFloat(explicitLat), lng: parseFloat(explicitLng) };
      }

      const hasLocation = !!coords;
      
      if (!coords) {
         coords = {
             lat: 33.352 + (Math.random() - 0.5) * 0.005,
             lng: -115.729 + (Math.random() - 0.5) * 0.005
         };
      }
      
      const rawType = getString(fields, ["Project Type"]).toLowerCase();
      let accent = '#1e3a8a';
      let typeId: FestivalEvent["type"] = 'installation';
      
      if (rawType.includes('performance')) { accent = '#86efac'; typeId = 'performance'; }
      else if (rawType.includes('object')) { accent = '#7dd3fc'; typeId = 'object'; }
      else if (rawType.includes('experience') || rawType.includes('facilitated')) { accent = '#a855f7'; typeId = 'experience'; }
      else if (rawType.includes('dj')) { accent = '#fef08a'; typeId = 'dj'; }
      else if (rawType.includes('music')) { accent = '#166534'; typeId = 'music'; }
      else if (rawType.includes('venue')) { accent = '#8b5cf6'; typeId = 'venue'; }
      else if (rawType.includes('food')) { accent = '#d8b4fe'; typeId = 'food'; }
      
      const venueId = record.id;
      const name = projectName || artistName || 'Untitled';
      const shortDesc = `By ${artistName || 'Unknown Artist'}`;
      const desc = getString(fields, ["Abridged Project Text"]);
      const permanence = getString(fields, ["Year or Permanent"]);
      
      venues.push({
        id: venueId,
        name: name,
        label: getString(fields, ["Project Type"]) || "Installation",
        shortDescription: shortDesc,
        description: desc,
        lat: coords.lat,
        lng: coords.lng,
        x: 0,
        y: 0,
        hasLocation: hasLocation,
        permanence: permanence,
        thumbnailUrl: "/map-layers/image_BB_map.jpg",
        accent: accent
      });
      
      const schedule = getString(fields, ["Schedule"]);
      const duration = getString(fields, ["Duration"]);
      
      events.push({
        id: `event-${venueId}`,
        venueId: venueId,
        title: name,
        host: artistName || "TBD",
        description: desc || "No description yet.",
        day: "fri",
        startTime: schedule || "TBD",
        endTime: duration || "TBD",
        type: typeId,
        thumbnailUrl: "/map-layers/image_BB_map.jpg",
        lat: coords.lat,
        lng: coords.lng,
        hasLocation: hasLocation,
        permanence: permanence,
      });
    }

    offset = payload.offset;
  } while (offset);

  return { venues, events };
}
