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

## Complete Dashboard Structure

### Page Routes
- `/` - Landing page with Phantom wallet authentication
- `/dashboard` - Main command center dashboard
- `/dashboard/create-automation` - 4-step automation wizard
- `/dashboard/automations` - List of user's automations
- `/dashboard/automations/:id` - Individual automation details
- `/dashboard/automations/:id/live` - Live automation monitoring
- `/dashboard/analytics` - Performance analytics dashboard
- `/dashboard/settings` - Account settings and preferences

### API Routes
- `/api/auth/*` - Authentication and user management
- `/api/automations/*` - CRUD operations for automations
- `/api/bright-data/*` - Browser session management
- `/api/ai/*` - AI reply generation and analysis

### Database Schema
- `users` - User accounts with wallet authentication
- `invitation_codes` - Tier-specific access codes
- `automations` - User automation configurations
- `automation_actions` - Action history and tracking
- `browser_sessions` - Live browser session management

## Changelog

```
Changelog:
- June 29, 2025. Initial setup
- June 29, 2025. Added PostgreSQL database with Web3-focused schema for wallet authentication and invitation-only access system
- June 29, 2025. Implemented complete Phantom wallet authentication with 50 tier-specific invitation codes
- June 29, 2025. Added wallet address binding system - each invitation code locks to first wallet used
- June 29, 2025. Created Command Center dashboard with real user data integration and subscription management
- June 29, 2025. Built complete page structure with automation wizard, analytics, settings, and live monitoring
- June 29, 2025. Added navigation back buttons throughout dashboard and automation delete functionality
- June 29, 2025. Configured Bright Data integration with browser automation credentials and tested session creation
- June 29, 2025. Built comprehensive browser test page with live automation verification - Bright Data integration confirmed working
- June 29, 2025. Upgraded browser test page with live streaming (20+ FPS) and real-time manual control via WebSocket - full remote browser control
- June 29, 2025. Redesigned browser test page with professional interface, larger 1400x900 viewport, accurate click mapping, and visual feedback
- June 29, 2025. Implemented Bright Data's official live view method using Page.inspect command - real Chrome DevTools interface with full native browser control
- June 29, 2025. Fixed browser display issues by correcting conditional rendering logic and improved iframe loading with proper error handling
- June 29, 2025. Resolved CORS restrictions with Chrome DevTools iframe by implementing new window approach - full DevTools interface in popup window
- June 29, 2025. Implemented comprehensive X/Twitter test automation system with 8-step workflow: navigation, manual login handoff, automatic login detection, post interaction, liking, and replying capabilities with real-time WebSocket progress tracking
- June 30, 2025. Completely redesigned live browser automation workflow - removed complex Chrome DevTools interface and implemented clean live streaming view
- June 30, 2025. Automation now automatically starts live streaming when reaching login step, allowing direct interaction with X/Twitter login page through canvas-based control system
- June 30, 2025. Simplified user experience: Start automation → live stream appears automatically → login manually in main view → automation continues automatically
- June 30, 2025. Implemented new tab-based login system - when manual login needed, automatically opens dedicated login tab with live browser view and "Continue Automation" button
- June 30, 2025. Created dedicated login page at /dashboard/test-browser/login with live iframe displaying actual X/Twitter login page for direct user interaction
- June 30, 2025. Added API endpoints for live view URL management and automation continuation - tab remains open after login to show live automation progress
- July 3, 2025. Migrated from Bright Data to Browserbase for enhanced browser automation capabilities and better Pro plan features
- July 3, 2025. Implemented comprehensive CAPTCHA control system with manual solving (solveCaptchas: false) to prevent automatic interference
- July 3, 2025. Fixed session timeout issues by correcting timeout values from milliseconds to seconds for Browserbase compatibility
- July 3, 2025. Added localStorage security error handling with try-catch blocks to prevent automation crashes during navigation
- July 3, 2025. Enhanced X.com navigation with domcontentloaded loading and robust element waiting for faster page loads
- July 3, 2025. Resolved cookie loading interference by implementing clean session mode - no automatic cookie operations during initial navigation
- July 3, 2025. Established manual control workflow - user handles all authentication and CAPTCHA solving without background automation
- July 3, 2025. Created comprehensive README documentation covering architecture, challenges, solutions, and current project status
```

## User Preferences

```
Preferred communication style: Simple, everyday language.
```