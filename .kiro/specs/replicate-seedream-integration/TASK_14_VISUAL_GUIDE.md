# SeedreamGenerationProgress - Visual Guide

## Component States Overview

This guide shows the visual appearance of the `SeedreamGenerationProgress` component in different states.

---

## 1. Initializing State (0% Progress)

```
┌─────────────────────────────────────────────────────────┐
│ 🔄 Initializing                                         │
│ Preparing your generation request...                    │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ Progress Bar: [░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░] 0%   │
│ 0% complete                    ⏱ 60-90 seconds remaining│
│                                                          │
│ Elapsed time:              0:03                          │
│ Job ID:                    a1b2c3d4...                   │
│                                                          │
│ ┌────────────────────────────────────────────────────┐  │
│ │                    [ Cancel ]                      │  │
│ └────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

**Visual Elements:**
- Blue spinning loader icon
- 0% progress bar (empty)
- Estimated time: "60-90 seconds remaining"
- Elapsed time counter
- Cancel button (if onCancel provided)

---

## 2. Uploading State (1-19% Progress)

```
┌─────────────────────────────────────────────────────────┐
│ 🔄 Uploading                                            │
│ Sending your images to the AI...                        │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ Progress Bar: [████░░░░░░░░░░░░░░░░░░░░░░░░░░░] 15%   │
│ 15% complete                   ⏱ 70 seconds remaining   │
│                                                          │
│ Elapsed time:              0:12                          │
│ Job ID:                    a1b2c3d4...                   │
│                                                          │
│ ┌────────────────────────────────────────────────────┐  │
│ │                    [ Cancel ]                      │  │
│ └────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

**Visual Elements:**
- Blue spinning loader icon
- 15% progress bar (partially filled)
- Updated estimated time
- Elapsed time incrementing

---

## 3. Processing State (20-89% Progress)

```
┌─────────────────────────────────────────────────────────┐
│ ✨ Generating                                           │
│ Creating your professional headshots...                  │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ Progress Bar: [████████████████░░░░░░░░░░░░░] 55%     │
│ 55% complete                   ⏱ 35 seconds remaining   │
│                                                          │
│ Elapsed time:              0:45                          │
│ Job ID:                    a1b2c3d4...                   │
│                                                          │
│ ┌────────────────────────────────────────────────────┐  │
│ │                    [ Cancel ]                      │  │
│ └────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

**Visual Elements:**
- Purple sparkles icon (spinning)
- 55% progress bar (more than half filled)
- Calculated estimated time remaining
- Main generation phase

---

## 4. Finalizing State (90-99% Progress)

```
┌─────────────────────────────────────────────────────────┐
│ 🔄 Finalizing                                           │
│ Almost done! Preparing your results...                   │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ Progress Bar: [████████████████████████████░░] 95%     │
│ 95% complete                   ⏱ 5 seconds remaining    │
│                                                          │
│ Elapsed time:              1:18                          │
│ Job ID:                    a1b2c3d4...                   │
│                                                          │
│ ┌────────────────────────────────────────────────────┐  │
│ │                    [ Cancel ]                      │  │
│ └────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

**Visual Elements:**
- Green spinning loader icon
- 95% progress bar (almost complete)
- Very short estimated time remaining
- Final preparation phase

---

## 5. Completed State (100% Progress)

```
┌─────────────────────────────────────────────────────────┐
│ ✅ Complete                                             │
│ Your headshots are ready!                                │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ Progress Bar: [████████████████████████████████] 100%  │
│ 100% complete                                            │
│                                                          │
│ Elapsed time:              1:25                          │
│ Generation time:           82s                           │
│ Job ID:                    a1b2c3d4...                   │
│                                                          │
│ ┌────────────────────────────────────────────────────┐  │
│ │ ✅ Your professional headshots are ready! (10 images)││
│ └────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

**Visual Elements:**
- Green check circle icon (static)
- 100% progress bar (fully filled)
- Success alert with green background
- Generation time displayed
- No cancel button (completed)

---

## 6. Failed State

```
┌─────────────────────────────────────────────────────────┐
│ ⚠️ Failed                                               │
│ Generation failed                                        │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ Elapsed time:              0:35                          │
│ Job ID:                    a1b2c3d4...                   │
│                                                          │
│ ┌────────────────────────────────────────────────────┐  │
│ │ ❌ Generation failed                                 │ │
│ │                                                      │ │
│ │ • Try generating again with different images        │ │
│ │ • Check that your images meet the requirements      │ │
│ │ • Ensure images contain clear faces                 │ │
│ │ • Contact support if the issue persists             │ │
│ └────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

