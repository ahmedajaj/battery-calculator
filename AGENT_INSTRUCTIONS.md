# 🔋 Battery Calculator — Agent Coding Instructions

> **Purpose**: This document provides comprehensive context for AI coding agents working on this project. Read this before making any changes.

---

## 1. Project Overview

**Battery Calculator** (Калькулятор батареи) is a **Russian-language** single-page React application that helps users plan energy consumption during power outages. Users configure a battery system, toggle household appliances, set power on/off schedules, and view a 24-hour forecast of battery charge levels.

### Core User Flow

1. **View status** — See current battery state, time remaining, total consumption, and recommendations
2. **Configure battery** — Set capacity (kWh), current charge (%), min/max discharge limits, charging power (kW)
3. **Configure power schedule** — Set when grid electricity turns on/off (simulates rolling blackouts)
4. **Manage appliances** — Toggle appliances on/off, adjust power draw (kW)
5. **Schedule appliances** — Drag-and-drop 24h timeline to set when each appliance operates
6. **View forecast** — 24-hour chart showing predicted battery level and consumption

---

## 2. Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | React | 19.2 |
| Language | TypeScript | 5.9 (strict mode) |
| Build Tool | Vite | 5.4 |
| Styling | Tailwind CSS v4 | 4.1 (via `@tailwindcss/vite` plugin) |
| Charts | Recharts | 3.7 |
| Icons | Lucide React | 0.563 |
| Date Utils | date-fns | 4.1 (installed but not yet used) |
| Linting | ESLint + typescript-eslint | 9.x |

### Key Configuration Notes

- **Tailwind CSS v4** — Uses `@import "tailwindcss"` in CSS (NOT `@tailwind` directives). Custom theme defined via `@theme {}` block in `src/index.css`, NOT in `tailwind.config.js`.
- **TypeScript Strict Mode** — `strict: true`, `noUnusedLocals: true`, `noUnusedParameters: true`, `verbatimModuleSyntax: true`. Use `import type` for type-only imports.
- **ESM Only** — `"type": "module"` in package.json. All imports use ES module syntax.
- **No state management library** — All state is managed via React `useState` in `App.tsx` and passed down as props.
- **No routing** — Single-page application, no React Router.
- **No testing framework** — No test files exist yet.

---

## 3. Project Structure

```
battery-calculator/
├── index.html              # Entry HTML (lang="ru", Inter font, emoji favicon)
├── package.json
├── vite.config.ts          # Vite + React + Tailwind CSS plugins
├── tsconfig.json           # References tsconfig.app.json + tsconfig.node.json
├── tsconfig.app.json       # Strict TS config for src/
├── eslint.config.js        # Flat ESLint config
├── public/                 # Static assets
└── src/
    ├── main.tsx            # React root mount (StrictMode)
    ├── App.tsx             # Root component — all state lives here
    ├── App.css             # Legacy Vite template CSS (mostly unused)
    ├── index.css           # Global styles + Tailwind @theme + custom CSS classes
    ├── assets/             # (empty)
    ├── types/
    │   └── index.ts        # All TypeScript interfaces
    ├── utils/
    │   └── calculations.ts # Pure business logic (no React dependencies)
    └── components/
        ├── index.ts            # Barrel re-exports
        ├── StatusDashboard.tsx  # Section 1: Status cards + recommendations
        ├── BatterySettingsPanel.tsx  # Section 2a: Battery config sliders
        ├── PowerSchedulePanel.tsx   # Section 2b: Power on/off time inputs
        ├── ApplianceControls.tsx    # Section 3: Appliance toggle cards
        ├── TimelineScheduler.tsx    # Section 4: Drag-and-drop schedule
        └── BatteryChart.tsx         # Section 5: Recharts 24h forecast
```

---

## 4. Data Architecture

### 4.1 Type Definitions (`src/types/index.ts`)

```
BatterySettings
├── capacity: number        // kWh (1–100)
├── minDischarge: number    // % (floor limit)
├── maxCharge: number       // % (ceiling limit)
├── currentCharge: number   // % (current level)
└── chargingPower: number   // kW (0.5–20)

Appliance
├── id: string              // unique key (e.g., "water", "heating")
├── name: string            // English name
├── nameRu: string          // Russian display name
├── icon: string            // icon key for iconMap lookup
├── power: number           // kW consumption
├── enabled: boolean        // on/off toggle
├── color: string           // hex color for UI
└── schedule: TimeRange[]   // operating hours

TimeRange
├── start: number           // 0–24 (hours)
└── end: number             // 0–24 (hours, supports overnight wrap)

PowerSchedule
├── powerOnTime: string     // "HH:mm" format
└── powerOffTime: string    // "HH:mm" format

CalculationResult
├── usableEnergy: number    // kWh available
├── totalConsumption: number // kW total draw
├── hoursRemaining: number  // hours until battery depleted
├── chargeTime: number      // hours to full charge
├── timelineData: TimelinePoint[]
├── canSurviveOutage: boolean
└── recommendations: string[]

TimelinePoint
├── time: number            // hour (0–23)
├── batteryLevel: number    // %
├── consumption: number     // kW
├── charging: boolean       // is grid power available
└── appliances: string[]    // active appliance names (Russian)
```

