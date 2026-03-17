# ADHD Gamified To-Do App — Full Spec

---

# 1. Project Overview

A **gamified ADHD-friendly To-Do application** that replaces stressful task lists with a **Draw mechanic**.

Users interact with a large **Draw button** that randomly produces:

- a **Task**
- or a **Reward**

Key goals:

- reduce overwhelm
- create frequent small rewards
- help with task initiation
- maintain user control over task structure

Core systems:

- Draw system
- AI task clarity detection
- Optional AI microtask preparation
- Bonus reward mechanic
- Pity meter
- Rescue mode

The app is **local-first** and works offline.

---

# 2. Architecture

| Concern | Choice |
|---|---|
| Platform | iOS + Android |
| Framework | React Native (Expo) |
| Routing | Expo Router (file-based) |
| Local database | `expo-sqlite` (SDK 51+ API only) |
| State management | Zustand |
| Styling | `StyleSheet` (React Native standard) |
| Animation | React Native Reanimated |
| AI integration | Gemini API |
| Model | `gpt-4o-mini` |

Default model settings:

```
temperature: 0.2
max_tokens: 200
```

> The app must function **fully offline except AI calls**. All AI calls are optional enhancements — task creation must always complete regardless of AI availability.

## 2.1 Routing — Expo Router

Use **Expo Router** (file-based routing). Do not use React Navigation directly.

Route structure:

```
app/
  _layout.tsx          -- root layout, splash/hydration gate
  index.tsx            -- redirects to /onboarding or /dashboard based on state
  onboarding/
    _layout.tsx
    index.tsx           -- welcome
    tasks.tsx           -- add initial tasks
    rewards.tsx         -- add initial rewards
  dashboard/
    index.tsx           -- main draw screen
```

## 2.2 Styling — StyleSheet

Use React Native's built-in `StyleSheet` for all styling. Do **not** install NativeWind, Tamagui, or any CSS-in-JS library. Keep all styles co-located with their component files.

## 2.3 Animation — React Native Reanimated

Use **React Native Reanimated** for all animations. Do not use the built-in `Animated` API or any third-party animation library (e.g. Lottie, Moti) unless explicitly specified.

Reanimated must be used for:
- Draw button pulse
- Card shake (300ms)
- Card flip (600ms)
- Pity ring progress animation

Install: `expo install react-native-reanimated`

Add the Reanimated Babel plugin to `babel.config.js`:

```js
plugins: ['react-native-reanimated/plugin']
```

> The Reanimated plugin **must be last** in the plugins array.

## 2.4 SQLite — SDK 51+ API Only

Use `expo-sqlite` with the **SDK 51+ synchronous-style API**. Do not use the legacy callback-based API from SDK 50 and earlier. The new API uses `useSQLiteContext()` and `SQLiteProvider`.

Install: `expo install expo-sqlite`

All schema setup runs in a single `migrations` function passed to `SQLiteProvider` via the `onInit` prop. Never use `openDatabase()` (legacy).

## 2.5 State Hydration

On app launch, **block the UI behind a splash screen** until Zustand finishes hydrating from SQLite.

Sequence:

1. App opens → show splash screen (use `expo-splash-screen`, keep it visible manually)
2. `SQLiteProvider` initializes DB and runs migrations
3. Zustand store runs `SELECT *` queries to load initial state (active task, draw state, user prefs)
4. Once hydration resolves → hide splash screen → render app
5. Never render the dashboard or onboarding screens before hydration is complete

This prevents flash-of-empty-state and draw button appearing before state is known.

## 2.6 File Structure

```
app/                        Expo Router screens
  _layout.tsx
  index.tsx
  onboarding/
  dashboard/

src/
  db/                       SQLite setup, migrations, query helpers
    database.ts             SQLiteProvider config and onInit migrations
    tasks.ts                task CRUD queries
    rewards.ts              reward CRUD queries
    subtasks.ts             subtask CRUD queries
    drawHistory.ts          draw history queries

  store/                    Zustand stores
    useAppStore.ts          global app state (draw lock, active task, pity meter)
    useUserStore.ts         user preferences and AI counters

  services/                 External API calls
    gemini.ts               clarity check and microtask generation calls

  components/               Shared UI components
    DrawButton.tsx
    TaskCard.tsx
    SubtaskChecklist.tsx
    PityRing.tsx
    RewardCard.tsx
```

