# Sinew

Calisthenics training log that replaces a paper notebook. Mobile-first PWA, offline-capable, with accounts + sync.
Product brief: [CALISTHENICS_APP_BRIEF.md](CALISTHENICS_APP_BRIEF.md).

## Stack (mirrors Paymavo)

| Concern | Choice | Same as Paymavo? |
|---|---|---|
| Framework | Next.js 16 App Router, React 19, TypeScript (strict) | yes |
| Styling | Tailwind CSS v4 (`@theme` tokens in `app/globals.css`), dark only | yes (v4) |
| DB / ORM | PostgreSQL + Prisma 7 (`prisma-client` generator, `@prisma/adapter-pg`) | yes |
| Auth | better-auth: email OTP (Resend) + optional Google | yes |
| Env | `@t3-oss/env-nextjs` + zod 4 (`src/env.ts`) | yes |
| Mutations | next-safe-action (to add with the first server actions) | yes |
| Tests / lint | Vitest, ESLint 9 flat config + `unused-imports` | yes |
| AI OCR (photo import) | Gemini vision with a JSON prompt, same pattern as `src/modules/ai/services/ocr.ts` in Paymavo | yes |
| Image storage | Cloudinary (private/authenticated delivery) | yes |
| Hosting | Vercel | yes |
| **Additions** | Dexie (IndexedDB) for local-first sessions; hand-written service worker (`public/sw.js`) | new |

Deliberate differences:
- **No next-intl**: the UI is English only for now.
- **No PWA plugin**: `@serwist/next` / `next-pwa` hook into webpack, while Next 16 builds with Turbopack. A ~60-line service worker is the smallest dependable option.
- **Client-generated ids** for sessions/entries/sets so rows created offline keep their identity on sync.

## Layout

```
src/domain/        Pure TS: types, program seed, session generation, parsers,
                   exercise matching, progression rules. No React/Next/Prisma imports (lint-enforced).
src/domain/__tests__/
src/features/      UI per feature (today, program, …)
src/lib/db         Prisma client
src/lib/auth       better-auth server + client
src/lib/local      Dexie local-first store
prisma/schema.prisma
app/               Routes (Today, Program, manifest, icons, auth API)
```

## Commands

```bash
pnpm install
pnpm dev
pnpm check        # lint + type-check + tests
pnpm test         # vitest watch
pnpm db:migrate   # needs DATABASE_URL
```

Copy `.env.example` to `.env` and fill it in. Without `RESEND_API_KEY`, the sign-in code is printed to the server console.

## Status

Done: repo on the Paymavo stack, full Prisma schema (brief §5 + target history, GTG, import tables),
domain module with 57 unit tests, Phase 2 program seeded as data, PWA shell, Today (with week strip) and Program screens.

Next (brief §10): create the database and run the first migration, seed the program per user, sign-in screen,
then session mode (prefilled sets, 1-tap confirm, rest/hold timers) on top of the local-first store.