### 4.2 State Management Pattern

All state is centralized in `App.tsx`:

```
App.tsx (state owner)
├── batterySettings: BatterySettings  ──→ BatterySettingsPanel (read/write)
│                                     ──→ StatusDashboard (read)
│                                     ──→ BatteryChart (read)
├── appliances: Appliance[]           ──→ ApplianceControls (read/write)
│                                     ──→ TimelineScheduler (read/write)
├── powerSchedule: PowerSchedule      ──→ PowerSchedulePanel (read/write)
│                                     ──→ BatteryChart (read)
└── calculationResult (derived via useMemo from all 3 states above)
                                      ──→ StatusDashboard (read)
                                      ──→ BatteryChart (read)
```

**Pattern**: Parent passes `value` + `onChange` callback. Components create new objects/arrays immutably and call `onChange`.

### 4.3 Default Appliances

| ID | Russian Name | Power | Default On | Schedule |
|----|-------------|-------|------------|----------|
| `water` | Насос воды | 1.5 kW | ✅ | 06:00–22:00 |
| `heating` | Насос отопления | 0.8 kW | ✅ | Always (24h) |
| `elevator` | Лифт | 3.0 kW | ✅ | 07:00–23:00 |
| `lighting` | Освещение | 0.5 kW | ❌ | 18:00–06:00 (overnight) |

---

## 5. Business Logic (`src/utils/calculations.ts`)

### Key Calculations

- **Usable Energy** = `capacity × (maxCharge − minDischarge) / 100`
- **Hours Remaining** = `currentUsableEnergy / totalConsumption`
- **Charge Time** = `energyToFull / chargingPower`
- **Timeline**: Simulates hour-by-hour battery level for 24 hours, accounting for:
  - Grid power availability (charges battery)
  - Active appliance schedules (drains battery)
  - Min/max charge limits (clamped)
- **Overnight wrapping**: Both power schedules and appliance schedules support overnight ranges (e.g., 22:00→06:00)
- **Recommendations**: Generated in Russian based on thresholds (charge level, hours remaining, survival check)

### Exported Utilities

- `calculateBatteryStatus(battery, appliances, powerSchedule, currentHour)` → `CalculationResult`
- `formatHours(hours)` → human-readable Russian string (e.g., "3 ч 25 мин")
- `getChargeColor(percentage)` → hex color (green ≥70%, yellow ≥40%, red <40%)

---

## 6. Styling Conventions

### Tailwind CSS v4 Setup

- **Import**: `@import "tailwindcss"` in `src/index.css`
- **Custom theme**: Defined in `@theme {}` block (NOT a config file)
- **Custom CSS classes**: `.card`, `.section`, `.section-title`, `.section-number`, `.fade-in` defined in `index.css`
- **Font**: Inter (loaded via Google Fonts in `index.html`)
- **Background**: `linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)`

### Design System

- **Colors**: Slate palette for neutrals, Blue for primary, Green/Amber/Red for status
- **Cards**: White background, `rounded-2xl`, `border border-slate-200`, `shadow-sm`, `p-8`
- **Section headers**: Numbered blue circles + uppercase text
- **Icons**: Lucide React icons, typically `w-5 h-5` inside colored `rounded-xl` containers
- **Inputs**: Custom-styled range sliders, number inputs, time inputs (see `index.css`)
- **Responsive**: Mobile-first with `sm:`, `md:`, `lg:` breakpoints

### Component Card Pattern

```tsx
<div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm">
  {/* Header with icon */}
  <div className="flex items-center gap-3 mb-6">
    <div className="p-2.5 bg-{color}-50 rounded-xl">
      <Icon className="w-5 h-5 text-{color}-600" />
    </div>
    <h2 className="text-lg font-semibold text-slate-800">Title</h2>
  </div>
  {/* Content */}
</div>
```

---

## 7. Component API Reference

### `StatusDashboard`
- **Props**: `{ result: CalculationResult, battery: BatterySettings }`
- **Displays**: Battery visual indicator, survival badge, 4 stat cards, recommendations list

### `BatterySettingsPanel`
- **Props**: `{ settings: BatterySettings, onChange: (settings: BatterySettings) => void }`
- **Controls**: Capacity slider, current charge slider, min/max discharge inputs, charging power slider

