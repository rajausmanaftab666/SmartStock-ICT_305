# shared

Types and zod schemas imported by **both** `server/` and `client/` through the
`@shared/*` path alias.

The stack requires one validation schema per rule in §9 of the specification,
applied on the client for immediate feedback and re-applied on the server as the
actual control. That is only honest if there is a single copy of each rule, so
the schemas live here rather than being written twice.

This is plain TypeScript source, not a built package:

- the server resolves it through `paths` in `server/tsconfig.json` (`tsx`
  honours tsconfig paths at runtime);
- the client resolves it through `resolve.alias` in `client/vite.config.ts`.

Neither side needs a build step, and editing a schema takes effect on both
immediately.
