# Deployment Guide

## Pre-Deployment Checklist

Before every deploy, run these commands locally:

```bash
# Clean install
rm -rf node_modules .turbo
pnpm install

# Approve build scripts (critical for Prisma, bcrypt, etc.)
pnpm approve-builds

# Build everything
pnpm -r build

# Test build (if using Vercel CLI)
vercel build
```

If any step fails locally, **fix it before deploying**. Vercel/Fly.io will fail the same way.

## Build Script Approval

After installing dependencies, you **must** approve build scripts:

```bash
pnpm approve-builds
```

Approve these packages:
- `prisma`
- `@prisma/client`
- `bcrypt`
- `esbuild`

This is critical! Without approval, pnpm silently skips required native build steps.

## Version Locking

This project uses locked versions for reproducibility:

- **Node**: `24.x` (Vercel requirement)
- **pnpm**: `10.26.0`

These are specified in `package.json`:
- `engines.node`: `24.x`
- `engines.pnpm`: `10.26.0`
- `packageManager`: `pnpm@10.26.0`

## Prisma Generation

Prisma client is automatically generated:
- During `pnpm install` (via `postinstall` script in `packages/db`)
- During `pnpm build` (via root build script)

This ensures Prisma client exists in CI/CD environments.

## Build Order

The root build script ensures proper order:

```json
"build": "pnpm --filter db generate && pnpm -r build"
```

This:
1. Generates Prisma client first
2. Then builds all packages (db, shared, compliance-core, api)

## Fly.io Deployment

### Environment Variables

Set these secrets in Fly.io:

```bash
flyctl secrets set INNGEST_BASE_URL=https://api.inngest.com
flyctl secrets set INNGEST_SIGNING_KEY=signkey-prod-<your_signing_key_here>
flyctl secrets set DATABASE_URL=postgresql://...
```

### Build Configuration

The `Dockerfile` in `apps/api/` handles:
- Installing dependencies
- Generating Prisma client
- Building all packages
- Setting up the runtime environment

## Vercel Deployment

Vercel will:
1. Run `pnpm install` (Prisma generates via postinstall)
2. Run `pnpm build` (generates Prisma again, then builds)
3. Deploy the built application

Make sure build script approval is committed or handled in Vercel settings.

## Troubleshooting

### "Prisma Client not found"

- Ensure `postinstall` script runs: `pnpm install --force`
- Check that build scripts are approved: `pnpm approve-builds`
- Verify Prisma generation: `pnpm --filter db generate`

### "Native module build failed"

- Run `pnpm approve-builds` and approve the failing package
- Ensure correct Node version: `node --version` should be `24.x` or higher
- Clean install: `rm -rf node_modules && pnpm install`

### "Build works locally but fails in CI"

- **Rule**: If it doesn't work locally, it won't work in CI
- Run the exact CI commands locally
- Check version mismatches (Node, pnpm)
- Verify all build scripts are approved

## Hard Truth

**A fix is not complete unless `pnpm -r build` and `vercel build` pass locally in a clean install.**

This forces thinking like CI, not like a dev server.

