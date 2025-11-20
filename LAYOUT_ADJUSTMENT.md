# Practice Screen Layout Adjustment

## Change

Adjusted the Practice screen layout to give more space to the video component and less to the feedback section, creating a better visual balance.

## Layout Changes

### Before
```
┌─────────────────────────────────────────┐
│  Video (50%)    │  Feedback (50%)       │
│  480x360        │                       │
└─────────────────────────────────────────┘
```
- Equal 50/50 split on large screens
- Video: 480x360 with max-w-lg
- Grid: `grid-cols-2`

### After
```
┌─────────────────────────────────────────┐
│  Video (60%)         │  Feedback (40%)  │
│  640x480             │                  │
└─────────────────────────────────────────┘
```
- 60/40 split on large screens (3:2 ratio)
- Video: 640x480 full width
- Grid: `grid-cols-5` with `col-span-3` and `col-span-2`

## Technical Implementation

### Grid System

**Before:**
```tsx
<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
  <div>
    <WebcamPreview width={480} height={360} className="w-full max-w-lg" />
  </div>
  <div>
    {/* Feedback */}
  </div>
</div>
```

**After:**
```tsx
<div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
  <div className="lg:col-span-3">
    <WebcamPreview width={640} height={480} className="w-full" />
  </div>
  <div className="lg:col-span-2">
    {/* Feedback */}
  </div>
</div>
```

### Responsive Behavior

**Mobile (< 1024px):**
- Single column layout
- Video stacks above feedback
- Both sections full width

**Desktop (≥ 1024px):**
- Two column layout with 3:2 ratio
- Video takes 60% of width (3/5 columns)
- Feedback takes 40% of width (2/5 columns)

## Benefits

1. **Better Visual Balance**: Larger video gets more space
2. **Improved Focus**: Video is the primary element
3. **Efficient Use of Space**: Feedback section is appropriately sized for its content
4. **Maintains Readability**: Feedback section still has enough width for comfortable reading
5. **Responsive**: Works well on all screen sizes

## Visual Impact

### Video Section
- ✅ More prominent (60% vs 50%)
- ✅ Full width within its column (no max-w constraint)
- ✅ Better visibility of pose landmarks
- ✅ Matches Create Activity screen size

### Feedback Section
- ✅ Appropriately sized for content (buttons, stats, messages)
- ✅ Prevents excessive whitespace
- ✅ Maintains good readability
- ✅ Compact but not cramped

## Content Fit

The feedback section contains:
- Difficulty level buttons (3 buttons)
- Practice control buttons (Start/Stop/Test)
- Real-time feedback messages
- Session statistics (4 metrics)
- Instructions

All of these fit comfortably in the 40% width column without requiring horizontal scrolling or text wrapping issues.

## Testing Checklist

- [ ] Desktop view: Video takes ~60% width, feedback ~40%
- [ ] Mobile view: Stacked layout, both full width
- [ ] Video displays at 640x480
- [ ] Feedback section content is readable
- [ ] Buttons are not cramped
- [ ] Statistics display properly
- [ ] No horizontal scrolling
- [ ] Responsive at all breakpoints
