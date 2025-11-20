# Video Placeholder Fix

## Problem

After clicking "Test Camera" and then "Stop Test", the video element showed a black box instead of the placeholder message "Camera Preview - Click 'Start Recording' or 'Test Camera' to begin".

## Root Cause

When the camera stream was stopped via `webcamService.stopVideoStream()`:
1. The video tracks were stopped
2. The `srcObject` was set to null
3. BUT the `videoReady` state in WebcamPreview remained `true`
4. This caused the placeholder overlay to not display

The component only reset `videoReady` when `isActive` prop changed, but in the Practice screen, `isActive` is always `true`.

## Solution

Added a monitoring effect that detects when the video stream is stopped and automatically resets the `videoReady` state.

## Code Changes

**Added to WebcamPreview.tsx:**

```typescript
// Monitor video srcObject to detect when stream is stopped
useEffect(() => {
  const video = videoRef.current;
  if (!video) return;

  const checkStream = () => {
    // If srcObject is null or stream has no active tracks, reset videoReady
    const stream = video.srcObject as MediaStream | null;
    if (!stream || stream.getTracks().every(track => track.readyState === 'ended')) {
      setVideoReady(false);
    }
  };

  // Check periodically
  const interval = setInterval(checkStream, 500);

  return () => {
    clearInterval(interval);
  };
}, []);
```

## How It Works

### Stream Monitoring
The effect checks every 500ms if:
1. **No srcObject:** `!stream` - Video has no media source
2. **All tracks ended:** `stream.getTracks().every(track => track.readyState === 'ended')` - All media tracks are stopped

If either condition is true, it sets `videoReady = false`, which triggers the placeholder to display.

### Track States
MediaStreamTrack has three possible `readyState` values:
- `"live"` - Track is active and providing data
- `"ended"` - Track has been stopped
- `"muted"` - Track is temporarily not providing data

## Behavior Now

### Initial State
```
┌─────────────────────────────┐
│                             │
│    📹 Camera Preview        │
│                             │
│  Click "Start Recording"    │
│  or "Test Camera" to begin  │
│                             │
└─────────────────────────────┘
```
- `videoReady = false`
- Placeholder visible

### After Starting Test
```
┌─────────────────────────────┐
│                             │
│   🎥 [Live Camera Feed]     │
│   with pose landmarks       │
│                             │
└─────────────────────────────┘
```
- `videoReady = true`
- Video stream active
- Placeholder hidden

### After Stopping Test
```
┌─────────────────────────────┐
│                             │
│    📹 Camera Preview        │
│                             │
│  Click "Start Recording"    │
│  or "Test Camera" to begin  │
│                             │
└─────────────────────────────┘
```
- Stream stopped
- Monitor detects stopped tracks
- `videoReady = false` (within 500ms)
- Placeholder reappears

## Benefits

1. **Automatic Detection:** No manual state management needed
2. **Consistent UI:** Placeholder always shows when camera is off
3. **User Feedback:** Clear indication that camera is not active
4. **Reusable:** Works for any component using WebcamPreview
5. **Reliable:** Checks actual stream state, not just props

## Performance

- **Interval:** 500ms check (2 times per second)
- **Lightweight:** Simple boolean checks
- **Cleanup:** Interval cleared when component unmounts
- **No Memory Leaks:** Proper cleanup in useEffect return

## Edge Cases Handled

1. **Stream never started:** Placeholder shows
2. **Stream stopped externally:** Detected and placeholder shows
3. **All tracks ended:** Detected and placeholder shows
4. **srcObject set to null:** Detected and placeholder shows
5. **Component unmounted:** Interval cleaned up

## Testing Checklist

- [x] Initial load: Placeholder visible
- [x] Click "Test Camera": Camera starts, placeholder hides
- [x] Camera active: Video feed visible
- [x] Click "Stop Test": Camera stops, placeholder reappears (within 500ms)
- [x] Multiple cycles: Works repeatedly
- [x] Error during test: Placeholder reappears
- [x] Browser tab inactive: No issues
- [x] Component unmount: No memory leaks

## Alternative Approaches Considered

### 1. Event Listeners on Tracks
```typescript
stream.getTracks().forEach(track => {
  track.addEventListener('ended', () => setVideoReady(false));
});
```
**Issue:** Tracks might be replaced, need to re-attach listeners

### 2. Prop-based Control
```typescript
<WebcamPreview isStreamActive={isStreamActive} />
```
**Issue:** Requires parent to track stream state, less encapsulated

### 3. Mutation Observer
```typescript
new MutationObserver(() => checkStream()).observe(video, { attributes: true });
```
**Issue:** Overkill for this use case, more complex

**Chosen Approach:** Polling with setInterval
- Simple and reliable
- Self-contained
- Works in all scenarios
- Minimal performance impact

## Files Modified

- `src/components/WebcamPreview.tsx`: Added stream monitoring effect to detect when video stream is stopped and reset `videoReady` state
