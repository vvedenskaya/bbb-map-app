import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { AdminEntriesFile, AdminEntry, ServiceType } from "@/types/admin-entry";
import { EventType, FestivalDay } from "@/types/festival";

const ADMIN_ENTRIES_PATH = path.join(process.cwd(), "admin_entries.json");

const VALID_DAYS: FestivalDay[] = ["fri", "sat", "sun"];
const VALID_TYPES: EventType[] = [
  "music",
  "performance",
  "installation",
  "exhibition",
  "lecture",
  "community",
  "social",
  "object",
  "experience",
  "film",
  "dj",
  "venue",
  "food",
  "services",
];
const VALID_SERVICES: ServiceType[] = ["garbage", "water", "toilets", "medic"];

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && !Number.isNaN(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
}

function parseDay(value: unknown): FestivalDay {
  const day = asString(value).toLowerCase();
  return VALID_DAYS.includes(day as FestivalDay) ? (day as FestivalDay) : "fri";
}

function parseType(value: unknown): EventType {
  const type = asString(value).toLowerCase();
  return VALID_TYPES.includes(type as EventType) ? (type as EventType) : "venue";
}

function parseTypeList(value: unknown): EventType[] {
  if (Array.isArray(value)) {
    const parsed = value
      .map((entry) => parseType(entry))
      .filter((entry, index, all) => all.indexOf(entry) === index);
    return parsed;
  }

  if (typeof value === "string") {
    const parts = value
      .split(/[,/|+&]/)
      .map((part) => parseType(part))
      .filter((entry, index, all) => all.indexOf(entry) === index);
    return parts;
  }

  return [];
}

function parseServiceType(value: unknown): ServiceType | undefined {
  const service = asString(value).toLowerCase();
  return VALID_SERVICES.includes(service as ServiceType) ? (service as ServiceType) : undefined;
}

function normalizeEntry(raw: unknown, index: number): AdminEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const lat = asNumber(obj.lat);
  const lng = asNumber(obj.lng);
  const hasLocation = typeof obj.hasLocation === "boolean" ? obj.hasLocation : lat !== undefined && lng !== undefined;
  const projectType = parseType(obj.projectType ?? obj.type);
  const parsedProjectTypes = parseTypeList(obj.projectTypes);
  const mergedProjectTypes = [
    projectType,
    ...parsedProjectTypes,
  ].filter((entry, index, all) => all.indexOf(entry) === index);
  const serviceType = parseServiceType(obj.serviceType);
  const fallbackName = serviceType
    ? `${serviceType.charAt(0).toUpperCase()}${serviceType.slice(1)}`
    : "Admin Entry";
  const name = asString(obj.name) || fallbackName;
  const hasSchedule = typeof obj.hasSchedule === "boolean" ? obj.hasSchedule : false;

  return {
    id: asString(obj.id) || `admin-${index + 1}`,
    name,
    artist: asString(obj.artist),
    locationInternal: asString(obj.locationInternal ?? obj.location),
    projectType: projectType === "services" || serviceType ? "services" : projectType,
    projectTypes:
      projectType === "services" || serviceType
        ? undefined
        : mergedProjectTypes.length > 1
          ? mergedProjectTypes
          : undefined,
    serviceType,
    abridgedProjectText: asString(obj.abridgedProjectText),
    day: parseDay(obj.day),
    startTime: hasSchedule ? asString(obj.startTime) || "TBD" : "",
    endTime: hasSchedule ? asString(obj.endTime) || "TBD" : "",
    hasSchedule,
    permanence: asString(obj.permanence),
    lat,
    lng,
    hasLocation,
  };
}

async function ensureAdminEntriesFile(): Promise<void> {
  try {
    await readFile(ADMIN_ENTRIES_PATH, "utf-8");
  } catch {
    const initial: AdminEntriesFile = { entries: [] };
    await writeFile(ADMIN_ENTRIES_PATH, JSON.stringify(initial, null, 2), "utf-8");
  }
}

export async function readAdminEntries(): Promise<AdminEntry[]> {
  await ensureAdminEntriesFile();
  const raw = await readFile(ADMIN_ENTRIES_PATH, "utf-8");
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== "object") return [];
  const entries = Array.isArray((parsed as AdminEntriesFile).entries) ? (parsed as AdminEntriesFile).entries : [];
  return entries
    .map((entry, index) => normalizeEntry(entry, index))
    .filter((entry): entry is AdminEntry => Boolean(entry));
}

async function writeAdminEntries(entries: AdminEntry[]): Promise<void> {
  const payload: AdminEntriesFile = { entries };
  await writeFile(ADMIN_ENTRIES_PATH, JSON.stringify(payload, null, 2), "utf-8");
}

export type UpsertInput = Partial<AdminEntry> & { id?: string; name?: string };

export async function createAdminEntry(input: UpsertInput): Promise<AdminEntry> {
  const entries = await readAdminEntries();
  const created = normalizeEntry({ ...input, id: `admin-${randomUUID()}` }, entries.length);
  if (!created) {
    throw new Error("Invalid admin entry payload");
  }
  const nextEntries = [...entries, created];
  await writeAdminEntries(nextEntries);
  return created;
}

export async function createManyAdminEntries(inputs: UpsertInput[]): Promise<AdminEntry[]> {
  const entries = await readAdminEntries();
  const created: AdminEntry[] = [];
  for (const input of inputs) {
    const normalized = normalizeEntry({ ...input, id: `admin-${randomUUID()}` }, entries.length + created.length);
    if (!normalized) {
      throw new Error("Invalid admin entry payload");
    }
    created.push(normalized);
  }
  const nextEntries = [...entries, ...created];
  await writeAdminEntries(nextEntries);
  return created;
}

export async function updateAdminEntry(id: string, input: Partial<AdminEntry>): Promise<AdminEntry | null> {
  const entries = await readAdminEntries();
  const idx = entries.findIndex((entry) => entry.id === id);
  if (idx < 0) return null;

  const merged = normalizeEntry({ ...entries[idx], ...input, id }, idx);
  if (!merged) {
    throw new Error("Invalid admin entry payload");
  }

  const nextEntries = [...entries];
  nextEntries[idx] = merged;
  await writeAdminEntries(nextEntries);
  return merged;
}

export async function deleteAdminEntry(id: string): Promise<boolean> {
  const entries = await readAdminEntries();
  const nextEntries = entries.filter((entry) => entry.id !== id);
  if (nextEntries.length === entries.length) return false;
  await writeAdminEntries(nextEntries);
  return true;
}

export async function getAdminEntryById(id: string): Promise<AdminEntry | null> {
  const entries = await readAdminEntries();
  return entries.find((entry) => entry.id === id) ?? null;
}
