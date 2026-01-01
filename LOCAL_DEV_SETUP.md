# Local Development Setup Guide

This guide ensures your local environment matches what's on GitHub and is ready for development.

## ✅ Quick Start Checklist

### 1. Prerequisites
- ✅ Node.js (v22.18.0 or higher - you have v22.18.0)
- ✅ pnpm (v10.26.0 - you have it installed)
- ✅ Git (repository cloned and up to date)

### 2. Environment Setup

#### API Environment (`apps/api/.env.local`)
Your API environment is already configured with:
- ✅ Database connection (Neon PostgreSQL)
- ✅ Inngest dev server settings
- ✅ Veriff API keys
- ✅ Server configuration

#### Main App Environment (`apps/main/.env.local`)
Your main app environment is configured with:
- ✅ `NEXT_PUBLIC_API_URL=http://localhost:3001`

### 3. Install Dependencies
```bash
pnpm install
```
✅ Already done - dependencies are installed and Prisma client is generated.

### 4. Database Connection
Your database is connected to Neon PostgreSQL:
- Connection string configured in `apps/api/.env.local`
- Prisma client generated automatically

### 5. Running the Development Environment

You need **3 separate terminals**:

#### Terminal 1: Inngest Dev Server (Optional - for background jobs)
```bash
pnpm dev:inngest
# Or: npx inngest-cli dev
```
This starts Inngest on port 8288 for background job processing.

#### Terminal 2: API Server
```bash
pnpm dev:api
```
This starts the Fastify API server on **port 3001**.

#### Terminal 3: Main App (Storefront + Admin)
```bash
pnpm dev:main
```
This starts the Next.js app on **port 3000**.

**OR run both API and Main together:**
```bash
pnpm dev
```
This runs both API and Main app in parallel.

### 6. Access Your Apps

- **Main App (Storefront + Admin)**: http://localhost:3000
- **API Server**: http://localhost:3001
- **API Health Check**: http://localhost:3001/health
- **API Swagger Docs**: http://localhost:3001/api/docs (in development)
- **Inngest Dashboard**: http://localhost:8288 (if running)

### 7. Useful Commands

```bash
# Check for admin accounts in database
pnpm --filter api check-admin

# Create an admin account
pnpm create-admin

# Generate Prisma client
pnpm db:generate

# Run database migrations
pnpm db:migrate

# Open Prisma Studio (database GUI)
pnpm db:studio

# Build for production
pnpm build:main
```

### 8. Making Changes & Pushing to GitHub

**Workflow:**
1. Make your changes locally
2. Test them with `pnpm dev` or `pnpm dev:main`
3. Commit changes:
   ```bash
   git add .
   git commit -m "Your descriptive commit message"
   git push origin main
   ```
4. Vercel will automatically deploy from GitHub

**Important:**
- ✅ Always test locally before pushing
- ✅ Keep commits small and focused
- ✅ Use descriptive commit messages
- ✅ Never commit `.env.local` files (they're gitignored)

### 9. Current Project Structure

```
apps/
  ├── api/          # Fastify API server (port 3001)
  └── main/         # Next.js app (port 3000) - Storefront + Admin

packages/
  ├── db/           # Prisma database package
  ├── shared/       # Shared utilities
  └── compliance-core/ # Compliance engine
```

### 10. Troubleshooting

**Port already in use?**
- Change ports in `apps/api/.env.local` (API_PORT) or `apps/main/package.json` (dev script)

**Database connection issues?**
- Verify `DATABASE_URL` in `apps/api/.env.local`
- Check Neon dashboard to ensure database is active
- Run `pnpm db:generate` to regenerate Prisma client

**Dependencies out of sync?**
```bash
pnpm install
pnpm db:generate
```

**Need to reset?**
```bash
git pull origin main
pnpm install
pnpm db:generate
```

## 🚀 You're Ready!

Everything is set up and ready for local development. Start making changes!
