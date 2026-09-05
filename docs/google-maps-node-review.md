# n8n Google Maps Platform Node — Review: Bugs & Architecture

Last updated: 2026-09-05

A full-package review of `0.1.3` plus the unreleased departure/arrival-time work on `main` (`d3b631a`). Companion to [google-maps-node-plan.md](google-maps-node-plan.md) (pitch and scope) and [google-maps-node-implementation.md](google-maps-node-implementation.md) (how it was built, and the source of truth for build steps). This doc is the *what's still wrong and what to change next* — findings, not history.

Nothing here is a crash-level defect. Tests, lint, and build all pass as of this review. The findings are correctness gaps against Google's current API contract, reliability gaps under real workflow load, and architecture changes worth making before the node grows further.

## How this was verified

- `npm test` — 30 tests, 1 file, all passing.
- `npm run lint` — exit 0, no findings.
- `npm run build` — TypeScript build successful.
- Every source file read in full: the node description, credential, `GenericFunctions.ts`, and all four resource directories.
- Claims about Google's limits and billing checked against the live Routes API reference and the SKU details page, not against memory or the older notes in the implementation plan.
- Claims about n8n's routing behavior checked against `n8n-core`'s `routing-node.ts` on `master`, specifically: hidden properties are skipped before their `routing.send`/`preSend` runs, `preSend` hooks run after the whole request is assembled, and `runNode` issues one request per input item.

The last point matters and is worth recording: it means the `preSend` cleanup functions in `GenericFunctions.ts` are **not** order-dependent on which property they hang off. They see the fully assembled body. The current design is safe.

## Bugs

Ordered by how likely a real user is to hit them.

### 1. Unthrottled fan-out on multi-item input

**Where:** [GoogleMapsPlatform.node.ts](../nodes/GoogleMapsPlatform/GoogleMapsPlatform.node.ts) — no `requestOptions` property is declared.

n8n's routing engine builds one request promise per input item and runs them through `Promise.allSettled`. Feeding 500 addresses into Geocode fires 500 concurrent requests at Google. Per-minute quota rejections come back as `OVER_QUERY_LIMIT`, which `handleGeocodingResponse` turns into a thrown `NodeApiError` — so the whole run aborts unless the user found Continue On Fail.

This is the single most likely real-world failure for the node's actual audience. The community thread is full of people wanting to geocode a spreadsheet, which is exactly the shape that triggers it.

The engine already supports throttling, gated on a node parameter it looks up itself:

```ts
const { batching } = context.getNodeParameter('requestOptions', 0, {}) as {
  batching: { batch: { batchSize: number; batchInterval: number } };
};
```

**Fix:** declare a `requestOptions` collection with `batching.batch.batchSize` / `batchInterval`, the same shape other n8n nodes use. No custom code — the engine does the sleeping. Ship a conservative default rather than unlimited.

### 2. Missing 50-address cap on Distance Matrix

**Where:** `validateRouteMatrixSize` in [GenericFunctions.ts:94](../nodes/GoogleMapsPlatform/GenericFunctions.ts:94).

The validator enforces the element product (625, dropping to 100 for `TRANSIT` or `TRAFFIC_AWARE_OPTIMAL`) but not Google's separate cardinality rule:

> "The sum of the number of origins + the number of destinations specified as either `placeId` or `address` must be no greater than 50."

Since the node only accepts addresses, this cap applies to *every* request it sends. A 40 x 15 matrix is 600 elements — under the 625 limit, so local validation passes — but 55 addresses, so Google rejects it with a raw 400. That is precisely the class of error the `preSend` validators exist to prevent.

**Fix:** add `origins.length + destinations.length > 50` to the same validator, with a message that names both counts. Worth a unit test alongside the existing element-count cases.

### 3. Two Wheeler is Enterprise-tier billing, presented as free

**Where:** the Travel Mode options in [getRoute.ts:48](../nodes/GoogleMapsPlatform/resources/directions/getRoute.ts:48) and [getDistanceDuration.ts:60](../nodes/GoogleMapsPlatform/resources/distanceMatrix/getDistanceDuration.ts:60).

Google's SKU details page lists two-wheeled vehicle routing as a Compute Routes **Enterprise** trigger. Enterprise has the smallest free tier of the three: 1,000 events/month, versus 10,000 for Essentials.

The node is otherwise scrupulous about this — every traffic-aware option carries a "(Pro Pricing)" suffix and a description explaining the tier change. Two Wheeler carries nothing, and the README's billing section says basic Directions/Distance Matrix calls are Essentials, which reads as covering it. A user picks the mode that matches their delivery fleet and burns the Enterprise free tier ten times faster than expected.

**Fix:** suffix the option name and extend the field description, matching the existing Pro-pricing treatment. Add the Enterprise trigger to the README's billing section.

