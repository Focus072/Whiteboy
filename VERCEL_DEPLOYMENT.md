# Vercel Deployment Configuration

## Monorepo Setup

This is a monorepo with multiple applications:
- `apps/admin` - Next.js admin dashboard
- `apps/storefront` - Next.js customer storefront
- `apps/api` - Fastify API (deploy to Fly.io, not Vercel)

## Vercel Configuration

Each Next.js app should be deployed as a **separate Vercel project** with the following settings:

### For `apps/admin`:

1. **Root Directory**: `apps/admin`
2. **Framework Preset**: Next.js
3. **Build Command**: (auto-detected by Vercel)
4. **Output Directory**: `.next` (auto-detected)
5. **Install Command**: `pnpm install --frozen-lockfile` (from repo root)

**Important**: The `vercel.json` in `apps/admin` is already configured correctly with build commands that reference the root directory.

### For `apps/storefront`:

1. **Root Directory**: `apps/storefront`
2. **Framework Preset**: Next.js
3. **Build Command**: (auto-detected by Vercel)
4. **Output Directory**: `.next` (auto-detected)
5. **Install Command**: `pnpm install --frozen-lockfile` (from repo root)

## Setting Root Directory in Vercel

1. Go to your Vercel project settings
2. Navigate to **Settings** → **General**
3. Under **Root Directory**, set:
   - For admin: `apps/admin`
   - For storefront: `apps/storefront`
4. Save the changes

## Why No Root vercel.json?

The root directory does NOT have a `vercel.json` because:
- Each app is deployed as a separate project
- Each app has its own `vercel.json` configured correctly
- Having a root `vercel.json` would cause conflicts

## Build Commands

The `vercel.json` files in each app directory use commands like:
```json
{
  "buildCommand": "cd ../.. && pnpm build --filter admin",
  "installCommand": "cd ../.. && pnpm install --frozen-lockfile"
}
```

These commands:
1. Navigate to the repo root (`cd ../..`)
2. Run pnpm commands from the root (required for monorepo workspaces)

## Environment Variables

Set environment variables in each Vercel project:

**For admin:**
- `NEXT_PUBLIC_API_URL` - Your API URL (e.g., `https://lumi-api.fly.dev`)

**For storefront:**
- `NEXT_PUBLIC_API_URL` - Your API URL (e.g., `https://lumi-api.fly.dev`)

## Deployment Flow

1. Push code to GitHub
2. Vercel automatically detects changes
3. For each project (admin/storefront):
   - Installs dependencies from repo root
   - Builds the specific app
   - Deploys to Vercel

## Troubleshooting

### Error: "No Output Directory named 'public' found"

This error occurs when:
- Root Directory is not set correctly
- Vercel is trying to build from root instead of the app directory

**Solution**: Ensure Root Directory is set to `apps/admin` or `apps/storefront` in Vercel project settings.

### Build Fails with "Cannot find module"

This usually means:
- Dependencies aren't installing from root
- The install command needs to run from repo root

**Solution**: Ensure `installCommand` in `vercel.json` runs from root: `cd ../.. && pnpm install --frozen-lockfile`

