# LoadFlow

**Commercial Multi-Tenant Logistics Management SaaS**

LoadFlow is an enterprise platform for logistics companies to manage deliveries, trucks, drivers, and load planning. It provides intelligent resource recommendation, CSV import pipelines, and multi-tenant data isolation.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Database | PostgreSQL (Supabase) |
| ORM | Prisma |
| Auth | Supabase Auth |
| Styling | Tailwind CSS |
| Icons | Lucide React |
| Date Utils | date-fns |

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL database (Supabase project recommended)
- npm

### Environment Setup

Copy `.env.example` to `.env` and configure:

```env
DATABASE_URL="postgresql://..."       # Supabase pooled connection (port 6543)
DIRECT_URL="postgresql://..."         # Supabase direct connection (port 5432)
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
```

### Installation

```bash
npm install
npx prisma generate
npx prisma db push        # Apply schema to database
npm run dev                # Start development server at http://localhost:3000
```

### Running Tests

```bash
# Recommendation engine tests
npx tsx lib/services/__tests__/recommendation-engine.test.ts

# Full import pipeline tests
npx tsx lib/import/csv/__tests__/parser.test.ts
npx tsx lib/import/validation/__tests__/validation.test.ts
npx tsx lib/import/mapping/__tests__/mapping.test.ts
npx tsx lib/import/preview/__tests__/preview.test.ts
npx tsx lib/import/commit/__tests__/commit.test.ts
npx tsx lib/import/pipeline/__tests__/pipeline.test.ts
```

### Production Build

```bash
npx prisma validate
npm run build
```

## Project Structure

```
LoadFlow/
├── app/                    # Next.js App Router
│   ├── (auth)/             # Auth pages (login, signup)
│   ├── (dashboard)/        # Authenticated dashboard pages
│   │   ├── dashboard/      # Main dashboard
│   │   ├── deliveries/     # Delivery management
│   │   ├── drivers/        # Driver management
│   │   ├── trucks/         # Truck management
│   │   ├── loads/          # Load plans, optimization, recommendations
│   │   ├── import/         # CSV import UI
│   │   ├── schedule/       # Schedule view
│   │   └── settings/       # Company settings
│   ├── api/                # REST API routes
│   └── auth/               # Auth callback handler
├── components/             # React components by domain
├── lib/                    # Core business logic
│   ├── auth.ts             # Authentication context
│   ├── prisma.ts           # Prisma client singleton
│   ├── rls.ts              # Row Level Security helpers
│   ├── security/           # Tenant isolation utilities
│   ├── services/           # Business services (recommendation engine)
│   ├── import/             # CSV import pipeline (6 engines)
│   └── supabase/           # Supabase client helpers
├── prisma/                 # Database schema and RLS policies
├── types/                  # Shared TypeScript type definitions
├── scripts/                # Utility scripts (demo data, migrations)
└── docs/                   # Project documentation
```

## Documentation

| Document | Description |
|----------|-------------|
| [Architecture](docs/ARCHITECTURE.md) | System architecture, modules, and data flow |
| [API Reference](docs/API_REFERENCE.md) | Complete REST API documentation |
| [Database](docs/DATABASE.md) | Schema, relationships, and tenant boundaries |
| [Workflows](docs/WORKFLOWS.md) | Business process flows with diagrams |
| [ADRs](docs/adr/) | Architecture Decision Records |
| [Project State](PROJECT_STATE.md) | Sprint history and current status |

## Current Version

**v0.7.1** — See [PROJECT_STATE.md](PROJECT_STATE.md) for detailed sprint history.

## License

Proprietary. All rights reserved.
