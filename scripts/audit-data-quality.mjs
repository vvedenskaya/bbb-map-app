#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const REPORTS_DIR = path.join(ROOT, "reports");
const OUTPUT_JSON = path.join(REPORTS_DIR, "data-audit-latest.json");
const OUTPUT_MD = path.join(REPORTS_DIR, "data-audit-latest.md");

const SCHEDULE_PATH = path.join(ROOT, "the_real_schedule_events.json");
const LOCATIONS_PATH = path.join(ROOT, "locations.json");
const ADMIN_ENTRIES_PATH = path.join(ROOT, "admin_entries.json");
const AIRTABLE_PATH = path.join(ROOT, "tmp_airtable_table.json");

const VALID_DAYS = new Set(["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]);
const SAMPLE_LIMIT = 20;

function asString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function asStringList(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => asString(entry)).filter(Boolean);
  }
  const single = asString(value);
  if (!single) return [];
  return single
    .split(/\s*(?:\||;|,|\n)\s*/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function asNumber(value) {
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

function normalizeText(value) {
  return asString(value)
    .toLowerCase()
    .replace(/[\u2019']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\bthe\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseTimeToMinutes(raw) {
  const value = asString(raw).toUpperCase();
  const match = value.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2] ?? "0");
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  if (hour === 12) hour = 0;
  if (match[3] === "PM") hour += 12;
  return hour * 60 + minute;
}

function isPlaceholderTimeLabel(value) {
  const normalized = asString(value).toUpperCase();
  return !normalized || normalized === "TBD";
}

function parseEventTypes(value) {
  const normalized = asString(value).toLowerCase();
  const types = new Set();
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
  if (normalized.includes("service")) types.add("services");
  return [...types];
}

function getAirtableProjectName(fields) {
  return asString(fields?.["Project Name"]) || asString(fields?.project_name);
}

function findMatchingLocation(locationName, byNormalizedName, allLocations) {
  const normalized = normalizeText(locationName);
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

function makeTracker() {
  return { count: 0, samples: [] };
}

function track(tracker, entry) {
  tracker.count += 1;
  if (tracker.samples.length < SAMPLE_LIMIT) {
    tracker.samples.push(entry);
  }
}

function sampleEventLabel(event, idx) {
  const title = asString(event.name) || "(untitled)";
  const day = asString(event.day) || "(no day)";
  const location = asString(event.location) || "(no location)";
  return `#${idx + 1} ${title} | ${day} | ${location}`;
}

function sampleLocationLabel(location, idx) {
  const name = asString(location.Name) || "(no name)";
  const category = asString(location.Category) || "(no category)";
  return `#${idx + 1} ${name} | ${category}`;
}

function toMarkdown(report) {
  const lines = [];
  lines.push("# Festival Data Audit");
  lines.push("");
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push("");
  lines.push("## Totals");
  lines.push("");
  lines.push(`- Schedule rows: ${report.totals.scheduleRows}`);
  lines.push(`- Locations rows: ${report.totals.locationRows}`);
  lines.push(`- Admin entries: ${report.totals.adminEntries}`);
  lines.push("");
  lines.push("## Likely Hidden In UI");
  lines.push("");
  lines.push(`- Hidden map pins (schedule events): ${report.hidden.mapPinsFromSchedule.count}`);
  lines.push(`- Hidden timeline events (schedule events): ${report.hidden.timelineFromSchedule.count}`);
  lines.push(`- Hidden map pins (admin scheduled events): ${report.hidden.mapPinsFromAdminScheduled.count}`);
  lines.push(`- Hidden timeline events (admin scheduled events): ${report.hidden.timelineFromAdminScheduled.count}`);
  lines.push("");
  lines.push("## Missing Or Invalid Data");
  lines.push("");
  lines.push(`- Schedule rows with missing required fields: ${report.schedule.requiredFieldIssues.count}`);
  lines.push(`- Schedule rows with invalid day labels: ${report.schedule.invalidDays.count}`);
  lines.push(`- Schedule rows with invalid time labels: ${report.schedule.invalidTimes.count}`);
  lines.push(`- Duplicate schedule rows (same day/title/time/location): ${report.schedule.duplicates.count}`);
  lines.push(`- Schedule rows with unmatched locations: ${report.schedule.unmatchedLocations.count}`);
  lines.push(`- Location rows missing coordinates: ${report.locations.missingCoordinates.count}`);
  lines.push(`- Art installations missing artist: ${report.locations.artInstallationsMissingArtist.count}`);
  lines.push(`- Art installations missing abridged text: ${report.locations.artInstallationsMissingText.count}`);
  lines.push(
    `- Missing artist but enrichable from Airtable: ${report.locations.artInstallationsMissingArtistEnrichableFromAirtable.count}`
  );
  lines.push(
    `- Missing artist and not found in Airtable: ${report.locations.artInstallationsMissingArtistNotFoundInAirtable.count}`
  );
  lines.push(
    `- Missing text but enrichable from Airtable: ${report.locations.artInstallationsMissingTextEnrichableFromAirtable.count}`
  );
  lines.push(
    `- Missing text and not found in Airtable: ${report.locations.artInstallationsMissingTextNotFoundInAirtable.count}`
  );
  lines.push("");
  lines.push("## Sample Rows (first 20 each)");
  lines.push("");
  lines.push("### Schedule hidden from map");
  for (const item of report.hidden.mapPinsFromSchedule.samples) lines.push(`- ${item}`);
  if (report.hidden.mapPinsFromSchedule.samples.length === 0) lines.push("- None");
  lines.push("");
  lines.push("### Schedule hidden from timeline");
  for (const item of report.hidden.timelineFromSchedule.samples) lines.push(`- ${item}`);
  if (report.hidden.timelineFromSchedule.samples.length === 0) lines.push("- None");
  lines.push("");
  lines.push("### Unmatched schedule locations");
  for (const item of report.schedule.unmatchedLocations.samples) lines.push(`- ${item}`);
  if (report.schedule.unmatchedLocations.samples.length === 0) lines.push("- None");
  lines.push("");
  lines.push("### Locations missing coordinates");
  for (const item of report.locations.missingCoordinates.samples) lines.push(`- ${item}`);
  if (report.locations.missingCoordinates.samples.length === 0) lines.push("- None");
  lines.push("");
  lines.push("### Missing artist but enrichable from Airtable");
  for (const item of report.locations.artInstallationsMissingArtistEnrichableFromAirtable.samples) lines.push(`- ${item}`);
  if (report.locations.artInstallationsMissingArtistEnrichableFromAirtable.samples.length === 0) lines.push("- None");
  lines.push("");
  lines.push("### Missing artist and not found in Airtable");
  for (const item of report.locations.artInstallationsMissingArtistNotFoundInAirtable.samples) lines.push(`- ${item}`);
  if (report.locations.artInstallationsMissingArtistNotFoundInAirtable.samples.length === 0) lines.push("- None");
  lines.push("");
  lines.push("### Missing text but enrichable from Airtable");
  for (const item of report.locations.artInstallationsMissingTextEnrichableFromAirtable.samples) lines.push(`- ${item}`);
  if (report.locations.artInstallationsMissingTextEnrichableFromAirtable.samples.length === 0) lines.push("- None");
  lines.push("");
  lines.push("### Missing text and not found in Airtable");
  for (const item of report.locations.artInstallationsMissingTextNotFoundInAirtable.samples) lines.push(`- ${item}`);
  if (report.locations.artInstallationsMissingTextNotFoundInAirtable.samples.length === 0) lines.push("- None");
  lines.push("");
  return `${lines.join("\n")}\n`;
}

async function readJson(filePath, fallbackValue) {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return fallbackValue;
  }
}

async function main() {
  const schedule = await readJson(SCHEDULE_PATH, []);
  const locations = await readJson(LOCATIONS_PATH, []);
  const adminFile = await readJson(ADMIN_ENTRIES_PATH, { entries: [] });
  const airtableFile = await readJson(AIRTABLE_PATH, { records: [] });
  const adminEntries = Array.isArray(adminFile?.entries) ? adminFile.entries : [];
  const airtableRecords = Array.isArray(airtableFile?.records) ? airtableFile.records : [];

  if (!Array.isArray(schedule)) {
    throw new Error("the_real_schedule_events.json must be an array");
  }
  if (!Array.isArray(locations)) {
    throw new Error("locations.json must be an array");
  }

  const airtableByProjectName = new Map();
  for (const record of airtableRecords) {
    const fields = record?.fields ?? {};
    const projectName = getAirtableProjectName(fields);
    if (!projectName) continue;
    const key = normalizeText(projectName);
    if (!airtableByProjectName.has(key)) {
      airtableByProjectName.set(key, fields);
    }
  }

  const byNormalizedName = new Map();
  const allLocationsWithCoords = [];
  for (const locationRow of locations) {
    const name = asString(locationRow.Name);
    const lat = asNumber(locationRow.Lat);
    const lng = asNumber(locationRow.Long);
    if (!name || lat === null || lng === null) continue;
    byNormalizedName.set(normalizeText(name), locationRow);
    for (const alias of asStringList(locationRow.Alias)) {
      byNormalizedName.set(normalizeText(alias), locationRow);
    }
    allLocationsWithCoords.push(locationRow);
  }

  const scheduleRequiredFieldIssues = makeTracker();
  const invalidDayRows = makeTracker();
  const invalidTimeRows = makeTracker();
  const unmatchedLocationRows = makeTracker();
  const hiddenMapScheduleRows = makeTracker();
  const hiddenTimelineScheduleRows = makeTracker();
  const duplicateRows = makeTracker();

  const seenScheduleKeys = new Set();

  schedule.forEach((event, idx) => {
    const title = asString(event.name);
    const day = asString(event.day);
    const start = asString(event.start_time);
    const end = asString(event.end_time);
    const locationName = asString(event.location);
    const category = asString(event.category);

    const missingFields = [];
    if (!title) missingFields.push("name");
    if (!day) missingFields.push("day");
    if (!start) missingFields.push("start_time");
    if (!end) missingFields.push("end_time");
    if (!locationName) missingFields.push("location");
    if (!category) missingFields.push("category");
    if (missingFields.length > 0) {
      track(scheduleRequiredFieldIssues, `${sampleEventLabel(event, idx)} | missing: ${missingFields.join(", ")}`);
    }

    const normalizedDay = day.toLowerCase();
    if (normalizedDay && !VALID_DAYS.has(normalizedDay)) {
      track(invalidDayRows, `${sampleEventLabel(event, idx)} | invalid day: "${day}"`);
    }

    const startIsPlaceholder = isPlaceholderTimeLabel(start);
    const endIsPlaceholder = isPlaceholderTimeLabel(end);
    const startMinutes = startIsPlaceholder ? null : parseTimeToMinutes(start);
    const endMinutes = endIsPlaceholder ? null : parseTimeToMinutes(end);
    const hasInvalidTime = (!startIsPlaceholder && startMinutes === null) || (!endIsPlaceholder && endMinutes === null);
    if (hasInvalidTime) {
      track(invalidTimeRows, `${sampleEventLabel(event, idx)} | start: "${start}" | end: "${end}"`);
    }

    const dedupeKey = [normalizeText(day), normalizeText(title), normalizeText(start), normalizeText(end), normalizeText(locationName)]
      .join("|");
    if (seenScheduleKeys.has(dedupeKey)) {
      track(duplicateRows, sampleEventLabel(event, idx));
    } else {
      seenScheduleKeys.add(dedupeKey);
    }

    const matchedLocation = locationName ? findMatchingLocation(locationName, byNormalizedName, allLocationsWithCoords) : null;
    if (!matchedLocation) {
      track(unmatchedLocationRows, sampleEventLabel(event, idx));
    }

    const mapHiddenReasons = [];
    if (!locationName) mapHiddenReasons.push("missing location");
    if (locationName && !matchedLocation) mapHiddenReasons.push("location did not match locations.json");
    if (mapHiddenReasons.length > 0) {
      track(hiddenMapScheduleRows, `${sampleEventLabel(event, idx)} | ${mapHiddenReasons.join("; ")}`);
    }

    const timelineHiddenReasons = [];
    if (startIsPlaceholder && endIsPlaceholder) timelineHiddenReasons.push("unscheduled (both times TBD/blank)");
    if (hasInvalidTime) timelineHiddenReasons.push("invalid time format");
    if (parseEventTypes(category).includes("services")) timelineHiddenReasons.push("service-type event filtered out");
    if (timelineHiddenReasons.length > 0) {
      track(hiddenTimelineScheduleRows, `${sampleEventLabel(event, idx)} | ${timelineHiddenReasons.join("; ")}`);
    }
  });

  const locationsMissingCoordinates = makeTracker();
  const artMissingArtist = makeTracker();
  const artMissingText = makeTracker();
  const artMissingArtistEnrichable = makeTracker();
  const artMissingArtistNotFound = makeTracker();
  const artMissingTextEnrichable = makeTracker();
  const artMissingTextNotFound = makeTracker();

  locations.forEach((locationRow, idx) => {
    const lat = asNumber(locationRow.Lat);
    const lng = asNumber(locationRow.Long);
    if (lat === null || lng === null) {
      track(locationsMissingCoordinates, sampleLocationLabel(locationRow, idx));
    }

    const category = normalizeText(locationRow.Category);
    const isArtInstallation = category.includes("art installation") || category.includes("installation");
    if (!isArtInstallation) return;

    const namesForMatch = [asString(locationRow.Name), ...asStringList(locationRow.Alias)].filter(Boolean);
    const matchingAirtableFields = namesForMatch
      .map((name) => airtableByProjectName.get(normalizeText(name)))
      .find(Boolean);
    const airtableArtist = asString(matchingAirtableFields?.["Artist Name"]);
    const airtableText = asString(matchingAirtableFields?.["Abridged Project Text"]);

    const artist = asString(locationRow["Artist Name"]) || asString(locationRow.artist_name);
    const text = asString(locationRow["Abridged Project Text"]) || asString(locationRow.abridged_project_text);
    if (!artist) {
      track(artMissingArtist, sampleLocationLabel(locationRow, idx));
      if (airtableArtist) {
        track(artMissingArtistEnrichable, `${sampleLocationLabel(locationRow, idx)} | Airtable match: ${getAirtableProjectName(matchingAirtableFields)}`);
      } else {
        track(artMissingArtistNotFound, sampleLocationLabel(locationRow, idx));
      }
    }
    if (!text) {
      track(artMissingText, sampleLocationLabel(locationRow, idx));
      if (airtableText) {
        track(artMissingTextEnrichable, `${sampleLocationLabel(locationRow, idx)} | Airtable match: ${getAirtableProjectName(matchingAirtableFields)}`);
      } else {
        track(artMissingTextNotFound, sampleLocationLabel(locationRow, idx));
      }
    }
  });

  const hiddenMapAdminScheduledRows = makeTracker();
  const hiddenTimelineAdminScheduledRows = makeTracker();
  adminEntries.forEach((entry, idx) => {
    const hasSchedule = Boolean(entry?.hasSchedule);
    if (!hasSchedule) return;

    const entryLabel = `#${idx + 1} ${asString(entry?.name) || "(unnamed admin entry)"}`;
    const hasLocation = Boolean(entry?.hasLocation);
    const lat = asNumber(entry?.lat);
    const lng = asNumber(entry?.lng);

    if (!hasLocation || lat === null || lng === null) {
      track(hiddenMapAdminScheduledRows, `${entryLabel} | missing map coordinates`);
    }

    const start = asString(entry?.startTime);
    const end = asString(entry?.endTime);
    const startIsPlaceholder = isPlaceholderTimeLabel(start);
    const endIsPlaceholder = isPlaceholderTimeLabel(end);
    const hasInvalidTime =
      (!startIsPlaceholder && parseTimeToMinutes(start) === null) ||
      (!endIsPlaceholder && parseTimeToMinutes(end) === null);
    if ((startIsPlaceholder && endIsPlaceholder) || hasInvalidTime) {
      const reason = startIsPlaceholder && endIsPlaceholder ? "unscheduled (both times TBD/blank)" : "invalid time format";
      track(hiddenTimelineAdminScheduledRows, `${entryLabel} | ${reason}`);
    }
  });

  const report = {
    generatedAt: new Date().toISOString(),
    files: {
      schedule: path.basename(SCHEDULE_PATH),
      locations: path.basename(LOCATIONS_PATH),
      adminEntries: path.basename(ADMIN_ENTRIES_PATH),
      airtable: path.basename(AIRTABLE_PATH),
    },
    totals: {
      scheduleRows: schedule.length,
      locationRows: locations.length,
      adminEntries: adminEntries.length,
    },
    hidden: {
      mapPinsFromSchedule: {
        count: hiddenMapScheduleRows.count,
        samples: hiddenMapScheduleRows.samples,
      },
      timelineFromSchedule: {
        count: hiddenTimelineScheduleRows.count,
        samples: hiddenTimelineScheduleRows.samples,
      },
      mapPinsFromAdminScheduled: {
        count: hiddenMapAdminScheduledRows.count,
        samples: hiddenMapAdminScheduledRows.samples,
      },
      timelineFromAdminScheduled: {
        count: hiddenTimelineAdminScheduledRows.count,
        samples: hiddenTimelineAdminScheduledRows.samples,
      },
    },
    schedule: {
      requiredFieldIssues: {
        count: scheduleRequiredFieldIssues.count,
        samples: scheduleRequiredFieldIssues.samples,
      },
      invalidDays: {
        count: invalidDayRows.count,
        samples: invalidDayRows.samples,
      },
      invalidTimes: {
        count: invalidTimeRows.count,
        samples: invalidTimeRows.samples,
      },
      duplicates: {
        count: duplicateRows.count,
        samples: duplicateRows.samples,
      },
      unmatchedLocations: {
        count: unmatchedLocationRows.count,
        samples: unmatchedLocationRows.samples,
      },
    },
    locations: {
      missingCoordinates: {
        count: locationsMissingCoordinates.count,
        samples: locationsMissingCoordinates.samples,
      },
      artInstallationsMissingArtist: {
        count: artMissingArtist.count,
        samples: artMissingArtist.samples,
      },
      artInstallationsMissingText: {
        count: artMissingText.count,
        samples: artMissingText.samples,
      },
      artInstallationsMissingArtistEnrichableFromAirtable: {
        count: artMissingArtistEnrichable.count,
        samples: artMissingArtistEnrichable.samples,
      },
      artInstallationsMissingArtistNotFoundInAirtable: {
        count: artMissingArtistNotFound.count,
        samples: artMissingArtistNotFound.samples,
      },
      artInstallationsMissingTextEnrichableFromAirtable: {
        count: artMissingTextEnrichable.count,
        samples: artMissingTextEnrichable.samples,
      },
      artInstallationsMissingTextNotFoundInAirtable: {
        count: artMissingTextNotFound.count,
        samples: artMissingTextNotFound.samples,
      },
    },
  };

  await mkdir(REPORTS_DIR, { recursive: true });
  await writeFile(OUTPUT_JSON, JSON.stringify(report, null, 2), "utf8");
  await writeFile(OUTPUT_MD, toMarkdown(report), "utf8");

  console.log(`Data audit complete.
- JSON: ${path.relative(ROOT, OUTPUT_JSON)}
- Markdown: ${path.relative(ROOT, OUTPUT_MD)}`);
}

main().catch((error) => {
  console.error("Data audit failed:", error);
  process.exitCode = 1;
});
