# Sprintboard Roadmap

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

## Product Strategy

Build the smallest useful system first, but choose boundaries that scale:

- separate map presentation from venue and event data models
- keep admin workflows inside the same application, behind auth
- treat venues and events as first-class entities from day one
- design schedule filters as shared state that can drive both sidebar and map
- start with a simple persistence layer, but keep the schema compatible with future role-based editing and external calendar sync

## Sprintboard

| Lane | Items |
| --- | --- |
| Now | Define technical architecture, scaffold app shell, choose map stack, choose data model, stand up local persistence |
| Sprint 1 | Hello world app shell, base layout, map canvas, static Bombay Beach map asset, seed venue data, sidebar shell |
| Sprint 2 | Venue CRUD for admins, persistent venue storage, pin rendering, hover card, sidebar venue inspect flow |
| Sprint 3 | Event model, Friday/Saturday/Sunday schedule UI, event filtering by day and venue, event detail modal |
| Sprint 4 | Auth for admins, asset upload flow, validation, audit-friendly admin UX, mobile polish |
| Sprint 5 | Search, map layers, richer filters, performance passes, production deployment pipeline |
| Later | Artist self-service editing, Google Calendar sync, Notion integrations, segmented communications, personal schedules |
| Stretch | AI-assisted event structuring, AI image generation, role-specific content operations |

## Milestones

### Milestone 0: Architecture Lock

Outcome:

- decide framework, deployment target, auth approach, ORM/data layer, and map rendering strategy

Exit criteria:

- one-page architecture decision record
- agreed entity model for `Venue`, `Event`, `Asset`, and `UserRole`
- agreed MVP non-goals

### Milestone 1: Functional Hello World

Outcome:

- running app with a split layout: map area plus right sidebar

Exit criteria:

- project boots locally
- static map asset renders
- sample venue pins render from seeded data
- selecting a pin updates the sidebar

### Milestone 2: Venue Management MVP

Outcome:

- admins can create and edit venues in-app and persist them

Exit criteria:

- venue form supports name, short description, long description, coordinates, label, and thumbnail
- create/edit/delete venue actions persist between reloads
- hover and click behavior matches the desired inspection flow

### Milestone 3: Schedule MVP

Outcome:

- users can browse festival programming by day and venue

Exit criteria:

- Friday, Saturday, and Sunday filters work
- events are color-coded by type
- selecting a venue scopes events
- selecting an event opens a detail modal

### Milestone 4: MVP Stabilization

Outcome:

- admin access is protected and the app is ready for wider iteration

Exit criteria:

- authenticated admin routes
- basic upload handling
- form validation and error states
- mobile-responsive map and sidebar behavior

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
- venue-event linkage
- event modal and type tagging

### Epic E: Identity and Permissions

- admin auth
- future artist/editor roles
- auditability for edits

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
- `eventType`
- `thumbnailAssetId`
- `published`
- timestamps

### Asset

- `id`
- `kind`
- `url`
- `altText`
- metadata

## Architectural Guardrails

- do not couple map pin rendering directly to raw CMS form state
- do not encode schedule logic only in UI components; keep it in reusable selectors/services
- do not optimize for every stretch goal in MVP, but keep schemas additive
- prefer boring, well-supported infrastructure for auth, database, and storage
- keep the initial map implementation compatible with later geospatial enrichment, even if MVP uses simple image coordinates

## MVP Non-Goals

- personalized attendee accounts
- full volunteer or artist portal
- automated Google Calendar sync
- mass email tooling
- AI-generated content workflows

## Next-Step Question Themes

For the next step, the architecture discussion should resolve:

- frontend framework and hosting preference
- database and ORM preference
- whether MVP uses image-coordinate mapping or true geospatial tiles
- admin auth provider and role model
- image upload/storage approach
- whether event data entry happens only in-app at first or imports from spreadsheets/calendar feeds