---

# 3. Database Schema

## User

```
id
created_at

isPremiumUser

dailyDrawCount
lastDrawReset

drawsSinceReward

aiClarityCount       -- daily clarity checks used (for future rate limiting)
aiMicrotaskCount     -- daily microtask generations used (for future rate limiting)
lastAIReset          -- timestamp of last daily AI counter reset
```

---

## Tasks

```
id
title

importanceWeight
  LOW
  MEDIUM
  HIGH

isCompleted

clarity_status
  clear
  skipped            -- AI was unavailable at creation time

draw_count           -- incremented each time this task is drawn (default 0)
last_drawn_at        -- timestamp of last draw; null if never drawn (used for dynamic staleness, see Section 9.2)

created_at
updated_at           -- updated on any title edit
```

Weight values:

```
LOW    = 1
MEDIUM = 3
HIGH   = 6
```

Effective draw weight = `importanceWeight + MIN(7, days_since_last_drawn)` — calculated dynamically in SQL, never stored.

---

## SubTasks

```
id
task_id

title
source             -- 'ai' | 'fallback'

isCompleted
order_index
```

Subtasks are **optional**. The `source` field distinguishes AI-generated steps from generic fallback steps.

---

## Rewards

```
id
title

is_consumable        -- boolean, default false
uses_remaining       -- integer | null; null = infinite; decrements on each draw

created_at
```

**Consumable rewards** are removed from the draw pool when `uses_remaining` reaches 0. Non-consumable rewards (`is_consumable = false`) always stay in the pool and can repeat.

---

## DrawHistory

```
id

draw_type
  TASK
  REWARD

task_id
reward_id

hasBonusReward

created_at
```

---

# 4. Task Creation Flow

When a user creates a task, the system performs **AI clarity evaluation**.

## Step 1 — User Types Task

Example input:

```
Clean desk
```

## Step 2 — Debounced AI Check

After the user stops typing for **1 second**, run AI evaluation.

Before firing the API call, check:

- Input length ≥ 3 characters
- Normalized input (lowercase, trimmed, collapsed whitespace) differs from the last checked string for this task

If either condition fails, skip the API call.

AI determines: `CLEAR` or `VAGUE`

---

# 5. AI Clarity Logic

## 5.1 If Task is CLEAR

Examples:

```
Call Mom
Clean desk
Fill insurance form
```

Behavior:

- Task is saved with `clarity_status = clear`
- AI **generates microtasks in the background**
- Microtasks are **stored but not shown**

The user sees **nothing extra**.

---

## 5.2 If Task is VAGUE

Examples:

```
Mom
Paper
Work
Stuff
```

AI returns a clarification question and 3 options. Popup appears:

```
It looks like a quick thought.

What exactly needs to happen with "Mom"?

A) Call Mom
B) Text Mom
C) Plan a visit
```

User chooses A, B, C, or "Something else".

**If user selects an option** — update task title to the chosen option, run microtask generation.

**If user types their own version** — wait 1 second, run clarity check again. Repeat until CLEAR.

---

## 5.3 Clarity Check — Prompt Contract

**System prompt:**

```
You are a task clarity evaluator for a to-do app designed for people with ADHD.
Classify the user's task input as CLEAR or VAGUE.

CLEAR = specific and immediately actionable, requires no interpretation.
VAGUE = ambiguous, too broad, a topic/noun, or a partial thought.

If VAGUE, return 3 short clarification options (max 5 words each).
```

**Model settings:**

```
model:       gpt-4o-mini
temperature: 0.2
max_tokens:  150
```

**response_format — Structured Output (json_schema):**