### 4. Timezone `ZERO_RESULTS` throws where Geocoding tolerates it

**Where:** `handleTimezoneResponse` in [GenericFunctions.ts:166](../nodes/GoogleMapsPlatform/GenericFunctions.ts:166).

`handleGeocodingResponse` special-cases `ZERO_RESULTS` and returns a flagged item, on the reasoning that "no match" is data, not failure. `handleTimezoneResponse` has no such branch: any non-`OK` status throws. The Time Zone API returns `ZERO_RESULTS` for a location with no known timezone — a point in the ocean, most commonly — so a single bad coordinate in a batch aborts the run.

The two handlers should agree. The implementation plan's own error-handling checklist frames the `ZERO_RESULTS` decision as a general one, not a Geocoding-only one.

**Fix:** give the Timezone handler the same `ZERO_RESULTS` branch.

### 5. Broken credential documentation anchor

**Where:** [GoogleMapsPlatformApi.credentials.ts:16](../credentials/GoogleMapsPlatformApi.credentials.ts:16) and [GoogleMapsPlatform.node.json:9](../nodes/GoogleMapsPlatform/GoogleMapsPlatform.node.json:9).

Both point at `README.md#credentials`. The README's heading is `## Credential setup`, which GitHub renders as `#credential-setup`. The anchor doesn't resolve, so the "docs" link on the credential — the one users click when the key isn't working — drops them at the top of the page instead of at the setup steps.

**Fix:** change both URLs to `#credential-setup`, or rename the README heading. Prefer fixing the URLs; the heading text is better as-is.

### 6. CI never runs the tests

**Where:** [ci.yml](../.github/workflows/ci.yml).

The workflow runs lint and build only. The 30 unit tests covering every response-shaping and validation function are never executed on a pull request or a push to `main`. `npm run release` doesn't run them either — the release script lints and builds.

The tests are the only thing standing behind the index-to-address rejoin and the status-code handling, both of which are easy to break silently. Not running them in CI wastes the coverage that already exists.

**Fix:** add a `npm test` step to the CI job. Consider adding it to the release path too.

### 7. Distance Matrix can't set a departure time

**Where:** [getDistanceDuration.ts](../nodes/GoogleMapsPlatform/resources/distanceMatrix/getDistanceDuration.ts) — no time field.

`computeRouteMatrix` accepts `departureTime` and `arrivalTime` under the same constraints as `computeRoutes` (arrival only for `TRANSIT`). Get Route gained both in `d3b631a`; Get Distance & Duration did not.

This is a functional gap rather than a defect, but it interacts with a feature the node already exposes: Traffic Aware and Traffic Aware Optimal are offered on the matrix, and traffic-aware routing for a *future* trip is only meaningful with a departure time. Today a user can pay the Pro-tier price on a matrix request and only ever get "now" traffic.

**Fix:** reuse `setRouteTimes` on the matrix operation. It already reads `travelMode` and gates arrival time on `TRANSIT`, so it should port with no change beyond wiring.

## Architecture

The foundational decisions are right and I would not revisit them:

- **Declarative over programmatic.** Correct for this shape, and it keeps the node on the easier path to n8n verification.
- **Routes API over the legacy endpoints.** Correct, and non-negotiable for new Cloud projects.
- **Host-branching `authenticate`.** Correct. The implementation plan notes that `routes.googleapis.com` also accepts `?key=`, making a simpler uniform credential possible — but branching matches Google's documented contract per API, and undocumented acceptance is exactly the kind of thing that stops working without notice. Keep the branch.
- **Index-to-address rejoin in `flattenRouteMatrixResponse`.** Correct, and the reason the node is meaningfully better than an HTTP Request node for this call. The zero-index handling is right (`??`, not `||`), and it's tested.
- **One file per operation, one directory per resource.** Scales fine, and is the layout an n8n reviewer expects.

Changes worth making, in priority order:

### Add an Additional Fields collection per resource

The node currently exposes only required fields plus a handful of options, all at the top level. The obvious next requests — language and region for Geocoding, component filtering, units, avoid tolls/highways/ferries, alternative routes, optimize waypoint order for Routes — have nowhere to go without cluttering the main panel.

Add a `collection`-type "Additional Fields" per operation before adding any of them individually. This is the standard n8n pattern, keeps the default panel to what a first-time user needs, and means each new option is a one-entry change rather than a layout decision. Doing it *before* the fields arrive is much cheaper than retrofitting once users have workflows pinned to top-level parameter names.

Note that `optimizeWaypointOrder` and 11-25 waypoints are both Pro triggers, so anything added there inherits the pricing-suffix convention from finding 3.

### Add a location input type for Route and Matrix waypoints

