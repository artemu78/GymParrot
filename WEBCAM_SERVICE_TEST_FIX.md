# WebcamService Test Fix

## Problem

All WebcamService tests were timing out after we updated the service to wait for `loadedmetadata` event before `loadeddata` event.

**Error:**
```
Error: Test timed out in 5000ms.
```

## Root Cause

The tests only mocked the `loadeddata` event:
```typescript
mockVideoElement.addEventListener.mockImplementation((event, handler) => {
  if (event === 'loadeddata') {
    setTimeout(() => handler(), 0)
  }
})
```

But our updated `WebcamService.startVideoStream()` now waits for `loadedmetadata` first:
```typescript
videoElement.addEventListener('loadedmetadata', handleLoadedMetadata, { once: true })
```

Since the tests never fired `loadedmetadata`, the promise never resolved, causing timeouts.

## Solution

Updated all test mocks to fire both `loadedmetadata` and `loadeddata` events:

```typescript
mockVideoElement.addEventListener.mockImplementation((event, handler) => {
  if (event === 'loadedmetadata' || event === 'loadeddata') {
    setTimeout(() => handler(), 0)
  }
})
```

## Tests Fixed

### 1. should start video stream successfully
- **Before:** Only mocked `loadeddata`
- **After:** Mocks both `loadedmetadata` and `loadeddata`

### 2. should request camera access if no current stream
- **Before:** Only mocked `loadeddata`
- **After:** Mocks both `loadedmetadata` and `loadeddata`

### 3. should use existing stream if available
- **Before:** Only mocked `loadeddata`
- **After:** Mocks both `loadedmetadata` and `loadeddata`

### 4. should stop video stream and clean up resources
- **Before:** Only mocked `loadeddata`
- **After:** Mocks both `loadedmetadata` and `loadeddata`

## Why Both Events Are Needed

### loadedmetadata Event
- Fires when video metadata is loaded
- Includes: duration, dimensions (videoWidth, videoHeight), etc.
- Required for our dimension validation

### loadeddata Event
- Fires when first frame of video is loaded
- Video is ready to start playing
- Required for smooth playback

### Our Implementation
```typescript
// Wait for metadata first (includes dimensions)
if (videoElement.readyState >= 1) {
  // Metadata already loaded, wait for data
  videoElement.addEventListener('loadeddata', handleLoadedData, { once: true })
} else {
  // Wait for metadata, then data
  videoElement.addEventListener('loadedmetadata', handleLoadedMetadata, { once: true })
}
```

### Test Mock
```typescript
// Fire both events to match real browser behavior
mockVideoElement.addEventListener.mockImplementation((event, handler) => {
  if (event === 'loadedmetadata' || event === 'loadeddata') {
    setTimeout(() => handler(), 0)
  }
})
```

## Test Results

**Before:**
```
Test Files  1 failed (1)
Tests  4 failed | 16 passed (20)
- All startVideoStream tests timing out
```

**After:**
```
Test Files  1 passed (1)
Tests  20 passed (20)
- All tests passing ✅
```

## Files Modified

- `src/services/__tests__/WebcamService.test.ts`: Updated 4 tests to mock both `loadedmetadata` and `loadeddata` events

## Related Changes

This fix aligns with the changes made to `WebcamService.ts` in the Camera Test Fix, where we improved video loading to wait for metadata (dimensions) before considering the video ready.