```json
{
  "type": "json_schema",
  "json_schema": {
    "name": "clarity_response",
    "strict": true,
    "schema": {
      "type": "object",
      "properties": {
        "result": {
          "type": "string",
          "enum": ["CLEAR", "VAGUE"]
        },
        "question": {
          "type": ["string", "null"]
        },
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

> **Why `json_schema` not `json_object`:** Gemini Structured Outputs (`type: "json_schema"`) force the model to conform exactly to the schema with 100% reliability. Unlike `json_object`, it eliminates Markdown fence wrapping, missing keys, and unexpected extra fields — no defensive parsing required. `question` and `options` are required fields in all responses; they will be `null` when `result` is `CLEAR`.

No prompt instruction about JSON format is needed — the schema enforces it. If the API call itself fails, treat as a soft failure (see 5.4).

---

## 5.4 Failure Handling — Clarity Check

The clarity check must **never block task saving**. All failure paths resolve silently.

| Failure condition | Behavior | Task saved? |
|---|---|---|
| Offline / no network | Skip check. Save task. Set `clarity_status = skipped`. | Yes |
| Request timeout (>3s) | Skip check. Save task. Set `clarity_status = skipped`. | Yes |
| Malformed JSON response | Treat as soft failure. Save task with `clarity_status = skipped`. | Yes |
| API quota exceeded | Show user message: "AI unavailable." Save task. | Yes |
| Invalid API key | Show persistent error in Settings. Save task. | Yes |

Tasks saved with `clarity_status = skipped` may optionally be re-evaluated the next time the user opens or edits them, if the device is back online.

---

# 6. AI Microtask Generation

When a task is confirmed CLEAR, microtask generation runs **silently in the background**. The user sees nothing. Results are stored in SQLite and **never regenerated**.

> **React Native background execution warning:** iOS and Android aggressively suspend the JS thread when the app is backgrounded or the screen locks. Do not assume the microtask API call will complete if the user saves a task and immediately minimizes the app. Implementation must either:
> - Await the API call before confirming the save (adds ~1s latency, acceptable since it's background to the user)
> - Or queue the call in a persistent job store (e.g. a `pending_ai_jobs` SQLite table) and process it on next foreground resume
>
> Do **not** use Expo Background Fetch for this — it's designed for periodic background sync, not task-triggered calls.

## 6.1 Generate Once, Store Forever

- Check `subtask` count for `task_id` before calling the API. If rows exist, skip the call.
- This applies even if the app restarts or the user edits the task title with minor changes.

## 6.2 Microtask Generation — Prompt Contract

**System prompt:**

```
You are a microtask generator for a to-do app designed for people with ADHD.
Break the given task into small, concrete physical actions.

