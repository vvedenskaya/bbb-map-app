# Sprintboard: 2026 Airtable Data -> Festival Map

## Goal

Launch a stable festival map driven by client Airtable data (not static JSON), while keeping the proven legacy UX pattern:

- map on the left
- schedule panel on the right
- click schedule item -> focus map location

---

## Confirmed Inputs (from current alignment)

- Data source: single Airtable table (client-owned).
- Status filter for publish: `Confirmed` only (for now).
- Time fields: `Start Time` only (no end time yet).
- `Location (Internal)` is text venue/location name.
- Google Maps links exist in `GPS Link`-style field, but not for all rows.
- Map focus now:
  - show location pins for `Venue` and `Art Installation`
  - show all confirmed events in schedule panel (grouped under venue/location behavior)
- If event has no coordinates:
  - open/focus venue location on map via `Location (Internal)` mapping.

---

## Product Behavior (2026)

### Map

- Display unique location pins for:
  - `Venue`
  - `Art Installation`
- Keep marker style readable and stable at festival zoom levels.
- Optional later: add separate Service/Safety layer.

### Schedule Panel

- Show all `Confirmed` events.
- Group events under resolved venue/location.
- Clicking an event:
  - if event has coordinates -> focus event location
  - else -> focus mapped venue location

---

## Data Pipeline Design (Legacy-Compatible)

Legacy used static JSON as a normalized dataset.  
2026 version keeps the same principle, but builds that dataset dynamically:

1. Fetch Airtable rows (server-side).
2. Filter by `Status = Confirmed`.
3. Normalize into app DTOs:
   - `locations[]` (unique map pins)
   - `events[]` (schedule records)
4. Resolve coordinates:
   - parse from Google Maps link if available
   - fallback to location/venue coordinates by name mapping
5. Return normalized data to map UI.

---

## Coordinate Strategy (Simple + Reliable)

### Required Airtable fields

- `GPS Link` (existing)
- `Latitude` (new number field)
- `Longitude` (new number field)

### Automation

Use Airtable Automation (on create/update of `GPS Link`) to parse and write:

- `Latitude`
- `Longitude`

### Runtime fallback in app

If event row has no `Latitude/Longitude`:

- match by `Location (Internal)` to known venue/location
- use that venue coordinates for map focus

This removes manual emergency work during last-minute updates.

---

## Pagination + Virtualization Plan

### Pagination (Airtable API): required

- Airtable returns records in pages using `offset`.
- Server fetch must loop through all pages and merge rows.
- UI should receive one normalized payload (user does not see pages).

Why useful:

- stable fetch for larger datasets
- avoids partial loads
- aligns with Airtable API behavior

### Virtualization: conditional

- Not mandatory on day 1 if lists stay moderate.
- Add when schedule list grows and panel gets slow.

Suggested threshold:

- if schedule list is large and scrolling becomes janky, virtualize right panel list (e.g. react-window).

---

## Caching Strategy (Lightweight)

Even with mostly static data, use simple caching:

- Revalidate every 5-10 minutes (recommended for this event type).
- Optional manual refresh endpoint/button for ops.

Reason:

- lower Airtable request pressure
- faster page responses
- safer during intermittent network/API issues

---

## Implementation Sprints

## Sprint 1 - Data Contract + Airtable Field Setup

### Tasks

- Confirm exact Airtable field names used by code.
- Add `Latitude` and `Longitude` numeric fields.
- Lock publish rule: `Confirmed` only.
- Define normalization rules for `Project Type -> map category`.

### Exit Criteria

- Table schema is stable.
- Team agrees on map-in / map-out record rules.

---

## Sprint 2 - Auto Geocoding from GPS Links

### Tasks

- Add Airtable Automation:
  - trigger on record create/update
  - parse Google Maps URL formats
  - write `Latitude/Longitude`
- Keep rows valid if link missing/unparseable (no hard failure).

### Exit Criteria

- New records with valid maps links auto-fill coordinates.
- No manual coordinate entry needed for normal flow.

---

## Sprint 3 - Dynamic Pull + Pagination + Normalizer

### Tasks

- Implement server fetch from Airtable with `offset` pagination loop.
- Filter to `Confirmed`.
- Normalize to:
  - unique map locations (venues/installations)
  - schedule events
- Resolve coordinate fallbacks using `Location (Internal)`.

### Exit Criteria

- App works from Airtable only.
- No dependency on hand-maintained local JSON for daily operations.

---

## Sprint 4 - Map + Schedule UX Integration

### Tasks

- Render map pins for `Venue` and `Art Installation`.
- Render schedule in right panel from confirmed events.
- Implement click behavior:
  - event -> map focus
  - no event coords -> focus venue coords
- Preserve legacy-style interaction feel.

### Exit Criteria

- End-to-end flow works for real festival records.

---

## Sprint 5 - Performance + Ops Hardening

### Tasks

- Add cache revalidation (5-10 min).
- Add lightweight debug counts:
  - total confirmed
  - mapped
  - missing coordinates
  - unresolved location names
- Add virtualization for panel list only if needed by real performance.

### Exit Criteria

- Stable operation for 3-day festival load.
- Team can quickly identify bad/missing records.

---

## Optional Phase - Service/Safety Layer

Add separate map layer (different marker style) for:

- `Medical`
- `Fire`
- `Water`
- `Toilet`
- `Parking`
- `Info` (optional)

Can be implemented after core venues/installations + schedule launch.

---

## Risks and Mitigations

- Inconsistent `Location (Internal)` names  
  -> add normalization + alias map for known variants.

- Missing GPS links in many event rows  
  -> venue fallback + debug counters.

- Airtable API slowness or temporary outage  
  -> cache revalidation + optional manual refresh flow.

---

## Client Meeting Talking Points

- We are reusing legacy interaction model, but data is now dynamic from Airtable.
- Publishing is controlled and safe: `Confirmed` only.
- Coordinates are automated from Google Maps links.
- Events without direct coordinates still work via venue fallback.
- Pagination and caching are included for reliability.
- Virtualization is planned only if list size requires it.

---

## Open Questions to Confirm with Client

- Final list of `Project Type` values that should appear on map vs schedule-only.
- Canonical naming for `Location (Internal)` (to reduce mismatches).
- Required refresh speed (5 min vs 10 min cache).
- Whether Service/Safety layer is needed for initial launch or phase 2.
