# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- `npm run dev` - Start Next.js development server with Turbopack
- `npm run build` - Build production version
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `supabase start` - Start local Supabase stack
- `supabase functions serve` - Serve edge functions locally

## Architecture Overview

This is a solar panel analysis application built with Next.js 15, Supabase, and TypeScript. The app analyzes addresses for solar panel viability using Google Solar API as primary source with PVGIS/NASA POWER as fallbacks.

### Core Flow
1. **Frontend**: User enters address → calls Supabase Edge Function
2. **Edge Function** (`supabase/functions/analyze/index.ts`): 
   - Authenticates via Supabase JWT
   - Geocodes address (Google Maps API)
   - Attempts Google Solar API analysis
   - Falls back to PVGIS → NASA POWER if Google unavailable
   - Returns deterministic analysis results
3. **Frontend**: Displays results with interactive map using MapLibre GL

### Key Components

**Authentication**
- Cookie-based auth via `@supabase/ssr`
- Protected routes redirect to `/auth/login`
- Dashboard requires authenticated user

**Analysis System**
- `AnalysisContext` manages state for current analysis
- `lib/analysis-api.ts` handles edge function communication
- Results include: usable area, irradiation, shading, production estimates, verdict

**UI Architecture**
- App Router with nested layouts
- `app/dashboard/layout.tsx` provides authenticated shell
- `components/analysis/` contains analysis-specific components
- `components/dashboard/` contains dashboard UI
- shadcn/ui components with Tailwind CSS
- Dark/light theme support via next-themes

**Map Integration**
- MapLibre GL for interactive mapping
- Address search with debounced geocoding
- Drawing tools for custom footprints
- Layer toggles for visualization

### Edge Function Details

The `analyze` function (`supabase/functions/analyze/index.ts`) is written in TypeScript for Deno and includes:
- Zod schemas for request/response validation
- Google Solar API integration (buildingInsights:findClosest)
- PVGIS yield data fetching
- NASA POWER GHI data fetching
- Deterministic calculation algorithms
- CORS handling for web requests

### Environment Variables

Required for edge function:
- `GOOGLE_MAPS_API_KEY` - For geocoding and Solar API
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anonymous key

### Database Schema

The app uses Supabase PostgreSQL but migrations aren't included in this analysis. Check `supabase/migrations/` for current schema.

### Key Files Structure

- `app/` - Next.js app router pages
- `components/` - React components organized by feature
- `lib/` - Utilities and API clients
- `supabase/` - Supabase configuration and edge functions
- `components.json` - shadcn/ui configuration

### Development Notes

- Uses React 19 with Next.js 15
- TypeScript strict mode enabled
- ESLint configuration for Next.js
- Responsive design with mobile-first approach
- Portuguese language interface (Brazilian market focus)