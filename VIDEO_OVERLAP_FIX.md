# Video Overlap Fix

## Problem

At medium screen sizes (around 1024px - 1280px), the video element was overlapping the Feedback section because:
1. The grid split happened at `lg` breakpoint (1024px)
2. At 1024px, there wasn't enough room for a 640px video + feedback section
3. The video had no max-width constraint

## Solution

Changed the breakpoint and added responsive constraints:

### 1. Changed Grid Breakpoint
- **Before:** Split at `lg` (1024px)
- **After:** Split at `xl` (1280px)

### 2. Added Video Constraints
- **Before:** `className="w-full"`
- **After:** `className="w-full max-w-2xl mx-auto xl:mx-0"`

## Code Changes

**Before:**
```tsx
<div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
  <div className="lg:col-span-3">
    <WebcamPreview
      width={640}
      height={480}
      className="w-full"
    />
  </div>
  <div className="lg:col-span-2">
    {/* Feedback */}
  </div>
</div>
```

**After:**
```tsx
<div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
  <div className="xl:col-span-3">
    <WebcamPreview
      width={640}
      height={480}
      className="w-full max-w-2xl mx-auto xl:mx-0"
    />
  </div>
  <div className="xl:col-span-2">
    {/* Feedback */}
  </div>
</div>
```

## Responsive Behavior

### Mobile & Tablet (< 1280px)
- **Layout:** Single column (stacked)
- **Video:** 
  - Full width up to 672px (`max-w-2xl`)
  - Centered (`mx-auto`)
  - Prevents overflow
- **Feedback:** Full width below video

### Desktop (≥ 1280px)
- **Layout:** Two columns (60/40 split)
- **Video:**
  - Takes 60% of width (3/5 columns)
  - Full width within column (`w-full`)
  - Left-aligned (`xl:mx-0` removes centering)
  - Max 640px actual size
- **Feedback:** Takes 40% of width (2/5 columns)

## Why This Works

### Breakpoint Choice (xl = 1280px)
At 1280px screen width:
- Video column: ~768px (60% of 1280px)
- Feedback column: ~512px (40% of 1280px)
- Video actual size: 640px (fits comfortably in 768px)
- Gap: 24px (1.5rem)
- Total: 640 + 24 + 512 = 1176px < 1280px ✓

### Max Width (max-w-2xl = 672px)
- Prevents video from getting too large on medium screens
- Allows some padding/margin
- Centers nicely when stacked

### Conditional Margin
- `mx-auto`: Centers video when stacked (< 1280px)
- `xl:mx-0`: Removes centering when in grid (≥ 1280px)

## Visual Layout

### At < 1280px (Stacked)
```
┌────────────────────────────────┐
│                                │
│     ┌──────────────────┐       │
│     │                  │       │
│     │   Video (640px)  │       │
│     │   Centered       │       │
│     │                  │       │
│     └──────────────────┘       │
│                                │
│  ┌──────────────────────────┐  │
│  │                          │  │
│  │   Feedback (full width)  │  │
│  │                          │  │
│  └──────────────────────────┘  │
│                                │
└────────────────────────────────┘
```

### At ≥ 1280px (Side by Side)
```
┌─────────────────────────────────────────┐
│                                         │
│  ┌──────────────────┐  ┌─────────────┐ │
│  │                  │  │             │ │
│  │  Video (640px)   │  │  Feedback   │ │
│  │  60% column      │  │  40% column │ │
│  │                  │  │             │ │
│  └──────────────────┘  └─────────────┘ │
│                                         │
└─────────────────────────────────────────┘
```

## Benefits

1. ✅ **No Overlap:** Video never overlaps feedback at any screen size
2. ✅ **Responsive:** Smooth transition from stacked to side-by-side
3. ✅ **Centered When Stacked:** Video looks good on medium screens
4. ✅ **Optimal Breakpoint:** Split only when there's enough room
5. ✅ **Maintains Size:** Video stays at 640x480 when space allows

## Testing Checklist

- [x] < 1024px: Stacked layout, video centered, no overlap
- [x] 1024px - 1279px: Still stacked, video centered, no overlap
- [x] ≥ 1280px: Side-by-side, video left-aligned, no overlap
- [x] Resize browser: Smooth transitions
- [x] Video maintains aspect ratio
- [x] Feedback section fully visible
- [x] No horizontal scrolling

## Files Modified

- `src/components/PracticeInterface.tsx`:
  - Changed grid breakpoint from `lg` to `xl`
  - Added `max-w-2xl mx-auto xl:mx-0` to video className
