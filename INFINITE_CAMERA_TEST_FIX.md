# Infinite Camera Test Fix

## Problem

The camera test mode had several issues:
1. **Auto-stopped after 30 seconds** - Tracking stopped but camera remained on
2. **Inconsistent state** - Button showed "Test Camera" but camera was still running
3. **No user control** - Test ended automatically instead of waiting for user action

## Root Cause

The `testCamera` function set a fixed duration of 30 seconds:
```typescript
duration: 30000, // 30 seconds test
```

When this duration expired:
- ✅ Pose tracking stopped
- ✅ UI state updated (`setIsCameraTesting(false)`)
- ❌ Camera remained on (no `stopVideoStream()` call)
- ❌ Video element still showed camera feed

## Solution

Changed the camera test to run indefinitely until the user explicitly stops it:

### 1. Set Infinite Duration
```typescript
duration: Infinity, // Run indefinitely until user clicks "Stop Test"
```

### 2. Added Camera Cleanup to Error Handler
```typescript
onError: (error) => {
  handleError(error.message);
  setIsCameraTesting(false);
  setCurrentLandmarks([]);
  webcamService.stopVideoStream(); // Turn off camera on error
}
```

## Code Changes

**Before:**
```typescript
const stopTracking = await mediaPipeService.startMovementTracking(
  video,
  (landmarks) => {
    setCurrentLandmarks(landmarks);
  },
  {
    duration: 30000, // 30 seconds test
    onComplete: () => {
      setIsCameraTesting(false);
      setCurrentLandmarks([]);
      // ❌ Camera not turned off
    },
    onError: (error) => {
      handleError(error.message);
      setIsCameraTesting(false);
      setCurrentLandmarks([]);
      // ❌ Camera not turned off
    },
  }
);
```

**After:**
```typescript
const stopTracking = await mediaPipeService.startMovementTracking(
  video,
  (landmarks) => {
    setCurrentLandmarks(landmarks);
  },
  {
    duration: Infinity, // Run indefinitely until user clicks "Stop Test"
    onComplete: () => {
      // This won't be called with Infinity duration
      setIsCameraTesting(false);
      setCurrentLandmarks([]);
      webcamService.stopVideoStream();
    },
    onError: (error) => {
      handleError(error.message);
      setIsCameraTesting(false);
      setCurrentLandmarks([]);
      webcamService.stopVideoStream(); // ✅ Turn off camera on error
    },
  }
);
```

## Behavior Now

### Starting Camera Test
1. User clicks "Test Camera"
2. Camera activates
3. Pose tracking starts
4. Landmarks appear in real-time
5. Button changes to "Stop Test"
6. **Test runs indefinitely** ⏱️

### Stopping Camera Test
User clicks "Stop Test":
1. Stops pose tracking
2. Clears landmarks
3. Updates UI state
4. **Turns off camera** 📷
5. Button changes back to "Test Camera"

### Error Handling
If error occurs during test:
1. Shows error message
2. Stops tracking
3. Clears landmarks
4. **Turns off camera** 📷
5. Returns to ready state

## Benefits

1. **User Control:** Test runs until user decides to stop
2. **Consistent State:** Camera and UI state always match
3. **Resource Management:** Camera only on when actively testing
4. **Better UX:** No unexpected auto-stops
5. **Flexible Testing:** Users can test as long as they need

## Use Cases

This infinite duration is perfect for:
- **Setup verification:** Users can adjust camera angle/position
- **Lighting checks:** Test different lighting conditions
- **Movement testing:** Try various poses and movements
- **Troubleshooting:** Debug pose detection issues
- **Calibration:** Find optimal distance from camera

## Technical Details

### Infinity Duration
JavaScript's `Infinity` is a valid number that represents an infinite value:
```typescript
typeof Infinity // "number"
Infinity > 1000000 // true
```

MediaPipe's tracking loop checks:
```typescript
if (elapsed >= duration) {
  onComplete();
}
```

With `Infinity`, this condition never becomes true, so tracking continues until manually stopped.

### Manual Stop
The `stopCameraTest` function calls:
```typescript
stopTrackingRef.current(); // Stops the tracking loop
webcamService.stopVideoStream(); // Turns off camera
```

This provides clean shutdown regardless of duration.

## Testing Checklist

- [x] Click "Test Camera" - camera starts, tracking begins
- [x] Move around - landmarks appear and follow movements
- [x] Wait 30+ seconds - test continues (no auto-stop)
- [x] Click "Stop Test" - camera turns off, landmarks disappear
- [x] UI state consistent - button text matches camera state
- [x] Error handling - camera turns off if error occurs
- [x] Can restart test - "Test Camera" works again after stopping

## Files Modified

- `src/components/PracticeInterface.tsx`:
  - Changed `duration: 30000` to `duration: Infinity`
  - Added `webcamService.stopVideoStream()` to error handler
