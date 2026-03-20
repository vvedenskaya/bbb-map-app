"use client";

import Image from "next/image";
import { useState } from "react";
import { APIProvider, Map, AdvancedMarker } from "@vis.gl/react-google-maps";
import { dayLabels, eventTypeLabels } from "@/data/festival";
import { FestivalDay, FestivalEvent, Venue } from "@/types/festival";

const ALL_DAYS: FestivalDay[] = ["fri", "sat", "sun"];

type LayerState = {
  imagery: boolean;
  roads: boolean;
  lots: boolean;
  houses: boolean;
};

const initialLayers: LayerState = {
  imagery: true,
  roads: true,
  lots: true,
  houses: true,
};

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
  const [layers, setLayers] = useState<LayerState>(initialLayers);
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

  function toggleLayer(layer: keyof LayerState) {
    setLayers((current) => ({
      ...current,
      [layer]: !current[layer],
    }));
  }

  return (
    <main className="festival-app">
      <div className="festival-shell">
        <section className="map-panel">
          <header className="map-header">
            <div className="title-block">
              <span className="eyebrow">Bombay Beach Biennale MVP</span>
              <h1>Map, venue, and schedule scaffold.</h1>
              <p>
                First pass on the interactive core: layered town map, inspectable venues,
                and a day-driven schedule sidebar wired to importable data.
              </p>
              {dataSourceLabel ? <p className="eyebrow">Data source: {dataSourceLabel}</p> : null}
              {debug ? (
                <details style={{ marginTop: 8 }}>
                  <summary style={{ cursor: "pointer", fontWeight: 600 }}>
                    Matching debug ({debug.matchedRows}/{debug.confirmedRows} confirmed matched)
                  </summary>
                  <div style={{ marginTop: 8, fontSize: 13, opacity: 0.9 }}>
                    <div>Total rows: {debug.totalRows}</div>
                    <div>Confirmed rows: {debug.confirmedRows}</div>
                    <div>Matched to `locations_2023.json`: {debug.matchedRows}</div>
                    <div>Unmatched locations: {debug.unmatchedLocations.length}</div>
                    {debug.unmatchedLocations.length > 0 ? (
                      <div
                        style={{
                          marginTop: 8,
                          maxHeight: 140,
                          overflow: "auto",
                          border: "1px solid rgba(255,255,255,0.2)",
                          borderRadius: 8,
                          padding: 8,
                          background: "rgba(0,0,0,0.35)",
                        }}
                      >
                        {debug.unmatchedLocations.map((name) => (
                          <div key={name}>{name}</div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </details>
              ) : null}
            </div>

            <div className="map-controls">
              <div className="control-group">
                {ALL_DAYS.map((day) => (
                  <button
                    key={day}
                    className={`pill ${activeDays.includes(day) ? "active" : ""}`}
                    type="button"
                    onClick={() => toggleDay(day)}
                  >
                    {dayLabels[day]}
                  </button>
                ))}
              </div>

              <div className="control-group">
                {Object.entries(layers).map(([layer, enabled]) => (
                  <button
                    key={layer}
                    className={`layer-toggle ${enabled ? "active" : ""}`}
                    type="button"
                    onClick={() => toggleLayer(layer as keyof LayerState)}
                  >
                    {layer}
                  </button>
                ))}
                <button
                  className={`layer-toggle ${locationFilter === "all" ? "active" : ""}`}
                  type="button"
                  onClick={() => setLocationFilter("all")}
                >
                  All Locations
                </button>
                <button
                  className={`layer-toggle ${locationFilter === "placed" ? "active" : ""}`}
                  type="button"
                  onClick={() => setLocationFilter("placed")}
                >
                  Mapped Only
                </button>
                <button
                  className={`layer-toggle ${locationFilter === "unplaced" ? "active" : ""}`}
                  type="button"
                  onClick={() => setLocationFilter("unplaced")}
                >
                  Missing Coordinates
                </button>
              </div>
            </div>
          </header>

          <div className="map-stage-wrap">
            <div className="map-stage">
              <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ""}>
                <Map
                  defaultCenter={{ lat: 33.352, lng: -115.729 }}
                  defaultZoom={17}
                  mapId="2f9f04bb8e9c458045b99a65"
                  mapTypeId="satellite"
                  disableDefaultUI={true}
                  zoomControl={true}
                  mapTypeControl={true}
                  gestureHandling="greedy"
                  style={{ width: "100%", height: "100%" }}
                >
                  {visibleVenues.slice(0, 100).map((venue) => (
                    <AdvancedMarker
                      key={venue.id}
                      position={{ lat: venue.lat || 33.351, lng: venue.lng || -115.731 }}
                      onClick={() => setSelectedVenueId(venue.id)}
                    >
                      <button
                        className={`pin-button ${selectedVenueId === venue.id ? "is-selected" : ""}`}
                        type="button"
                      >
                        <span className="pin-dot" style={{ background: venue.accent }} />
                        <span className="pin-label">
                          {venue.name.length > 20 ? venue.name.substring(0, 20) + "..." : venue.name}
                        </span>
                      </button>
                    </AdvancedMarker>
                  ))}
                </Map>
              </APIProvider>

              <div className="map-fade" />
            </div>
          </div>
        </section>

        <aside className="sidebar-panel">
          <header className="sidebar-header">
            <div>
              <span className="eyebrow">Schedule Surface</span>
              <h2>{selectedVenue ? selectedVenue.name : "All venues"}</h2>
              <p>
                Click a pin to scope the schedule. The same selectors can later back map filters,
                admin forms, and API routes without changing the UI model.
              </p>
            </div>
          </header>

          <div className="sidebar-body">
            <section className="sidebar-section">
              <div className="filter-grid">
                <input
                  type="search"
                  placeholder="Search venues or events..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    gridColumn: "1 / -1",
                    padding: "10px 14px",
                    borderRadius: "99px",
                    border: "1px solid rgba(255, 255, 255, 0.2)",
                    background: "rgba(0,0,0,0.5)",
                    color: "white",
                    marginBottom: "8px",
                    fontSize: "14px",
                    outline: "none",
                  }}
                />
                <button
                  className={`pill ${selectedVenueId === null ? "active" : ""}`}
                  type="button"
                  onClick={() => setSelectedVenueId(null)}
                >
                  All venues
                </button>
                {ALL_DAYS.map((day) => (
                  <button
                    key={`sidebar-${day}`}
                    className={`pill ${activeDays.includes(day) ? "active" : ""}`}
                    type="button"
                    onClick={() => toggleDay(day)}
                  >
                    {dayLabels[day]}
                  </button>
                ))}
              </div>

              <div className="legend-grid">
                {Object.entries(eventTypeLabels).map(([eventType, label]) => (
                  <span key={eventType} className={`type-chip type-${eventType}`}>
                    {label}
                  </span>
                ))}
              </div>

              <button
                className="ghost-button"
                type="button"
                onClick={() => setLayers(initialLayers)}
              >
                Reset map layers
              </button>
            </section>

            {selectedVenue ? (
              <section className="venue-card">
                <div className="venue-image">
                  <Image
                    src={selectedVenue.thumbnailUrl}
                    alt={selectedVenue.name}
                    fill
                    sizes="420px"
                    style={{ objectFit: "cover" }}
                  />
                </div>
                <span className="eyebrow">Venue Inspect</span>
                <h2>{selectedVenue.name}</h2>
                <p>{selectedVenue.description}</p>
                <div className="venue-meta">
                  <span className="meta-chip">{selectedVenue.label}</span>
                  <span className="meta-chip">
                    {events.filter((event) => event.venueId === selectedVenue.id).length} scheduled
                    items
                  </span>
                </div>
              </section>
            ) : (
              <section className="empty-state">
                <span className="eyebrow">No Venue Scoped</span>
                <p>
                  This is the all-venues view. In the next pass, this panel can grow into a proper
                  admin workspace for creating and editing venue records against a persisted
                  backend.
                </p>
              </section>
            )}

            <section className="sidebar-section">
              <div className="event-list-title">
                <h3>Schedule</h3>
                <span className="event-count">{visibleEvents.length} visible events</span>
              </div>

              <div className="schedule-stack">
                {visibleEvents.map((event) => {
                  const venue = venues.find((entry) => entry.id === event.venueId);
                  return (
                    <article key={event.id} className="event-card">
                      <button
                        className="event-button"
                        type="button"
                        onClick={() => setSelectedEventId(event.id)}
                      >
                        <div className="event-heading">
                          <div>
                            <span className={`type-chip type-${event.type}`}>
                              {eventTypeLabels[event.type]}
                            </span>
                            <h3>{event.title}</h3>
                          </div>
                          <span className="event-time">
                            {dayLabels[event.day]}
                            <br />
                            {event.startTime} - {event.endTime}
                          </span>
                        </div>

                        <div className="event-meta">
                          <span className="meta-chip">{venue?.name ?? "Unknown venue"}</span>
                          <span className="meta-chip">Host: {event.host}</span>
                          {event.permanence ? (
                            <span className="meta-chip">{event.permanence}</span>
                          ) : null}
                        </div>

                        <p>{event.description}</p>
                      </button>
                    </article>
                  );
                })}

                {visibleEvents.length === 0 ? (
                  <div className="empty-state">
                    <span className="eyebrow">No Results</span>
                    <p>
                      The current day and venue filters produce an empty state. This is a good hook
                      for later search, import validation, and admin QA workflows.
                    </p>
                  </div>
                ) : null}
              </div>
            </section>
          </div>
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
