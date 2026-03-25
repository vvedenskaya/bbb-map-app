"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { APIProvider, Map, AdvancedMarker, AdvancedMarkerAnchorPoint } from "@vis.gl/react-google-maps";
import { dayLabels, eventTypeLabels } from "@/data/festival";
import { EventType, FestivalDay, FestivalEvent, Venue } from "@/types/festival";
import banner1080 from "../../assets/banner/biennale-banner1080.jpg";
import banner2560 from "../../assets/banner/biennale-banner2560.jpg";
import { createPortal } from "react-dom";

const DAY_DISPLAY_ORDER: FestivalDay[] = ["wed", "thu", "fri", "sat", "sun", "mon", "tue"];
const DAY_SORT_ORDER: Record<FestivalDay, number> = {
  wed: 0,
  thu: 1,
  fri: 2,
  sat: 3,
  sun: 4,
  mon: 5,
  tue: 6,
};
const MAP_CENTER = { lat: 33.351508, lng: -115.729625 };
const MAP_DEFAULT_ZOOM = 16.9;
const MAP_FOCUS_ZOOM = 17.8;
const MAP_MIN_ZOOM = 14;
const MAP_MAX_ZOOM = 19.2;
const GEOFENCE_RADIUS_METERS = 1609.34; // 1 mile
const CAMERA_EPSILON = 0.000001;
const ZOOM_EPSILON = 0.001;
const TIMELINE_ZOOM_MIN = 0.75;
const TIMELINE_ZOOM_MAX = 2.4;
const TIMELINE_ZOOM_STEP = 0.15;
const TIMELINE_DEFAULT_ZOOM = 1.5;
const TIMELINE_BASE_LANE_WIDTH = 124;
const TIMELINE_EVENT_GAP = 6;
const TIMELINE_TIME_COLUMN_WIDTH = 42;

const PROJECT_TYPE_COLORS: Record<EventType, string> = {
  music: "#3b82f6",
  performance: "#ef4444",
  installation: "#f59e0b",
  lecture: "#14b8a6",
  community: "#8b5cf6",
  social: "#6366f1",
  object: "#ec4899",
  experience: "#22c55e",
  film: "#0ea5e9",
  dj: "#a855f7",
  venue: "#0ea5e9",
  food: "#f97316",
  services: "#4b5563",
};
const SERVICE_TYPE_COLORS: Record<"garbage" | "water" | "toilets" | "medic", string> = {
  garbage: "#4b5563",
  water: "#06b6d4",
  toilets: "#8b5cf6",
  medic: "#dc2626",
};

const UNCATEGORIZED_KEY = "uncategorized";
const SERVICES_KEY = "services";
const LOCAL_BUSINESS_KEY = "local business";
const COMMUNITY_HUB_KEY = "community hub";
const VENUE_KEY = "venue";
const ART_INSTALLATION_KEY = "art installation";
const PIN_CATEGORY_ORDER = [
  SERVICES_KEY,
  COMMUNITY_HUB_KEY,
  LOCAL_BUSINESS_KEY,
  VENUE_KEY,
  ART_INSTALLATION_KEY,
];
const PROJECT_TYPE_FILTER_OPTIONS: Array<{ id: string; label: string; types: EventType[] }> = [
  { id: "music", label: eventTypeLabels.music, types: ["music"] },
  { id: "performance", label: eventTypeLabels.performance, types: ["performance"] },
  { id: "installation", label: eventTypeLabels.installation, types: ["installation"] },
  { id: "lecture", label: eventTypeLabels.lecture, types: ["lecture"] },
  { id: "social", label: eventTypeLabels.social, types: ["community", "social"] },
  { id: "object", label: eventTypeLabels.object, types: ["object"] },
  { id: "experience", label: eventTypeLabels.experience, types: ["experience"] },
  { id: "film", label: eventTypeLabels.film, types: ["film"] },
  { id: "dj", label: eventTypeLabels.dj, types: ["dj"] },
  { id: "venue", label: eventTypeLabels.venue, types: ["venue"] },
  { id: "food", label: eventTypeLabels.food, types: ["food"] },
  { id: "services", label: eventTypeLabels.services, types: ["services"] },
];
const ALL_PROJECT_TYPES = PROJECT_TYPE_FILTER_OPTIONS.flatMap((option) => option.types);
const PIN_CATEGORY_COLORS: Record<string, string> = {
  [SERVICES_KEY]: "#f97316",
  [COMMUNITY_HUB_KEY]: "#8b5cf6",
  [LOCAL_BUSINESS_KEY]: "#0ea5e9",
  [VENUE_KEY]: "#3b82f6",
  [ART_INSTALLATION_KEY]: "#ec4899",
  [UNCATEGORIZED_KEY]: "#6b7280",
};

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const earthRadius = 6371000;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * earthRadius * Math.asin(Math.sqrt(a));
}

function isInsideGeofence(lat: number, lng: number): boolean {
  return distanceMeters(MAP_CENTER.lat, MAP_CENTER.lng, lat, lng) <= GEOFENCE_RADIUS_METERS;
}

