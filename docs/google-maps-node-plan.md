# n8n Google Maps Platform Node — Plan

Last updated: 2026-08-13

High-level plan: what this node is, why it's scoped this way, and why it's built on the Routes API instead of the legacy Directions/Distance Matrix APIs. For exact endpoints, auth wiring, and a step-by-step build sequence with code, see [google-maps-node-implementation.md](google-maps-node-implementation.md).

## The pitch

A community node that wraps the official Google Maps Platform APIs (Geocoding, Distance Matrix, Directions, Timezone) for n8n. It's the most-requested node in n8n's history that never got built — the original request thread has been open since February 2021, an n8n co-founder said he'd look into it and never shipped it, and people are still asking for it as recently as two weeks ago (July 28, 2026). Everyone gets pointed to the HTTP Request node as a workaround.

Package name: `n8n-nodes-google-maps-platform` (must start with `n8n-nodes-` per n8n's naming rules).

## Scope — resources and operations

Keep v1 to the core data APIs. Skip Places/scraping — that space is already crowded with Apify/SerpApi wrappers and sits closer to a ToS gray zone; the Geocoding/Distance/Directions/Timezone APIs are clean first-party data lookups.

- **Geocoding**
  - Geocode: address → lat/lng + formatted address + place components
  - Reverse Geocode: lat/lng → address
- **Routes — Distance Matrix**
  - Get Distance & Duration: batch of origins × destinations → driving/walking/transit distance and time, via the **Routes API's `computeRouteMatrix`** (not the legacy Distance Matrix API — see Architecture decision)
- **Routes — Directions**
  - Get Route: origin + destination (+ optional waypoints) → distance, duration, turn-by-turn steps, polyline, via the **Routes API's `computeRoutes`** (not the legacy Directions API)
- **Timezone**
  - Get Timezone: lat/lng + timestamp → IANA timezone ID and UTC offset

That's four resources, ~5 operations — a legitimately complete, useful node without overscoping the first release.

## Architecture decision

Build this as a **declarative ("HTTP API") node**, not a programmatic one. n8n's own CLI scaffolding has an "HTTP API" node type built specifically for exactly this shape — REST endpoints, API Key auth, JSON responses — and it's the faster-to-approve path if you later submit for official verification.

**Important correction from the original plan:** the Directions API and Distance Matrix API (the REST endpoints, not just the JS client library) have been in Google's **Legacy / feature-frozen** status since March 1, 2025, with the **Routes API** (`computeRoutes`, `computeRouteMatrix`) as the designated replacement.

The argument here is stronger than "frozen surface, avoid on principle": **Legacy services are not available in new Cloud projects at all.** A user setting this node up fresh today literally cannot enable the Directions API — only projects that were already using it before the cutover can continue. A node built on the legacy endpoints would be unshippable for every new user, not merely dated. (Google commits to 12 months' notice before decommissioning for the existing-project population, with no date announced yet.) Decision: **build the Directions and Distance Matrix resources against the Routes API from day one.**

This decision has real consequences for auth (Routes needs a header + POST, not the classic query-param GET) and for routing config (two different hosts, different enum casing, custom response flattening). See the [implementation plan](google-maps-node-implementation.md) for all of that.

## Roadmap at a glance

1. Get credentials, hit the raw APIs directly to learn the exact shapes
2. Scaffold with the official n8n node CLI
3. Define resources/operations in the declarative routing config
4. Run and test locally (`npm run dev`)
5. Handle Route Matrix flattening/re-labeling, credential test, field descriptions
6. Lint and document (README, credential setup guide)
7. Publish to npm
8. Install your own package, build a real demo workflow
9. Distribute where the demand already is (the 2021 forum thread, r/n8n, r/automation)
10. Optional, later: apply for official n8n verification

Full detail, code, and gotchas for each step: [google-maps-node-implementation.md](google-maps-node-implementation.md).

## Positioning against what already exists

"No Google Maps node exists" is true for the *data lookup* APIs but not literally true on npm — there are several published community nodes in this space. They are all Places/scraping wrappers: `@two02/n8n-nodes-google-maps-scraper`, `n8n-nodes-crawler-google-places` (an Apify wrapper), `@cryptodevops/n8n-nodes-google-places`, and SerpApi's **verified** node, which covers Google Maps search among 20+ search APIs.

This *strengthens* the scope decision above rather than undermining it — nobody has built the first-party Geocoding/Routes/Timezone side, which is exactly what the 2021 thread keeps asking for. But it does mean the README and the launch post need one explicit sentence on the difference: **this calls Google's own APIs with the user's own key for address→coordinate, ETA, routing, and timezone lookups; those other nodes scrape or resell Places/search results.** Different job, different billing model, different ToS footing. Don't let a reader assume it's a fifth scraper.

`n8n-nodes-google-maps-platform` is unclaimed on npm as of this revision.

## After v1: maintenance

Two things will age this node, and neither is hypothetical:

- **Google will keep moving.** Places already went through its `(New)` migration, Routes replaced two APIs in one cut. Assume at least one breaking-ish change to the Routes surface over the node's life, and keep the response-shaping logic isolated enough (one function per operation, unit-tested) that adapting is a contained edit.
- **Legacy decommission gets 12 months' notice.** Irrelevant to this node if it launches on Routes as planned — but it's the thing to watch if you ever add a resource that only exists on a legacy endpoint. Don't.

## Portfolio blurb (draft — for LinkedIn/Upwork/README)

> Google Maps Platform has never had an official n8n node — the community's been asking since 2021. I built one: geocoding, distance/duration, directions, and timezone lookups, wrapped as a clean community node with proper credential handling and error messages. [link]. If your workflow needs address validation, ETA calculation, or location-based logic and you've been stuck writing raw HTTP Request nodes for it, this replaces that.
