# Project rules

## Developing

- Commit as you go.

## Stack

- Nix
- pnpm
- SolidStart v2
- TypeScript
- Tailwind CSS
- Vitest

## Structure

- Organized by feature under `src/`, split by role.
- `components/<feature>/foo.tsx`
  - One Solid component per file.
  - View only. No state. Calls out to `state/` for all actions and effects.
- `state/<feature>/{data,effects,actions,formulas}.ts`
  - `data.ts`: contains only signals, stores, and types. No effects.
  - `effects.ts`: contains only side effects. No reference to Solid state.
  - `actions.ts`: combines data and effects providing high-level transitions. Used by components.
  - `formulas.ts`: owns derived queries, calculations, and formatting. No mutations or side effects.
- `routes/`: Per-route wrappers. Thin. Delegates to `components`.
- `lib/`: Independent abstractions. Thoroughly tested.
- `__tests__/`: co-located with files they test. `foo.ts` gets `__tests__/foo.test.ts`.

## Testing

- `pnpm check`: runs all checks below.
- `pnpm typecheck`: TypeScript, no emit.
- `pnpm test`: Vitest, single run.
- `pnpm fmt:check`: formatting check.
- `pnpm fmt`: format files. (Automatic via agent post-edit hooks.)
- `pnpm build`: production build.
- `pnpm dev`: development server.

## Rules

- Avoid deps except for well-known foundations (e.g. Vitest, Solid, Tailwind).
- Electrical theory MUST be accurate. A bug here is not acceptable.

## Style

- Always prefer `const` over `function`.
- One component per file.
