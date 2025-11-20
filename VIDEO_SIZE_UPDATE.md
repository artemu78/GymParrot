# Video Component Size Update

## Change

Updated the video component size on the Practice screen to match the Create Activity screen for consistency.

## Before

**Create Activity Screen:**
- Width: 640px
- Height: 480px
- Aspect Ratio: 4:3

**Practice Screen:**
- Width: 480px
- Height: 360px
- Aspect Ratio: 4:3
- Max Width: `max-w-lg` (32rem / 512px)

## After

**Both Screens:**
- Width: 640px
- Height: 480px
- Aspect Ratio: 4:3
- Max Width: `max-w-2xl` (42rem / 672px) on Practice screen

## Benefits

1. **Consistency**: Same video size across both screens
2. **Better Visibility**: Larger video makes it easier to see pose details
3. **Improved UX**: Users get the same viewing experience whether creating or practicing
4. **Better Landmark Visibility**: Larger canvas for MediaPipe overlay makes landmarks more visible

## Technical Details

### Practice Screen Changes

**File:** `src/components/PracticeInterface.tsx`

**Before:**
```tsx
<WebcamPreview
  width={480}
  height={360}
  className="w-full max-w-lg"
/>
```

**After:**
```tsx
<WebcamPreview
  width={640}
  height={480}
  className="w-full max-w-2xl"
/>
```

### Responsive Behavior

Both screens now use:
- `w-full`: Video fills container width on small screens
- `max-w-2xl`: Caps at 672px on larger screens
- Maintains 4:3 aspect ratio at all sizes

## Visual Impact

The video on the Practice screen is now:
- **33% larger** (640x480 vs 480x360)
- **More prominent** in the interface
- **Easier to see** pose landmarks and feedback
- **Consistent** with Create Activity screen

## Testing

To verify:
1. Open Create Activity screen - note video size
2. Open Practice screen - video should be same size
3. Resize browser window - both should scale consistently
4. Check on mobile - both should be responsive