Rules:
- Each step must start with an action verb (e.g. Remove, Write, Open, Put, Wipe).
- Each step must take under 5 minutes.
- No step may require a decision — only a physical action.
- Do not invent tools or materials not implied by the task.
- Do not make assumptions about context.
- Return between 1 and 5 steps.
- If the task is already atomic (e.g. "Call Mom"), return 1–2 steps maximum.
```

**Model settings:**

```
model:       gpt-4o-mini
temperature: 0.2
max_tokens:  200
```

**response_format — Structured Output (json_schema):**

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

> **Why `json_schema`:** Same rationale as Section 5.3 — Structured Outputs guarantee schema conformance. The `steps` array is always present and always contains strings. No defensive parsing or fallback JSON cleaning needed.

## 6.3 Microtask Quality Rules

- Every step begins with an action verb. Reject and discard steps that do not.
- No step text should be identical or near-identical to the parent task title.
- **Minimum 2 meaningfully distinct steps** to offer the breakdown popup. If only 1 step is returned and it mirrors the task title, discard silently and do not offer breakdown.
- Maximum 5 steps. Truncate if the model returns more.
- Store each step with `source = 'ai'`.

## 6.4 Failure Handling — Microtask Generation

Failure must be **invisible to the user**.

| Failure condition | Behavior |
|---|---|
| Offline / no network | Store 3 generic fallback steps. |
| Request timeout (>5s) | Store 3 generic fallback steps. |
| Malformed JSON / missing `steps` key | Store 3 generic fallback steps. |
| API quota exceeded | Store 3 generic fallback steps. Log quietly. |

**Fallback microtasks** (stored with `source = 'fallback'`):

```
1. Start the task
2. Continue working on the task
3. Finish and mark complete
```

---

# 7. Cost Controls & Rate Limiting

Two AI calls are possible per task creation: one clarity check and one microtask generation call.

## 7.1 Caching

- Before firing a clarity check, normalize input (lowercase, trimmed, collapsed whitespace) and compare to the last checked string for this task. Skip if identical.
- Microtasks are permanent once stored. Never regenerate for the same `task_id`.

## 7.2 Input Threshold

- Minimum 3 characters before the clarity check fires.
- Do not fire on whitespace-only input.

## 7.3 Daily Limits (Prepared, Not Yet Active)

These limits are defined now for future monetization enforcement. Logic is **disabled in the MVP**.

| Feature | Free tier limit | Premium |
|---|---|---|
| Clarity checks | 10 per day | Unlimited |
| Microtask generation | 3 per day | Unlimited |
| Fallback behaviour when limit hit | Save task, skip AI | N/A |

Track usage in `User.aiClarityCount` and `User.aiMicrotaskCount`. Reset daily against `User.lastAIReset`.

---

# 8. Onboarding Flow

Users must complete onboarding before entering the dashboard.

Requirements:

```
Minimum 3 tasks
Minimum 1 non-consumable reward
Minimum 3 rewards total
```

> **Why at least 1 non-consumable reward is required:** The pity meter guarantees a reward every 4 task draws. If all rewards are consumable and eventually exhausted, the reward pool becomes empty and the pity meter logic breaks silently — the app would draw a task instead of a reward, permanently undermining the dopamine loop. A non-consumable reward guarantees the pool is never truly empty.

During onboarding reward creation, the UI must:
- Default all rewards to non-consumable (`is_consumable = false`)
- Allow users to toggle a reward as consumable and set `uses_remaining`
- Block "Continue" until at least 1 non-consumable reward exists

Suggested non-consumable reward prompts to show as examples:

```
Take a 10-minute break
Guilt-free phone scroll
Make a snack
Play a song you like
Step outside for 5 minutes
```

Steps:

1. Welcome
2. Add tasks (minimum 3)
3. Add rewards (minimum 3, at least 1 non-consumable)
4. Enter dashboard

---

# 9. Core Draw System

User taps **Draw**.

Base probability:

```
75% → Task
25% → Reward
```

> **Rationale:** The original 40% reward rate, combined with the 30% bonus reward chance and the pity meter, resulted in reward inflation — rewards were drawn so frequently they lost dopamine value. Lowering to 25% makes a reward draw feel genuinely lucky while the pity meter still guarantees one every 4 task draws on a bad run.

**Pity override:** if `drawsSinceReward ≥ 4`, next draw is a guaranteed reward regardless of base probability. Reset `drawsSinceReward` after any reward draw.

## 9.1 Task Selection

Weighted random by effective weight = `importanceWeight + staleness_bonus`:

```
LOW    = 1
MEDIUM = 3
HIGH   = 6
```

## 9.2 Staleness Modifier

Tasks that are never drawn accumulate a staleness bonus to prevent permanent starvation of low-weight tasks.

**Do not store or update `staleness_bonus` as a column.** Calculate it dynamically in the SQL query at draw time using SQLite's `julianday()` function. Running `UPDATE` on every row at app launch is unnecessary and inefficient.

Add a `last_drawn_at` timestamp column to the `Tasks` table (nullable; null means never drawn). Use `created_at` as the fallback when `last_drawn_at` is null.

**Draw query — weighted random with dynamic staleness:**

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

Rules:
- Staleness cap: `MIN(7, ...)` — prevents a neglected LOW task from dominating indefinitely.
- Multiply by `RANDOM()` for weighted-random selection (not just always picking the highest weight).
- Reset `last_drawn_at = datetime('now')` and increment `draw_count` when a task is drawn.
- Remove `staleness_bonus` from the Tasks schema — it is not stored, only computed.

**Example:** A LOW task (base weight 1) not drawn for 5 days has effective weight 6 — equal to a fresh HIGH task.

## 9.3 Reward Selection

Uniform random across all **available** rewards. A consumable reward with `uses_remaining = 0` is excluded from the pool.

---

# 10. Draw Button Locking

| Draw result | Lock state |
|---|---|
| Task drawn | Button **locked** until task + all active subtasks are completed |
| Reward drawn | Button remains **unlocked** |

---

# 11. Bonus Reward Mechanic

When a task is drawn:

```
30% chance → bonus reward attached
```

UI shows:

```
TASK: Clean desk

⭐ BONUS REWARD
Complete this task to reveal a reward
```

After task completion:

1. Reward is automatically drawn
2. Reward animation plays
3. Draw button unlocks

---

# 12. Pity Meter

Field: `User.drawsSinceReward`

Rule:

```
if drawsSinceReward >= 4 → next draw = guaranteed reward
```

Reset to 0 after any reward draw (including bonus rewards).

**UI:** A progress ring around the Draw button shows progress toward the guaranteed reward.

---

# 13. Microtask Activation (User Controlled)

When a **task is drawn**, a popup appears:

```
You drew a task.

