# Topiq Explorer

A cross-platform desktop application for exploring and managing Apache Kafka clusters.

## Features

- **Connection Management** - Save and manage multiple Kafka cluster connections with SSL/SASL support
- **Topic Browser** - View, create, and manage topics with partition details
- **Message Viewer** - Browse messages with filtering, search, and JSON formatting
- **Consumer Groups** - Monitor consumer group status, lag, and member assignments

## Tech Stack

- **Electron** - Cross-platform desktop framework
- **React** - UI framework
- **TypeScript** - Type-safe JavaScript
- **KafkaJS** - Apache Kafka client for Node.js
- **Vite** - Fast build tooling
- **Tailwind CSS** - Utility-first CSS framework
- **Zustand** - Lightweight state management
- **Radix UI** - Accessible component primitives

## Screenshots

<!-- TODO: Add screenshots -->

## Installation

### Download

Download the latest release for your platform from the [Releases](https://github.com/exitCodeNihil/topiq-explorer/releases) page.

#### macOS
- **DMG**: Download `Topiq Explorer-x.x.x.dmg` and drag to Applications
- **ZIP**: Download `Topiq Explorer-x.x.x-mac.zip` for portable use

> **Note**: The app is not code-signed. If you see "Topiq Explorer is damaged and can't be opened", run:
> ```bash
> xattr -cr "/Applications/Topiq Explorer.app"
> ```
> Or right-click the app → Open → Open (bypasses Gatekeeper).

#### Windows
- **Installer**: Download `Topiq Explorer-Setup-x.x.x.exe` for standard installation
- **Portable**: Download `Topiq Explorer-x.x.x.exe` for portable use

## Development

### Prerequisites

- Node.js 22+
- Yarn

### Setup

```bash
# Clone the repository
git clone https://github.com/exitCodeNihil/topiq-explorer.git
cd topiq-explorer

# Install dependencies
yarn install

# Start development server (Vite + Electron)
yarn dev
```

### Build Commands

```bash
# Type-check and build renderer + main process into dist/ and dist-electron/ (no packaging)
yarn build

# Package for current platform
yarn package

# Package for macOS / Windows / Linux
yarn package:mac
yarn package:win
yarn package:linux
```

Packaged artifacts are output to the `release/` directory.

### Testing against local Kafka

`docker/` contains a Compose stack with plain, SASL/PLAIN, SCRAM and SSL brokers. See [TESTING.md](TESTING.md).

## Project Structure

```
├── src/
│   ├── components/     # React components
│   ├── hooks/          # Custom React hooks
│   ├── lib/            # Utility functions
│   ├── stores/         # Zustand state stores
│   └── types/          # TypeScript type definitions
├── electron/           # Electron main process
├── shared/             # Types shared between renderer and main process
├── docker/             # Local Kafka brokers for testing (see TESTING.md)
├── docs/               # Design notes and reviews
├── build/              # Build resources (icons)
└── release/            # Packaged output
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, branching model, and PR guidelines.

## Releases

Releases are automated via GitHub Actions. Version bumps are controlled by PR labels. See [RELEASING.md](RELEASING.md) for details.

## License

Apache-2.0 - see [LICENSE](LICENSE) for details.
