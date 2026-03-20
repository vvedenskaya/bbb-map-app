# Sprintboard Roadmap (Build on Top Legacy)

## Decision: Build on top, not rewrite

Based on the legacy repo and currently running map:

- Legacy codebase: [binx/bombay-mapbox](https://github.com/binx/bombay-mapbox)
- Existing live map: [bombaybeachmap.com](https://bombaybeachmap.com/)

Recommended approach is **incremental migration on top of existing work**, not full rewrite.  
Reason: you already have usable map behavior, domain data, and real-world interaction patterns to preserve.

---

## Product Scope (2026)

Core outcomes for this project:

- Public no-auth interactive map (wayfinding + schedule).
- Master schedule with day view and filters (venue + event type).
- Category color system (music/performance/installation/lecture/etc.).
- Admin panel for organizers (manage venues/events/media/descriptions).
- Contributor portal with scoped edit permissions.
- Role model: guest (public), contributor (scoped edit), admin (full control).

---

## Architecture Baseline

### Frontend

- Keep current Next.js app as the main product shell.
- Build map as isolated module (`MapCanvas`, `MapPins`, `MapLegend`, `MapFilters`).
- New UI theme should be token-based (colors/spacing/typography in one place).

### Map stack

- Use **Google Maps JavaScript API** via `@vis.gl/react-google-maps`.
- Default map style: **`mapTypeId="satellite"`**.
- Keep marker rendering stable with fixed anchor + non-reflowing pin geometry.

### Data source

- Airtable as editable source for operations team.
- Add a server-side sync layer (`Airtable -> normalized DTO -> app model`).
- Introduce cache + revalidation strategy to avoid rate-limit issues.

### Auth and permissions

- Public pages: no auth.
- Admin pages: auth required.
- Contributor pages: auth + row-level permission checks by venue/event ownership.

---

## Conflict-Safe Migration Plan

### Phase 0 - Stabilize foundation (1 week)

- Lock map interaction bugs (marker click stability, mobile gestures).
- Freeze current data model contracts (`Venue`, `Event`, `Asset`, `Role`).
- Add smoke tests for map click/select/filter flows.

**Exit criteria**
- Map no longer jumps during pin selection.
- Existing views keep functioning after refactors.
- Baseline test suite passes in CI.

### Phase 1 - UI redesign without behavior rewrite (1-2 weeks)

- Replace visual layer only (layout/components/tokens), preserve feature behavior.
- Introduce new shell sections: map, schedule rail, detail pane.
- Keep data plumbing unchanged during this phase.

**Exit criteria**
- New interface live, old flows still functional.
- No regressions in pin selection, filters, and modal behavior.

### Phase 2 - Google Satellite map hardening (1 week)

- Standardize Google map config (center, zoom bounds, gesture policy).
- Implement marker/popup primitives that do not alter anchor position.
- Add optional layer toggles and map presets (default, satellite focus, event view).

**Exit criteria**
- Stable click targeting across desktop/mobile.
- Predictable zoom/pan behavior.

### Phase 3 - Airtable integration (1-2 weeks)

- Define Airtable schema mapping:
  - `Venues`
  - `Events`
  - `Contributors`
  - `Media`
- Build import adapter and validation.
- Add reconciliation reports (missing coordinates, bad time windows, orphan events).

**Exit criteria**
- Data renders from Airtable in public map/schedule.
- Validation catches broken records before publish.

### Phase 4 - Admin panel MVP (2 weeks)

- Authenticated admin routes.
- CRUD for venues/events.
- Media upload/linking and publish state.
- Basic audit trail (`updatedBy`, `updatedAt`, change reason optional).

**Exit criteria**
- Organizer can fully manage festival content without code changes.

### Phase 5 - Contributor portal + role rules (2 weeks)

- Contributor dashboard for own records only.
- Editable fields: description, timing, media, map placement request.
- Approval workflow (auto-publish toggle per role).

**Exit criteria**
- Contributor edits are scoped and secure.
- Admin can approve/reject/override.

---

## Sprintboard (Practical)

| Sprint | Focus | Deliverables |
|------|--------|--------|
| **Now** | Architecture lock | ADR, schema freeze, map bug baseline |
| **Sprint 1** | UI refactor shell | New layout/tokens/components; no feature regressions |
| **Sprint 2** | Google Satellite hardening | Stable markers, map controls, mobile gesture tuning |
| **Sprint 3** | Airtable data integration | Read pipeline, validation, sync diagnostics |
| **Sprint 4** | Admin MVP | Auth + venue/event CRUD + publish workflow |
| **Sprint 5** | Contributor portal | Scoped edits, review flow, permission rules |
| **Sprint 6** | Performance and launch | Caching, QA, analytics, production stabilization |

---

## Data Contracts (Minimum)

### Venue

- `id`
- `name`
- `slug`
- `lat`, `lng`
- `description`
- `thumbnailUrl`
- `category`
- `published`
- `updatedAt`

### Event

- `id`
- `venueId`
- `title`
- `host`
- `description`
- `day` (`fri|sat|sun`)
- `startTime`, `endTime`
- `type` (music, performance, installation, lecture, food, community, etc.)
- `thumbnailUrl`
- `published`
- `updatedAt`

### Permission model

- `role`: `guest | contributor | admin`
- `editableVenueIds[]`
- `editableEventIds[]`

---

## Guardrails to avoid conflicts

- Do not migrate map engine and redesign UI in the same PR.
- Do not couple UI state directly to Airtable payload shape.
- Keep adapters between external data and internal typed models.
- Keep public and admin/contributor routes physically separated.
- Enforce role checks on server side, not only in client UI.
- Add feature flags for risky changes (`new_ui`, `airtable_live`, `contributor_portal`).

---

## Definition of done for your request

For your exact goal ("new UI + Google satellite + Airtable + roles") this plan is successful when:

- Public users see a fast no-auth map + schedule with stable interaction.
- Admins can maintain all content without developer involvement.
- Contributors can update only permitted records.
- Migration happens gradually, without breaking the already working map experience.

---

## Immediate next implementation steps

1. Finalize Airtable table/field contract and naming.
2. Add `MapCanvas` abstraction with stable marker anchor behavior.
3. Move current UI into tokenized component system.
4. Enable feature flags and release changes incrementally.
5. Start admin auth + CRUD on top of normalized models.
