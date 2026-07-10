# Local Skills Manager

A small cross-platform desktop app for managing the local **skills** used by
[Codex](https://developers.openai.com/codex/) and
[Claude Code](https://docs.claude.com/en/docs/claude-code). It scans your
`~/.codex/skills` and `~/.claude/skills` folders and lets you browse, search,
enable/disable, and delete skills from one place — without hand-editing folders.

Built with [Tauri 2](https://tauri.app/), React 19, TypeScript and Tailwind CSS,
so the bundled app is tiny and runs natively on macOS, Windows and Linux.

> The UI is currently in Chinese. English localization is welcome — see
> [Contributing](#contributing).

## Features

- **Unified view** — lists skills from both Codex (`~/.codex/skills`) and
  Claude Code (`~/.claude/skills`) side by side.
- **Search & filter** — filter by source (Codex / Claude) and state
  (enabled / disabled), or search by name and description.
- **Enable / disable** — toggle a skill without deleting it. Disabling moves the
  skill out of the active folder so the assistant no longer loads it; restoring
  brings it back.
- **Safe delete** — deleted skills go to the system trash/recycle bin, so nothing
  is permanently lost by accident.
- **Bulk actions** — select multiple skills and disable, restore, or delete them
  in one operation.
- **Abnormal-skill detection** — flags folders missing a `SKILL.md` so you can
  spot broken skills.
- **Reveal in file manager** — jump straight to a skill's folder on disk.

## How it works

Each skill is a folder containing a `SKILL.md` file with front-matter metadata
(`name`, `description`). The Rust backend reads the standard skill directories,
parses that metadata, and exposes two Tauri commands to the React frontend:

- `list_skills` — scans and returns all discovered skills.
- `operate_skills` — performs `disable` / `restore` / `delete` on a set of skills.

Deletes use the OS trash (via the [`trash`](https://crates.io/crates/trash)
crate) rather than an unrecoverable `rm`.

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://www.rust-lang.org/tools/install) (stable) and the platform
  toolchain required by Tauri — see the
  [Tauri prerequisites guide](https://tauri.app/start/prerequisites/).

### Development

```bash
npm install
npm run app:dev      # launch the desktop app with hot reload
```

Other useful scripts:

```bash
npm run dev          # run just the Vite frontend in the browser
npm test             # run the frontend unit tests (Vitest)
npm run app:build    # produce a production desktop bundle
```

Rust backend tests:

```bash
cd src-tauri
cargo test
```

## Project structure

```
src/            React + TypeScript frontend
  api.ts        Typed wrappers around the Tauri commands
  App.tsx       Main UI
  components/   UI components
src-tauri/      Rust backend (Tauri)
  src/skills/   Skill scanning, parsing, and operations
  src/commands.rs  Tauri command handlers
```

## Contributing

Issues and pull requests are welcome. Good first contributions include English
(and other) localization, additional skill sources, and tests. Please run
`npm test` and `cargo test` before opening a PR.

## License

[MIT](LICENSE) © jiongzhi
