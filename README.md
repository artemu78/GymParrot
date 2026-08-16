# GymParrot

GymParrot is a browser-based pose coaching application that connects trainers and trainees through AI-powered movement tracking. Trainers can create reusable pose or movement activities, and trainees can practise them with live landmark overlays, configurable difficulty, and real-time feedback.

[Open the deployed application](https://gymparrot.netlify.app/)

## Features

- Create single-pose and recorded movement activities with a webcam.
- Review or retake a capture before saving it.
- Browse, filter, preview, practise, and delete saved activities.
- Test camera placement and pose tracking before a practice session.
- Compare live poses with a reference using Google MediaPipe.
- Choose easy, medium, or hard comparison thresholds.
- Track attempts, successful matches, best score, average score, and success rate.
- Run without a backend or user account.

## Local data and privacy

GymParrot stores activity metadata and pose data in the browser's `localStorage`. Recorded reference-video blobs are stored in IndexedDB. Data stays in the current browser profile, is not synchronized between devices, and may be lost when site data is cleared.

The camera is activated only for capture, camera testing, or practice and is stopped when the operation finishes or is cancelled.

## Prerequisites

- Node.js and npm
- A modern browser with webcam support
- Camera permission for `localhost:3000`
- Internet access when MediaPipe downloads its WebAssembly runtime and pose model

## Run locally

Install the locked dependencies:

```bash
npm ci
```

Start the Vite development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), allow camera access, and use **Create Activity** to record a reference or **Browse Activities** to practise an existing one.

`npm run start` starts the same development server on port 3000.

## Build and preview

Create a production build and run the TypeScript compiler:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run serve
```

## Tests and code quality

The available commands are defined in `package.json`:

| Command | Purpose |
| --- | --- |
| `npm test` | Run the Vitest suite once. |
| `npm run test:coverage` | Run all tests and generate text, JSON, and HTML coverage reports. |
| `npm run lint` | Run Biome lint checks. |
| `npm run format` | Run the Biome formatter. |
| `npm run check` | Run Biome's combined checks. |
| `npm run check:ci` | Check the performance and pose-feature files selected by the CI script. |

## Application flow

1. Create a pose or movement activity with the webcam.
2. Review and approve the captured reference.
3. Select the saved activity from the activity library.
4. Test the camera and choose a difficulty level.
5. Start practising to receive live comparison feedback and session statistics.

## Technology

- React 19 and TypeScript
- Vite 6
- TanStack Router with file-based routes
- Google MediaPipe Tasks Vision
- Tailwind CSS 4
- Vitest and Testing Library
- Biome

## Project structure

```text
src/
├── components/   UI for activity creation, browsing, playback, and practice
├── routes/       File-based application routes
├── services/     MediaPipe, webcam, comparison, activity, and storage services
├── types/        Shared activity and pose types
└── utils/        Validation and performance utilities
```

More implementation detail is available in [`src/components/ActivityCreator/README.md`](src/components/ActivityCreator/README.md) and [`src/services/STORAGE_README.md`](src/services/STORAGE_README.md).
