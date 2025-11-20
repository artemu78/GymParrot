# Camera Test Button Fix

## Problem

On the Practice screen, clicking "Test Camera" button resulted in console errors:
1. `Practice error: Video stream not ready. Please wait for camera to initialize.`
2. `Practice error: Failed to start video stream: The play() request was interrupted because the media was removed from the document.`

## Root Cause

### Issue 1: Video Dimensions Not Ready
The code was checking `video.videoWidth` and `video.videoHeight` immediately after `startVideoStream()` returned, but the video element's dimensions weren't available yet.

**Why?**
- `startVideoStream()` waited for the `loadeddata` event
- But `loadeddata` can fire before `loadedmetadata`
- Video dimensions are only available after `loadedmetadata` event

### Issue 2: Race Condition
The video element reference (`videoRef.current`) could become null between the initial check and when `startMovementTracking` was called, especially if the component re-rendered.

## Solutions

### Fix 1: Improved Video Loading in WebcamService

**Before:**
```typescript
// Only waited for loadeddata
videoElement.addEventListener('loadeddata', handleLoadedData)
videoElement.play().catch(reject)
```

**After:**
```typescript
// Wait for loadedmetadata first (includes dimensions), then loadeddata
if (videoElement.readyState >= 1) {
  // Metadata already loaded
  videoElement.addEventListener('loadeddata', handleLoadedData, { once: true })
} else {
  // Wait for metadata, then data
  videoElement.addEventListener('loadedmetadata', handleLoadedMetadata, { once: true })
}
```

**Benefits:**
- Ensures video dimensions are available before resolving
- Handles case where metadata is already loaded
- Proper event cleanup to prevent memory leaks

### Fix 2: Added Safety Delay in testCamera

**Before:**
```typescript
await webcamService.startVideoStream(videoRef.current);

// Immediately check dimensions
const video = videoRef.current;
if (video.videoWidth === 0 || video.videoHeight === 0) {
  throw new Error("Video stream not ready...");
}
```

**After:**
```typescript
await webcamService.startVideoStream(videoRef.current);

// Wait a bit for video dimensions to be available
await new Promise(resolve => setTimeout(resolve, 100));

// Check if video element still exists
const video = videoRef.current;
if (!video) {
  throw new Error("Video element no longer available");
}

// Then check dimensions
if (video.videoWidth === 0 || video.videoHeight === 0) {
  throw new Error("Video stream not ready...");
}
```

**Benefits:**
- 100ms delay ensures dimensions are set
- Checks if video element still exists (prevents null reference)
- Captures video reference in local variable for consistency

### Fix 3: Use Local Video Reference

**Before:**
```typescript
const stopTracking = await mediaPipeService.startMovementTracking(
  videoRef.current,  // Could become null during async operation
  ...
);
```

**After:**
```typescript
const video = videoRef.current;  // Capture reference
// ... validation ...

const stopTracking = await mediaPipeService.startMovementTracking(
  video,  // Use captured reference
  ...
);
```

**Benefits:**
- Prevents race conditions from component re-renders
- Ensures same video element is used throughout the function

## Video Loading Events Order

Understanding the video element loading sequence:

1. **loadstart**: Video loading has begun
2. **loadedmetadata**: Metadata loaded (duration, dimensions, etc.)
3. **loadeddata**: First frame loaded
4. **canplay**: Enough data to start playing
5. **canplaythrough**: Can play through without buffering

Our fix ensures we wait for both `loadedmetadata` (for dimensions) and `loadeddata` (for first frame).

## Testing

To verify the fix:
1. Open Practice screen
2. Click "Test Camera" button
3. Should see:
   - ✅ Camera activates smoothly
   - ✅ Pose landmarks appear
   - ✅ No console errors
   - ✅ "Camera test in progress" message
4. Move around to verify pose detection
5. Click "Stop Test" to end

## Files Modified

1. **src/components/PracticeInterface.tsx**
   - Added 100ms delay after video stream starts
   - Added null check for video element
   - Use local video reference instead of ref.current

2. **src/services/WebcamService.ts**
   - Wait for `loadedmetadata` event before `loadeddata`
   - Handle case where metadata is already loaded
   - Improved event cleanup with `once: true` option

## Related Issues

This fix also improves:
- "Start Practice" button reliability
- Any other feature that starts the video stream
- Overall video initialization robustness
