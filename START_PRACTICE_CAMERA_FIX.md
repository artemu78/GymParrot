# Start Practice Camera Fix

## Problem

Clicking "Start Practice" button resulted in error:
```
Practice error: Video stream not ready. Please wait for camera to initialize.
```

## Root Cause

The `startPractice` function assumed the camera was already running and only checked if video dimensions were valid. Unlike "Test Camera" which initializes the camera, "Start Practice" didn't start the camera stream.

**Before:**
```typescript
const startPractice = async () => {
  // ❌ No camera initialization
  const video = videoRef.current;
  if (video.videoWidth === 0 || video.videoHeight === 0) {
    throw new Error("Video stream not ready...");
  }
  // Start tracking...
}
```

## Solution

Added camera initialization to `startPractice` function, matching the pattern used in `testCamera`:

1. Initialize MediaPipe pose landmarker
2. Start video stream
3. Wait for video dimensions to be available
4. Validate video element and dimensions
5. Start practice tracking

Also added camera cleanup to `stopPractice` to turn off camera when practice ends.

## Code Changes

### 1. Added Camera Initialization to startPractice

**Before:**
```typescript
const startPractice = useCallback(async () => {
  if (!videoRef.current || !activity || practiceState !== "ready") return;

  try {
    setPracticeState("practicing");
    setIsTracking(true);
    clearError();

    // Ensure video element has valid dimensions
    const video = videoRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      throw new Error("Video stream not ready...");
    }
    // ...
  }
}, [...]);
```

**After:**
```typescript
const startPractice = useCallback(async () => {
  if (!videoRef.current || !activity || practiceState !== "ready") return;

  try {
    setPracticeState("practicing");
    setIsTracking(true);
    clearError();

    // Initialize camera and pose detection if not already running
    await mediaPipeService.initializePoseLandmarker();
    await webcamService.startVideoStream(videoRef.current);

    // Wait a bit for video dimensions to be available
    await new Promise(resolve => setTimeout(resolve, 100));

    // Ensure video element has valid dimensions
    const video = videoRef.current;
    if (!video) {
      throw new Error("Video element no longer available");
    }
    
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      throw new Error("Video stream not ready...");
    }
    // ...
  }
}, [...]);
```

### 2. Added Camera Cleanup to stopPractice

**Before:**
```typescript
const stopPractice = useCallback(() => {
  if (stopTrackingRef.current) {
    stopTrackingRef.current();
    stopTrackingRef.current = null;
  }
  setIsTracking(false);
  setPracticeState("ready");
  setComparisonResult(null);
  // ❌ Camera not turned off
}, []);
```

**After:**
```typescript
const stopPractice = useCallback(() => {
  if (stopTrackingRef.current) {
    stopTrackingRef.current();
    stopTrackingRef.current = null;
  }
  setIsTracking(false);
  setPracticeState("ready");
  setComparisonResult(null);
  
  // Turn off camera to conserve resources
  webcamService.stopVideoStream();
}, []);
```

## Behavior Now

### Starting Practice
1. User clicks "Start Practice"
2. **Camera initializes** 📷
3. MediaPipe loads
4. Video stream starts
5. Waits 100ms for dimensions
6. Validates video is ready
7. Starts pose tracking
8. Practice begins

### During Practice
- Camera active
- Pose tracking running
- Real-time comparison
- Feedback displayed
- Statistics updated

### Stopping Practice
1. User clicks "Stop Practice" or practice completes
2. Stops pose tracking
3. Clears comparison results
4. Updates UI state
5. **Turns off camera** 📷
6. Returns to ready state

## Benefits

1. **Automatic Camera Management:** No manual camera control needed
2. **Consistent Behavior:** Works like "Test Camera" button
3. **Resource Efficient:** Camera only on during practice
4. **Error Prevention:** Proper initialization prevents dimension errors
5. **User Friendly:** Just click and practice starts

## Comparison: Test Camera vs Start Practice

### Test Camera
- **Purpose:** Verify camera setup and pose detection
- **Duration:** Infinite (until user stops)
- **Tracking:** Shows landmarks only
- **Comparison:** None
- **Camera:** On during test, off when stopped

### Start Practice
- **Purpose:** Practice activity with feedback
- **Duration:** Configurable (default 60 seconds for poses)
- **Tracking:** Shows landmarks
- **Comparison:** Real-time pose/movement comparison
- **Camera:** On during practice, off when stopped

Both now properly manage camera lifecycle! ✅

## Edge Cases Handled

1. **Camera already running:** `startVideoStream` handles gracefully
2. **MediaPipe already initialized:** `initializePoseLandmarker` handles gracefully
3. **Video element removed:** Checks for null before using
4. **Dimensions not ready:** 100ms delay + validation
5. **Practice stopped early:** Camera properly cleaned up
6. **Error during start:** Camera state consistent

## Testing Checklist

- [x] Click "Start Practice" - camera starts, practice begins
- [x] Practice runs - pose tracking and comparison work
- [x] Click "Stop Practice" - camera turns off
- [x] Practice completes - camera turns off automatically
- [x] Error during practice - camera turns off
- [x] Multiple practice sessions - works repeatedly
- [x] Switch between Test Camera and Practice - no conflicts
- [x] Video placeholder shows after stopping

## Files Modified

- `src/components/PracticeInterface.tsx`:
  - Added camera initialization to `startPractice` function
  - Added camera cleanup to `stopPractice` function
