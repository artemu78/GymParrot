# ActivityCreator Component

A refactored, modular component for creating pose and movement activities.

## Structure

```
ActivityCreator/
├── ActivityCreator.tsx       # Main component with business logic
├── ActionButtons.tsx          # Recording control buttons
├── CapturedPoseView.tsx       # Display captured pose with landmarks
├── CapturingFlash.tsx         # Flash animation during capture
├── CountdownOverlay.tsx       # Countdown timer overlay
├── ErrorDisplay.tsx           # Error message display
├── Instructions.tsx           # User instructions panel
├── ReviewSection.tsx          # Pose review and approval UI
├── SettingsModal.tsx          # Settings configuration modal
├── types.ts                   # TypeScript type definitions
├── utils.ts                   # Helper functions
└── index.ts                   # Public exports
```

## Components

### ActivityCreator (Main)
The main component that orchestrates the activity creation flow. Handles:
- Camera management
- Recording state machine
- MediaPipe integration
- Activity saving

### ActionButtons
Renders appropriate buttons based on recording state:
- Start Recording / Test Camera (idle)
- Stop Recording / Cancel (recording/countdown)
- Approve & Create / Retake (reviewing)
- Try Again (error)
- Create Another (completed)

### CapturedPoseView
Displays the captured image with pose landmarks overlaid using SVG.

### CountdownOverlay
Shows countdown timer before pose capture with visual feedback.

### ErrorDisplay
Dismissible error message component with icon.

### Instructions
Context-aware instructions based on activity type (pose vs movement).

### ReviewSection
Approval interface for captured poses with approve/retake options.

### SettingsModal
Configuration modal for countdown delay and other settings.

### CapturingFlash
Flash animation effect during pose capture.

## Usage

```tsx
import ActivityCreator from './components/ActivityCreator';

<ActivityCreator
  onActivityCreated={(activityId) => console.log('Created:', activityId)}
  onError={(error) => console.error('Error:', error)}
  className="custom-class"
/>
```

## Benefits of Refactoring

1. **Modularity**: Each UI section is a separate component
2. **Maintainability**: Easier to locate and modify specific features
3. **Testability**: Components can be tested in isolation
4. **Reusability**: UI components can be reused elsewhere
5. **Readability**: Main component is ~400 lines vs 1000+ lines
6. **Type Safety**: Shared types in dedicated file