function hasCameraChanged(
  prev: { lat: number; lng: number },
  next: { lat: number; lng: number },
  prevZoom: number,
  nextZoom: number
): boolean {
  return (
    Math.abs(prev.lat - next.lat) > CAMERA_EPSILON ||
    Math.abs(prev.lng - next.lng) > CAMERA_EPSILON ||
    Math.abs(prevZoom - nextZoom) > ZOOM_EPSILON
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function getModalSafeCenter(target: { lat: number; lng: number }, zoom: number): { lat: number; lng: number } {
  if (typeof window === "undefined") return target;

  // Keep selected markers visible above the centered venue modal.
  const viewportHeight = window.innerHeight || 900;
  const popupHeight = Math.min(viewportHeight * 0.7, 560);
  const yOffsetPixels = clamp(popupHeight * 0.42, 120, 220);
  const metersPerPixel = (156543.03392 * Math.cos(toRadians(target.lat))) / Math.pow(2, zoom);
  const latOffsetDegrees = (yOffsetPixels * metersPerPixel) / 111320;
  return { lat: target.lat - latOffsetDegrees, lng: target.lng };
}

function getVenueCategoryKey(venue: Venue): string {
  if (venue.serviceType) return SERVICES_KEY;
  const label = (venue.label || "").toLowerCase();
  if (label.includes("service")) return SERVICES_KEY;
  if (label.includes("community")) return COMMUNITY_HUB_KEY;
  if (label.includes("local business")) return LOCAL_BUSINESS_KEY;
  if (label.includes("object")) return ART_INSTALLATION_KEY;
  if (label.includes("installation/immersive environment")) return ART_INSTALLATION_KEY;
  if (label.includes("installation")) return ART_INSTALLATION_KEY;
  if (label.includes("immersive")) return ART_INSTALLATION_KEY;
  if (label.includes("facilitated experience")) return ART_INSTALLATION_KEY;
  if (label.includes("venue")) return VENUE_KEY;
  if (label.includes("art installation")) return ART_INSTALLATION_KEY;
  // Keep all mappable pins in a canonical map category bucket.
  return VENUE_KEY;
}

function getServiceIcon(serviceType?: Venue["serviceType"]): string | null {
  if (serviceType === "garbage") return "🗑";
  if (serviceType === "water") return "💧";
  if (serviceType === "toilets") return "🚻";
  if (serviceType === "medic") return "✚";
  return null;
}

function getCategoryDisplayLabel(categoryKey: string): string {
  if (categoryKey === UNCATEGORIZED_KEY) {
    return "Uncategorized";
  }
  return categoryKey.replace(/\b\w/g, (char) => char.toUpperCase());
}

function getProjectTypeColor(type: EventType): string {
  return PROJECT_TYPE_COLORS[type] || "#8b5cf6";
}

function getVenueLabelProjectTypes(venue: Venue): EventType[] {
  const types = new Set<EventType>();
  if (venue.serviceType) types.add("services");

  const normalizedLabel = (venue.label || "").toLowerCase();
  if (normalizedLabel.includes("venue")) types.add("venue");
  if (normalizedLabel.includes("service")) types.add("services");
  if (normalizedLabel.includes("community") || normalizedLabel.includes("social gathering")) types.add("community");
  if (normalizedLabel.includes("social")) types.add("social");
  if (normalizedLabel.includes("food") || normalizedLabel.includes("beverage")) types.add("food");
  if (normalizedLabel.includes("music")) types.add("music");
  if (normalizedLabel.includes("performance")) types.add("performance");
  if (normalizedLabel.includes("lecture") || normalizedLabel.includes("talk")) types.add("lecture");
  if (normalizedLabel.includes("object")) types.add("object");
  if (normalizedLabel.includes("installation")) types.add("installation");
  if (
    normalizedLabel.includes("immersive") ||
    normalizedLabel.includes("facilitated experience") ||
    normalizedLabel.includes("experience")
  ) {
    types.add("experience");
  }
  if (normalizedLabel.includes("film")) types.add("film");
  if (normalizedLabel.includes("dj")) types.add("dj");

  return [...types];
}

function getEventProjectTypes(event: FestivalEvent): EventType[] {
  const merged = [event.type, ...(event.projectTypes ?? [])];
  return [...new Set(merged)];
}

function eventMatchesProjectTypeFilter(event: FestivalEvent, activeTypes: EventType[]): boolean {
  return getEventProjectTypes(event).some((type) => activeTypes.includes(type));
}

function sortScheduleEvents(a: FestivalEvent, b: FestivalEvent): number {
  const dayDelta = DAY_SORT_ORDER[a.day] - DAY_SORT_ORDER[b.day];
  if (dayDelta !== 0) return dayDelta;
  const startDelta = (a.startTime || "").localeCompare(b.startTime || "");
  if (startDelta !== 0) return startDelta;
  return a.title.localeCompare(b.title);
}

function getVisibleEventDescription(event: FestivalEvent): string {
  const description = (event.description || "").trim();
  if (!description) return "";
  if (description === "No abridged text provided.") return "";
  return description;
}

function isPlaceholderTimeLabel(value: string): boolean {
  const normalized = (value || "").trim().toUpperCase();
  return !normalized || normalized === "TBD";
}

function isUnscheduledEvent(event: FestivalEvent): boolean {
  return isPlaceholderTimeLabel(event.startTime) && isPlaceholderTimeLabel(event.endTime);
}

function getDefaultActiveDays(events: FestivalEvent[]): FestivalDay[] {
  const available = Array.from(new Set(events.map((event) => event.day)));
  const sorted = DAY_DISPLAY_ORDER.filter((day) => available.includes(day));
  return sorted.length > 0 ? sorted : ["fri", "sat", "sun"];
}

function parseTimeToMinutes(raw: string): number | null {
  const value = raw.trim().toUpperCase();
  const match = value.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2] ?? "0");
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  if (hour === 12) hour = 0;
  if (match[3] === "PM") hour += 12;
  return hour * 60 + minute;
}

