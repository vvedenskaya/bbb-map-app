import { FestivalDay, FestivalEvent } from "@/types/festival";

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
