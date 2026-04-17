# Feature-Module Folder Structure

This directory follows a **feature-based** layout where each sub-folder owns all
the code for a single product domain.  This replaces the flat `pages/` + `components/`
organisation and makes it easy to co-locate related components, hooks, API calls,
stores, and tests.

## Folder layout

```
src/features/
├── auth/           User authentication, registration, password reset
├── atlas/          AI travel assistant (Atlas) chat and history
├── budget/         Budget planner, expense tracking
├── destinations/   Destination explorer, safety scores, weather
├── journal/        Travel journal entries and photo attachments
├── notifications/  In-app notifications, preferences
├── packing/        Packing lists and templates
├── safety/         Check-ins, emergency contacts, guardian invites
└── trips/          Trip creation, legs, itinerary, places
```

## Convention per feature folder

Each feature folder is expected to contain:

```
<feature>/
├── components/     Presentational components specific to this feature
├── hooks/          React hooks (data fetching via TanStack Query, local state)
├── api.js          API client functions (returns raw fetch/axios promises)
├── store.js        Zustand slice for this feature (if needed)
├── types.js        PropTypes / JSDoc type definitions
└── index.js        Public exports for the feature (barrel file)
```

## Migration status

> ⚠️  **Active migration in progress.**  
> Existing code still lives in `pages/` and `components/`.  
> New code should be written under `features/`.  
> Legacy code is being moved incrementally to avoid a big-bang refactor.

## Usage

Import from a feature using the barrel file so internal structure can change
without touching callers:

```js
import { TripCard, useTripsList } from '../features/trips';
```
