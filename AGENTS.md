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
  - One Solid component per file.
  - View only. No state. Calls out to `state/` for all actions and effects.
- `state/<feature>/{data,effects,actions,formulas}.ts`
  - `data.ts`: contains only signals, stores, and types. No effects.
  - `effects.ts`: contains only side effects. No reference to Solid state.
  - `actions.ts`: combines data and effects providing high-level transitions. Used by components.
  - `formulas.ts`: owns derived queries, calculations, and formatting. No mutations or side effects.
- `routes/`
  - Per-route wrappers. Thin. Delegates to `components`.
- `__tests__/`: co-located with files they test. `foo.ts` gets `__tests__/foo.test.ts`.

## Checks

- `pnpm check`: runs all checks below.
- `pnpm typecheck`: TypeScript, no emit.
- `pnpm test`: Vitest, single run.
- `pnpm fmt:check`: formatting check.
- `pnpm fmt`: format files. (Automatic via agent post-edit hooks.)
- `pnpm build`: production build.

## Rules

- Use Nix for the dev environment.
- Avoid packages except for well-known foundational stuff (e.g. Vitest, Solid, Tailwind).
- Use pnpm's declarative allowed builds file and ask the user before allowing any postinstall scripts.
- Prefer `const` arrow functions over function declarations.
- Separate imports, declarations, logical blocks, and test cases with blank lines.
- Commit as you go.
