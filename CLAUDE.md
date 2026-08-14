# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project state

Scaffolded via `@n8n/node-cli` (declarative/custom template) on 2026-08-14. `package.json`, `nodes/GoogleMapsPlatform/`, and `credentials/GoogleMapsPlatformApi.credentials.ts` exist but still hold scaffold placeholders (generic `user`/`company` example resources, a generic header-based `authenticate`) — none of the actual Google Maps operations are implemented yet. Before writing node code, read both planning docs in full:

- [docs/google-maps-node-plan.md](docs/google-maps-node-plan.md) — high-level plan: pitch, scope, and the architecture decision (why Routes API, not the legacy Directions/Distance Matrix APIs).
- [docs/google-maps-node-implementation.md](docs/google-maps-node-implementation.md) — detailed implementation plan: exact endpoints, auth wiring, step-by-step build sequence with code, and every gotcha (billing tiers, field masks, enum casing, etc.). This is the single source of truth for *how* to build it, and tracks progress with checkboxes — check items off as they're done.

For n8n's own conventions on node/credential file structure — separate from this project's specifics above — see `@AGENTS.md`.

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

## Commands

```bash
# Install dependencies (not yet run in this repo — do this before npm run dev)
npm install

# Local dev — boots n8n at localhost:5678 with the node pre-loaded
npm run dev

# Lint
npm run lint

# Build
npm run build

# Build, lint, tag, and publish to npm in one step
npm run release
```

The Google Maps API key for local testing lives in `.env` (gitignored) as `GOOGLE_MAPS_API_KEY` — not yet wired into the n8n dev instance's credential UI; that happens when the credential is filled in during implementation step 5.

## Distribution context

The target audience is a specific, long-standing community request thread (community.n8n.io/t/google-maps-integration/4323, open since Feb 2021) — this shapes README/positioning priorities (clear credential setup docs, a Google Cloud billing-account caveat, example workflow) more than it would for a greenfield node with no waiting audience.