### `PowerSchedulePanel`
- **Props**: `{ schedule: PowerSchedule, onChange: (schedule: PowerSchedule) => void }`
- **Controls**: Power on/off time inputs, visual 24h timeline bar, duration summary

### `ApplianceControls`
- **Props**: `{ appliances: Appliance[], onChange: (appliances: Appliance[]) => void }`
- **Controls**: Toggle buttons, power sliders, power number inputs
- **Note**: Uses `iconMap` record to map appliance IDs to Lucide icons

### `TimelineScheduler`
- **Props**: `{ appliances: Appliance[], onChange: (appliances: Appliance[]) => void }`
- **Interactions**: Click to add range, drag to move/resize, double-click to delete
- **Only shows enabled appliances**

### `BatteryChart`
- **Props**: `{ timelineData: TimelinePoint[], battery: BatterySettings, powerSchedule: PowerSchedule }`
- **Chart**: Recharts `ComposedChart` with battery level area + consumption bars + reference lines

---

## 8. Coding Rules for Agents

### MUST Follow

1. **Language**: All user-facing text MUST be in **Russian**. English is only used in code identifiers.
2. **Type Safety**: Use `import type` for type-only imports. Never use `any` — the tsconfig enforces strict mode.
3. **Immutability**: Always create new objects/arrays when updating state. Use spread operators or `.map()`.
4. **Barrel Exports**: When adding a new component, export it from `src/components/index.ts`.
5. **Pure Calculations**: Keep business logic in `src/utils/calculations.ts`, not in components.
6. **Component Pattern**: Follow the existing `React.FC<Props>` pattern with named exports.
7. **Styling**: Use Tailwind utility classes inline. For reusable styles, add to `src/index.css`.
8. **No `console.log`**: Remove debug logs before committing.

### SHOULD Follow

1. **New types** → Add to `src/types/index.ts`
2. **New utility functions** → Add to `src/utils/` (create new files for distinct domains)
3. **New components** → Add to `src/components/`, export via barrel
4. **State changes** → If new state is needed, add `useState` in `App.tsx` and pass down
5. **Derived data** → Use `useMemo` in `App.tsx` for expensive calculations
6. **Icons** → Import from `lucide-react`. If mapping by ID, add to `iconMap` in `ApplianceControls.tsx`
7. **Colors** → Use the theme palette from `index.css` (`primary-*`, `slate-*`, `success-*`, `warning-*`, `danger-*`)

### MUST NOT Do

1. **Do NOT** add a `tailwind.config.js` — Tailwind v4 uses CSS-based config via `@theme {}`
2. **Do NOT** use `@tailwind base/components/utilities` — use `@import "tailwindcss"` instead
3. **Do NOT** install a state management library (Redux, Zustand, etc.) without explicit request
4. **Do NOT** add routing without explicit request
5. **Do NOT** change the locale — this is a Russian-language application
6. **Do NOT** use default exports for components (use named exports)
7. **Do NOT** put business logic inside component files

---

## 9. Common Tasks

### Adding a New Appliance

1. Add default entry in `defaultAppliances[]` in `App.tsx`
2. Add icon mapping in `iconMap` in `ApplianceControls.tsx`
3. Import the Lucide icon in `ApplianceControls.tsx`

### Adding a New Battery Setting

1. Update `BatterySettings` interface in `src/types/index.ts`
2. Add default value in `defaultBatterySettings` in `App.tsx`
3. Add UI control in `BatterySettingsPanel.tsx`
4. Update calculation logic in `src/utils/calculations.ts` if needed

### Adding a New Status Metric

1. Add field to `CalculationResult` in `src/types/index.ts`
2. Compute it in `calculateBatteryStatus()` in `calculations.ts`
3. Display it in `StatusDashboard.tsx` using the `StatCard` sub-component

### Adding a New Section to the Page

1. Create component in `src/components/NewSection.tsx`
2. Export from `src/components/index.ts`
3. Import in `App.tsx`
4. Add as new numbered `<section>` following the existing pattern

---

## 10. Build & Run Commands

```bash
npm run dev       # Start dev server (Vite HMR)
npm run build     # TypeScript check + Vite production build
npm run lint      # ESLint check
npm run preview   # Preview production build
```

---

## 11. Known Limitations & Improvement Areas

- **No persistence** — All settings reset on page reload (could add localStorage)
- **No custom appliance creation** — Users can't add/remove appliances from UI
- **Simplified model** — Battery simulation is linear per hour (no efficiency losses, temperature effects)
- **No i18n framework** — Russian strings are hardcoded (consider i18n if multi-language needed)
- **No tests** — No unit or integration tests exist
- **`App.css`** — Contains leftover Vite template CSS that is mostly unused and can be cleaned up
- **`date-fns`** — Installed but not used anywhere in the codebase
- **Timeline resolution** — Forecast uses 1-hour granularity (could be finer)
