"use client";

import Image from "next/image";
import { useState } from "react";
import { dayLabels, eventTypeLabels, events, MAP_DIMENSIONS, venues } from "@/data/festival";
import { FestivalDay } from "@/types/festival";

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

export function FestivalMapApp() {
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null);
  const [hoveredVenueId, setHoveredVenueId] = useState<string | null>(venues[0]?.id ?? null);
  const [activeDays, setActiveDays] = useState<FestivalDay[]>(ALL_DAYS);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [layers, setLayers] = useState<LayerState>(initialLayers);

  const selectedVenue = venues.find((venue) => venue.id === selectedVenueId) ?? null;
  const hoveredVenue = venues.find((venue) => venue.id === hoveredVenueId) ?? null;
  const selectedEvent = events.find((event) => event.id === selectedEventId) ?? null;

  const visibleEvents = events.filter((event) => {
    const matchesDay = activeDays.includes(event.day);
    const matchesVenue = selectedVenueId ? event.venueId === selectedVenueId : true;
    return matchesDay && matchesVenue;
  });

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
                and a day-driven schedule sidebar built on seed data.
              </p>
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
              </div>
            </div>
          </header>

          <div className="map-stage-wrap">
            <div className="map-stage">
              <svg
                className="map-artwork"
                viewBox={`0 0 ${MAP_DIMENSIONS.width} ${MAP_DIMENSIONS.height}`}
                role="img"
                aria-label="Bombay Beach festival map prototype"
              >
                <rect width={MAP_DIMENSIONS.width} height={MAP_DIMENSIONS.height} fill="#eadcc0" />
                {layers.imagery ? (
                  <image
                    href="/map-layers/image_BB_map.jpg"
                    x="0"
                    y="0"
                    width={MAP_DIMENSIONS.width}
                    height={MAP_DIMENSIONS.height}
                    preserveAspectRatio="none"
                    opacity="0.92"
                  />
                ) : null}
                {layers.lots ? (
                  <image
                    href="/map-layers/lots_BB_map.svg"
                    x="0"
                    y="0"
                    width={MAP_DIMENSIONS.width}
                    height={MAP_DIMENSIONS.height}
                    preserveAspectRatio="none"
                    opacity="0.6"
                  />
                ) : null}
                {layers.houses ? (
                  <image
                    href="/map-layers/houses_BB_map.svg"
                    x="0"
                    y="0"
                    width={MAP_DIMENSIONS.width}
                    height={MAP_DIMENSIONS.height}
                    preserveAspectRatio="none"
                    opacity="0.42"
                  />
                ) : null}
                {layers.roads ? (
                  <image
                    href="/map-layers/roads_BB_map.svg"
                    x="0"
                    y="0"
                    width={MAP_DIMENSIONS.width}
                    height={MAP_DIMENSIONS.height}
                    preserveAspectRatio="none"
                    opacity="0.7"
                  />
                ) : null}
              </svg>

              <div className="pin-layer">
                {venues.map((venue) => (
                  <button
                    key={venue.id}
                    className={`pin-button ${selectedVenueId === venue.id ? "is-selected" : ""}`}
                    type="button"
                    style={{
                      left: `${(venue.x / MAP_DIMENSIONS.width) * 100}%`,
                      top: `${(venue.y / MAP_DIMENSIONS.height) * 100}%`,
                    }}
                    onMouseEnter={() => setHoveredVenueId(venue.id)}
                    onFocus={() => setHoveredVenueId(venue.id)}
                    onClick={() => setSelectedVenueId(venue.id)}
                  >
                    <span className="pin-dot" style={{ background: venue.accent }} />
                    <span className="pin-label">{venue.label}</span>
                  </button>
                ))}
              </div>

              {hoveredVenue ? (
                <article className="hover-card">
                  <div className="hover-image">
                    <Image
                      src={hoveredVenue.thumbnailUrl}
                      alt={`${hoveredVenue.name} preview`}
                      fill
                      sizes="340px"
                      style={{ objectFit: "cover" }}
                    />
                  </div>
                  <div className="hover-copy">
                    <span className="eyebrow">Venue Preview</span>
                    <h2>{hoveredVenue.name}</h2>
                    <p>{hoveredVenue.shortDescription}</p>
                    <div className="hover-meta">
                      <span className="meta-chip">
                        {events.filter((event) => event.venueId === hoveredVenue.id).length} events
                      </span>
                      <span className="meta-chip">Front-end seed data</span>
                    </div>
                    <div>
                      <button
                        className="solid-button"
                        type="button"
                        onClick={() => setSelectedVenueId(hoveredVenue.id)}
                      >
                        Inspect venue
                      </button>
                    </div>
                  </div>
                </article>
              ) : null}

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
              </div>
              <p>{selectedEvent.description}</p>
            </div>
          </article>
        </div>
      ) : null}
    </main>
  );
}
