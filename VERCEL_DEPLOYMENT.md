# Vercel Deployment Configuration

## 🔴 Root Cause Analysis

**Why the "No Output Directory named 'public' found" error occurs:**

Vercel successfully builds everything:
- ✅ Prisma generates
- ✅ pnpm installs dependencies
- ✅ TypeScript compiles
- ✅ Next.js apps build
- ✅ All monorepo packages build

**But then Vercel asks: "Where's the deployable output?"**

When Vercel can't determine the framework output, it:
1. Assumes **Static Site** deployment
2. Looks for a `public/` directory at the project root
3. Doesn't find one (because Next.js outputs to `.next/`)
4. ❌ **Fails**

This happens when:
- Root Directory is not configured in Vercel dashboard
- Vercel tries to build from repository root (`/`)
- No framework is detected at the root
- Falls back to static site detection

## ✅ Solution A: Separate Vercel Projects (RECOMMENDED)

**This is the production-grade, best practice approach.**

Create **two separate Vercel projects**:

| Vercel Project | Root Directory | Framework |
|----------------|---------------|-----------|
| `admin` | `apps/admin` | Next.js (auto-detected) |
| `storefront` | `apps/storefront` | Next.js (auto-detected) |

### Setup Steps:

1. **Create Admin Project:**
   - In Vercel: New Project → Import repository
   - **Root Directory**: Set to `apps/admin`
   - Framework: Next.js (auto-detected)
   - Deploy

2. **Create Storefront Project:**
   - In Vercel: New Project → Import same repository
   - **Root Directory**: Set to `apps/storefront`
   - Framework: Next.js (auto-detected)
   - Deploy

3. **Benefits:**
   - ✅ No root directory confusion
   - ✅ Each app deploys independently
   - ✅ Separate environment variables
   - ✅ Separate build logs
   - ✅ No `.next` vs `public/` confusion
   - ✅ Production-ready monorepo setup

## ⚠️ CRITICAL: Root Directory Configuration

**You MUST configure Root Directory in Vercel dashboard for each project.**

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

### How to Set Root Directory:

1. Go to **Vercel Dashboard** → Your Project
2. Navigate to **Settings** → **General**
3. Find **Root Directory** section (under "Project Settings")
4. Click **Edit**
5. Enter the app directory:
   - Admin project: `apps/admin`
   - Storefront project: `apps/storefront`
6. Click **Save**
7. **Redeploy** your project (or push a new commit)

### Verification:

After setting Root Directory, Vercel will:
- ✅ Use the `vercel.json` from that directory
- ✅ Build from that directory context
- ✅ Find `.next` output directory (not `public/`)
- ✅ Deploy successfully

**Without Root Directory set, Vercel defaults to repository root → looks for `public/` → fails.**

## Why No Root vercel.json?

**We intentionally do NOT have a root `vercel.json` because:**

1. **Each app is a separate Vercel project** with Root Directory set to the app folder
2. **Each app has its own `vercel.json`** in `apps/admin/vercel.json` and `apps/storefront/vercel.json`
3. **Vercel reads `vercel.json` from the Root Directory** you configure
4. **Root `vercel.json` would conflict** with the monorepo setup

**The Root Directory setting in Vercel dashboard:**
- Tells Vercel which directory is the project root
- Determines which `vercel.json` to read
- Sets where to look for framework output (`.next` for Next.js)

**If you set Root Directory to `apps/admin`, Vercel uses `apps/admin/vercel.json` and looks for `.next` in `apps/admin/.next`.**

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

**Root Cause:** Vercel successfully builds everything, but then can't find the deployable output because Root Directory is not configured.

**Why it happens:**
1. ✅ Builds succeed (Prisma, TypeScript, Next.js, everything)
2. ❌ Vercel looks for output at repository root (`/`)
3. ❌ Doesn't find Next.js `.next` directory (it's in `apps/admin/.next`)
4. ❌ Falls back to static site detection
5. ❌ Looks for `public/` directory
6. ❌ Doesn't find it
7. ❌ **Fails**

**Solution (REQUIRED - Dashboard Configuration):**

1. Go to **Vercel Dashboard** → Your Project
2. Navigate to **Settings** → **General**
3. Find **Root Directory** section
4. Click **Edit**
5. Enter: 
   - `apps/admin` (for admin project)
   - `apps/storefront` (for storefront project)
6. Click **Save**
7. **Redeploy** (push a new commit or redeploy from dashboard)

**After fixing:** Vercel will look in `apps/admin/.next` (or `apps/storefront/.next`) and find the Next.js output correctly.

### Build Fails with "Cannot find module"

This usually means:
- Dependencies aren't installing from root
- The install command needs to run from repo root

**Solution**: Ensure `installCommand` in `vercel.json` runs from root: `cd ../.. && pnpm install --frozen-lockfile`

