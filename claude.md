# CLAUDE.md

This file is read automatically by Claude Code at the start of every session.
It defines how to operate in this codebase — not what to build (see `SPEC.md` for that).

---

## Project

ADHD Gamified To-Do app. React Native (Expo). Local-first. AI is an optional enhancement, never a dependency.

---

## Commands

```bash
npx expo start                  # start dev server
npx expo run:ios                # run on iOS simulator
npx expo run:android            # run on Android emulator
npx expo install <package>      # always use this, not npm/yarn, for Expo packages
```

---

## Environment

Create `.env.local` in the project root. Never commit it.

```
GEMINI_API_KEY=sk-...
```

Access in code via `process.env.GEMINI_API_KEY`. Use `expo-constants` or a thin `src/services/env.ts` wrapper — do not inline the key anywhere.

---

## File Structure

```
app/                        Expo Router screens (file-based routing)
  _layout.tsx               root layout — holds splash gate and SQLiteProvider
  index.tsx                 redirects to /onboarding or /dashboard
  onboarding/
    _layout.tsx
    index.tsx               welcome screen
    tasks.tsx               add initial tasks (min 3)
    rewards.tsx             add initial rewards (min 3, at least 1 non-consumable)
  dashboard/
    index.tsx               main draw screen

src/
  db/
    database.ts             SQLiteProvider config, onInit migrations
    tasks.ts                task CRUD
    rewards.ts              reward CRUD
    subtasks.ts             subtask CRUD
    drawHistory.ts          draw history queries
  store/
    useAppStore.ts          draw lock, active task, pity meter, rescue state
    useUserStore.ts         user prefs, AI usage counters
  services/
    gemini.ts               clarity check + microtask generation calls
  components/
    DrawButton.tsx
    TaskCard.tsx
    SubtaskChecklist.tsx
    PityRing.tsx
    RewardCard.tsx
```

---

## Libraries — Approved

| Purpose | Library |
|---|---|
| Routing | `expo-router` (file-based) |
| Database | `expo-sqlite` |
| State | `zustand` |
| Animation | `react-native-reanimated` |
| Styling | `StyleSheet` (built-in) |
| Splash screen | `expo-splash-screen` |
| App state | `react-native` `AppState` API |

**Do not install** NativeWind, Tamagui, Moti, Lottie, React Navigation, or any CSS-in-JS library without explicit instruction.

---

## Libraries — Key Rules

### expo-sqlite
Use the **SDK 51+ API only**. The entry point is `SQLiteProvider` with an `onInit` prop for migrations.

```ts
// CORRECT
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';

// NEVER USE — legacy API
import * as SQLite from 'expo-sqlite';
SQLite.openDatabase(...)   // ← forbidden
```

### react-native-reanimated
Must be used for: Draw button pulse, card shake (300ms), card flip (600ms), pity ring progress.

The Babel plugin **must be the last entry** in `babel.config.js`:

```js
plugins: [
  // ... other plugins
  'react-native-reanimated/plugin'   // always last
]
```

### Animated API
Do not use React Native's built-in `Animated` API. Use Reanimated for everything.

---

## Database

### Migrations
All schema setup runs in the `onInit` function passed to `SQLiteProvider`. Never run schema changes outside of this function.

### Staleness — Do Not Store, Compute in SQL
The task draw query calculates staleness dynamically. Do not add a `staleness_bonus` column or run UPDATE sweeps on app launch.

```sql
SELECT *
FROM tasks
WHERE isCompleted = 0
ORDER BY (
  CASE importanceWeight
    WHEN 'LOW'    THEN 1
    WHEN 'MEDIUM' THEN 3
    WHEN 'HIGH'   THEN 6
  END
  +
  MIN(7, CAST(julianday('now') - julianday(COALESCE(last_drawn_at, created_at)) AS INTEGER))
) * RANDOM() DESC
LIMIT 1;
```

After drawing a task: set `last_drawn_at = datetime('now')`, increment `draw_count`.

---

## State Hydration

**Block the UI until Zustand is hydrated from SQLite.** Never render screens before this completes.

Boot sequence in `app/_layout.tsx`:

1. Call `SplashScreen.preventAutoHideAsync()` on module load
2. Wrap app in `SQLiteProvider` with `onInit` migrations
3. Inside the provider, run Zustand hydration (SELECT active task, draw state, user row)
4. Once hydration resolves, call `SplashScreen.hideAsync()`
5. Render the app

---

## Gemini Integration

All calls live in `src/services/gemini.ts`.