Clean desk

Do you want to break this task into smaller steps?
```

Buttons: `Yes — Show steps` / `No — Do task directly`

**If YES:** stored microtasks are displayed as a checklist. Draw button stays locked until all are checked off.

**If NO:** task is completed as a single action. User autonomy is preserved.

> Do not show the breakdown popup if microtask count < 2 or all steps mirror the task title.

---

# 14. Rescue Mode

**Trigger:** task active > 10 minutes AND no interaction detected.

Use **two complementary mechanisms** — one for active screen use, one for returning from background:

**Mechanism 1 — Foreground timer (handles paralysis while staring at screen):**

```
When a task is drawn:
  Start a setInterval (every 30 seconds) in the active task component.
  On each tick: if (now - task_started_at) > 10 minutes AND rescue not yet shown → show rescue popup.
  Clear the interval when the task is completed or the component unmounts.
```

> This is the primary trigger for ADHD task paralysis — the user is looking at the screen but frozen. A foreground timer is required here; the background-resume check alone would miss this entirely.

**Mechanism 2 — Background-resume check (handles returning after stepping away):**

```
On every app foreground resume (AppState 'active' event):
  If active task exists AND rescue not yet shown this session:
    If (now - task_started_at) > 10 minutes → show rescue popup.
```

Both mechanisms check the same `rescueShownThisTask` flag (stored in Zustand, reset when a new task is drawn) to ensure the popup appears at most once per task.

Popup:

```
Feeling stuck?

Start a 2-minute rescue task.
```

Example rescue tasks:

```
Drink water
Put away one item
Write one sentence
Open the document
Stand up and stretch
```

Completion grants: small reward draw or pity meter progress (+1 to `drawsSinceReward`).

Then return to main task.

---

# 15. Dashboard Layout

```
┌─────────────────────────┐
│   Daily success bar      │
├─────────────────────────┤
│                          │
│       [ DRAW ]           │   ← pity ring around button
│                          │
├─────────────────────────┤
│   Active task card       │
├─────────────────────────┤
│   Subtask checklist      │   ← if activated
├─────────────────────────┤
│   Bonus reward indicator │   ← if applicable
└─────────────────────────┘
```

---

# 16. Draw Animation

Sequence:

1. Button pulse
2. Card appears
3. Shake (300ms)
4. Glow
5. Flip (600ms)
6. Reveal task or reward

Total duration: ~1.2 seconds

---

# 17. State Persistence

Persist locally via SQLite + Zustand runtime state:

```
activeTask
activeSubtasks
drawLocked
activeBonusReward
dailyDrawCount
drawsSinceReward
task_started_at      -- timestamp used for rescue mode trigger calculation
rescueShownThisTask  -- boolean; reset to false when a new task is drawn
```

App launch restores full session state.

---

# 18. Edge Cases

| Condition | Behavior |
|---|---|
| No tasks exist | Draw a reward |
| No rewards exist | Draw a task |
| All consumable rewards exhausted and no non-consumable rewards exist | Cannot happen — onboarding enforces at least 1 non-consumable reward |
| AI clarity check fails | Save task with `clarity_status = skipped` |
| AI microtask generation fails | Store 3 generic fallback steps |
| Microtask count < 2 or steps mirror task | Do not offer breakdown popup |
| Pity override fires but reward pool is empty | Draw a task, do not increment `drawsSinceReward` |

---

# 19. Monetization (Prepared, Not Active)

Fields exist but logic is disabled in MVP.

| Feature | Free | Premium |
|---|---|---|
| Daily draws | 3 | Unlimited |
| AI clarity checks | 10/day | Unlimited |
| AI microtask generation | 3/day | Unlimited |

---

# 20. Minimum Viable Version

**Must include:**

- Onboarding (min 3 tasks, min 3 rewards)
- Task creation with AI clarity detection
- Background microtask generation (with fallback)
- User-controlled microtask activation
- Draw system with weighted task selection
- Bonus reward mechanic (30%)
- Pity meter with progress ring UI
- Rescue mode
- Card flip animation (~1.2s)
- Local persistence (SQLite + Zustand)
- Full offline support (AI gracefully degraded)

**Excluded from MVP:**

- Push notifications
- Cloud sync
- Social features
- Calendar integration
- Monetization enforcement