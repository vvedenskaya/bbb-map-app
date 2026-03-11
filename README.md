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

- Sprintboard roadmap: [docs/sprintboard-roadmap.md](/Users/vincentnaples/Documents/github/bbb_festival-app/docs/sprintboard-roadmap.md)

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

## Status

Repository initialized. Planning is in place. First-pass frontend scaffolding is running locally, with persistence and admin CRUD still to come.