### Rules
- Use `response_format: { type: "json_schema", ... }` (Structured Outputs) on both calls — not `json_object`
- Never use `json_object` mode — it does not guarantee schema conformance
- Both calls use `model: gpt-4o-mini`, `temperature: 0.2`
- Clarity check: `max_tokens: 150`
- Microtask generation: `max_tokens: 200`

### Clarity check schema

```json
{
  "type": "json_schema",
  "json_schema": {
    "name": "clarity_response",
    "strict": true,
    "schema": {
      "type": "object",
      "properties": {
        "result": { "type": "string", "enum": ["CLEAR", "VAGUE"] },
        "question": { "type": ["string", "null"] },
        "options": {
          "type": ["array", "null"],
          "items": { "type": "string" },
          "minItems": 3,
          "maxItems": 3
        }
      },
      "required": ["result", "question", "options"],
      "additionalProperties": false
    }
  }
}
```

### Microtask generation schema

```json
{
  "type": "json_schema",
  "json_schema": {
    "name": "microtask_response",
    "strict": true,
    "schema": {
      "type": "object",
      "properties": {
        "steps": {
          "type": "array",
          "items": { "type": "string" },
          "minItems": 1,
          "maxItems": 5
        }
      },
      "required": ["steps"],
      "additionalProperties": false
    }
  }
}
```

### AI must never block task saving
Every AI call is fire-and-enhance. If it fails for any reason, the task is saved as-is.

| Failure | Clarity behavior | Microtask behavior |
|---|---|---|
| Offline | Save, `clarity_status = skipped` | Store 3 fallback steps |
| Timeout (>3s clarity / >5s microtask) | Save, `clarity_status = skipped` | Store 3 fallback steps |
| API error / quota | Save, show "AI unavailable" | Store 3 fallback steps |

Fallback microtasks (`source = 'fallback'`):
```
1. Start the task
2. Continue working on the task
3. Finish and mark complete
```

### Microtask generation — background execution
iOS/Android suspend the JS thread aggressively on backgrounding. Either:
- Await the call before confirming save (preferred — ~1s, transparent to user), or
- Queue in a `pending_ai_jobs` SQLite table and process on next foreground resume

Do not use Expo Background Fetch for this.

### Debounce + dedup
- Fire clarity check after 1 second of typing inactivity
- Minimum 3 characters before firing
- Normalize input (lowercase, trim, collapse whitespace) and skip if identical to last checked string
- Microtasks: check subtask count for `task_id` before calling — if rows exist, skip entirely

---

## Draw System

### Probabilities
```
Base:          75% Task / 25% Reward
Bonus reward:  30% chance when a task is drawn
Pity override: drawsSinceReward >= 4 → guaranteed reward
```

### Reward pool
Only draw from rewards where `is_consumable = false OR uses_remaining > 0`.
Decrement `uses_remaining` after drawing a consumable reward.
At least 1 non-consumable reward is guaranteed by onboarding — the pool is never empty.

---

## Rescue Mode

Use **both** mechanisms. They share a single `rescueShownThisTask` Zustand flag (reset when a new task is drawn) so the popup fires at most once per task.

**Mechanism 1 — foreground timer** (user staring at screen, frozen):
```ts
// In the active task component
const interval = setInterval(() => {
  if (!rescueShownThisTask && Date.now() - task_started_at > 10 * 60 * 1000) {
    showRescuePopup();
  }
}, 30_000);
return () => clearInterval(interval);
```

**Mechanism 2 — background resume** (user returning after stepping away):
```ts
AppState.addEventListener('change', (state) => {
  if (state === 'active' && activeTask && !rescueShownThisTask) {
    if (Date.now() - task_started_at > 10 * 60 * 1000) {
      showRescuePopup();
    }
  }
});
```

---

## Onboarding Gate

Onboarding is complete when:
- `tasks` table has ≥ 3 incomplete rows
- `rewards` table has ≥ 1 row with `is_consumable = false`
- `rewards` table has ≥ 3 rows total

Check this in `app/index.tsx` after hydration and redirect accordingly.

---

## Hard Rules — Do Not Violate

- **Never use the legacy `expo-sqlite` API** (`openDatabase`, callbacks)
- **Never use `Animated`** — use Reanimated for all animations
- **Never store `staleness_bonus`** — compute dynamically in SQL
- **Never block task creation on AI** — all AI paths have silent fallbacks
- **Never use `json_object` mode** — use `json_schema` Structured Outputs
- **Never render screens before Zustand hydration completes**
- **Reanimated Babel plugin must be last** in `babel.config.js`
- **Never commit `.env`** or hardcode the Gemini API key
- **Never install animation/styling libraries** not in the approved list above