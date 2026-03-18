# Sprintboard Roadmap

## Festival Context

The **Bombay Beach Biennale** is a town-wide arts and culture festival across the small **5×8 block footprint** of Bombay Beach, CA. It includes:

- **Performances** — music, opera, theater
- **Lectures & presentations** — philosophy, sustainability, poetry
- **Art installations** — 24/7 passive experiences, viewable on demand, or scheduled exhibitions in venues with public hours
- **Unscheduled / impromptu** — if-you-know-you-know activities that may or may not appear on the master calendar

The app supports **decentralized coordination**: event producers and artists/presenters get the tools and autonomy to self-manage and update their own events.

---

## Vision Notes

Reference reviewed: [Bombay Beach Biennale 2024 map](https://www.bombaybeachbiennale.org/map2024)

Observed qualities to preserve:

- strong local personality and festival-specific visual language
- venue-first wayfinding
- all-at-once sense of the town footprint
- category cues through icons and labels

Observed issues to improve:

- dense labeling hurts scanability
- schedule context is disconnected from the map
- hover, search, and filtering workflows are limited
- mobile interaction is likely constrained by poster-style composition

---

## Product Strategy

Build the smallest useful system first, with boundaries that scale:

- **Interactive digital map web app** of Bombay Beach Biennale with venues and schedule
- **No-auth access** for guests (view only); **auth for admin panel** to edit and manage comms; **artist-editable permissions** for submitting description, timing, photos, etc.
- **Admin dashboard** — create pinned, labeled locations with description, photo, and schedule per venue/event
- **Master festival schedule** — Day view, venue checkboxes, color coding by event type (music, performance, installation, lecture, etc.)
- **Artists / contributors portal** — edit event inputs, place on map, attach media, description, time
- **Clean Notion kit** for FAQ and artist/volunteer information

---

## Sprintboard

| Lane | Items |
|------|--------|
| **Now** | Define technical architecture, scaffold app shell, choose map stack, choose data model, stand up local persistence |
| **Sprint 1** | Hello world app shell, base layout, map canvas, static Bombay Beach map asset, seed venue data, sidebar shell |
| **Sprint 2** | Venue CRUD for admins, persistent venue storage, pin rendering, hover card, sidebar venue inspect flow |
| **Sprint 3** | Event model, Friday/Saturday/Sunday schedule UI, event filtering by day and venue, event detail modal, color coding by event type |
| **Sprint 4** | Auth for admins, asset upload flow, validation, audit-friendly admin UX, mobile polish |
| **Sprint 5** | Search, map layers, richer filters, performance passes, production deployment pipeline |
| **Second pass** | Artist/contributor portal (self-edit events, map placement, media, description, time); guest view remains no-auth; admin panel for comms and management |
| **Later** | User accounts and personal schedule (favorited events, “my schedule” view); Google Calendar or Notion calendar sync; Notion kit for FAQ and artist/volunteer info |
| **Stretch** | AI-powered data structuring in the platform; AI image generation; role-specific content operations; segmented communications |

---

## Second Pass (Post-MVP)

The second pass turns the app into a **coordination platform** instead of a static map + schedule.

### Access model

| Role | Access | Capabilities |
|------|--------|--------------|
| **Guest** | No auth | View map, schedule, venue/event details only |
| **Admin** | Auth required | Full CRUD on venues, events, comms; manage permissions; audit |
| **Artist / contributor** | Auth, scoped | Edit own events: description, timing, photos, map placement; submit for review or auto-publish per policy |

### Second-pass deliverables

1. **Artist / contributor portal**
   - Claim or create events linked to venues
   - Edit title, description, time, media, place-on-map (or venue assignment)
   - Permissions: admin grants “editor” per event or per venue; optional self-service request flow

2. **Admin dashboard**
   - Create/edit pinned labeled locations (venue or event-level pins)
   - Description, photo, schedule per venue/event
   - Manage artist permissions and review submissions
   - Comms and content management (copy, announcements)

3. **Master festival schedule**
   - Day view (e.g. Friday / Saturday / Sunday)
   - Checkboxes (or filters) for venues
   - Color coding by event type: music, performance, installation, lecture, etc.
   - Optional: “unscheduled” or “impromptu” bucket for items that don’t have a fixed slot

4. **Notion kit**
   - Clean, public-facing FAQ
   - Artist and volunteer information (how to submit, who to contact, deadlines)
   - Can be embedded or linked; single source of truth for non-map, non-schedule content

### Stretch (second pass)

- **AI-powered data structuring** — e.g. suggest event type, time slots, or venue from description
- **Calendar sync** — export or sync to Google Calendar or Notion calendar
- **AI image generation** — placeholder or promotional imagery (with clear moderation and rights policy)
- **User accounts and personal schedule** — favorited events, “my schedule” view for attendees

---

## Milestones

### Milestone 0: Architecture Lock

**Outcome:** Decide framework, deployment target, auth approach, ORM/data layer, and map rendering strategy.

**Exit criteria:**

- one-page architecture decision record
- agreed entity model for `Venue`, `Event`, `Asset`, `UserRole`
- agreed MVP non-goals

### Milestone 1: Functional Hello World

**Outcome:** Running app with map area plus sidebar.

**Exit criteria:**

- project boots locally
- static map asset renders
- sample venue pins render from seeded data
- selecting a pin updates the sidebar

### Milestone 2: Venue Management MVP

**Outcome:** Admins can create and edit venues in-app and persist them.

**Exit criteria:**

- venue form: name, short/long description, coordinates, label, thumbnail
- create/edit/delete venue actions persist between reloads
- hover and click behavior matches the desired inspection flow

### Milestone 3: Schedule MVP

**Outcome:** Users can browse festival programming by day and venue.

**Exit criteria:**

- Friday, Saturday, Sunday filters work
- events are color-coded by type (music, performance, installation, lecture, etc.)
- selecting a venue scopes events
- selecting an event opens a detail modal

### Milestone 4: MVP Stabilization

**Outcome:** Admin access is protected; app is ready for wider iteration.

**Exit criteria:**

- authenticated admin routes
- basic upload handling
- form validation and error states
- mobile-responsive map and sidebar behavior

### Milestone 5: Second Pass — Artist Portal & Permissions

**Outcome:** Artists/contributors can edit their own events; guests remain no-auth; admin retains full control.

**Exit criteria:**

- role model supports Guest, Admin, Artist/Contributor
- artist-editable fields (description, timing, media, placement) with permission checks
- admin dashboard: pinned locations, descriptions, photos, schedule; comms tooling
- master schedule: day view, venue checkboxes, event-type color coding

### Milestone 6: Second Pass — Notion & Optional Extras

**Outcome:** FAQ and artist/volunteer info in a clean Notion kit; optional calendar sync and user schedules.

**Exit criteria:**

- Notion kit (or equivalent) for FAQ and artist/volunteer information linked or embedded
- (Stretch) Calendar sync to Google or Notion
- (Stretch) User accounts and personal schedule (favorites, “my schedule” view)

---

## Recommended Backlog Shape

### Epic A: Core Platform

- app shell and routing
- shared design tokens and layout primitives
- environment configuration
- deployment and CI setup

### Epic B: Map System

- base map asset pipeline
- coordinate system and pin placement rules
- layer toggles
- pin rendering states

### Epic C: Venue CMS

- venue schema
- admin CRUD flows
- image asset association
- published vs draft state

### Epic D: Schedule Engine

- event schema
- day filters
- venue–event linkage
- event modal and type tagging (music, performance, installation, lecture, etc.)

### Epic E: Identity and Permissions

- admin auth
- artist/contributor roles and scoped editing
- auditability for edits

### Epic F: Artist / Contributor Portal (Second Pass)

- claim or create events; edit description, timing, media, placement
- permission model (admin-granted or self-service request)
- review/workflow for submissions (if not auto-publish)

### Epic G: Notion & External Content (Second Pass)

- Notion kit for FAQ and artist/volunteer information
- (Stretch) Calendar sync (Google, Notion)
- (Stretch) User accounts and personal schedule

### Epic H: Stretch

- AI-powered data structuring
- AI image generation
- role-specific content operations; segmented communications

---

## Data Model Starting Point

### Venue

- `id`
- `name`
- `slug`
- `label`
- `shortDescription`
- `description`
- `x`
- `y`
- `thumbnailAssetId`
- `published`
- timestamps

### Event

- `id`
- `venueId`
- `title`
- `host`
- `description`
- `day`
- `startTime`
- `endTime`
- `eventType` (e.g. music, performance, installation, lecture, impromptu)
- `thumbnailAssetId`
- `published`
- timestamps

### Asset

- `id`
- `kind`
- `url`
- `altText`
- metadata

### User / Role (for second pass)

- `id`
- role: admin | artist | guest (or inferred by no account)
- scoped permissions (e.g. eventIds or venueIds editable by artist)

---

## Architectural Guardrails

- Do not couple map pin rendering directly to raw CMS form state.
- Do not encode schedule logic only in UI components; keep it in reusable selectors/services.
- Do not optimize for every stretch goal in MVP, but keep schemas additive.
- Prefer boring, well-supported infrastructure for auth, database, and storage.
- Keep the initial map implementation compatible with later geospatial enrichment, even if MVP uses simple image coordinates.
- Keep guest experience no-auth; reserve auth for admin and artist/contributor flows.

---

## MVP Non-Goals

- personalized attendee accounts
- full volunteer or artist portal
- automated Google Calendar sync
- mass email tooling
- AI-generated content workflows
- Notion kit (defer to second pass)

---

## Next-Step Question Themes

For the next step, the architecture discussion should resolve:

- frontend framework and hosting preference
- database and ORM preference
- whether MVP uses image-coordinate mapping or true geospatial tiles
- admin auth provider and role model (and later, artist role model)
- image upload/storage approach
- whether event data entry happens only in-app at first or imports from spreadsheets/calendar feeds
- how Notion will be used (embed, link, or sync) for FAQ and artist/volunteer info