**Visual Elements:**
- Red alert circle icon (static)
- No progress bar
- Red error alert with suggestions
- Actionable error messages
- No cancel button (already failed)

---

## 7. Retry State (Connection Issues)

```
┌─────────────────────────────────────────────────────────┐
│ ✨ Generating                                           │
│ Creating your professional headshots...                  │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ Progress Bar: [████████████████░░░░░░░░░░░░░] 55%     │
│ 55% complete                   ⏱ 35 seconds remaining   │
│                                                          │
│ Elapsed time:              0:45                          │
│ Job ID:                    a1b2c3d4...                   │
│                                                          │
│ ┌────────────────────────────────────────────────────┐  │
│ │ 🔄 Connection issue detected. Retrying... (2/3)     │ │
│ └────────────────────────────────────────────────────┘  │
│                                                          │
│ ┌────────────────────────────────────────────────────┐  │
│ │                    [ Cancel ]                      │  │
│ └────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

**Visual Elements:**
- Retry indicator with spinning icon
- Shows retry count (2/3)
- Progress bar still visible
- Continues polling in background

---

## 8. Long-Running Generation (After 2 Minutes)

```
┌─────────────────────────────────────────────────────────┐
│ ✨ Generating                                           │
│ Creating your professional headshots...                  │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ Progress Bar: [████████████████████░░░░░░░░░] 70%     │
│ 70% complete                   ⏱ 25 seconds remaining   │
│                                                          │
│ Elapsed time:              2:15                          │
│ Job ID:                    a1b2c3d4...                   │
│                                                          │
│ ┌────────────────────────────────────────────────────┐  │
│ │ ⏱ This generation is taking longer than usual.      │ │
│ │   This can happen during high demand. Your request  │ │
│ │   is still being processed.                         │ │
│ └────────────────────────────────────────────────────┘  │
│                                                          │
│ ┌────────────────────────────────────────────────────┐  │
│ │                    [ Cancel ]                      │  │
│ └────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

**Visual Elements:**
- Clock icon in notice
- Reassuring message about delays
- Still shows progress and continues polling
- Elapsed time over 2 minutes

---

## 9. Connection Error with Manual Retry

```
┌─────────────────────────────────────────────────────────┐
│ ✨ Generating                                           │
│ Creating your professional headshots...                  │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ Progress Bar: [████████████████░░░░░░░░░░░░░] 55%     │
│ 55% complete                   ⏱ 35 seconds remaining   │
│                                                          │
│ Elapsed time:              0:45                          │
│ Job ID:                    a1b2c3d4...                   │
│                                                          │
│ ┌────────────────────────────────────────────────────┐  │
│ │ ⚠️ Connection issues. Still trying to fetch status...││
│ │                                        [ Retry ]    │ │
│ └────────────────────────────────────────────────────┘  │
│                                                          │
│ ┌────────────────────────────────────────────────────┐  │
│ │                    [ Cancel ]                      │  │
│ └────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

**Visual Elements:**
- Error alert with warning icon
- Manual retry button appears after 3 failed attempts
- Still shows progress
- Cancel button still available

---

## Color Scheme

### Phase Colors

| Phase | Color | Hex | Usage |
|-------|-------|-----|-------|
| Initializing | Blue | `#3B82F6` | Icon, text |
| Uploading | Blue | `#3B82F6` | Icon, text |
| Processing | Purple | `#A855F7` | Icon, text |
| Finalizing | Green | `#22C55E` | Icon, text |
| Completed | Green | `#22C55E` | Icon, alert background |
| Failed | Red | `#EF4444` | Icon, alert background |

