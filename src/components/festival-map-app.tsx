"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { APIProvider, Map, AdvancedMarker, AdvancedMarkerAnchorPoint } from "@vis.gl/react-google-maps";
import { dayLabels, eventTypeLabels } from "@/data/festival";
import { FestivalDay, FestivalEvent, Venue } from "@/types/festival";

const ALL_DAYS: FestivalDay[] = ["fri", "sat", "sun"];
const MAP_CENTER = { lat: 33.351508, lng: -115.729625 };
const MAP_DEFAULT_ZOOM = 16.9;
const MAP_FOCUS_ZOOM = 17.8;
const MAP_MIN_ZOOM = 14;
const MAP_MAX_ZOOM = 19.2;
const GEOFENCE_RADIUS_METERS = 1609.34; // 1 mile
const CAMERA_EPSILON = 0.000001;
const ZOOM_EPSILON = 0.001;

const LEGACY_CATEGORY_COLORS: Record<string, string> = {
  parking: "#FA7B5D",
  bathroom: "#90B4FF",
  "local business": "#C98A76",
  "community hub": "#FFD2B7",
  museum: "#A17A7B",
  gallery: "#B8A5BF",
  studio: "#DDA390",
  venue: "#48564D",
  "art installation": "#9AA367",
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

function getLegacyCategory(venue: Venue): string {
  const label = (venue.label || "").toLowerCase();
  if (label.includes("parking")) return "parking";
  if (label.includes("bathroom")) return "bathroom";
  if (label.includes("local business")) return "local business";
  if (label.includes("community")) return "community hub";
  if (label.includes("museum")) return "museum";
  if (label.includes("gallery")) return "gallery";
  if (label.includes("studio")) return "studio";
  if (label.includes("venue")) return "venue";
  return "art installation";
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
  const [activeDays, setActiveDays] = useState<FestivalDay[]>(ALL_DAYS);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [locationFilter, setLocationFilter] = useState<"all" | "placed" | "unplaced">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [mapCenter, setMapCenter] = useState(MAP_CENTER);
  const [mapZoom, setMapZoom] = useState(MAP_DEFAULT_ZOOM);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  const selectedVenue = venues.find((venue) => venue.id === selectedVenueId) ?? null;
  const selectedEvent = events.find((event) => event.id === selectedEventId) ?? null;

  const lowerQuery = searchQuery.toLowerCase();

  const visibleVenues = venues.filter((venue) => {
    let matchesLocation = true;
    if (locationFilter === "placed") matchesLocation = venue.hasLocation !== false;
    if (locationFilter === "unplaced") matchesLocation = venue.hasLocation === false;
    
    const matchesSearch = lowerQuery ? venue.name.toLowerCase().includes(lowerQuery) : true;
    return matchesLocation && matchesSearch;
  });

  const visibleEvents = events
    .filter((event) => {
      const matchesDay = activeDays.includes(event.day);
      const matchesVenue = selectedVenueId ? event.venueId === selectedVenueId : true;
      
      let matchesLocation = true;
      if (locationFilter === "placed") matchesLocation = event.hasLocation !== false;
      if (locationFilter === "unplaced") matchesLocation = event.hasLocation === false;

      const matchesSearch = lowerQuery
        ? event.title.toLowerCase().includes(lowerQuery) ||
          event.host.toLowerCase().includes(lowerQuery) ||
          (event.description || "").toLowerCase().includes(lowerQuery)
        : true;
      return matchesDay && matchesVenue && matchesLocation && matchesSearch;
    })
    .sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""));

  function toggleDay(day: FestivalDay) {
    setActiveDays((current) =>
      current.includes(day) ? current.filter((entry) => entry !== day) : [...current, day]
    );
  }

  function focusVenue(venue: Venue, zoom = MAP_FOCUS_ZOOM) {
    const lat = venue.lat ?? MAP_CENTER.lat;
    const lng = venue.lng ?? MAP_CENTER.lng;
    setSelectedVenueId(venue.id);
    setMapCenter({ lat, lng });
    setMapZoom(zoom);
  }

  useEffect(() => {
    if (!navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      () => {
        // Ignore permission and device errors silently; map remains fully usable.
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
            {userLocation ? (
              <button
                className="legacy-chip"
                type="button"
                onClick={() => {
                  setMapCenter(userLocation);
                  setMapZoom(Math.max(mapZoom, 17.2));
                }}
              >
                My Location
              </button>
            ) : null}
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
              mapTypeId="satellite"
              disableDefaultUI={true}
              zoomControl={true}
              clickableIcons={false}
              gestureHandling="greedy"
              minZoom={MAP_MIN_ZOOM}
              maxZoom={MAP_MAX_ZOOM}
              onCameraChanged={(ev) => {
                const nextCenter = ev.detail.center;
                const nextZoom = ev.detail.zoom;
                if (
                  isInsideGeofence(nextCenter.lat, nextCenter.lng) &&
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
              {visibleVenues.slice(0, 100).map((venue) => {
                const category = getLegacyCategory(venue);
                const markerSize = category === "art installation" ? 10 : 12;
                return (
                  <AdvancedMarker
                    key={venue.id}
                    position={{ lat: venue.lat || 33.351, lng: venue.lng || -115.731 }}
                    anchorPoint={AdvancedMarkerAnchorPoint.CENTER}
                  >
                    <button
                      className={`legacy-pin ${selectedVenueId === venue.id ? "is-selected" : ""}`}
                      type="button"
                      aria-label={venue.name}
                      style={{
                        background: LEGACY_CATEGORY_COLORS[category] || venue.accent,
                        width: markerSize,
                        height: markerSize,
                      }}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                      }}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setSelectedVenueId(venue.id);
                      }}
                    />
                  </AdvancedMarker>
                );
              })}
              {selectedVenue ? (
                <AdvancedMarker
                  position={{
                    lat: selectedVenue.lat ?? MAP_CENTER.lat,
                    lng: selectedVenue.lng ?? MAP_CENTER.lng,
                  }}
                  anchorPoint={AdvancedMarkerAnchorPoint.BOTTOM_CENTER}
                >
                  <article className="legacy-popup">
                    <div className="legacy-popup-head">
                      <h3>{selectedVenue.name}</h3>
                      <button
                        type="button"
                        className="legacy-popup-close"
                        aria-label="Close location popup"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          setSelectedVenueId(null);
                        }}
                      >
                        ×
                      </button>
                    </div>
                    <div>
                      <i>{selectedVenue.label}</i>
                    </div>
                    <div>{selectedVenue.shortDescription || selectedVenue.description}</div>
                    {selectedVenue.permanence ? (
                      <div className="legacy-popup-meta">{selectedVenue.permanence}</div>
                    ) : null}
                  </article>
                </AdvancedMarker>
              ) : null}
              {userLocation ? (
                <AdvancedMarker position={userLocation} anchorPoint={AdvancedMarkerAnchorPoint.CENTER}>
                  <div className="legacy-user-dot" aria-label="Your location" />
                </AdvancedMarker>
              ) : null}
            </Map>
          </APIProvider>
        </section>

        <aside className="legacy-list-panel">
          <section className="legacy-list-block">
            <div className="legacy-list-title">
              <h2>{selectedVenue ? selectedVenue.name : "Venues"}</h2>
              <span>{visibleVenues.length}</span>
            </div>
            <div className="legacy-venue-list">
              {visibleVenues.map((venue) => (
                <button
                  key={venue.id}
                  className={`legacy-venue-item ${selectedVenueId === venue.id ? "active" : ""}`}
                  type="button"
                  onClick={() => focusVenue(venue)}
                >
                  <span
                    className="legacy-venue-dot"
                    style={{ background: LEGACY_CATEGORY_COLORS[getLegacyCategory(venue)] || venue.accent }}
                  />
                  <span>{venue.name}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="legacy-list-block">
            <div className="legacy-list-title">
              <h2>Schedule</h2>
              <span>{visibleEvents.length}</span>
            </div>

            <div className="legacy-event-list">
              {visibleEvents.map((event) => {
                const venue = venues.find((entry) => entry.id === event.venueId);
                return (
                  <button
                    key={event.id}
                    className="legacy-event-item"
                    type="button"
                    onClick={() => setSelectedEventId(event.id)}
                  >
                    <span className={`type-chip type-${event.type}`}>{eventTypeLabels[event.type]}</span>
                    <strong>{event.title}</strong>
                    <small>
                      {dayLabels[event.day]} | {event.startTime} - {event.endTime}
                    </small>
                    <small>{venue?.name ?? "Unknown venue"}</small>
                  </button>
                );
              })}
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

      {selectedEvent ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setSelectedEventId(null)}>
          <article
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="event-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-topbar">
              <button
                className="close-button"
                type="button"
                aria-label="Close event details"
                onClick={() => setSelectedEventId(null)}
              >
                ×
              </button>
            </div>
            <div className="modal-image">
              <Image
                src={selectedEvent.thumbnailUrl}
                alt={selectedEvent.title}
                fill
                sizes="900px"
                style={{ objectFit: "cover" }}
              />
            </div>
            <div className="modal-copy">
              <span className="eyebrow">Event Detail</span>
              <h2 id="event-modal-title">{selectedEvent.title}</h2>
              <div className="modal-meta">
                <span className={`type-chip type-${selectedEvent.type}`}>
                  {eventTypeLabels[selectedEvent.type]}
                </span>
                <span className="meta-chip">{dayLabels[selectedEvent.day]}</span>
                <span className="meta-chip">
                  {selectedEvent.startTime} - {selectedEvent.endTime}
                </span>
                <span className="meta-chip">Host: {selectedEvent.host}</span>
                {selectedEvent.permanence ? (
                  <span className="meta-chip">{selectedEvent.permanence}</span>
                ) : null}
              </div>
              <p>{selectedEvent.description}</p>
            </div>
          </article>
        </div>
      ) : null}
    </main>
  );
}