function parseEventDateTime(scheduleDate: string | undefined, timeLabel: string): Date | null {
  if (!scheduleDate) return null;
  const minutes = parseTimeToMinutes(timeLabel);
  if (minutes === null) return null;
  const date = new Date(`${scheduleDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  date.setHours(hours, mins, 0, 0);
  return date;
}

function isPastEvent(event: FestivalEvent, now: Date): boolean {
  const end = parseEventDateTime(event.scheduleDate, event.endTime);
  if (end) return end.getTime() < now.getTime();
  const start = parseEventDateTime(event.scheduleDate, event.startTime);
  if (!start) return false;
  const inferredEnd = new Date(start.getTime() + 60 * 60 * 1000);
  return inferredEnd.getTime() < now.getTime();
}

type TimelineEventBlock = {
  event: FestivalEvent;
  start: number;
  end: number;
  column: number;
  groupColumns: number;
};

function getEventMinuteRange(event: FestivalEvent): { start: number; end: number } | null {
  const start = parseTimeToMinutes(event.startTime);
  if (start === null) return null;
  const parsedEnd = parseTimeToMinutes(event.endTime);
  const fallbackEnd = start + 60;
  let end = parsedEnd ?? fallbackEnd;
  if (end <= start) end += 24 * 60;
  return { start, end };
}

function formatMinutesLabel(totalMinutes: number): string {
  const minutesInDay = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const hours = Math.floor(minutesInDay / 60);
  const mins = minutesInDay % 60;
  const suffix = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 === 0 ? 12 : hours % 12;
  return mins === 0 ? `${displayHour} ${suffix}` : `${displayHour}:${String(mins).padStart(2, "0")} ${suffix}`;
}

function buildTimelineLayout(events: FestivalEvent[]): { blocks: TimelineEventBlock[]; columns: number } {
  const ranged = events
    .map((event) => {
      const range = getEventMinuteRange(event);
      return range ? { event, ...range } : null;
    })
    .filter((entry): entry is { event: FestivalEvent; start: number; end: number } => entry !== null)
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const active: Array<{ end: number; column: number }> = [];
  const blocks: TimelineEventBlock[] = [];
  let maxColumns = 1;
  let groupBlockIndexes: number[] = [];
  let groupMaxColumns = 1;

  for (const item of ranged) {
    for (let i = active.length - 1; i >= 0; i -= 1) {
      if (active[i].end <= item.start) {
        active.splice(i, 1);
      }
    }

    if (active.length === 0 && groupBlockIndexes.length > 0) {
      groupBlockIndexes.forEach((index) => {
        blocks[index].groupColumns = groupMaxColumns;
      });
      groupBlockIndexes = [];
      groupMaxColumns = 1;
    }

    const usedColumns = new Set(active.map((entry) => entry.column));
    let column = 0;
    while (usedColumns.has(column)) column += 1;

    active.push({ end: item.end, column });
    const concurrentColumns = Math.max(...active.map((entry) => entry.column), 0) + 1;
    groupMaxColumns = Math.max(groupMaxColumns, concurrentColumns);
    const blockIndex = blocks.push({
      event: item.event,
      start: item.start,
      end: item.end,
      column,
      groupColumns: 1,
    }) - 1;
    groupBlockIndexes.push(blockIndex);

    maxColumns = Math.max(maxColumns, concurrentColumns);
  }

  if (groupBlockIndexes.length > 0) {
    groupBlockIndexes.forEach((index) => {
      blocks[index].groupColumns = groupMaxColumns;
    });
  }

  return { blocks, columns: maxColumns };
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = hex.trim().replace("#", "");
  const full = normalized.length === 3
    ? normalized.split("").map((char) => `${char}${char}`).join("")
    : normalized;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  const value = Number.parseInt(full, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

function getTimelineFillColor(type: EventType): string {
  const rgb = hexToRgb(getProjectTypeColor(type));
  if (!rgb) return "#f3efe6";
  const mix = 0.72;
  const r = Math.round(255 - (255 - rgb.r) * (1 - mix));
  const g = Math.round(255 - (255 - rgb.g) * (1 - mix));
  const b = Math.round(255 - (255 - rgb.b) * (1 - mix));
  return `rgb(${r}, ${g}, ${b})`;
}

type FestivalMapAppProps = {
  venues: Venue[];
  events: FestivalEvent[];
  dataSourceLabel?: string;
  debug?: {
    totalRows: number;
    confirmedRows: number;
    matchedRows: number;
    unmatchedLocations: string[];
  };
};

export function FestivalMapApp({ venues, events, dataSourceLabel, debug }: FestivalMapAppProps) {
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null);
  const [lastInteractedVenueId, setLastInteractedVenueId] = useState<string | null>(null);
  const [activeDays, setActiveDays] = useState<FestivalDay[]>(() => getDefaultActiveDays(events));
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [listView, setListView] = useState<"venues" | "schedule">("schedule");
  const [isTimelineOpen, setIsTimelineOpen] = useState(false);
  const [showPastEvents, setShowPastEvents] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
  const [activeProjectTypes, setActiveProjectTypes] = useState<EventType[]>(ALL_PROJECT_TYPES);
  const [isProjectTypeMenuOpen, setIsProjectTypeMenuOpen] = useState(false);
  const [mapType, setMapType] = useState<"satellite" | "roadmap">("satellite");
  const [searchQuery, setSearchQuery] = useState("");
  const [mapCenter, setMapCenter] = useState(MAP_CENTER);
  const [mapZoom, setMapZoom] = useState(MAP_DEFAULT_ZOOM);
  const [timelineZoom, setTimelineZoom] = useState(TIMELINE_DEFAULT_ZOOM);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [hoveredVenueId, setHoveredVenueId] = useState<string | null>(null);
  const [allowOutOfBoundsNavigation, setAllowOutOfBoundsNavigation] = useState(false);
  const [geolocationStatus, setGeolocationStatus] = useState<
    "idle" | "requesting" | "ready" | "denied" | "unavailable" | "error"
  >("idle");
  const hasCenteredOnUserRef = useRef(false);
  const timelineScrollRef = useRef<HTMLDivElement | null>(null);
  const hasAutoScrolledTimelineRef = useRef(false);
  const supportsHoverRef = useRef(false);

  const geolocationHint =
    geolocationStatus === "requesting"
      ? "Locating..."
      : geolocationStatus === "denied"
        ? "Location access denied"
        : geolocationStatus === "unavailable"
          ? "Geolocation unavailable"
          : geolocationStatus === "error"
            ? "Location lookup failed"
            : "";

  const selectedVenue = venues.find((venue) => venue.id === selectedVenueId) ?? null;
  const selectedVenueLabelProjectTypes = selectedVenue ? getVenueLabelProjectTypes(selectedVenue) : [];
  const venueById = venues.reduce<globalThis.Map<string, Venue>>((acc, venue) => {
    acc.set(venue.id, venue);
    return acc;
  }, new globalThis.Map());
  const availableDays = DAY_DISPLAY_ORDER.filter((day) => events.some((event) => event.day === day));
  const effectiveActiveDays = activeDays.filter((day) => availableDays.includes(day));
  const activeDayFilter = effectiveActiveDays.length > 0 ? effectiveActiveDays : availableDays;

  const lowerQuery = searchQuery.toLowerCase();
  const eventsByVenueId = events.reduce<globalThis.Map<string, FestivalEvent[]>>((acc, event) => {
    const existing = acc.get(event.venueId);
    if (existing) {
      existing.push(event);
    } else {
      acc.set(event.venueId, [event]);
    }
    return acc;
  }, new globalThis.Map());

  const venueCategoryById = venues.reduce<globalThis.Map<string, string>>((acc, venue) => {
    acc.set(venue.id, getVenueCategoryKey(venue));
    return acc;
  }, new globalThis.Map());

  const venueColorById = venues.reduce<globalThis.Map<string, string>>((acc, venue) => {
    if (venue.serviceType) {
      acc.set(venue.id, SERVICE_TYPE_COLORS[venue.serviceType]);
      return acc;
    }
    const category = venueCategoryById.get(venue.id) ?? VENUE_KEY;
    acc.set(venue.id, PIN_CATEGORY_COLORS[category] ?? PIN_CATEGORY_COLORS[VENUE_KEY]);
    return acc;
  }, new globalThis.Map());

  const hasActiveProjectTypeFilter = activeProjectTypes.length < ALL_PROJECT_TYPES.length;

  const visibleVenues = venues.filter((venue) => {
    const venueEvents = eventsByVenueId.get(venue.id) ?? [];
    const labelProjectTypes = getVenueLabelProjectTypes(venue);
    const matchesProjectType = hasActiveProjectTypeFilter
      ? labelProjectTypes.some((type) => activeProjectTypes.includes(type)) ||
        venueEvents.some((event) => eventMatchesProjectTypeFilter(event, activeProjectTypes))
      : true;

    const matchesSearch = lowerQuery
      ? venue.name.toLowerCase().includes(lowerQuery) ||
        venueEvents.some((event) => {
          if (!activeDayFilter.includes(event.day) || !eventMatchesProjectTypeFilter(event, activeProjectTypes)) {
            return false;
          }
          return (
            event.title.toLowerCase().includes(lowerQuery) ||
            event.host.toLowerCase().includes(lowerQuery) ||
            (event.description || "").toLowerCase().includes(lowerQuery)
          );
        })
      : true;
    return matchesProjectType && matchesSearch;
  });

  const visibleEvents = events
    .filter((event) => {
      const venue = venueById.get(event.venueId);
      if (venue?.serviceType) {
        return false;
      }
      if (isUnscheduledEvent(event)) {
        return false;
      }
      const matchesDay = activeDayFilter.includes(event.day);
      const matchesProjectType = eventMatchesProjectTypeFilter(event, activeProjectTypes);

      const matchesSearch = lowerQuery
        ? event.title.toLowerCase().includes(lowerQuery) ||
          event.host.toLowerCase().includes(lowerQuery) ||
          (event.description || "").toLowerCase().includes(lowerQuery)
        : true;
      return matchesDay && matchesProjectType && matchesSearch;
    })
    .sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""));

  const scheduleVisibleEvents = visibleEvents
    .filter((event) => showPastEvents || !now || !isPastEvent(event, now))
    .sort(sortScheduleEvents);

  const selectedVenueEvents = selectedVenue
    ? events
        .filter(
          (event) =>
            event.venueId === selectedVenue.id &&
            activeDayFilter.includes(event.day) &&
            !getEventProjectTypes(event).includes("services")
        )
        .filter((event) => showPastEvents || !now || !isPastEvent(event, now))
        .sort(sortScheduleEvents)
    : [];
  const selectedVenueScheduledEvents = selectedVenueEvents.filter((event) => !isUnscheduledEvent(event));
  const selectedVenueUnscheduledEvents = selectedVenueEvents.filter((event) => isUnscheduledEvent(event));
  const hasUnscheduledOnlyView = selectedVenueScheduledEvents.length === 0 && selectedVenueUnscheduledEvents.length > 0;
  const selectedVenueDescription = (() => {
    if (!selectedVenue) return "";
    const venueDescription = (selectedVenue.description || "").trim();
    const hasGenericLocationDescription = /^Mapped from locations\.json\b/i.test(venueDescription);
    if (venueDescription && !hasGenericLocationDescription) {
      return venueDescription;
    }
    const unscheduledFallback = selectedVenueUnscheduledEvents
      .filter((event) => isUnscheduledEvent(event))
      .map((event) => getVisibleEventDescription(event))
      .find(Boolean);
    return unscheduledFallback || venueDescription;
  })();
  const visibleMappableVenues = visibleVenues.filter(
    (venue) => typeof venue.lat === "number" && typeof venue.lng === "number"
  );

  const venuesByCategory = visibleVenues
    .filter((venue) => !venue.serviceType)
    .reduce<globalThis.Map<string, Venue[]>>((acc, venue) => {
    const category = venueCategoryById.get(venue.id) ?? VENUE_KEY;
    const existing = acc.get(category);
    if (existing) {
      existing.push(venue);
    } else {
      acc.set(category, [venue]);
    }
    return acc;
    }, new globalThis.Map());

  const sortedVenueGroups = PIN_CATEGORY_ORDER.map((category) => ({
    category,
    categoryLabel: getCategoryDisplayLabel(category),
    venues: [...(venuesByCategory.get(category) ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
  }));
  const visibleCategorizedVenuesCount = sortedVenueGroups
    .reduce((sum, group) => sum + group.venues.length, 0);

  const scheduleByDay = DAY_DISPLAY_ORDER.map((day) => {
    const dayEvents = scheduleVisibleEvents.filter((event) => event.day === day);
    const bySlot = dayEvents.reduce<globalThis.Map<string, FestivalEvent[]>>((acc, event) => {
      const key = `${event.startTime}__${event.endTime}`;
      const existing = acc.get(key);
      if (existing) {
        existing.push(event);
      } else {
        acc.set(key, [event]);
      }
      return acc;
    }, new globalThis.Map());

    const slots = Array.from(bySlot.entries())
      .map(([key, items]) => {
        const [startTime, endTime] = key.split("__");
        return {
          key,
          startTime,
          endTime,
          sortValue: parseTimeToMinutes(startTime) ?? Number.MAX_SAFE_INTEGER,
          events: items.sort((a, b) => a.title.localeCompare(b.title)),
        };
      })
      .sort((a, b) => a.sortValue - b.sortValue || a.startTime.localeCompare(b.startTime));

    return {
      day,
      label: dayLabels[day],
      slots,
      count: dayEvents.length,
    };
  }).filter((entry) => entry.count > 0);

  const timelineDays = scheduleByDay.map((entry) => entry.day);
  const timelineLayoutsByDay = new globalThis.Map<FestivalDay, { blocks: TimelineEventBlock[]; columns: number }>();
  for (const day of timelineDays) {
    timelineLayoutsByDay.set(
      day,
      buildTimelineLayout(scheduleVisibleEvents.filter((event) => event.day === day))
    );
  }
  const timelineRanges = scheduleVisibleEvents
    .map((event) => getEventMinuteRange(event))
    .filter((entry): entry is { start: number; end: number } => entry !== null);
  const timelineStart = timelineRanges.length
    ? Math.max(0, Math.floor(Math.min(...timelineRanges.map((entry) => entry.start)) / 60) * 60)
    : 8 * 60;
  const timelineEnd = timelineRanges.length
    ? Math.min(26 * 60, Math.ceil(Math.max(...timelineRanges.map((entry) => entry.end)) / 60) * 60)
    : 24 * 60;
  const timelineHourMarks = Array.from(
    { length: Math.max(Math.floor((timelineEnd - timelineStart) / 60) + 1, 1) },
    (_, idx) => timelineStart + idx * 60
  );
  const timelinePixelsPerMinute = 1.2;
  const timelineHeight = Math.max((timelineEnd - timelineStart) * timelinePixelsPerMinute, 360);
  const timelineLaneWidth = Math.round(TIMELINE_BASE_LANE_WIDTH * timelineZoom);
  const timelineZoomPercentLabel = `${Math.round(timelineZoom * 100)}%`;
  const currentDayByNow: FestivalDay | null = (() => {
    if (!now) return null;
    const day = now.getDay();
    if (day === 0) return "sun";
    if (day === 1) return "mon";
    if (day === 2) return "tue";
    if (day === 3) return "wed";
    if (day === 4) return "thu";
    if (day === 5) return "fri";
    return "sat";
  })();
  const currentMinutesByNow = now ? now.getHours() * 60 + now.getMinutes() : null;

  function toggleDay(day: FestivalDay) {
    setActiveDays((current) =>
      current.includes(day) ? current.filter((entry) => entry !== day) : [...current, day]
    );
  }

  function toggleProjectType(types: EventType[]) {
    setActiveProjectTypes((current) => {
      const isSelected = types.every((type) => current.includes(type));
      if (isSelected) {
        return current.filter((entry) => !types.includes(entry));
      }
      const merged = [...current];
      types.forEach((type) => {
        if (!merged.includes(type)) {
          merged.push(type);
        }
      });
      return merged;
    });
  }

  function focusVenue(venue: Venue, zoom = MAP_FOCUS_ZOOM) {
    const lat = venue.lat ?? MAP_CENTER.lat;
    const lng = venue.lng ?? MAP_CENTER.lng;
    const center = getModalSafeCenter({ lat, lng }, zoom);
    setSelectedVenueId(venue.id);
    setLastInteractedVenueId(venue.id);
    setSelectedEventId(null);
    setAllowOutOfBoundsNavigation(false);
    setMapCenter(center);
    setMapZoom(zoom);
  }

  function focusEvent(event: FestivalEvent) {
    const venue = venues.find((entry) => entry.id === event.venueId) ?? null;
    // When selecting from the sidebar, center on the venue location first.
    if (typeof venue?.lat === "number" && typeof venue.lng === "number") {
      setMapZoom(MAP_FOCUS_ZOOM);
      setMapCenter(getModalSafeCenter({ lat: venue.lat, lng: venue.lng }, MAP_FOCUS_ZOOM));
    } else if (
      typeof event.lat === "number" &&
      typeof event.lng === "number" &&
      !Number.isNaN(event.lat) &&
      !Number.isNaN(event.lng)
    ) {
      setMapZoom(MAP_FOCUS_ZOOM);
      setMapCenter(getModalSafeCenter({ lat: event.lat, lng: event.lng }, MAP_FOCUS_ZOOM));
    }

    if (venue) {
      setSelectedVenueId(venue.id);
      setLastInteractedVenueId(venue.id);
      setAllowOutOfBoundsNavigation(false);
    }

    setSelectedEventId(event.id);
  }

  function adjustTimelineZoom(targetZoom: number, anchorClientX?: number) {
    const clampedZoom = clamp(targetZoom, TIMELINE_ZOOM_MIN, TIMELINE_ZOOM_MAX);
    if (Math.abs(clampedZoom - timelineZoom) < 0.001) return;

    const scrollElement = timelineScrollRef.current;
    if (!scrollElement) {
      setTimelineZoom(clampedZoom);
      return;
    }

    const rect = scrollElement.getBoundingClientRect();
    const viewportX = anchorClientX !== undefined
      ? clamp(anchorClientX - rect.left, 0, scrollElement.clientWidth)
      : scrollElement.clientWidth / 2;
    const contentX = scrollElement.scrollLeft + viewportX;
    const zoomScale = clampedZoom / timelineZoom;
    setTimelineZoom(clampedZoom);

    window.requestAnimationFrame(() => {
      if (!timelineScrollRef.current) return;
      timelineScrollRef.current.scrollLeft = Math.max(contentX * zoomScale - viewportX, 0);
    });
  }

  useEffect(() => {
    if (!navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const nextLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setUserLocation(nextLocation);
        setGeolocationStatus("ready");
        if (!hasCenteredOnUserRef.current) {
          setMapCenter(nextLocation);
          setMapZoom((current) => Math.max(current, 17.2));
          setAllowOutOfBoundsNavigation(true);
          hasCenteredOnUserRef.current = true;
        }
      },
      (error: GeolocationPositionError) => {
        if (error.code === error.PERMISSION_DENIED) {
          setGeolocationStatus("denied");
          return;
        }
        if (error.code === error.POSITION_UNAVAILABLE) {
          setGeolocationStatus("unavailable");
          return;
        }
        setGeolocationStatus("error");
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 15000,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(hover: hover) and (pointer: fine)");
    const applySupport = () => {
      supportsHoverRef.current = media.matches;
      if (!media.matches) {
        setHoveredVenueId(null);
      }
    };
    applySupport();
    media.addEventListener("change", applySupport);
    return () => {
      media.removeEventListener("change", applySupport);
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 60000);
    const kickoff = window.setTimeout(() => {
      setNow(new Date());
    }, 0);
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(kickoff);
    };
  }, []);

  useEffect(() => {
    if (!isTimelineOpen) {
      hasAutoScrolledTimelineRef.current = false;
      return;
    }
    if (!timelineScrollRef.current || !now || hasAutoScrolledTimelineRef.current || !currentDayByNow) return;
    if (!timelineDays.includes(currentDayByNow)) return;
    if (currentMinutesByNow === null) return;

    const section = timelineScrollRef.current.querySelector<HTMLElement>(
      `[data-timeline-day="${currentDayByNow}"]`
    );
    if (!section) return;

    const lineY = (currentMinutesByNow - timelineStart) * timelinePixelsPerMinute;
    const sectionTop = section.offsetTop;
    const toolbarOffset = 120;
    const desiredTop = Math.max(sectionTop + lineY - toolbarOffset, 0);
    timelineScrollRef.current.scrollTo({ top: desiredTop, behavior: "smooth" });
    hasAutoScrolledTimelineRef.current = true;
  }, [isTimelineOpen, now, currentDayByNow, currentMinutesByNow, timelineDays, timelineStart, timelinePixelsPerMinute]);

  useEffect(() => {
    if (selectedVenueId) {
      setHoveredVenueId(null);
    }
  }, [selectedVenueId]);

  return (
    <main className="legacy-app">
      <header className="legacy-banner">
        <div className="legacy-banner-title">
          <picture className="legacy-banner-art">
            <source media="(min-width: 900px)" srcSet={banner2560.src} />
            <img
              src={banner1080.src}
              alt="Bombay Beach Biennale 2026"
              width={banner1080.width}
              height={banner1080.height}
            />
          </picture>
        </div>
      </header>

      <div className="legacy-shell">
        <section className="legacy-map-panel">
          <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ""}>
            <Map
              center={mapCenter}
              zoom={mapZoom}
              mapId="2f9f04bb8e9c458045b99a65"
              mapTypeId={mapType}
              disableDefaultUI={true}
              zoomControl={!selectedVenue}
              clickableIcons={false}
              gestureHandling={selectedVenue ? "none" : "greedy"}
              minZoom={MAP_MIN_ZOOM}
              maxZoom={MAP_MAX_ZOOM}
              onCameraChanged={(ev) => {
                const nextCenter = ev.detail.center;
                const nextZoom = ev.detail.zoom;
                const canMoveOutsideFence =
                  allowOutOfBoundsNavigation && userLocation
                    ? distanceMeters(userLocation.lat, userLocation.lng, nextCenter.lat, nextCenter.lng) <= 3000
                    : false;
                if (
                  (isInsideGeofence(nextCenter.lat, nextCenter.lng) || canMoveOutsideFence) &&
                  hasCameraChanged(mapCenter, nextCenter, mapZoom, nextZoom)
                ) {
                  setMapCenter(nextCenter);
                  if (Math.abs(mapZoom - nextZoom) > ZOOM_EPSILON) {
                    setMapZoom(nextZoom);
                  }
                }
              }}
              style={{ width: "100%", height: "100%" }}
            >
              {visibleMappableVenues.slice(0, 300).map((venue) => {
                const serviceIcon = getServiceIcon(venue.serviceType);
                const venueSchedulePreview = (eventsByVenueId.get(venue.id) ?? [])
                  .filter((event) => !isUnscheduledEvent(event))
                  .filter((event) => activeDayFilter.includes(event.day) && eventMatchesProjectTypeFilter(event, activeProjectTypes))
                  .filter((event) => showPastEvents || !now || !isPastEvent(event, now))
                  .sort(sortScheduleEvents);
                const previewItems = venueSchedulePreview.slice(0, 2);
                const remainingCount = Math.max(venueSchedulePreview.length - previewItems.length, 0);
                return (
                  <AdvancedMarker
                    key={venue.id}
                    position={{ lat: venue.lat || 33.351, lng: venue.lng || -115.731 }}
                    anchorPoint={AdvancedMarkerAnchorPoint.CENTER}
                  >
                    {serviceIcon ? (
                      <div
                        className="legacy-service-pin"
                        aria-label={venue.name}
                        style={{ "--pin-color": venueColorById.get(venue.id) || "#4b5563" } as CSSProperties}
                      >
                        <span className="legacy-pin-service-icon" aria-hidden="true">
                          {serviceIcon}
                        </span>
                      </div>
                    ) : (
                      <div
                        className="legacy-pin-wrap"
                        onMouseEnter={() => {
                          if (!supportsHoverRef.current || selectedVenueId) return;
                          setHoveredVenueId(venue.id);
                        }}
                        onMouseLeave={() => {
                          setHoveredVenueId((current) => (current === venue.id ? null : current));
                        }}
                      >
                        <button
                          className={`legacy-pin ${selectedVenueId === venue.id ? "is-selected" : ""} ${lastInteractedVenueId === venue.id ? "is-last-interacted" : ""}`}
                          type="button"
                          aria-label={venue.name}
                          style={{ "--pin-color": venueColorById.get(venue.id) || venue.accent || "#8b5cf6" } as CSSProperties}
                          onMouseDown={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                          }}
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            setSelectedVenueId(venue.id);
                            setLastInteractedVenueId(venue.id);
                            setSelectedEventId(null);
                          }}
                        />
                        {hoveredVenueId === venue.id ? (
                          <div className="legacy-pin-hover-card" role="status" aria-live="polite">
                            <strong>{venue.name}</strong>
                            {previewItems.length > 0 ? (
                              <ul className="legacy-popup-mini-list">
                                {previewItems.map((event) => (
                                  <li key={event.id}>
                                    <strong>{event.title}</strong>
                                    <span>{dayLabels[event.day]} | {event.startTime} - {event.endTime}</span>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <span className="legacy-pin-hover-empty">No upcoming scheduled events</span>
                            )}
                            {remainingCount > 0 ? (
                              <span className="legacy-pin-hover-more">+{remainingCount} more</span>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    )}
                  </AdvancedMarker>
                );
              })}
              {userLocation ? (
                <AdvancedMarker position={userLocation} anchorPoint={AdvancedMarkerAnchorPoint.CENTER} zIndex={1000}>
                  <div className="legacy-user-dot" aria-label="Your location" />
                </AdvancedMarker>
              ) : null}
            </Map>
          </APIProvider>
          <div className="legacy-map-controls">
            <div className="legacy-control-row">
              <button
                className={`legacy-chip ${mapType === "satellite" ? "active" : ""}`}
                type="button"
                onClick={() => setMapType("satellite")}
              >
                Satellite
              </button>
              <button
                className={`legacy-chip ${mapType === "roadmap" ? "active" : ""}`}
                type="button"
                onClick={() => setMapType("roadmap")}
              >
                Street
              </button>
            </div>
            <button
              className={`legacy-chip legacy-chip-geo ${allowOutOfBoundsNavigation && userLocation ? "active" : ""}`}
              type="button"
              disabled={!userLocation}
              onClick={() => {
                if (!userLocation) return;
                setAllowOutOfBoundsNavigation(true);
                setMapCenter(userLocation);
                setMapZoom(Math.max(mapZoom, 17.2));
              }}
            >
              {geolocationStatus === "requesting" ? "Locating..." : "My Location"}
            </button>
            <div className="legacy-control-row">
              <button
                className={`legacy-chip ${selectedVenueId === null ? "active" : ""}`}
                type="button"
                onClick={() => {
                  setSelectedVenueId(null);
                  setSelectedEventId(null);
                  setAllowOutOfBoundsNavigation(false);
                  setMapCenter(MAP_CENTER);
                  setMapZoom(MAP_DEFAULT_ZOOM);
                }}
              >
                Reset
              </button>
            </div>
            {geolocationHint ? <span className="legacy-geo-status">{geolocationHint}</span> : null}
          </div>
          {selectedVenue ? (
            <div
              className="legacy-map-modal-overlay"
              role="presentation"
              onClick={() => {
                setSelectedVenueId(null);
                setSelectedEventId(null);
              }}
            >
              <article
                className="legacy-popup is-centered-modal"
                role="dialog"
                aria-modal="true"
                aria-label={`${selectedVenue.name} venue details`}
                onMouseDown={(event) => {
                  event.stopPropagation();
                }}
                onClick={(event) => {
                  event.stopPropagation();
                }}
                onWheel={(event) => {
                  event.stopPropagation();
                }}
              >
                <div className="legacy-popup-head">
                  <div>
                    <h3>{selectedVenue.name}</h3>
                    <p className="legacy-popup-subtitle">
                      {selectedVenueScheduledEvents.length > 0
                        ? `${selectedVenueScheduledEvents.length} scheduled ${selectedVenueScheduledEvents.length === 1 ? "event" : "events"}`
                        : selectedVenueUnscheduledEvents.length > 0
                          ? "Installation details"
                          : "0 scheduled events"}
                    </p>
                    {selectedVenueLabelProjectTypes.length > 0 ? (
                      <div className="legacy-popup-type-tags">
                        {selectedVenueLabelProjectTypes.map((type) => (
                          <span
                            key={`venue-type-${type}`}
                            className={`type-chip type-${type}`}
                            style={{ backgroundColor: getProjectTypeColor(type) }}
                          >
                            {eventTypeLabels[type]}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="legacy-popup-close"
                    aria-label="Close location popup"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setSelectedVenueId(null);
                      setSelectedEventId(null);
                    }}
                  >
                    ×
                  </button>
                </div>
                <div className="legacy-popup-content">
                  {selectedVenueDescription && !hasUnscheduledOnlyView ? (
                    <p className="legacy-popup-description">{selectedVenueDescription}</p>
                  ) : null}
                  {selectedVenueScheduledEvents.length > 0 ? (
                    <>
                      <details className="legacy-popup-section is-schedule" open>
                        <summary className="legacy-popup-section-title">Schedule</summary>
                        <div className="legacy-popup-event-list">
                          {selectedVenueScheduledEvents.map((event) => {
                            const visibleDescription = getVisibleEventDescription(event);
                            return (
                              <button
                                key={event.id}
                                type="button"
                                className="legacy-popup-event legacy-popup-event-button"
                                onClick={() => focusEvent(event)}
                              >
                                <div className="legacy-popup-event-head">
                                  <div className="legacy-type-chip-group">
                                    {getEventProjectTypes(event).map((type) => (
                                      <span
                                        key={`${event.id}-popup-type-${type}`}
                                        className={`type-chip type-${type}`}
                                        style={{ backgroundColor: getProjectTypeColor(type) }}
                                      >
                                        {eventTypeLabels[type]}
                                      </span>
                                    ))}
                                  </div>
                                  {!isUnscheduledEvent(event) ? (
                                    <span className="legacy-popup-meta">
                                      {dayLabels[event.day]} | {event.startTime} - {event.endTime}
                                    </span>
                                  ) : null}
                                </div>
                                <strong>{event.title}</strong>
                                <p>{event.host}</p>
                                {event.airtableRecordId ? (
                                  <p className="legacy-popup-reconciled">Matched Airtable event</p>
                                ) : null}
                                {visibleDescription ? (
                                  <p className="legacy-popup-description">{visibleDescription}</p>
                                ) : null}
                              </button>
                            );
                          })}
                        </div>
                      </details>

                    </>
                  ) : selectedVenueUnscheduledEvents.length > 0 ? (
                    <div className="legacy-popup-event-list">
                      {selectedVenueUnscheduledEvents.map((event) => {
                        const visibleDescription = getVisibleEventDescription(event);
                        return (
                          <div key={event.id} className="legacy-popup-event">
                            <div className="legacy-popup-event-head">
                              <div className="legacy-type-chip-group">
                                {getEventProjectTypes(event).map((type) => (
                                  <span
                                    key={`${event.id}-popup-unscheduled-type-${type}`}
                                    className={`type-chip type-${type}`}
                                    style={{ backgroundColor: getProjectTypeColor(type) }}
                                  >
                                    {eventTypeLabels[type]}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <strong>{event.title}</strong>
                            <p>{event.host}</p>
                            {visibleDescription ? (
                              <p className="legacy-popup-description">{visibleDescription}</p>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="legacy-popup-empty">No scheduled events for this venue.</p>
                  )}
                </div>
              </article>
            </div>
          ) : null}
        </section>

        <aside className="legacy-list-panel">
          <section className="legacy-list-block legacy-list-controls">
            <div className="legacy-search-row">
              <input
                type="search"
                placeholder="Search venues or events..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="legacy-search"
              />
              <div className="legacy-project-filters">
                <button
                  type="button"
                  className={`legacy-chip legacy-icon-button ${hasActiveProjectTypeFilter ? "active" : ""}`}
                  onClick={() => setIsProjectTypeMenuOpen((current) => !current)}
                  aria-expanded={isProjectTypeMenuOpen}
                  aria-haspopup="true"
                  aria-label="Project type filters"
                >
                  <span className="legacy-filter-icon" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </span>
                </button>
                {isProjectTypeMenuOpen ? (
                  <div className="legacy-project-filters-popover" role="dialog" aria-label="Project type filters">
                    <div className="legacy-project-filters-head">
                      <strong>Project types</strong>
                      <button
                        type="button"
                        className="legacy-popup-close"
                        aria-label="Close filters"
                        onClick={() => setIsProjectTypeMenuOpen(false)}
                      >
                        ×
                      </button>
                    </div>
                    <div className="legacy-project-filters-list">
                      {PROJECT_TYPE_FILTER_OPTIONS.map((option) => (
                        <label key={option.id} className="legacy-filter-option">
                          <input
                            type="checkbox"
                            checked={option.types.every((type) => activeProjectTypes.includes(type))}
                            onChange={() => toggleProjectType(option.types)}
                          />
                          <span>{option.label}</span>
                        </label>
                      ))}
                    </div>
                    <div className="legacy-project-filters-actions">
                      <button
                        type="button"
                        className="legacy-chip"
                        onClick={() => setActiveProjectTypes(ALL_PROJECT_TYPES)}
                      >
                        Select all
                      </button>
                      <button
                        type="button"
                        className="legacy-chip"
                        onClick={() => setActiveProjectTypes([])}
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
            <button
              type="button"
              className="legacy-chip legacy-mobile-filters-toggle"
              onClick={() => setIsMobileFiltersOpen((current) => !current)}
            >
              {isMobileFiltersOpen ? "Hide filters" : "Show filters"}
            </button>
            <div className={`legacy-mobile-filter-body ${isMobileFiltersOpen ? "is-open" : ""}`}>
              <div className="legacy-checkbox-row">
                {availableDays.map((day) => (
                  <label key={day} className="legacy-filter-option">
                    <input
                      type="checkbox"
                      checked={activeDays.includes(day)}
                      onChange={() => toggleDay(day)}
                    />
                    <span>{dayLabels[day]}</span>
                  </label>
                ))}
              </div>
              <label className="legacy-filter-option legacy-filter-toggle">
                <input
                  type="checkbox"
                  checked={showPastEvents}
                  onChange={() => setShowPastEvents((current) => !current)}
                />
                <span>Show past events</span>
              </label>
              <div className="legacy-control-row">
                <button
                  type="button"
                  className={`legacy-chip ${listView === "schedule" ? "active" : ""}`}
                  onClick={() => setListView("schedule")}
                >
                  Schedule
                </button>
                <button
                  type="button"
                  className={`legacy-chip ${listView === "venues" ? "active" : ""}`}
                  onClick={() => setListView("venues")}
                >
                  Venues
                </button>
                <button
                  type="button"
                  className={`legacy-chip ${isTimelineOpen ? "active" : ""}`}
                  onClick={() => setIsTimelineOpen(true)}
                >
                  Fullscreen timeline
                </button>
              </div>
            </div>
          </section>

          {listView === "venues" ? (
            <section className="legacy-list-block">
              <div className="legacy-list-title">
                <h2>{selectedVenue ? selectedVenue.name : "Venues"}</h2>
                <span>{visibleCategorizedVenuesCount}</span>
              </div>
              <div className="legacy-venue-list">
                {sortedVenueGroups.map((group) => (
                  <div key={group.category} className="legacy-venue-group">
                    <div className="legacy-venue-group-header">
                      <span>{group.categoryLabel}</span>
                      <span>{group.venues.length}</span>
                    </div>
                    {group.venues.map((venue) => (
                      <button
                        key={venue.id}
                        className={`legacy-venue-item ${selectedVenueId === venue.id ? "active" : ""}`}
                        type="button"
                        onClick={() => focusVenue(venue)}
                      >
                        <span
                          className="legacy-venue-dot"
                          style={{ "--pin-color": venueColorById.get(venue.id) || venue.accent || "#8b5cf6" } as CSSProperties}
                        />
                        <span>{getServiceIcon(venue.serviceType) ? `${getServiceIcon(venue.serviceType)} ` : ""}{venue.name}</span>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </section>
          ) : (
            <section className="legacy-list-block">
              <div className="legacy-list-title">
                <h2>Schedule</h2>
                <span>{scheduleVisibleEvents.length}</span>
              </div>

              <div className="legacy-event-list">
                {scheduleByDay.map((dayGroup) => (
                  <div key={dayGroup.day} className="legacy-venue-group">
                    <div className="legacy-venue-group-header">
                      <span>{dayGroup.label}</span>
                      <span>{dayGroup.count}</span>
                    </div>
                    {dayGroup.slots.map((slot) => (
                      <div key={slot.key} className="legacy-time-slot">
                        <div className="legacy-time-slot-header">
                          <strong>{slot.startTime} - {slot.endTime}</strong>
                          <span>{slot.events.length}</span>
                        </div>
                        <div className="legacy-time-slot-events">
                          {slot.events.map((event) => {
                            const venue = venueById.get(event.venueId);
                            const visibleDescription = getVisibleEventDescription(event);
                            return (
                              <button
                                key={event.id}
                                className={`legacy-event-item ${selectedEventId === event.id ? "active" : ""}`}
                                type="button"
                                onClick={() => focusEvent(event)}
                              >
                                <div className="legacy-type-chip-group">
                                  {getEventProjectTypes(event).map((type) => (
                                    <span
                                      key={`${event.id}-list-type-${type}`}
                                      className={`type-chip type-${type}`}
                                      style={{ backgroundColor: getProjectTypeColor(type) }}
                                    >
                                      {eventTypeLabels[type]}
                                    </span>
                                  ))}
                                </div>
                                <strong>{event.title}</strong>
                                <small>{venue?.name ?? "Unknown venue"}</small>
                                {event.airtableRecordId ? <small className="legacy-event-reconciled">Matched Airtable event</small> : null}
                                {visibleDescription ? (
                                  <small className="legacy-event-description">{visibleDescription}</small>
                                ) : null}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </section>
          )}

          {debug ? (
            <details className="legacy-debug">
              <summary>
                Matching debug ({debug.matchedRows}/{debug.confirmedRows})
              </summary>
              <div>
                <div>Total rows: {debug.totalRows}</div>
                <div>Confirmed rows: {debug.confirmedRows}</div>
                <div>Matched rows: {debug.matchedRows}</div>
                <div>Unmatched: {debug.unmatchedLocations.length}</div>
              </div>
            </details>
          ) : null}
        </aside>
      </div>

      {isTimelineOpen && typeof document !== "undefined" ? createPortal((
        <div className="legacy-timeline-overlay" role="dialog" aria-modal="true" aria-label="Fullscreen schedule timeline">
          <div className="legacy-timeline-shell">
            <div className="legacy-timeline-toolbar">
              <div>
                <strong>Schedule Timeline</strong>
                <p>Simultaneous events shown side-by-side by time block.</p>
              </div>
              <div className="legacy-timeline-toolbar-actions">
                <div className="legacy-timeline-zoom-controls" role="group" aria-label="Timeline zoom controls">
                  <button
                    type="button"
                    className="legacy-chip"
                    onClick={() => adjustTimelineZoom(timelineZoom - TIMELINE_ZOOM_STEP)}
                    aria-label="Zoom out timeline"
                  >
                    -
                  </button>
                  <button
                    type="button"
                    className="legacy-chip legacy-timeline-zoom-label"
                    onClick={() => adjustTimelineZoom(TIMELINE_DEFAULT_ZOOM)}
                    aria-label="Reset timeline zoom"
                  >
                    {timelineZoomPercentLabel}
                  </button>
                  <button
                    type="button"
                    className="legacy-chip"
                    onClick={() => adjustTimelineZoom(timelineZoom + TIMELINE_ZOOM_STEP)}
                    aria-label="Zoom in timeline"
                  >
                    +
                  </button>
                </div>
                <button
                  type="button"
                  className="legacy-chip"
                  onClick={() => setIsTimelineOpen(false)}
                >
                  Close
                </button>
              </div>
            </div>
            <div
              className="legacy-timeline-grid-wrap"
              ref={timelineScrollRef}
              onWheel={(event) => {
                if (!event.ctrlKey && !event.metaKey) return;
                event.preventDefault();
                const direction = event.deltaY > 0 ? -1 : 1;
                adjustTimelineZoom(timelineZoom + direction * TIMELINE_ZOOM_STEP, event.clientX);
              }}
              onTouchMove={(event) => {
                if (event.touches.length !== 2) return;
                const [firstTouch, secondTouch] = [event.touches[0], event.touches[1]];
                const dx = secondTouch.clientX - firstTouch.clientX;
                const dy = secondTouch.clientY - firstTouch.clientY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (!Number.isFinite(distance) || distance <= 0) return;

                const currentDistanceRef = (event.currentTarget as HTMLDivElement).dataset.pinchStartDistance;
                const currentZoomRef = (event.currentTarget as HTMLDivElement).dataset.pinchStartZoom;
                if (!currentDistanceRef || !currentZoomRef) return;

                event.preventDefault();
                const startDistance = Number(currentDistanceRef);
                const startZoom = Number(currentZoomRef);
                if (!Number.isFinite(startDistance) || startDistance <= 0 || !Number.isFinite(startZoom)) return;
                const midpointX = (firstTouch.clientX + secondTouch.clientX) / 2;
                adjustTimelineZoom(startZoom * (distance / startDistance), midpointX);
              }}
              onTouchStart={(event) => {
                if (event.touches.length !== 2) return;
                const [firstTouch, secondTouch] = [event.touches[0], event.touches[1]];
                const dx = secondTouch.clientX - firstTouch.clientX;
                const dy = secondTouch.clientY - firstTouch.clientY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (!Number.isFinite(distance) || distance <= 0) return;
                (event.currentTarget as HTMLDivElement).dataset.pinchStartDistance = String(distance);
                (event.currentTarget as HTMLDivElement).dataset.pinchStartZoom = String(timelineZoom);
              }}
              onTouchEnd={(event) => {
                if (event.touches.length < 2) {
                  delete (event.currentTarget as HTMLDivElement).dataset.pinchStartDistance;
                  delete (event.currentTarget as HTMLDivElement).dataset.pinchStartZoom;
                }
              }}
            >
              {timelineDays.length === 0 ? (
                <p className="legacy-popup-empty">No events available for timeline with current filters.</p>
              ) : (
                <div className="legacy-timeline-stack">
                {timelineDays.map((day) => {
                  const layout = timelineLayoutsByDay.get(day);
                  if (!layout) return null;
                  const showNowLine =
                    day === currentDayByNow &&
                    currentMinutesByNow !== null &&
                    currentMinutesByNow >= timelineStart &&
                    currentMinutesByNow <= timelineEnd;
                  const nowLineTop = showNowLine
                    ? (currentMinutesByNow - timelineStart) * timelinePixelsPerMinute
                    : 0;
                  const dayColumnWidth = Math.max(layout.columns, 1) * timelineLaneWidth;
                  const showHost = timelineLaneWidth >= 130;
                  const showVenue = timelineLaneWidth >= 104;
                  const showDescription = timelineLaneWidth >= 176;
                  return (
                    <section key={day} className="legacy-timeline-day-section" data-timeline-day={day}>
                      <div className="legacy-timeline-day-section-head">
                        <strong>{dayLabels[day]}</strong>
                        <span>{layout.blocks.length} events</span>
                      </div>
                      <div
                        className="legacy-timeline-day-grid"
                        style={{ gridTemplateColumns: `${TIMELINE_TIME_COLUMN_WIDTH}px ${dayColumnWidth}px` }}
                      >
                        <div className="legacy-timeline-time-col" style={{ height: `${timelineHeight}px` }}>
                          {timelineHourMarks.map((minute) => (
                            <div
                              key={`${day}-time-${minute}`}
                              className="legacy-timeline-time-mark"
                              style={{ top: `${(minute - timelineStart) * timelinePixelsPerMinute}px` }}
                            >
                              {formatMinutesLabel(minute)}
                            </div>
                          ))}
                        </div>
                        <div
                          className="legacy-timeline-day-col"
                          style={{ height: `${timelineHeight}px`, minWidth: `${dayColumnWidth}px` }}
                        >
                          {timelineHourMarks.map((minute) => (
                            <div
                              key={`${day}-${minute}`}
                              className="legacy-timeline-hour-line"
                              style={{ top: `${(minute - timelineStart) * timelinePixelsPerMinute}px` }}
                            />
                          ))}
                          {showNowLine ? (
                            <div className="legacy-timeline-now-line" style={{ top: `${nowLineTop}px` }}>
                              <span>Now</span>
                            </div>
                          ) : null}
                          {layout.blocks.map((block) => {
                            const top = (block.start - timelineStart) * timelinePixelsPerMinute;
                            const height = Math.max((block.end - block.start) * timelinePixelsPerMinute, 26);
                            const width = Math.max(timelineLaneWidth - TIMELINE_EVENT_GAP, 42);
                            const left = block.column * timelineLaneWidth + TIMELINE_EVENT_GAP / 2;
                            const venue = venueById.get(block.event.venueId);
                            const visibleDescription = getVisibleEventDescription(block.event);
                            return (
                              <button
                                key={block.event.id}
                                type="button"
                                className={`legacy-timeline-event ${selectedEventId === block.event.id ? "active" : ""}`}
                                style={{
                                  top: `${top}px`,
                                  height: `${height}px`,
                                  width: `${width}px`,
                                  left: `${left}px`,
                                  backgroundColor: getTimelineFillColor(block.event.type),
                                  borderColor: getProjectTypeColor(block.event.type),
                                }}
                                onClick={() => {
                                  focusEvent(block.event);
                                  setIsTimelineOpen(false);
                                }}
                              >
                                <span className="legacy-timeline-event-time">
                                  {block.event.startTime} - {block.event.endTime}
                                </span>
                                <strong>{block.event.title}</strong>
                                {showHost && block.event.host && block.event.host !== "TBD" ? (
                                  <small className="legacy-timeline-event-host">{block.event.host}</small>
                                ) : null}
                                {showVenue ? <small>{venue?.name ?? "Unknown venue"}</small> : null}
                                {showDescription && visibleDescription ? (
                                  <small className="legacy-timeline-event-description">{visibleDescription}</small>
                                ) : null}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </section>
                  );
                })}
                </div>
              )}
            </div>
          </div>
        </div>
      ), document.body) : null}

      <button
        type="button"
        className="legacy-mobile-timeline-fab"
        onClick={() => setIsTimelineOpen(true)}
      >
        Timeline
      </button>

    </main>
  );
}
