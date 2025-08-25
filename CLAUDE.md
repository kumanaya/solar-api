# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run dev --turbopack    # Start development server with Turbopack
npm run build              # Build the application
npm start                  # Start production server
npm run lint              # Run linting

# Supabase Local Development
cd supabase
supabase start            # Start local Supabase stack
supabase db reset         # Reset local database
supabase functions serve  # Serve edge functions locally
```

# Project Instructions
- Always use MCP
- Whenever you create/edit a feature that inputs to the database, first check the table structure in the database with MCP to create columns if necessary.
- Whenever you finish the feature, run npm run && npm lint to check for any errors that need fixing.
- Don't use migrations
- Before making any changes, understand the context in which they are applied.
- Whenever you analyze the context, ask me the right questions to make the change.
- Perform calculations on the front end only if I ask, otherwise return directly from the API.

## Architecture Overview

This is a solar analysis platform built with Next.js App Router and Supabase, specializing in solar panel feasibility analysis for residential and commercial properties.

### Tech Stack
- **Framework**: Next.js 15 with App Router and Turbopack
- **Backend**: Supabase (PostgreSQL, Edge Functions, Auth)
- **State Management**: Zustand with persistence
- **UI**: shadcn/ui components with Tailwind CSS
- **Maps**: MapLibre GL for interactive mapping
- **3D**: React Three Fiber for 3D visualizations

### Core Architecture

**Analysis Flow**:
1. Address search and location selection (`components/analysis/address-search.tsx`)
2. Interactive map with building footprint selection (`components/analysis/map-view.tsx`)
3. Solar analysis processing via Supabase Edge Functions (`supabase/functions/analyze/`)
4. Results display with technical calculations (`components/analysis/results-panel.tsx`)
5. Financial modeling with technician inputs (`components/analysis/technician-inputs-panel.tsx`)

**State Management**:
- Global analysis state managed by Zustand store (`lib/stores/analysis-store.ts`)
- Persistent duplicate data handling for analysis replication
- Schema validation using Zod (`lib/types/analysis-schema.ts`)

**Data Flow**:
- Analysis data types defined in `lib/types/analysis.ts`
- API integration through `lib/analysis-api.ts` and related API modules
- Edge functions handle solar calculations and external API integrations

### Key Components

**Analysis System**:
- `AnalysisProvider`: Context wrapper for analysis state
- `MapPanel`: Interactive map with drawing tools and footprint management
- `ResultsPanel`: Solar production calculations and feasibility verdicts
- `TechnicianInputsPanel`: Financial modeling inputs and advanced settings

**Dashboard**:
- `DashboardAnalysesWrapper`: Main dashboard with analysis list
- `AnalysisCards`: Reusable analysis display components
- Credit system integration for usage tracking

**Authentication**: 
- Supabase Auth with cookie-based sessions
- Route protection via middleware
- Forms in `components/` directory (login, signup, etc.)

### Supabase Integration

**Database Schema**:
- `building_footprints`: Geospatial building data
- `solar_analyses`: Analysis results with versioning support
- RLS policies for user data isolation

**Edge Functions**:
- `analyze`: Main solar analysis processing
- `footprints`: Building footprint retrieval
- `generate-pdf`: Report generation
- `get-analysis`: Analysis data retrieval
- Shared utilities in `supabase/functions/shared/`

**Local Development**:
- Project ID: "solar-api"
- Local ports: API (54321), DB (54322), Auth, Storage, Inbucket email testing
- Edge functions use TypeScript with Deno runtime

### Data Validation

All analysis data is validated using Zod schemas with comprehensive error handling. The analysis store ensures data integrity and provides fallback mechanisms for invalid states.

### Development Notes

- Uses schema validation extensively - always validate data updates through the store
- Map interactions are complex - coordinate systems and footprint sources are carefully tracked
- Financial calculations use configurable technician inputs with sensible defaults
- The codebase supports analysis duplication with timestamp-based data sharing