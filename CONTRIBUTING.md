# Contributing to Topiq Explorer

Thanks for your interest in contributing! This guide will help you get started.

## Getting Started

### Prerequisites

- Node.js 22+
- Yarn

### Setup

```bash
# Fork and clone the repository
git clone https://github.com/<your-username>/topiq-explorer.git
cd topiq-explorer

# Install dependencies
yarn install

# Start the development server
yarn dev
```

Production builds inline a PostHog key for the anonymous usage heartbeat and fail without one. Contributors do not need it: run `TELEMETRY=off yarn build`.

## Branching Model

| Branch | Purpose |
|--------|---------|
| `main` | The only long-lived branch — every merge is auto-released |
| `feature/*`, `fix/*` | Short-lived branches off `main`, squash-merged via PR |

## Reporting Bugs and Requesting Features

Use the issue templates (bug report, feature request, question) at https://github.com/exitCodeNihil/topiq-explorer/issues/new/choose. For bugs, include the app version from Settings → About and your OS.

## Submitting a Pull Request

1. Create a branch from `main`
2. Make your changes and commit with clear, descriptive messages
3. Open a PR targeting `main`
4. Add a release label (required) — see [RELEASING.md](RELEASING.md)
5. Fill out the PR template and ensure the checklist is complete
6. PRs are squash-merged; the squash commit message must keep the `(#<PR number>)` suffix so the release workflow can find the label

### Release Labels (Required)

Every PR to `main` **must** carry a release label to control the version bump:

- `release:major` — breaking changes
- `release:minor` — new features, enhancements
- `release:patch` — bug fixes

See [RELEASING.md](RELEASING.md) for full details.

## Code Style

- **TypeScript** — strict mode, prefer explicit types at module boundaries
- **React** — functional components with hooks
- **Zustand** — for state management (stores in `src/stores/`)
- **Tailwind CSS** — utility-first styling, avoid custom CSS where possible
- **Radix UI** — for accessible primitive components

## Useful Links

- [RELEASING.md](RELEASING.md) — release process and version bumping
