# AI Rules for QHQ Tickets

## Tech Stack Overview

- **Framework**: React 18 with TypeScript, built on Vite for fast development and optimized builds
- **UI Components**: shadcn/ui - a collection of reusable, accessible components built on Radix UI primitives
- **Styling**: Tailwind CSS with custom CSS variables for theming (dark mode by default)
- **Animation**: Framer Motion for declarative animations, transitions, and micro-interactions
- **Backend/Auth**: Supabase for authentication, database, storage, and serverless functions
- **Data Fetching**: TanStack Query (React Query) for server state management and caching
- **Routing**: React Router v6 for client-side navigation
- **Forms**: React Hook Form with Zod for schema validation
- **Icons**: Lucide React for consistent, modern iconography
- **Notifications**: Sonner for toast notifications

## Library Usage Rules

### UI Components
- **ALWAYS** use shadcn/ui components when available (Button, Card, Dialog, Input, etc.)
- Import from `@/components/ui/[component]` not from external packages directly
- Extend shadcn components via composition, not by modifying the source files
- Use `cn()` utility from `@/lib/utils` for conditional class merging

### Styling
- **NEVER** use inline styles; use Tailwind classes exclusively
- Use the custom design system tokens:
  - `bg-gradient-primary` for primary buttons/accents
  - `bg-gradient-gold` for VIP/member-specific elements
  - `glass` for card backgrounds with blur
  - `shadow-glow` for primary glow effects
  - `shadow-gold` for member-specific glows
- Use `hsl(var(--primary))` format when referencing CSS variables in Tailwind

### Animation
- Use Framer Motion for all animations (`motion.div`, `AnimatePresence`, etc.)
- Prefer `whileHover`, `whileTap`, and `whileInView` for interaction animations
- Use `AnimatePresence` for mount/unmount animations
- Keep animation durations between 0.2s - 0.6s for UI responsiveness

### Data & State
- Use TanStack Query for all Supabase data fetching
- Use `useAuth()` hook from `@/hooks/useAuth` for authentication state
- Use `useAdmin()` hook from `@/hooks/useAdmin` for admin checks
- **NEVER** call Supabase client directly in components; use custom hooks

### Forms
- Use React Hook Form with Zod resolvers for form validation
- Use controlled inputs with proper TypeScript types
- Display validation errors using Sonner toast notifications

### Icons
- **ONLY** use Lucide React icons (`import { IconName } from "lucide-react"`)
- Use consistent sizing: `w-4 h-4` for inline, `w-6 h-6` for buttons, `w-8 h-8` for features

### File Structure
- Place pages in `src/pages/`
- Place reusable components in `src/components/`
- Place custom hooks in `src/hooks/`
- Place utilities in `src/lib/`
- Use kebab-case for file names (e.g., `event-card.tsx`)

### TypeScript
- **ALWAYS** use TypeScript; no `.js` files allowed
- Define interfaces for all component props
- Use strict null checks
- Import types with `import type { TypeName } from "module"`

### Images & Assets
- Store images in `src/assets/` for processed images
- Use `public/` for static files like favicons
- Use Supabase Storage for user-uploaded content (avatars, etc.)

### Notifications
- Use Sonner (`toast.success()`, `toast.error()`) for all user feedback
- **NEVER** use native `alert()` or `console.log` for user-facing messages

### Routing
- Keep all routes in `src/App.tsx`
- Use `useNavigate()` for programmatic navigation
- Use `NavLink` from `@/components/NavLink` for navigation links

### Best Practices
- Keep components under 100 lines; refactor larger components
- Use composition over inheritance
- Implement responsive designs (mobile-first)
- Use `useCallback` and `useMemo` only when necessary (don't over-optimize)
- Follow existing code patterns in the codebase