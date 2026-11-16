# Sinew: working notes for Claude

Calisthenics training log (Next.js 16, React 19, Prisma 7, better-auth, Tailwind v4, pnpm). See README.md for the stack and layout, CALISTHENICS_APP_BRIEF.md for the product.

## Workflow (cloud dev + Vercel preview)
- Develop in Claude Code on the web, on a `claude/...` branch. Never depend on a local machine.
- Run `pnpm check` (lint + type-check + tests) before every push.
- Pushed branches get a Vercel Preview URL automatically.
- **Stable test environment: branch `staging` -> https://staging.sinew.fit.** To test a change on a real device, merge/push it to `staging`. Production is `main`.
- Preview uses its own database (Neon branch), never the production one. Preview migrations run only when `MIGRATE_PREVIEW=true` (see `scripts/migrate-on-deploy.mjs`).

## Conventions
- `src/domain/` is pure TS: no React, Next or Prisma imports (lint-enforced).
- Env vars are validated in `src/env.ts`; add new ones there and in `.env.example`.
- Every server query is scoped by the user id (`requireUserId`).
- Never commit secrets; `.env*` is gitignored.

## Env vars
Defined in `.env.example`. Sign-in on Vercel (incl. Preview) needs `RESEND_API_KEY`: without it OTP sending throws when `NODE_ENV=production`.