### UI Elements

| Element | Color | Usage |
|---------|-------|-------|
| Progress Bar (filled) | Primary | Active progress |
| Progress Bar (empty) | Secondary | Remaining progress |
| Card Background | White/Dark | Main container |
| Text (primary) | Foreground | Main text |
| Text (secondary) | Muted | Supporting text |
| Alert (success) | Green-50 | Success messages |
| Alert (error) | Red-50 | Error messages |
| Alert (info) | Blue-50 | Info messages |

---

## Icon Reference

| Phase | Icon | Animation | Color |
|-------|------|-----------|-------|
| Initializing | `Loader2` | Spin | Blue |
| Uploading | `Loader2` | Spin | Blue |
| Processing | `Sparkles` | Spin | Purple |
| Finalizing | `Loader2` | Spin | Green |
| Completed | `CheckCircle` | None | Green |
| Failed | `AlertCircle` | None | Red |
| Retry | `RefreshCw` | Spin | Blue |
| Time | `Clock` | None | Muted |
| Cancel | `XCircle` | None | Red |

---

## Responsive Behavior

### Desktop (≥1024px)
- Full width card
- All elements visible
- Comfortable spacing

### Tablet (768px - 1023px)
- Slightly reduced padding
- All elements visible
- Adjusted spacing

### Mobile (<768px)
- Full width card
- Stacked layout
- Touch-friendly buttons
- Readable text sizes

---

## Animation Details

### Progress Bar
- Smooth transition: `transition-all`
- Duration: Default CSS transition
- Easing: Default

### Spinning Icons
- Animation: `animate-spin`
- Duration: 1s
- Timing: Linear
- Infinite loop

### Elapsed Time
- Updates: Every 1 second
- No animation (instant update)
- Format: `M:SS`

---

## Accessibility Features

### Semantic HTML
- Proper heading hierarchy
- Descriptive labels
- ARIA attributes where needed

### Screen Reader Support
- Status updates announced
- Progress percentage announced
- Error messages announced
- Button labels clear

### Keyboard Navigation
- Cancel button focusable
- Retry button focusable
- Tab order logical

### Color Contrast
- Text meets WCAG AA standards
- Icons have sufficient contrast
- Alerts have clear backgrounds

---

## Integration Layout Example

```
┌─────────────────────────────────────────────────────────┐
│                    Page Header                           │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │                                                     │ │
│  │        SeedreamGenerationProgress Component        │ │
│  │                                                     │ │
│  │  [Progress bar and status information shown above] │ │
│  │                                                     │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │                                                     │ │
│  │         Results Gallery (Task 15)                  │ │
│  │         (Shown after completion)                   │ │
│  │                                                     │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## State Transition Diagram

```
     Start
       ↓
  Initializing (0%)
       ↓
   Uploading (1-19%)
       ↓
  Processing (20-89%)
       ↓
  Finalizing (90-99%)
       ↓
   Completed (100%)
       
       OR
       
   Failed (any %)
```

---

## User Flow

1. **User starts generation** → Component mounts with jobId
2. **Initializing phase** → Shows 0% progress, starts polling
3. **Progress updates** → Bar fills, time updates, phase changes
4. **Long wait (optional)** → Shows reassurance notice after 2 min
5. **Completion** → Shows success message, calls onComplete callback
6. **User views results** → Parent component shows results gallery

---

## Error Flow

1. **Connection error** → Retry automatically (up to 3 times)
2. **Still failing** → Show error with manual retry button
3. **User retries** → Reset retry count, resume polling
4. **API error** → Show error message with suggestions
5. **User cancels** → Stop polling, call onCancel callback

---

This visual guide provides a comprehensive overview of how the `SeedreamGenerationProgress` component appears and behaves in different states throughout the generation process.
