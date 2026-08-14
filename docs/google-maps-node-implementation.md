# n8n Google Maps Platform Node — Implementation Plan

Last updated: 2026-08-13 (revised after verification pass against current Google + n8n docs)

Companion to [google-maps-node-plan.md](google-maps-node-plan.md), which has the pitch, scope, and the reasoning behind building on the Routes API instead of the legacy Directions/Distance Matrix APIs. This doc is the how: exact endpoints, auth wiring, a step-by-step build sequence with code, and every gotcha worth knowing before you start. Each section ends with a checklist — check items off as you go; the full set is consolidated in [Pre-launch checklist](#pre-launch-checklist) at the end.

## Auth

Single credential type: "Google Maps Platform API Key". The key travels differently depending on the API:

- **Geocoding and Timezone** use the classic pattern: `?key=...` query parameter on a GET request.
- **Routes API** (`computeRoutes` / `computeRouteMatrix`) requires the key in an `X-Goog-Api-Key` **header**, on a **POST** request, plus a mandatory `X-Goog-FieldMask` header — Google returns an empty body without it.

This means the node can't rely on one uniform "generic auth" setting at the credential level the way a single-style API normally would. Plan for this explicitly rather than discovering it mid-build.

### How to actually implement the split

Declarative `routing.request.headers` **cannot inject credential values**, so "give the Routes operations their own header override" is not a routing-level fix. The mechanism is at the credential level: `ICredentialType.authenticate` accepts either an `IAuthenticateGeneric` object **or a function**:

```ts
authenticate: async (credentials, requestOptions) => {
  const key = credentials.apiKey as string;
  const isRoutes = (requestOptions.baseURL ?? '').includes('routes.googleapis.com');
  if (isRoutes) {
    requestOptions.headers = { ...requestOptions.headers, 'X-Goog-Api-Key': key };
  } else {
    requestOptions.qs = { ...requestOptions.qs, key };
  }
  return requestOptions;
}
```

(Verified against `n8n-workflow@2.16.0`: `IAuthenticate = ((credentials, requestOptions) => Promise<IHttpRequestOptions>) | IAuthenticateGeneric`.)

**Confirmed 2026-08-14 via curl:** `routes.googleapis.com` accepts `?key=...` as a query parameter — a POST to `computeRoutes` with no `X-Goog-Api-Key` header at all, just `?key=`, returned `200`. This means the simpler alternative also works: a plain `IAuthenticateGeneric` that always sets `qs.key` on every request, with no branching function needed, since `maps.googleapis.com` already expects `?key=` and `routes.googleapis.com` turns out to accept it too.

```ts
authenticate: {
  type: 'generic',
  properties: {
    qs: { key: '={{$credentials.apiKey}}' },
  },
}
```

Trade-off: this is less code, but it means the credential no longer models the header-based auth that Google's own Routes docs present as canonical — if Google ever tightens `routes.googleapis.com` to require the header, this breaks silently until someone notices. The function form from above costs three extra lines and matches Google's documented auth method exactly, so it doesn't rely on undocumented-but-currently-working behavior. Pick one deliberately; both are now verified to work today.

### Credential test

Add a credential test using a cheap Geocode call against a known address. Critically, `ICredentialTestRequest` supports a `rules` array, and `responseSuccessBody` is exactly the tool for Google's HTTP-200-with-an-error-in-the-body behaviour:

```ts
test: {
  request: { baseURL: 'https://maps.googleapis.com/maps/api', url: '/geocode/json', qs: { address: 'Brandenburg Gate, Berlin' } },
  rules: [
    { type: 'responseSuccessBody', properties: { key: 'status', value: 'REQUEST_DENIED', message: 'Invalid API key, or the Geocoding API is not enabled on this project' } },
  ],
}
```

Without those rules the test passes on a dead key. Note that a passing Geocoding test does **not** guarantee Routes or Timezone are enabled/billed on the same project — each Google Maps API is enabled and billed independently. Say so in the credential description text, not just the README.

### Checklist — Auth

- [x] Confirm via curl whether `routes.googleapis.com` also accepts `?key=` — **confirmed yes** (2026-08-14); either the branching function or a plain `IAuthenticateGeneric` with `qs.key` will work
- [ ] Implement `authenticate` — either the branching function (matches Google's documented header auth) or the simpler generic `qs.key`-only form (less code, relies on undocumented-but-currently-working query-param support on `routes.googleapis.com`); pick one deliberately, see trade-off note above
- [ ] Add the credential `test` block with a `responseSuccessBody` rule matching `status === 'REQUEST_DENIED'`
- [ ] Add a second `responseSuccessBody` rule (or extend the message) for `OVER_QUERY_LIMIT`, so a quota-exhausted key doesn't read as "connection successful"
- [ ] Add a line to the credential's description field: passing this test does not confirm Routes or Timezone are enabled — each API is billed/enabled independently
- [ ] Manually verify the test fails on a key with Geocoding disabled, and passes on a valid key

## The two-host problem — read this before scaffolding

Geocoding/Timezone and the Routes API are on **different hosts**:

| Operation | Endpoint |
|---|---|
| Geocode / Reverse Geocode | `https://maps.googleapis.com/maps/api/geocode/json` |
| Timezone | `https://maps.googleapis.com/maps/api/timezone/json` |
| Get Route | `https://routes.googleapis.com/directions/v2:computeRoutes` |
| Get Distance & Duration | `https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix` |

So a single `requestDefaults.baseURL` does **not** cover the node. Set `requestDefaults.baseURL` to `https://maps.googleapis.com/maps/api` for the Geocoding/Timezone operations, and override `routing.request.baseURL` to `https://routes.googleapis.com` on each Routes operation — `routing.request` is typed as `IHttpRequestOptions`, which includes `baseURL`, so per-operation override is supported. Verify early that n8n's HTTP layer passes the colon-verb path (`v2:computeRoutes`) through unencoded; it's an unusual URL shape and worth a five-minute smoke test before building everything on top of it.

This changes the shape of the Routes operations relative to Geocoding/Timezone:
- **POST + JSON body**, not GET + query string (routing.request needs `method: 'POST'` and a `body` object, not `qs`)
- Origins/destinations/waypoints are structured waypoint objects (`{ address: "..." }` or `{ location: { latLng: {...} } }`), not the legacy pipe (`|`) separated address strings
- A response `X-Goog-FieldMask` header is required on every request. **Confirmed 2026-08-14 via curl:** a missing field mask on `computeRoutes` does *not* come back as an empty 200 body as earlier drafts of this doc assumed — Google returns `400 INVALID_ARGUMENT` with a message naming the missing header and giving an example value. Still easy to forget, but the failure is loud, not silent.
- `computeRouteMatrix`'s response still needs custom flattening/labeling (see Gotchas) — the specific field names differ from the legacy `rows[].elements[]` shape, so re-verify against the current Routes API reference when implementing, don't assume the legacy field names carry over

This is still achievable as a declarative node — POST bodies and static headers are normal `routing.request` config, and declarative nodes support custom `preSend`/`postReceive` functions for the body-shaping and flattening work without dropping into a fully programmatic node. Confirmed against `n8n-workflow@2.16.0`: `PostReceiveAction` includes `(this: IExecuteSingleFunctions, items: INodeExecutionData[], response: IN8nHttpFullResponse) => Promise<INodeExecutionData[]>` alongside the built-in `rootProperty`/`filter`/`sort`/`limit`/`set`/`setKeyValue` actions. Because it runs with `IExecuteSingleFunctions` bound as `this`, the flattening function can call `this.getNodeParameter(...)` — which the Route Matrix labeling work depends on (see Gotchas).

### Checklist — routing config

- [ ] `requestDefaults.baseURL` set to `https://maps.googleapis.com/maps/api`
- [ ] `routing.request.baseURL` overridden to `https://routes.googleapis.com` on both Routes operations
- [ ] Smoke-tested that the colon-verb path (`v2:computeRoutes`) survives n8n's HTTP layer unencoded
- [ ] Routes operations use `method: 'POST'` + `body`, not `qs`
- [ ] Origin/destination/waypoint fields build structured objects (`{ address }` / `{ location: { latLng } }`), not pipe-separated strings
- [ ] `X-Goog-FieldMask` header set on every Routes request (hard-coded server-side, see Gotchas on why it shouldn't be user-editable)
- [ ] `postReceive` custom function written for `computeRouteMatrix` flattening (not a built-in `rootProperty` action — see Gotchas)

## Step by step: what to do

### 1. Get credentials and learn the raw APIs first

Create a Google Cloud project, enable Geocoding, **Routes API** (covers both directions and distance matrix — the legacy Directions/Distance Matrix APIs won't even be listed as enablable on a new project), and Timezone APIs, generate an API key. Hit each endpoint directly (curl or Postman) with a couple of real addresses so you know the exact request/response shapes before you write any node code — pay particular attention to the Routes API's POST body shape, required `X-Goog-FieldMask` request header, and its response field names, since they differ from the legacy Directions/Distance Matrix APIs this plan originally targeted. While you're in curl, settle two open questions that change the node's design: **(a)** does `routes.googleapis.com` also accept `?key=` (if so, the credential can stay a plain `IAuthenticateGeneric`), and **(b)** what does a `computeRouteMatrix` response actually look like with and without `status` in the field mask.

- [x] Create or select a Google Cloud project, link a billing account
- [x] Enable the Geocoding API
- [x] Enable the Routes API
- [x] Enable the Time Zone API
- [x] Generate an API key, restrict it by API (not referrer/IP — see Gotchas) — restricted to Geocoding, Routes, and Time Zone
- [x] `curl` the Geocoding API with a real address; save the raw response JSON somewhere for reference — `200`, `status: OK`
- [x] `curl` the Timezone API with a real lat/lng + Unix timestamp in seconds; save the raw response — `200`, `status: OK`, `Europe/Berlin`
- [x] `curl` `computeRoutes` with POST, `X-Goog-Api-Key`, and `X-Goog-FieldMask` headers; save the raw response — `200` once the field mask used valid `computeRoutes` field paths (note: `routes.condition` is a `computeRouteMatrix`-only field and 400s on `computeRoutes`)
- [x] `curl` `computeRouteMatrix` with a small (e.g. 2×2) origin/destination set; save the raw response — `200`, 4 elements returned out of request order, confirming the index-based re-joining requirement
- [x] Confirm whether `routes.googleapis.com` accepts `?key=` in addition to the header — **confirmed yes**, see Auth section above
- [x] `curl` `computeRouteMatrix` once with `status` **omitted** from the field mask and once **included** — confirmed: omitted returns only `originIndex`/`destinationIndex` with no error signal on a failed element (silent), included returns `status: { code, message }` (loud)

**Validated 2026-08-14** against the live APIs with the project's actual key — all six checks above ran clean. Two things this surfaced are folded into the Auth section and the two-host bullet list above: (a) the missing-field-mask failure is a loud `400`, not a silent empty body, and (b) `routes.googleapis.com` accepts `?key=`, so the credential doesn't strictly need the branching function.

### 2. Install the official n8n node CLI and scaffold the project

```
npm create @n8n/node@latest n8n-nodes-google-maps-platform -- --template declarative/custom
```

When prompted: choose **HTTP API** (this is the CLI's label for the declarative style), base URL `https://maps.googleapis.com/maps/api`, auth type **API Key**. Note that passing `--template declarative/custom` explicitly skips the node-kind and template prompts — you'll still be asked for base URL and auth type, which are template-level prompts. The base URL answer only sets `requestDefaults`; you will override it per-operation for the two Routes resources (see the two-host problem above).

What the scaffold already gives you (verified against `@n8n/node-cli@0.43.3`): MIT license, the `n8n-community-node-package` keyword, `icon` wired to light/dark placeholder SVGs, a `subtitle` expression, title-cased displayNames, `usableAsTool: true`, and the `publish.yml` GitHub Actions workflow. Less blank than you'd expect — the real work is replacing the placeholder icon and filling in resources.

- [ ] Run the scaffold command with `--template declarative/custom`
- [ ] Answer node kind: HTTP API
- [ ] Answer base URL: `https://maps.googleapis.com/maps/api`
- [ ] Answer auth type: API Key
- [ ] Confirm scaffold output includes: MIT `LICENSE`, `n8n-community-node-package` keyword in `package.json`, light/dark icon files, `subtitle` expression, `usableAsTool: true`, `.github/workflows/publish.yml`
- [ ] Replace the placeholder icon SVGs with a neutral geo/pin glyph in your own style (not Google's Maps pin/logo — see trademark note in Gotchas)

### 3. Define each resource/operation in the declarative routing config

Map endpoint path, query params (Geocoding/Timezone) or POST body (Routes) to node UI fields (address, origin/destination, travel mode, units, etc.). Decide up front how the node handles Geocoding's `results[]` array: Google returns multiple matches for ambiguous addresses, so pick one item-per-result (with an optional "first result only" toggle) rather than silently dropping matches — this is the same class of decision as `ZERO_RESULTS` below and is easier to settle now than to change after release.

- [ ] **Geocode** — `address` field → `qs.address`; decide multi-result handling (item-per-result vs. first-result-only toggle)
- [ ] **Reverse Geocode** — lat/lng fields → `qs.latlng`
- [ ] **Get Timezone** — lat/lng + timestamp fields → `qs.location` + `qs.timestamp` (document that the timestamp must be in seconds)
- [ ] **Get Route** — origin/destination/waypoint fields → structured POST body objects; travel-mode dropdown uses Routes' SCREAMING_SNAKE_CASE enum values (`DRIVE`, `WALK`, `BICYCLE`, `TRANSIT`, `TWO_WHEELER`)
- [ ] **Get Distance & Duration** — origins/destinations fields (arrays) → structured POST body objects; same enum casing as Get Route
- [ ] `X-Goog-FieldMask` hard-coded per Routes operation (not exposed as a user field), always including `status` and `condition`
- [ ] `preSend` validation added for Routes hard limits: 25 intermediate waypoints max on Get Route; 625 elements max on Get Distance & Duration (100 if `travelMode: TRANSIT` or `routingPreference: TRAFFIC_AWARE_OPTIMAL`)

### 4. Run it locally and build test workflows

`npm run dev` boots a local n8n at `localhost:5678` with your node already loaded.

- [ ] `npm run dev` — confirm the node appears and loads without errors
- [ ] Test workflow: geocode a real address
- [ ] Test workflow: reverse-geocode a real lat/lng
- [ ] Test workflow: get a route between two real addresses, with at least one waypoint
- [ ] Test workflow: compute a small (2×2 or 3×3) route matrix
- [ ] Test workflow: get timezone for a real lat/lng
- [ ] Deliberately trigger `ZERO_RESULTS` (nonsense address), `REQUEST_DENIED` (bad key), and a malformed Routes request — observe the raw, unhandled behavior before writing error handling around it

### 5. Handle the Route Matrix flattening, error handling, and credential test

This is the single hardest piece of the build — see Gotchas for why index-based responses make it harder than "unnest the array." Write clear field descriptions/placeholders (this matters for n8n's UX guidelines if you submit for verification later).

- [ ] `postReceive` function for `computeRouteMatrix` that re-joins `originIndex`/`destinationIndex` against the request's own origin/destination lists via `this.getNodeParameter(...)`
- [ ] `postReceive` function for Geocoding/Timezone that inspects `status` and throws `NodeApiError` on anything other than `OK` or the deliberately-tolerated `ZERO_RESULTS`
- [ ] `ZERO_RESULTS` handling implemented as an empty/flagged output item, not a thrown error
- [ ] Verified (by testing, not assumption) that a `NodeApiError` thrown from inside `postReceive` still honours the node's "Continue on Fail" setting
- [ ] Field descriptions/placeholders written for every user-facing parameter
- [ ] Credential `test` block wired in with its `responseSuccessBody` rules (see Auth checklist)
- [ ] Unit tests written for the response-shaping (`postReceive`) functions — not required for verification, but this is where the bugs will live, and it's cheap pure input→output logic to test

### 6. Lint and document

`npm run lint`, fix issues, write a README with install steps, a credential setup guide (link to Google Cloud Console), and one example workflow screenshot.

- [ ] `npm run lint` passes with no errors
- [ ] README: install steps
- [ ] README: credential setup guide, linking to Google Cloud Console
- [ ] README: billing-account requirement (needed even for free-tier usage)
- [ ] README: per-element Route Matrix billing explanation (origins × destinations)
- [ ] README: API key plaintext-in-logs / debug-panel caveat
- [ ] README: "restrict your key by API, not by referrer/IP"
- [ ] README: one example workflow screenshot

### 7. Publish

`npm login`, then `npm run release` — this builds, lints, tags, and publishes to npm in one step. Even though provenance is only required for *verification*, publishing via the scaffolded `publish.yml` from the start costs nothing and saves re-doing the release pipeline later.

- [ ] `npm login`
- [ ] `npm run release`
- [ ] Confirm the package is live on npm and installs cleanly in a fresh n8n instance

### 8. Install your own package and build a demo workflow

- [ ] Install via Settings → Community Nodes in n8n
- [ ] Build one real demo workflow as a case study — the "standardize + geocode property addresses, calculate distance to key amenities" angle ties directly to your proptech positioning

### 9. Distribute where the demand already is

- [ ] Reply in the original request thread (community.n8n.io/t/google-maps-integration/4323) with a link to the package and the demo workflow — lead with the working thing, not a pitch
- [ ] Post to r/n8n
- [ ] Post to r/automation

### 10. Optional, later: apply for official n8n verification

Note that since May 1, 2026, verified nodes must be published through a GitHub Actions workflow with an npm provenance statement — not required to ship v1, only for getting the "verified" badge afterward.

- [ ] Confirm the node has real usage before applying
- [ ] Run through the [verification readiness](#verification-readiness) checklist below
- [ ] Apply via the n8n Creator Portal
- [ ] Confirm the publish went through GitHub Actions with an npm provenance statement

## Gotchas to know upfront

- Google requires a billing account linked to the API key even to use the free tier — mention this in your README so users aren't surprised.
- **The free tier is per SKU tier, not per API.** The March 2025 restructure replaced the flat $200 credit with per-SKU caps: **10,000** free events/month for Essentials SKUs, **5,000** for Pro, **1,000** for Enterprise. Geocoding and basic Compute Routes are Essentials. But setting `routingPreference: TRAFFIC_AWARE` / `TRAFFIC_AWARE_OPTIMAL`, or using 11+ intermediate waypoints, silently moves that request to the **Pro** SKU and its 5,000 cap. If the node exposes a traffic-aware option, the field description should say it changes the billing tier.
- **Route Matrix is billed per element, not per request.** Elements = origins × destinations. A single 25×25 call is **625 billable events** — roughly 16 such calls exhausts the monthly free tier. This is the most expensive footgun in the node and it is invisible from the n8n UI, where it looks like one request. Put it in the field description for the origins/destinations inputs, not only the README.
- Geocoding, Timezone, and the Routes API all nest or flatten results differently; budget real time for response-shaping logic across all five operations, not just Route Matrix.
- Rate limits and per-API quotas differ — worth surfacing clear error messages when a request fails rather than a raw Google error blob. Routes-specific hard limits: **25 intermediate waypoints max** for `computeRoutes`; **625 elements max** for `computeRouteMatrix`, dropping to **100** when `travelMode: TRANSIT` or `routingPreference: TRAFFIC_AWARE_OPTIMAL`; and a **3,000 elements/minute** rate limit. Validate these client-side in a `preSend` so users get a real message instead of a 400.
- **Errors come back as HTTP 200.** Geocoding and Timezone wrap failures in a `status` field (`OK`, `ZERO_RESULTS`, `OVER_QUERY_LIMIT`, `REQUEST_DENIED`, `INVALID_REQUEST`) inside a 200 response; n8n's declarative routing only auto-detects errors from HTTP status codes, so a bad key or exceeded quota will silently look like success unless a custom `postReceive` function inspects the body and throws `NodeApiError` itself. The Routes API uses real HTTP status codes for errors (a genuine improvement), so this only applies to the Geocoding/Timezone operations.
- **Omitting `status` from the field mask makes Routes failures look like successes.** Google's own docs call this out for `computeRouteMatrix`: leave `status` out of `X-Goog-FieldMask` and every element comes back looking OK regardless of whether a route was found. Given how much of this plan is about not silently swallowing errors, this is the Routes-side equivalent of the HTTP-200 problem above. Argues for **hard-coding a sensible field mask** in the node (always including `status` and `condition`) rather than exposing the mask as a user-editable field.
- **Route Matrix responses identify rows by index, not by address.** Elements carry `originIndex` / `destinationIndex` and Google does **not** echo the original addresses back. Flattening therefore isn't just "unnest the array" — the `postReceive` function has to re-join each element against the request's own origin/destination lists via `this.getNodeParameter(...)` to produce output a user can actually read. Get this wrong and users get `originIndex: 3` where they expected an address. Budget for it as real logic, not a one-line `rootProperty`.
- **Decide what `ZERO_RESULTS` means.** Treating "no match for this address" as a hard error will abort a batch geocoding run on the first miss — prefer returning an empty/flagged item and respecting `continueOnFail()` over throwing. Verify that a `NodeApiError` thrown from inside a `postReceive` function still honours the node's `onError` / "Continue on Fail" setting rather than killing the execution — test it explicitly, since the error is being raised from a different place than a normal declarative HTTP failure.
- **No built-in throttling, and "Batching" is not free.** Declarative nodes fire one request per input item with no automatic backoff; a workflow geocoding hundreds of addresses will hit `OVER_QUERY_LIMIT` fast. Note that the Batching options (items per batch, batch interval) are a **HTTP Request node feature — declarative nodes do not inherit them**, and making them universal is still an open n8n feature request. So either verify early that you can wire equivalent options yourself, or cut it from v1 and just document the quota clearly. Don't plan around it as if it comes for free.
- **API key exposure.** The key is visible in plaintext in n8n's execution logs and the "show request" debug panel — inherent to how Google's APIs authenticate, not fixable, but worth a README callout. Also: browser-style HTTP-referrer key restrictions don't work for a server-side n8n call — credential setup docs should tell users to restrict the key by API only, not referrer/IP.
- **Verification technical constraints** (confirmed against current n8n docs, Aug 2026): package must have zero runtime dependencies — stay pure declarative, don't add a polyline-decoding library, inline any such helper instead; must integrate exactly one third-party service (fine — four Google Maps resources under one credential counts as one); must pass `npx @n8n/scan-community-package`; MIT license and English-only UI/docs required; `n8n-community-node-package` keyword required in `package.json`.
- **n8n lint/UX conventions** (`eslint-plugin-n8n-nodes-base`) require an `icon` and a `subtitle` on the node description and title-cased `displayName`s throughout. **Correction:** the `declarative/custom` scaffold *does* generate these — it ships `icon: { light: 'file:example.svg', dark: 'file:example.dark.svg' }`, a `subtitle` expression, title-cased displayNames, MIT license, and the required keyword. The risk isn't that they're missing, it's that the placeholders ship unchanged.
- **The icon is a trademark question, not just an asset task.** Replacing the placeholder SVG means putting Google Maps branding in an npm package you publish under your own name. Google's brand guidelines constrain use of the Maps pin/logo, and n8n's verification review looks at icons. Safest path is a neutral geo/pin glyph in your own style rather than Google's mark — decide this before you design it, not after a reviewer flags it.
- **`usableAsTool: true` is worth treating as a feature, not a scaffold default.** It's already in the template, and it makes this node available to n8n's AI agents — an agent that can resolve an address or compute an ETA mid-conversation is a genuinely strong pitch, and none of the existing Google Maps community nodes lead with it. Worth a line in the README and the launch post.
- Timezone API wants a Unix timestamp in **seconds**, not milliseconds — an easy bug if piping in `Date.now()` directly.
- Enum values must match Google's exact spelling in the node's dropdown option values — but note the casing convention **differs between the two hosts**: the legacy-style Geocoding/Timezone params are lowercase (`driving`, `metric`), while the Routes API uses SCREAMING_SNAKE_CASE enums (`DRIVE`, `TRAFFIC_AWARE`, `METRIC`, `TRANSIT`). Copying the old plan's lowercase assumption into the Routes operations will produce 400s.
- Routes waypoint limit: **25 intermediate waypoints** for `computeRoutes` (the old "25 total including origin and destination" figure was the legacy Directions API limit — don't carry it over). Requests with 11 or more intermediates bill at the higher Pro SKU.

## Pre-launch checklist

Consolidated from every gotcha above, grouped so you can sweep through it right before `npm run release`.

### Billing & quotas
- [ ] Billing account linked to the API key, and the README says so
- [ ] README explains the free tier is per-SKU (10k Essentials / 5k Pro / 1k Enterprise), not per-API
- [ ] Field description on any traffic-aware option notes it moves the request to the Pro SKU
- [ ] Field description on origins/destinations notes Route Matrix bills per element (origins × destinations)
- [ ] `preSend` validation enforces 25 intermediate waypoints (Get Route) and 625/100 elements (Get Distance & Duration) with a clear error, not a raw 400

### Error handling
- [ ] Geocoding/Timezone `postReceive` inspects `status` and throws `NodeApiError` on non-OK, non-`ZERO_RESULTS` values
- [ ] Routes field mask hard-codes `status` and `condition` — not exposed as an editable field
- [ ] `ZERO_RESULTS` returns an empty/flagged item and respects `continueOnFail()` instead of throwing
- [ ] Confirmed by testing that a `NodeApiError` thrown inside `postReceive` still honours "Continue on Fail"

### Auth & security
- [ ] Credential `authenticate` function branches by host (query param for `maps.googleapis.com`, header for `routes.googleapis.com`)
- [ ] Credential `test` block uses `responseSuccessBody` rules, not just HTTP status
- [ ] README documents plaintext key exposure in execution logs / debug panel
- [ ] README tells users to restrict the key by API, not by referrer/IP

### Data correctness
- [ ] Route Matrix `postReceive` re-labels elements by address/name, not raw `originIndex`/`destinationIndex`
- [ ] Timezone timestamp field documented and implemented as seconds, not milliseconds
- [ ] Routes enums are SCREAMING_SNAKE_CASE; Geocoding/Timezone enums are lowercase — verified per operation against the live API, not assumed
- [ ] Waypoint limit enforced as 25 *intermediate* (not the legacy "25 total including origin/destination")
- [ ] Geocoding multi-result (`results[]`) behavior decided and implemented, not left as an accident of `rootProperty`

### Verification readiness
- [ ] Zero runtime dependencies (no polyline-decoding library — inline any such helper)
- [ ] Exactly one third-party service integrated (four Google Maps resources under one credential counts as one)
- [ ] `npx @n8n/scan-community-package` passes
- [ ] MIT license; UI and docs are English-only
- [ ] `n8n-community-node-package` keyword present in `package.json`
- [ ] Icon replaced with a non-trademarked glyph, not Google's Maps pin/logo
- [ ] Published via the GitHub Actions `publish.yml` workflow with npm provenance (required for verification since May 1, 2026)

### Positioning polish
- [ ] `usableAsTool: true` called out in the README and the launch post
