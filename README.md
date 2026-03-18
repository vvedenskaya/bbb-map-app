# Bombay Beach Biennale Map App

Interactive festival map and schedule platform for the Bombay Beach Biennale.

## Project Intent

This repository is the planning and future implementation home for a reimagined Biennale map experience:

- public interactive map with layered venue pins
- public festival schedule for Friday, Saturday, and Sunday
- venue inspection flows with imagery, descriptions, and event context
- admin tools to create and edit venues directly from the frontend
- data plumbing that starts simple for MVP and can expand toward artist tooling, calendar sync, and communications workflows

## MVP Focus

The first deliverable should prove the two core surfaces:

1. map-based venue discovery
2. day-filtered festival schedule

MVP capabilities:

- render a Bombay Beach base map with selectable venue pins
- persist venue records with name, description, coordinates, and image assets
- support admin creation and editing of venue pins from the web UI
- show a venue hover/click preview with image and summary
- inspect a venue in a sidebar
- render a Friday/Saturday/Sunday schedule view
- filter schedule items by day and selected venue
- open event details in a modal overlay

## Product Direction

The current 2024 map presentation is visually dense, icon-led, and poster-like. The new app should preserve local character while improving:

- readability at multiple zoom levels
- venue discovery and selection
- schedule clarity
- mobile usability
- content management ergonomics

## Planning Docs

- Sprintboard roadmap: [docs/sprintboard-roadmap.md](docs/sprintboard-roadmap.md)

## Current Prototype

The repository now includes a runnable Next.js prototype with:

- layered Bombay Beach map artwork using the provided base assets
- seeded venue pins with hover preview and sidebar inspect state
- Friday/Saturday/Sunday schedule filtering
- event detail modal flow

## Local Development

- `pnpm dev`
- `pnpm build`
- `pnpm lint`

## MVP Data Pipeline (CSV -> Airtable)

The prototype can now load schedule events from:

- `csv` (default): `data/airtable-schedule.csv`
- `airtable`: live fetch from Airtable API
- `seed`: fallback hardcoded events in `src/data/festival.ts`

### CSV workflow

1. Export your Airtable view to CSV.
2. Replace `data/airtable-schedule.csv` with your export.
3. Keep `FESTIVAL_DATA_SOURCE=csv` in `.env.local`.

Expected CSV headers:

- `id`
- `title`
- `venue_id`
- `day` (`Fri`, `Sat`, `Sun` or full names)
- `start_time`
- `end_time`
- `type` (`music`, `performance`, `installation`, `lecture`, `community`)
- `host`
- `description`
- `thumbnail_url`

### Airtable API workflow

Set the following in `.env.local` and switch source to Airtable:

- `FESTIVAL_DATA_SOURCE=airtable`
- `AIRTABLE_TOKEN=...`
- `AIRTABLE_BASE_ID=...`
- `AIRTABLE_TABLE_NAME=...`
- `AIRTABLE_VIEW=...` (optional)

If Airtable fetch fails or has no usable records, the app falls back to CSV, then seed data.

## Status

Repository initialized. Planning is in place. First-pass frontend scaffolding is running locally, with persistence and admin CRUD still to come.
