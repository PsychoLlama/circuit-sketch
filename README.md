# Electricity Explainer

A single-package SolidStart v2 app with TypeScript, Tailwind CSS, and Vitest.

## Development

```sh
nix develop
pnpm install --frozen-lockfile
pnpm dev
```

Open the local URL printed by Vite. The home page includes a small greeting action.
The Nix shell provides Node.js 24, pnpm, and formatters.

## Checks and production

```sh
pnpm typecheck
pnpm test
treefmt --fail-on-change
pnpm build
pnpm start
```

Use `pnpm test:watch` during development and `treefmt` to format files.
The production server uses Nitro v3 (currently a pinned beta), the deployment
plugin supported by SolidStart v2.

## Source layout

```text
src/
  components/hello/HelloWorld.tsx
  state/hello/
    data.ts
    effects.ts
    actions.ts
    actions.test.ts
  routes/index.tsx
  app.tsx
  app.css
  entry-client.tsx
  entry-server.tsx
```

Routes delegate to view components. Components call feature actions; data modules
own signals and stores, and effects modules contain external side effects without
referencing Solid state. Feature state is created per view instance rather than
as a shared module singleton, keeping server requests isolated. The hello feature
has no external side effects yet, so its effects module is an empty placeholder.

See [AGENTS.md](./AGENTS.md) for the project rules.

## Dependency build permissions

`pnpm-workspace.yaml` holds the declarative `allowBuilds` policy. Unreviewed
dependency build scripts fail installation. Ask the user before allowing any
postinstall scripts; do not approve them automatically.

## References

- [SolidStart v2 setup](https://docs.solidjs.com/solid-start/v2/getting-started)
- [Tailwind's Vite integration](https://tailwindcss.com/docs/installation/using-vite)
- [pnpm build permissions](https://pnpm.io/settings/build)
