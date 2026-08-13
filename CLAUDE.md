# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project state

This repository currently contains only planning docs — no code has been scaffolded yet. There is no `package.json`, no source tree, and no git repository initialized. Before writing any node code, read both docs in full:

- [docs/google-maps-node-plan.md](docs/google-maps-node-plan.md) — high-level plan: pitch, scope, and the architecture decision (why Routes API, not the legacy Directions/Distance Matrix APIs).
- [docs/google-maps-node-implementation.md](docs/google-maps-node-implementation.md) — detailed implementation plan: exact endpoints, auth wiring, step-by-step build sequence with code, and every gotcha (billing tiers, field masks, enum casing, etc.). This is the single source of truth for *how* to build it.

When the user is ready to start building, the first real step is running the n8n node CLI scaffolder (see below) — do not hand-roll a package structure that competes with it.

## What this project is

An n8n community node wrapping four Google Maps Platform REST APIs: Geocoding, Distance Matrix, Directions, and Timezone. Package name (fixed by n8n's naming convention, must start with `n8n-nodes-`): `n8n-nodes-google-maps-platform`.

Scope is deliberately limited to first-party data lookup APIs — Places/scraping-style endpoints are explicitly out of scope for v1 (crowded market, ToS gray zone).

## Architecture

Build as a **declarative ("HTTP API") node**, not a programmatic one — n8n's CLI scaffolding has a template built for exactly this shape (REST endpoint + API Key auth + JSON response), and it's the faster path to n8n's official verification later.

Directions and Distance Matrix are built against the **Routes API** (`computeRoutes` / `computeRouteMatrix`), not the legacy Directions/Distance Matrix APIs — those are feature-frozen and unavailable to new Cloud projects. Read the implementation plan's "two-host problem" section before scaffolding: Geocoding/Timezone and the Routes API live on different hosts with different auth mechanisms (query-param key vs. header key + POST + mandatory field mask).

- **Auth**: single credential type, "Google Maps Platform API Key" — but the key travels differently per API (query param for Geocoding/Timezone, `X-Goog-Api-Key` header for Routes). No OAuth. Include a credential test (cheap Geocode call, with `responseSuccessBody` rules to catch Google's HTTP-200-with-error-in-body behavior) so users get a real "connection successful" check.
- **Resources/operations** (4 resources, ~5 operations total):
  - Geocoding → Geocode, Reverse Geocode
  - Distance Matrix → Get Distance & Duration (via Routes API `computeRouteMatrix`)
  - Directions → Get Route (via Routes API `computeRoutes`)
  - Timezone → Get Timezone
- **Known non-trivial part**: `computeRouteMatrix` responses identify rows by `originIndex`/`destinationIndex`, not by address — flattening means re-joining against the request's own origin/destination lists, not just unnesting an array. See the implementation plan's Gotchas section.

## Commands (once scaffolded)

These become available after running the scaffolder in step 2 of the implementation plan; they don't exist yet in this repo.

```bash
# Scaffold the project (run once, from the parent directory you want the package in)
npm create @n8n/node@latest n8n-nodes-google-maps-platform -- --template declarative/custom
# When prompted: node type = HTTP API, base URL = https://maps.googleapis.com/maps/api, auth = API Key
# (base URL only covers Geocoding/Timezone — Routes operations override to https://routes.googleapis.com per-operation)

# Local dev — boots n8n at localhost:5678 with the node pre-loaded
npm run dev

# Lint
npm run lint

# Build, lint, tag, and publish to npm in one step
npm run release
```

## Distribution context

The target audience is a specific, long-standing community request thread (community.n8n.io/t/google-maps-integration/4323, open since Feb 2021) — this shapes README/positioning priorities (clear credential setup docs, a Google Cloud billing-account caveat, example workflow) more than it would for a greenfield node with no waiting audience.
