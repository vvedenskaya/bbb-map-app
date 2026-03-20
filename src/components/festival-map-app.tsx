"use client";

import Image from "next/image";
import { useState } from "react";
import { APIProvider, Map, AdvancedMarker, AdvancedMarkerAnchorPoint } from "@vis.gl/react-google-maps";
import { dayLabels, eventTypeLabels } from "@/data/festival";
import { FestivalDay, FestivalEvent, Venue } from "@/types/festival";

const ALL_DAYS: FestivalDay[] = ["fri", "sat", "sun"];

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
              onClick={() => setSelectedVenueId(null)}
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
              defaultCenter={{ lat: 33.352, lng: -115.729 }}
              defaultZoom={16.9}
              mapId="2f9f04bb8e9c458045b99a65"
              mapTypeId="satellite"
              disableDefaultUI={true}
              zoomControl={true}
              gestureHandling="greedy"
              style={{ width: "100%", height: "100%" }}
            >
              {visibleVenues.slice(0, 100).map((venue) => (
                <AdvancedMarker
                  key={venue.id}
                  position={{ lat: venue.lat || 33.351, lng: venue.lng || -115.731 }}
                  anchorPoint={AdvancedMarkerAnchorPoint.CENTER}
                >
                  <button
                    className={`legacy-pin ${selectedVenueId === venue.id ? "is-selected" : ""}`}
                    type="button"
                    aria-label={venue.name}
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
              ))}
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
                  onClick={() => setSelectedVenueId(venue.id)}
                >
                  <span className="legacy-venue-dot" style={{ background: venue.accent }} />
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
