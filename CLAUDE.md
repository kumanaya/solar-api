# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## IMPORTANT
- Always create FEATURE.md to record the feature you are currently developing.
- Always create TO-DO.md to record the current feature plan and its progress.
- Always create CHANGE_LOG.md to record new features and what was done so the app user knows.
- All screens and components must be responsive
- Whenever you create/edit a feature that inputs to the database, first check the table structure in the database with MCP to create columns if necessary.
- Whenever you finish the feature, run npm run && npm lint to check for any errors that need fixing.
- Whenever you make any changes to the database, first save the migration in the supabase folder, then run it via MCP.

## Project Overview

This is a Next.js 15 application built with the Supabase starter template, featuring:
- Next.js App Router
- Supabase authentication and database integration
- Tailwind CSS for styling
- shadcn/ui components (New York style)
- TypeScript with strict configuration
- Dark/light theme support via next-themes


## Development Commands

```bash
# Start development server with Turbopack
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run ESLint
npm run lint
```

## Environment Setup

1. Copy `.env.example` to `.env.local`
2. Set required Supabase environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY`

## Architecture

### Authentication Flow
- Supabase authentication with cookie-based sessions
- Server and client Supabase clients in `lib/supabase/`
- Auth components: login, signup, password reset forms
- Protected routes in `app/protected/`

### Component Structure
- UI components in `components/ui/` (shadcn/ui)
- Auth-related components in `components/` root
- Tutorial components in `components/tutorial/`
- Path alias `@/` points to project root

### Key Patterns
- Server components use `lib/supabase/server.ts` client
- Client components use `lib/supabase/client.ts` client
- Middleware handles auth state in `middleware.ts`
- CSS variables for theming in `app/globals.css`

### Styling
- Tailwind CSS with custom design tokens
- shadcn/ui components with New York style
- CSS variables for light/dark theme support
- Lucide React icons

## Important Notes

- Never create new Supabase clients in global variables
- Always create fresh server clients within each function
- TypeScript strict mode enabled
- ESLint configuration via `eslint.config.mjs`