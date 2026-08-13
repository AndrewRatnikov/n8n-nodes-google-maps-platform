# n8n-nodes-google-maps-platform

An n8n community node wrapping four official Google Maps Platform REST APIs — Geocoding, Distance Matrix, Directions, and Timezone — for use in n8n workflows.

## Status

**Planning stage — no code scaffolded yet.** There is no `package.json` or source tree in this repo. Before writing any node code, read the two planning docs in full:

- [docs/google-maps-node-plan.md](docs/google-maps-node-plan.md) — high-level plan: the pitch, scope, and the architecture decision (why this is built on the Routes API, not the legacy Directions/Distance Matrix APIs).
- [docs/google-maps-node-implementation.md](docs/google-maps-node-implementation.md) — detailed implementation plan: exact endpoints, auth wiring, a step-by-step build sequence with code, and a checklist for every gotcha (billing tiers, field masks, enum casing, etc.).

`CLAUDE.md` in the repo root points AI coding assistants at both docs and summarizes the architecture for quick reference.

## Prerequisites

- Node.js (this environment has v24.11.1) and npm
- A Google Cloud project with billing enabled, and the Geocoding, Routes, and Time Zone APIs enabled
- Familiarity with n8n community node development (or a willingness to follow the implementation plan step by step)

## Next step

Scaffold the project with n8n's official CLI, per the implementation plan:

```bash
npm create @n8n/node@latest n8n-nodes-google-maps-platform -- --template declarative/custom
```

Do not hand-roll a package structure ahead of this — the scaffolder sets up the license, keywords, icons, and publish workflow the project needs.

## License

MIT — see [LICENSE](LICENSE).