Origins, destinations, and intermediates are address strings only. The README's own worked example — geocode an address, then feed it into Distance Matrix — therefore round-trips through Google's geocoder a second time, because the coordinates from step 1 have to be stringified back into an address field. That costs an extra billable resolution and can land on a different point than the one Geocode returned.

The Routes API takes `location.latLng` and `placeId` on every waypoint. Add an input-type selector (Address / Coordinates / Place ID) and build the waypoint object accordingly. Place ID is the highest-fidelity option and the cheapest for Google to resolve.

This is the change that makes the node's resources compose properly with each other rather than just sitting side by side.

### Make the Get Route field mask conditional

The field mask is hard-coded to `routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs`. `routes.legs` pulls every leg, every step, per-step instructions, and per-step polylines. For the common "how far and how long" case that's a large payload stored in every execution record, for data the workflow never reads.

Add an "Include Steps" toggle (default off) and vary the mask. Field mask contents also feed SKU selection, so a narrower default mask is the safer default in more than one sense.

### Add a node-description test

The current suite tests the helper functions well and the node description not at all. Wiring mistakes — a `displayOptions` that references a stale operation value, a routing expression with a typo, a `name` that doesn't match what a `preSend` looks up with `getNodeParameter` — are invisible to both the unit tests and the linter, and only show up as a broken panel in a live n8n.

A cheap structural test over the exported description catches most of that: every property has `displayOptions` naming a real resource and operation, every `preSend`-referenced parameter name exists as a property, every `={{...}}` expression parses. This is the highest-value test to add next, because it covers the layer where the node actually is complex.

## Minor

- **Routing Preference options are ordered differently between the two operations.** Get Route lists Unaware, Aware, Aware Optimal; Get Distance & Duration lists them alphabetically. Same three options, same meaning, two orders. Pick one.
- **[CLAUDE.md](../CLAUDE.md)'s "Project state" section is stale, and misleadingly so.** It states the node and credential "still hold scaffold placeholders" with "generic `user`/`company` example resources" and that "none of the actual Google Maps operations are implemented yet." All four resources have shipped and `0.1.3` is live on npm. This is the file that orients a future contributor or agent session before it reads any code, so it is the worst place in the repo for a stale claim.
- **Dev-server port disagrees between docs.** The README's Development section says `localhost:5679`; [CLAUDE.md](../CLAUDE.md) says `localhost:5678`.
- **`@n8n/node-cli` is an unpinned `"*"` devDependency.** The lockfile masks this locally, but CI runs `npm ci` against the lockfile too, so it's latent rather than active. Worth pinning to a range before it resolves to a major bump mid-release — `publish.yml` already documents a hard floor of ≥ 0.23.0 for provenance support.
- **`subtitle` renders raw parameter values.** `operation + ": " + resource` puts `getDistanceDuration: distanceMatrix` on the canvas rather than display names.

## Checklist

### Bugs
- [x] Expose `requestOptions` batching so multi-item runs don't fan out unthrottled (finding 1)
- [x] Enforce the 50-address origins + destinations cap in `validateRouteMatrixSize`, with a unit test (finding 2)
- [x] Mark Two Wheeler as Enterprise-tier in both Travel Mode fields and in the README billing section (finding 3)
- [x] Give `handleTimezoneResponse` the same `ZERO_RESULTS` branch as the Geocoding handler (finding 4)
- [x] Fix the `#credentials` anchor in the credential and in `GoogleMapsPlatform.node.json` (finding 5)
- [x] Add `npm test` to the CI workflow (finding 6)
- [x] Wire `setRouteTimes` into Get Distance & Duration (finding 7)

### Architecture
- [x] Add an Additional Fields collection per operation, before adding any new optional field
- [x] Add an input-type selector (Address / Coordinates / Place ID) for Route and Matrix waypoints -- shipped for Get Route's single Origin/Destination fields (non-breaking: existing `originAddress`/`destinationAddress` params and behavior are untouched, since Origin/Destination Type defaults to "Address"). The repeatable Waypoints/Origins/Destinations lists are intentionally out of scope here -- giving each list item its own type without breaking their existing `string[]` shape needs a versioned node (see [google-maps-node-implementation.md](google-maps-node-implementation.md) conventions), which wasn't taken on in this pass.
- [ ] Make `routes.legs` conditional on an "Include Steps" toggle, default off
- [ ] Add a structural test over the node description

### Minor
- [ ] Align Routing Preference option order across the two operations
- [ ] Rewrite CLAUDE.md's "Project state" section — it still describes the node as unimplemented scaffold
- [ ] Reconcile the dev-server port between the README and CLAUDE.md
- [ ] Pin `@n8n/node-cli` to a range with a ≥ 0.23.0 floor
- [ ] Use display names in the node `subtitle`
