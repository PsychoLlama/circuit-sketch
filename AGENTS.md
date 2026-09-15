# Project rules

## Stack

- pnpm
- SolidStart v2
- TypeScript
- Tailwind CSS
- Vitest

## Structure

- Single package.
- Organized by feature under `src/`, split by role.
- `components/<feature>/Foo.tsx`
  - View only. No state. Calls out to `state/` for all actions and effects.
- `state/<feature>/{data,effects,actions}.ts`
  - `data.ts`: contains only signals, stores, and types. No effects.
  - `effects.ts`: contains only side effects. No reference to Solid state.
  - `actions.ts`: combines data and effects providing high-level transitions. Used by components.
- `routes/`
  - Per-route wrappers. Thin. Delegates to `components`.

## Rules

- Use Nix for the dev environment.
- Avoid packages except for well-known foundational stuff (e.g. Vitest, Solid, Tailwind).
- Use pnpm's declarative allowed builds file and ask the user before allowing any postinstall scripts.
- Commit as you go.
