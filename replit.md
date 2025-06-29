# replit.md

## Overview

This is a modern Web3-first landing page application for "XReplyGuy by Trendify" - a Twitter automation platform. The application uses a full-stack TypeScript architecture with React frontend, Express backend, and PostgreSQL database through Drizzle ORM.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and optimized builds
- **Routing**: Wouter for lightweight client-side routing
- **UI Components**: shadcn/ui component library with Radix UI primitives
- **Styling**: Tailwind CSS with custom crypto-themed design system
- **Animations**: Framer Motion for smooth user interactions
- **State Management**: TanStack React Query for server state
- **Web3 Integration**: Phantom wallet authentication (Solana ecosystem)

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **Database ORM**: Drizzle ORM for type-safe database operations
- **Session Management**: Express sessions with PostgreSQL storage
- **Development**: Hot reloading with Vite integration

### Database Architecture
- **Database**: PostgreSQL (configured for Neon/Supabase deployment)
- **Schema Management**: Drizzle migrations in `/migrations` directory
- **Models**: User management with username/password authentication

## Key Components

### Landing Page Sections
1. **Hero Section**: Main value proposition with wallet connection CTA
2. **Authority Section**: Trust indicators and platform reliability
3. **Features Section**: Core automation capabilities
4. **Social Proof Section**: User testimonials and statistics
5. **How It Works Section**: Step-by-step process explanation
6. **Pricing Section**: Tiered subscription plans (SOL-based pricing)
7. **Exclusivity Section**: Invitation-only access messaging

### Authentication System
- **Primary**: Phantom wallet connection for Web3 authentication
- **Secondary**: Invitation code system for access control
- **User Identity**: Combination of wallet public key + invitation code

### Pricing Tiers
- **Free**: 20 actions/day (invitation required)
- **Starter**: 250 actions/day - 2 SOL (30 days)
- **Pro**: 500 actions/day - 3 SOL (30 days)
- **Advanced**: 750 actions/day - 4 SOL (30 days)
- **Enterprise**: 1000 actions/day - 5 SOL (30 days)

## Data Flow

1. **User Landing**: User visits landing page, sees marketing content
2. **Wallet Connection**: User clicks CTA, Phantom wallet modal opens
3. **Authentication**: Wallet connection establishes user identity
4. **Invitation Validation**: User enters invitation code for access
5. **Tier Assignment**: System assigns user tier based on invitation code
6. **Payment Processing**: SOL-based payments for premium tiers

## External Dependencies

### Frontend Dependencies
- **UI Framework**: React, React DOM, Wouter for routing
- **UI Components**: Radix UI primitives, Lucide icons
- **Styling**: Tailwind CSS, class-variance-authority
- **Animations**: Framer Motion, Embla Carousel
- **Forms**: React Hook Form, Hookform Resolvers
- **Data Fetching**: TanStack React Query

### Backend Dependencies
- **Server**: Express.js, TypeScript execution with tsx
- **Database**: Drizzle ORM, PostgreSQL client (@neondatabase/serverless)
- **Session**: connect-pg-simple for PostgreSQL session storage
- **Utilities**: date-fns, nanoid, zod for validation

### Web3 Dependencies
- **Wallet Integration**: Solana Web3.js, Phantom wallet adapters
- **Blockchain**: Solana ecosystem for payments and authentication

## Deployment Strategy

### Development Environment
- **Frontend**: Vite dev server with hot reloading
- **Backend**: tsx for TypeScript execution in development
- **Database**: Drizzle push for schema synchronization

### Production Build
- **Frontend**: Vite build generates optimized static assets
- **Backend**: esbuild bundles server code with external dependencies
- **Database**: Drizzle migrations for production schema management

### Environment Variables
- `DATABASE_URL`: PostgreSQL connection string
- `NODE_ENV`: Environment specification (development/production)

## Changelog

```
Changelog:
- June 29, 2025. Initial setup
- June 29, 2025. Added PostgreSQL database with Web3-focused schema for wallet authentication and invitation-only access system
```

## User Preferences

```
Preferred communication style: Simple, everyday language.
```