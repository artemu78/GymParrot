# Landmark Overlay Alignment Fix

## Problem

On the Practice screen, the MediaPipe pose landmarks (skeleton lines and dots) were not aligning with the actual video image. The overlay was offset or scaled incorrectly.

## Root Cause

The SVG overlay was using **absolute pixel coordinates** based on the video's native resolution (e.g., 640x480), but the video element was being displayed at a different size due to CSS scaling (`object-cover`).

**Before:**
```typescript
<svg
  width={videoWidth}        // e.g., 640
  height={videoHeight}      // e.g., 480
  viewBox={`0 0 ${videoWidth} ${videoHeight}`}
>
  <circle
    cx={landmark.x * videoWidth}   // e.g., 0.5 * 640 = 320px
    cy={landmark.y * videoHeight}  // e.g., 0.5 * 480 = 240px
  />
</svg>
```

This approach failed because:
1. The SVG had fixed pixel dimensions (640x480)
2. The video element was scaled by CSS to fit the container
3. The SVG didn't scale proportionally with the video

## Solution

Changed the SVG to use **normalized coordinates** (0-1 range) with a viewBox that matches:

**After:**
```typescript
<svg
  className="absolute inset-0 w-full h-full"
  viewBox="0 0 1 1"
  preserveAspectRatio="xMidYMid slice"
>
  <circle
    cx={landmark.x}    // Already normalized (0-1)
    cy={landmark.y}    // Already normalized (0-1)
    r="0.005"          // Relative to viewBox
  />
</svg>
```

### Key Changes

1. **SVG viewBox**: Changed from `0 0 640 480` to `0 0 1 1`
   - Now uses normalized coordinate space

2. **SVG sizing**: Changed from fixed `width/height` to `w-full h-full`
   - SVG now fills the container and scales with it

3. **preserveAspectRatio**: Set to `xMidYMid slice`
   - Matches the video's `object-cover` behavior
   - Centers and scales to fill the container

4. **Landmark coordinates**: Use raw normalized values
   - Before: `landmark.x * videoWidth` (e.g., 0.5 * 640 = 320)
   - After: `landmark.x` (e.g., 0.5)

5. **Stroke/radius sizes**: Adjusted to normalized scale
   - Before: `strokeWidth="2"` (2 pixels)
   - After: `strokeWidth="0.003"` (0.3% of viewBox)
   - Before: `r="3"` (3 pixels)
   - After: `r="0.005"` (0.5% of viewBox)

## Benefits

1. ✅ **Automatic scaling**: Overlay scales perfectly with any video size
2. ✅ **Responsive**: Works on any screen size or container dimension
3. ✅ **Consistent**: Maintains alignment regardless of CSS scaling
4. ✅ **Simpler**: No need to track displayed dimensions vs native dimensions

## Technical Details

### MediaPipe Coordinates

MediaPipe returns landmarks with normalized coordinates:
- `x`: 0.0 (left) to 1.0 (right)
- `y`: 0.0 (top) to 1.0 (bottom)
- `z`: Depth (not used for 2D overlay)

### SVG viewBox

The `viewBox="0 0 1 1"` creates a coordinate system where:
- (0, 0) is top-left
- (1, 1) is bottom-right
- All coordinates are proportional

### preserveAspectRatio

`xMidYMid slice` means:
- `xMidYMid`: Center the content both horizontally and vertically
- `slice`: Scale to cover the entire viewport (like CSS `object-cover`)

This matches the video element's behavior, ensuring perfect alignment.

## Testing

To verify the fix:
1. Open Practice screen
2. Start camera test or practice
3. Move around and observe pose landmarks
4. Landmarks should perfectly overlay your body position
5. Try resizing the window - overlay should remain aligned

## Files Modified

- `src/components/WebcamPreview.tsx`: Updated `PoseLandmarkOverlay` component
  - Changed SVG viewBox and sizing
  - Updated coordinate calculations
  - Adjusted stroke widths and radii for normalized scale
