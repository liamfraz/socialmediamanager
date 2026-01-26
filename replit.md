# Social Media Post Review & Approval System

## Overview

This is a web application for reviewing, editing, and managing AI-generated social media posts before publication. The system provides a dashboard view to filter and organize posts by status, and a detailed editing interface for individual post review and approval workflows.

The application is built as a full-stack TypeScript solution with a React frontend and Express backend, connected to a PostgreSQL database through Drizzle ORM.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: React 18 with TypeScript, using Vite as the build tool and development server.

**Routing**: Wouter for lightweight client-side routing with main routes:
- Dashboard view (`/`) - Displays all posts in a filterable list
- Post detail view (`/post/:id`) - Individual post editing and approval interface
- Review Posts (`/review`) - Post review workflow with status tabs
- Posted Posts (`/posted`) - Published posts with "Posted Photos" viewer
- Tagged Photos (`/tagged-photos`) - Photo library with direct uploads and AI tagging

**State Management**: TanStack Query (React Query) for server state management with optimistic updates and automatic cache invalidation. No global client state management library is used.

**UI Component Library**: Shadcn/ui components (New York style variant) built on Radix UI primitives with Tailwind CSS for styling. The design follows modern SaaS principles inspired by Linear and Notion with a clean, minimalist aesthetic.

**Styling System**: 
- Tailwind CSS with custom theme configuration
- CSS variables for theming (supports light/dark modes)
- Custom utility classes for hover effects and elevations
- Design tokens defined in `index.css` for consistent spacing, shadows, and colors

**Form Handling**: React Hook Form with Zod for validation when needed, though most interactions are simple state updates.

### Backend Architecture

**Framework**: Express.js server with TypeScript, serving both API endpoints and static frontend assets.

**API Design**: RESTful JSON API with the following endpoints:
- `GET /api/posts` - Retrieve all posts
- `GET /api/posts/:id` - Retrieve single post
- `POST /api/posts` - Create new post
- `PUT /api/posts/:id` - Update post content/images
- `PATCH /api/posts/:id/status` - Update post approval status
- `PUT /api/posts/reorder` - Reorder posts by changing order values
- `DELETE /api/posts/:id` - Delete post
- `POST /api/seed` - Seed database with sample data

**Validation**: Zod schemas for request validation, with schema definitions shared between client and server through the `@shared` directory.

**Error Handling**: Centralized error handling with appropriate HTTP status codes and JSON error responses.

**Build Process**: Custom esbuild configuration that bundles server code with allowlisted dependencies to reduce cold start times. Client is built with Vite.

### Data Storage

**Database**: PostgreSQL with connection pooling via `pg` library.

**ORM**: Drizzle ORM for type-safe database queries and migrations.

**Schema Design**:
- `users` table - User authentication (username/password)
- `posts` table - Social media posts with fields:
  - `id` (UUID primary key)
  - `content` (text)
  - `status` (enum: pending/approved/rejected/draft/posted)
  - `scheduledDate` (timestamp)
  - `images` (text array for image URLs)
  - `order` (integer for manual sorting)
- `tagged_photos` table - Photos from Google Drive for use in posts:
  - `id` (UUID primary key)
  - `photoId` (text - Google Photos ID)
  - `photoUrl` (text - URL to the photo)
  - `description` (text)
  - `tags` (text array)
  - `status` (enum: available/posted) - tracks if photo has been used in a published post
  - `postedAt` (timestamp) - when the photo was posted

**Migration Strategy**: Drizzle Kit for schema migrations with `drizzle.config.ts` configuration pointing to `shared/schema.ts`.

### Key Architectural Decisions

**Monorepo Structure**: Single repository with three main directories:
- `client/` - React frontend application
- `server/` - Express backend application  
- `shared/` - Shared TypeScript types and Zod schemas

**Rationale**: Simplifies development by allowing code sharing and type safety across frontend and backend. Single deployment artifact.

**Path Aliasing**: Configured in both TypeScript and build tools:
- `@/` maps to `client/src/`
- `@shared/` maps to `shared/`
- `@assets/` maps to `attached_assets/`

**Development vs Production**:
- Development mode uses Vite dev server with HMR middleware integrated into Express
- Production mode serves pre-built static assets from `dist/public`
- Environment detection via `NODE_ENV`

**Component Organization**: 
- Page components in `client/src/pages/`
- Reusable UI components in `client/src/components/`
- Example implementations in `client/src/components/examples/` for documentation
- Shadcn/ui primitives in `client/src/components/ui/`

**Type Safety**: Full TypeScript coverage with strict mode enabled. Database schema types are inferred from Drizzle schema definitions and shared with the frontend through the `@shared` module.

**No Authentication Currently**: While the database schema includes a `users` table with password field, there is no active authentication middleware or session management implemented. This suggests authentication may be added later or is handled externally.

## External Dependencies

### Core Runtime Dependencies

**Frontend**:
- React 18 ecosystem (react, react-dom)
- TanStack Query v5 for server state
- Wouter for routing
- Date-fns for date formatting
- Radix UI component primitives (@radix-ui/*)
- Class variance authority for component variants
- Tailwind CSS merge utilities (clsx, tailwind-merge)

**Backend**:
- Express.js for HTTP server
- PostgreSQL client (pg)
- Drizzle ORM for database operations
- Zod for runtime validation

### Build Tools

- Vite for frontend bundling and dev server
- esbuild for server bundling
- TypeScript compiler
- Tailwind CSS with PostCSS
- Drizzle Kit for database migrations

### UI Component System

Shadcn/ui component library providing:
- Form controls (Button, Input, Textarea, Select, Checkbox, Radio)
- Layout components (Card, Dialog, Sheet, Popover, Dropdown)
- Data display (Badge, Avatar, Toast, Tooltip)
- Navigation (Breadcrumb, Tabs, Accordion)

All components are copied into the project (not installed as npm package) and customizable.

### Development Tools

- Replit-specific plugins for development (@replit/vite-plugin-*)
- Runtime error overlay for development
- Source map support

### Icon Libraries

- Lucide React for standard icons
- React Icons (Simple Icons) for social media platform icons

### Database

PostgreSQL database required, accessed via connection string in `DATABASE_URL` environment variable. The application expects the database to be provisioned before startup and will throw an error if the connection string is missing.

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `SESSION_SECRET` | Yes | Secret key for session encryption |
| `OPENAI_API_KEY` | No | OpenAI API key for AI photo tagging (if not set, photos upload without tags) |
| `PORT` | No | Server port (defaults to 5000) |
| `N8N_POSTING_WEBHOOK_URL` | No | Webhook URL for n8n posting integration |

### Photo Uploads

Photos can be uploaded directly through the Tagged Photos page. Uploaded files are:
- Stored locally in the `/uploads` directory
- Automatically analyzed and tagged using OpenAI Vision API (gpt-4o model)
- Accessible via `/uploads/{filename}` URL

**Supported formats:** JPG, JPEG, PNG, WebP
**Maximum file size:** 10MB per file
**Concurrent uploads:** Up to 3 files processed simultaneously

To run locally with photo tagging:
```bash
export OPENAI_API_KEY="your-api-key"
export DATABASE_URL="postgresql://user@localhost:5432/dbname"
export SESSION_SECRET="your-secret"
npm run dev
```

On Replit, add `OPENAI_API_KEY` to your Secrets for AI tagging to work.