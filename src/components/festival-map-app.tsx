"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { APIProvider, Map, AdvancedMarker, AdvancedMarkerAnchorPoint } from "@vis.gl/react-google-maps";
import { dayLabels, eventTypeLabels } from "@/data/festival";
import { EventType, FestivalDay, FestivalEvent, Venue } from "@/types/festival";

const ALL_DAYS: FestivalDay[] = ["fri", "sat", "sun"];
const DAY_SORT_ORDER: Record<FestivalDay, number> = { fri: 0, sat: 1, sun: 2 };
const MAP_CENTER = { lat: 33.351508, lng: -115.729625 };
const MAP_DEFAULT_ZOOM = 16.9;
const MAP_FOCUS_ZOOM = 17.8;
const MAP_MIN_ZOOM = 14;
const MAP_MAX_ZOOM = 19.2;
const GEOFENCE_RADIUS_METERS = 1609.34; // 1 mile
const CAMERA_EPSILON = 0.000001;
const ZOOM_EPSILON = 0.001;

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
  const [activeDays, setActiveDays] = useState<FestivalDay[]>(ALL_DAYS);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [locationFilter, setLocationFilter] = useState<"all" | "placed" | "unplaced">("all");
  const [serviceFilter, setServiceFilter] = useState<"all" | "garbage" | "water" | "toilets" | "medic">("all");
  const [mapType, setMapType] = useState<"satellite" | "roadmap">("satellite");
  const [searchQuery, setSearchQuery] = useState("");
  const [mapCenter, setMapCenter] = useState(MAP_CENTER);
  const [mapZoom, setMapZoom] = useState(MAP_DEFAULT_ZOOM);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [allowOutOfBoundsNavigation, setAllowOutOfBoundsNavigation] = useState(false);
  const [geolocationStatus, setGeolocationStatus] = useState<
    "idle" | "requesting" | "ready" | "denied" | "unavailable" | "error"
  >("idle");
  const hasCenteredOnUserRef = useRef(false);

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
  const venueById = venues.reduce<globalThis.Map<string, Venue>>((acc, venue) => {
    acc.set(venue.id, venue);
    return acc;
  }, new globalThis.Map());

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

  const visibleVenues = venues.filter((venue) => {
    let matchesLocation = true;
    if (locationFilter === "placed") matchesLocation = venue.hasLocation !== false;
    if (locationFilter === "unplaced") matchesLocation = venue.hasLocation === false;
    const matchesService =
      serviceFilter === "all"
        ? true
        : venue.serviceType === serviceFilter;

    const matchesSearch = lowerQuery
      ? venue.name.toLowerCase().includes(lowerQuery) ||
        (eventsByVenueId.get(venue.id) ?? []).some((event) => {
          const eventMatchesLocation =
            locationFilter === "placed"
              ? event.hasLocation !== false
              : locationFilter === "unplaced"
                ? event.hasLocation === false
                : true;
          if (!eventMatchesLocation || !activeDays.includes(event.day)) {
            return false;
          }
          return (
            event.title.toLowerCase().includes(lowerQuery) ||
            event.host.toLowerCase().includes(lowerQuery) ||
            (event.description || "").toLowerCase().includes(lowerQuery)
          );
        })
      : true;
    return matchesLocation && matchesService && matchesSearch;
  });

  const visibleEvents = events
    .filter((event) => {
      const venue = venueById.get(event.venueId);
      if (venue?.serviceType) {
        return false;
      }
      const matchesDay = activeDays.includes(event.day);
      
      let matchesLocation = true;
      if (locationFilter === "placed") matchesLocation = event.hasLocation !== false;
      if (locationFilter === "unplaced") matchesLocation = event.hasLocation === false;

      const matchesSearch = lowerQuery
        ? event.title.toLowerCase().includes(lowerQuery) ||
          event.host.toLowerCase().includes(lowerQuery) ||
          (event.description || "").toLowerCase().includes(lowerQuery)
        : true;
      return matchesDay && matchesLocation && matchesSearch;
    })
    .sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""));

  const eventsByCategory = visibleEvents.reduce<globalThis.Map<string, FestivalEvent[]>>((acc, event) => {
    const venue = venueById.get(event.venueId);
    const category = venue ? getVenueCategoryKey(venue) : VENUE_KEY;
    const existing = acc.get(category);
    if (existing) {
      existing.push(event);
    } else {
      acc.set(category, [event]);
    }
    return acc;
  }, new globalThis.Map());

  const sortedEventGroups = PIN_CATEGORY_ORDER.map((category) => ({
    category,
    categoryLabel: getCategoryDisplayLabel(category),
    events: [...(eventsByCategory.get(category) ?? [])].sort((a, b) => {
        const timeDelta = (a.startTime || "").localeCompare(b.startTime || "");
        if (timeDelta !== 0) return timeDelta;
        return a.title.localeCompare(b.title);
      }),
  }));
  const visibleCategorizedEventsCount = sortedEventGroups
    .reduce((sum, group) => sum + group.events.length, 0);

  const selectedVenueSchedule = selectedVenue
    ? events
        .filter((event) => event.venueId === selectedVenue.id && activeDays.includes(event.day) && event.type !== "services")
        .sort(sortScheduleEvents)
    : [];
  const selectedVenueDescription = selectedVenue
    ? (selectedVenue.description || "").trim()
    : "";
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

  function toggleDay(day: FestivalDay) {
    setActiveDays((current) =>
      current.includes(day) ? current.filter((entry) => entry !== day) : [...current, day]
    );
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

  useEffect(() => {
    if (!navigator.geolocation) {
      setGeolocationStatus("unavailable");
      return;
    }

    setGeolocationStatus("requesting");

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

  return (
    <main className="legacy-app">
      <header className="legacy-banner">
        <div className="legacy-banner-title">
          <span className="legacy-kicker">Bombay Beach Biennale 2026</span>
          <h1>Art Map + Schedule</h1>
          {dataSourceLabel ? <p>Data source: {dataSourceLabel}</p> : null}
        </div>
        <div className="legacy-banner-controls">
          <input
            type="search"
            placeholder="Search venues or events..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="legacy-search"
          />
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
              All Venues
            </button>
            {ALL_DAYS.map((day) => (
              <button
                key={day}
                className={`legacy-chip ${activeDays.includes(day) ? "active" : ""}`}
                type="button"
                onClick={() => toggleDay(day)}
              >
                {dayLabels[day]}
              </button>
            ))}
          </div>
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
            {geolocationHint ? <span className="legacy-geo-status">{geolocationHint}</span> : null}
            <button
              className={`legacy-chip ${locationFilter === "all" ? "active" : ""}`}
              type="button"
              onClick={() => setLocationFilter("all")}
            >
              All Locations
            </button>
            <button
              className={`legacy-chip ${locationFilter === "placed" ? "active" : ""}`}
              type="button"
              onClick={() => setLocationFilter("placed")}
            >
              Mapped
            </button>
            <button
              className={`legacy-chip ${locationFilter === "unplaced" ? "active" : ""}`}
              type="button"
              onClick={() => setLocationFilter("unplaced")}
            >
              Missing Coordinates
            </button>
            <button
              className={`legacy-chip ${serviceFilter === "all" ? "active" : ""}`}
              type="button"
              onClick={() => setServiceFilter("all")}
            >
              All Services
            </button>
            <button
              className={`legacy-chip ${serviceFilter === "toilets" ? "active" : ""}`}
              type="button"
              onClick={() => setServiceFilter("toilets")}
            >
              Toilets
            </button>
            <button
              className={`legacy-chip ${serviceFilter === "water" ? "active" : ""}`}
              type="button"
              onClick={() => setServiceFilter("water")}
            >
              Water
            </button>
            <button
              className={`legacy-chip ${serviceFilter === "garbage" ? "active" : ""}`}
              type="button"
              onClick={() => setServiceFilter("garbage")}
            >
              Garbage
            </button>
            <button
              className={`legacy-chip ${serviceFilter === "medic" ? "active" : ""}`}
              type="button"
              onClick={() => setServiceFilter("medic")}
            >
              Medic
            </button>
          </div>
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
                      {selectedVenueSchedule.length} scheduled {selectedVenueSchedule.length === 1 ? "event" : "events"}
                    </p>
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
                  {selectedVenueDescription ? (
                    <p className="legacy-popup-description">{selectedVenueDescription}</p>
                  ) : null}
                  {selectedVenueSchedule.length > 0 ? (
                    <>
                      <details className="legacy-popup-section is-schedule" open>
                        <summary className="legacy-popup-section-title">Schedule</summary>
                        <div className="legacy-popup-event-list">
                          {selectedVenueSchedule.map((event) => {
                            const visibleDescription = getVisibleEventDescription(event);
                            return (
                              <article key={event.id} className="legacy-popup-event">
                                <div className="legacy-popup-event-head">
                                  <span
                                    className={`type-chip type-${event.type}`}
                                    style={{ backgroundColor: getProjectTypeColor(event.type) }}
                                  >
                                    {eventTypeLabels[event.type]}
                                  </span>
                                  <span className="legacy-popup-meta">
                                    {dayLabels[event.day]} | {event.startTime} - {event.endTime}
                                  </span>
                                </div>
                                <strong>{event.title}</strong>
                                <p>{event.host}</p>
                                {visibleDescription ? (
                                  <p className="legacy-popup-description">{visibleDescription}</p>
                                ) : null}
                              </article>
                            );
                          })}
                        </div>
                      </details>

                    </>
                  ) : (
                    <p className="legacy-popup-empty">No scheduled events for this venue.</p>
                  )}
                </div>
              </article>
            </div>
          ) : null}
        </section>

        <aside className="legacy-list-panel">
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

          <section className="legacy-list-block">
            <div className="legacy-list-title">
              <h2>Schedule</h2>
              <span>{visibleCategorizedEventsCount}</span>
            </div>

            <div className="legacy-event-list">
              {sortedEventGroups.map((group) => (
                <div key={group.category} className="legacy-venue-group">
                  <div className="legacy-venue-group-header">
                    <span>{group.categoryLabel}</span>
                    <span>{group.events.length}</span>
                  </div>
                  {group.events.map((event) => {
                    const venue = venueById.get(event.venueId);
                    const visibleDescription = getVisibleEventDescription(event);
                    return (
                      <button
                        key={event.id}
                        className={`legacy-event-item ${selectedEventId === event.id ? "active" : ""}`}
                        type="button"
                        onClick={() => focusEvent(event)}
                      >
                        <span
                          className={`type-chip type-${event.type}`}
                          style={{ backgroundColor: getProjectTypeColor(event.type) }}
                        >
                          {eventTypeLabels[event.type]}
                        </span>
                        <strong>{event.title}</strong>
                        <small>
                          {dayLabels[event.day]} | {event.startTime} - {event.endTime}
                        </small>
                        <small>{venue?.name ?? "Unknown venue"}</small>
                        {visibleDescription ? (
                          <small className="legacy-event-description">{visibleDescription}</small>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </section>

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

    </main>
  );
}
