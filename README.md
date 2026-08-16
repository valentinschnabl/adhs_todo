# ADHS Todo

A local-first mobile application built with React Native and Expo, designed to counter executive dysfunction and task paralysis using game mechanics (weighted draw pool, pity counter, microtask breakdowns).

Most todo apps fail neurodivergent users because long, static lists cause cognitive overload. ADHS Todo replaces the conventional backlog with a single-task draw deck, variable reward mechanics, and automated task clarification.

---

## Why this exists

Traditional todo apps assume the user struggles with organization. In reality, ADHD task paralysis usually stems from:
1. **Decision paralysis:** Staring at 30 tasks with no clear entry point.
2. **Vague task definitions:** Tasks like "clean kitchen" feel insurmountable because they are not broken down into immediate physical actions.
3. **Dopamine deficits:** Completing a mundane chore provides no immediate positive reinforcement.

This app solves these bottlenecks through:
- **Single-Focus Draw System:** Users do not pick tasks; they draw one card from a weighted deck.
- **Pity Timer Reward Loop:** Completing tasks builds a counter that guarantees reward cards, introducing variable ratio reinforcement.
- **Clarity & Microtask Engine:** Tasks are analyzed on capture. Vague inputs prompt structured clarification options, while heavy tasks are automatically broken down into atomic, physical steps.
- **Rescue Intervals:** If a user remains idle on an active task, low-barrier rescue prompts kick in to break inertia.

---

## Architecture and Engineering Decisions

### 1. Local-First SQLite Persistence
User data, draw states, reward history, and subtask trees live entirely on-device via `expo-sqlite`. 
- Zero cloud latency and fully functional offline.
- Abstracted database layer with an in-memory fallback for rapid web previews and testing environments.

### 2. State Machine & Domain Store (Zustand)
All domain rules (weighted random selection, pity calculations, active task locks, rescue timers) are encapsulated inside a centralized Zustand store. This keeps UI components purely presentational and simplifies state transitions.

### 3. Graceful AI Degradation
AI features (powered by Gemini) use strict structured JSON schemas with validation fallbacks:
- If an API key is missing or the network drops, the app degrades gracefully to standard task creation and local heuristic microtasks without throwing errors.
- Low temperature and strict token caps ensure fast response times and minimal battery impact.

---

## Tech Stack

- **Framework:** React Native, Expo (SDK 54), Expo Router
- **Language:** TypeScript
- **State Management:** Zustand
- **Persistence:** Expo SQLite (with Web fallback)
- **UI & Motion:** React Native Reanimated, Expo Vector Icons, Expo Haptics
- **AI Service:** Google Gemini API (Structured JSON generation)

---

## Project Structure

```text
app/
  (tabs)/
    index.tsx        # Draw deck, active task card, rescue workflow
    tasks.tsx        # Task ingestion and clarity validation
    rewards.tsx      # Reward pool configuration
    settings.tsx     # Local database management & configuration
  _layout.tsx        # Root layout and theme provider

lib/
  ai.ts              # Gemini API client, system prompts, JSON parsers
  db.ts              # SQLite database driver and web fallback adapter
  store.ts           # Central state machine and business logic
  types.ts           # Shared domain models
  utils.ts           # Weighted random selection, ID generation, date utils

components/          # Reusable UI primitives and animated progress rings
constants/           # Color palettes, typography, and theme tokens
```

---

## Getting Started

### Prerequisites
- Node.js (v18+)
- npm or yarn
- Expo Go app on iOS/Android (or an emulator)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/your-username/adhs-todo.git
cd adhs-todo
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables (optional):
```bash
cp .env.example .env
```
Add your Gemini API key to `.env` if you want AI-assisted task breakdown:
```env
EXPO_PUBLIC_GEMINI_API_KEY=your_api_key_here
```
*Note: The app runs completely fine without an API key; AI features will simply fall back to manual input.*

4. Start the development server:
```bash
npx expo start
```

---

## Core Mechanics

- **Importance Weights:** Tasks are assigned `LOW`, `MEDIUM`, or `HIGH` weights, adjusting their draw probability in the deck.
- **Pity System:** Every task draw increases the pity gauge. If no reward has appeared after a defined threshold, a reward is guaranteed on the next draw.
- **Rescue Trigger:** When an active task has been open for an extended period with zero subtask progress, a lightweight rescue modal appears with small, zero-friction actions (e.g., "Drink water", "Open the document").
