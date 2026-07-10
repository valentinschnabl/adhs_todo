# ADHD Quest

ADHD Quest is a local-first Expo app for turning to-dos into a simple draw loop. Tasks and rewards stay in SQLite on-device, with optional Gemini help for clarifying vague tasks and suggesting smaller steps.

## What it does

- Draws a random task or reward from your local pool
- Weights task draws by importance and recency
- Guides onboarding with 3 tasks and 3 rewards
- Uses optional AI for task clarity checks and microtask ideas
- Keeps the app usable even when Gemini is disabled

## Requirements

- Node.js 18+
- An iOS simulator, Android emulator, or Expo Go
- Optional Gemini API key for AI features

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create a local env file in the project root:

```bash
EXPO_PUBLIC_GEMINI_API_KEY=your_key_here
```

`GEMINI_API_KEY` also works as a fallback, but `EXPO_PUBLIC_GEMINI_API_KEY` is the path used by the Expo app config.

3. Start the app:

```bash
npm run start
```

## Scripts

- `npm run start` - start Expo
- `npm run android` - run on Android
- `npm run ios` - run on iOS
- `npm run web` - run in the browser

## Project layout

- `app/` - Expo Router screens
- `src/db/` - SQLite setup and queries
- `src/components/` - shared UI
- `src/services/` - env and Gemini helpers
- `src/store/` - Zustand state

## Notes

- Data stays local in SQLite on the device.
- AI features are optional and should not block normal task entry.
