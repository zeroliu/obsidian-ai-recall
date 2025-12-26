---
created: 2025-12-24
updated: 2025-12-25
---
# Recall: Interaction Design Spec

This document describes the detailed interaction design for the Recall Obsidian plugin. Use this spec to generate an interactive prototype.

See also: [[Recall - Obsidian Quiz Plugin PRD]]

---

## App Structure

**Container**: Right sidebar panel in Obsidian (width: 320px)
**Navigation**: Three tabs at the top — Quiz (default), Progress, Settings

---

## Screen 1: First Launch / Onboarding

### 1.1 Vault Analysis (Loading State)

```
┌─────────────────────────────────────────┐
│  [Recall logo]                          │
│                                         │
│  Welcome to Recall                      │
│                                         │
│  Analyzing your vault...                │
│  ━━━━━━━━━━━━━━━○○○○○                   │
│                                         │
│  Found 234 notes so far...              │
│                                         │
└─────────────────────────────────────────┘
```

**Behavior:**
- Progress bar animates left to right (indeterminate style, 2s loop)
- Note count updates in real-time as vault is scanned
- Duration: 3-8 seconds depending on vault size
- Auto-transitions to 1.2 when complete

### 1.2 Concept Selection (Netflix-style)

```
┌─────────────────────────────────────────┐
│  What do you want to master?            │
│  Select concepts to quiz on             │
├─────────────────────────────────────────┤
│                                         │
│  [✓] Golf                    23 notes   │
│  [✓] React & Frontend       156 notes   │
│  [ ] Meeting Notes           89 notes   │
│  [✓] Product Management      45 notes   │
│  [ ] Personal Finance        12 notes   │
│  [ ] Book Notes              67 notes   │
│  [ ] System Design           34 notes   │
│                                         │
│  ─────────────────────────────────────  │
│  Selected: 3 concepts                   │
│                                         │
│  [Get Started →]                        │
│                                         │
└─────────────────────────────────────────┘
```

**Components:**
- **Concept row**: Checkbox + concept name + note count (right-aligned, muted)
- **Checkbox**: Toggle on tap. Checked = primary color fill with checkmark
- **Selected counter**: Updates immediately on selection change
- **Get Started button**: Primary button, full-width, disabled if 0 selected

**Interactions:**
- Tap concept row → toggle checkbox
- Scroll if >7 concepts (vertical scroll within list area)
- Tap "Get Started" → transition to Screen 2 (Home) with first quiz auto-starting

**Transitions:**
- Fade in concept rows with 50ms stagger
- Button slides up from bottom when at least 1 concept selected

---

## Screen 2: Home (Quiz Tab)

### 2.1 Default Home State

```
┌─────────────────────────────────────────┐
│  [Quiz]  [Progress]  [Settings]    [⚙️] │
├─────────────────────────────────────────┤
│                                         │
│  💡 Your concepts                       │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ 🏌️ Golf              due today │ ▶ │
│  └─────────────────────────────────┘   │
│  ┌─────────────────────────────────┐   │
│  │ ⚛️ React           2 new notes │ ▶ │
│  └─────────────────────────────────┘   │
│  ┌─────────────────────────────────┐   │
│  │ 📊 PM               5 days ago │ ▶ │
│  └─────────────────────────────────┘   │
│                                         │
│  ─────────────────────────────────────  │
│                                         │
│  ✨ New concept detected                │
│  ┌─────────────────────────────────┐   │
│  │ Short game techniques           │   │
│  │ 4 notes seem related            │   │
│  │ [Add]              [Skip]       │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ─────────────────────────────────────  │
│                                         │
│  🔍 Quiz me on...                       │
│                                         │
│  ─────────────────────────────────────  │
│  📈 7-day streak · 73% mastery          │
│  [View Progress →]                      │
│                                         │
└─────────────────────────────────────────┘
```

**Components:**

1. **Tab bar**
   - 3 tabs: Quiz (active), Progress, Settings
   - Active tab: primary color underline
   - Tap tab → switch view with horizontal slide

2. **Concept card**
   - Left: emoji icon + concept name
   - Right: status text (muted) + play button (▶)
   - Status options: "due today" (orange), "X new notes" (blue), "X days ago" (gray)
   - Hover: subtle background highlight
   - Tap anywhere on card → start quiz for that concept

3. **New concept suggestion card**
   - Highlighted border (dashed, primary color)
   - Title + subtitle explaining the suggestion
   - Two buttons: Add (primary, small) + Skip (secondary, small)
   - Tap Add → card animates up to join concept list
   - Tap Skip → card fades out and collapses

4. **"Quiz me on..." input**
   - Placeholder: "Quiz me on..."
   - Semantic search input (not keyword filter)
   - Tap → focus with cursor, keyboard appears
   - User types natural language query (e.g., "agentic app development")
   - Enter → AI searches vault, transitions to Topic Discovery (2.2)

5. **Progress summary bar**
   - Streak icon + count + mastery percentage
   - Tap "View Progress" → switch to Progress tab

**Interactions:**
- Pull down → refresh concept suggestions
- Concept cards can be reordered via drag (future)

---

## Screen 2.2: "Quiz me on..." Flow

### 2.2.1 Searching State

```
┌─────────────────────────────────────────┐
│  [Quiz]  [Progress]  [Settings]         │
├─────────────────────────────────────────┤
│                                         │
│  🔍 Searching for notes about           │
│     "agentic app development"...        │
│                                         │
│  ━━━━━━━━━━━━━○○○○○                     │
│                                         │
│  [Cancel]                               │
│                                         │
└─────────────────────────────────────────┘
```

**Behavior:**
- Progress bar animates (indeterminate, 1.5s loop)
- User's query shown in quotes
- Cancel returns to Home
- Duration: 1-3 seconds
- Auto-transitions to 2.2.2 or 2.2.3 when complete

### 2.2.2 Topic Discovery (Notes Found)

```
┌─────────────────────────────────────────┐
│  [Quiz]  [Progress]  [Settings]         │
├─────────────────────────────────────────┤
│                                         │
│  Found 8 notes about                    │
│  "agentic app development"              │
│                                         │
│  ─────────────────────────────────────  │
│                                         │
│  Suggested concept name:                │
│  ┌─────────────────────────────────┐   │
│  │ Agentic AI Development          │   │
│  └─────────────────────────────────┘   │
│  (tap to edit)                          │
│                                         │
│  📄 Notes included:                     │
│     • claude-agent-sdk.md               │
│     • ai-agents-overview.md             │
│     • building-with-llms.md             │
│     + 5 more                            │
│                                         │
│  ─────────────────────────────────────  │
│                                         │
│  [⚡ Quick Quiz]  [📌 Create Concept]   │
│                                         │
│  [← Back]                               │
│                                         │
└─────────────────────────────────────────┘
```

**Components:**

1. **Header**
   - Note count + user's original query
   - Success state indicator (subtle green tint optional)

2. **Concept name input**
   - Pre-filled with AI-suggested name
   - Editable text field
   - Tap → focus, keyboard appears, user can rename
   - Hint text below: "(tap to edit)"

3. **Notes list**
   - Shows first 3 note filenames
   - "+ X more" for additional notes
   - Tap note → opens in Obsidian editor (optional for v1)
   - Tap "+ X more" → expands full list

4. **Action buttons**
   - **Quick Quiz** (primary, left): Start quiz immediately, no tracking
   - **Create Concept** (secondary, right): Save to tracked list, then start quiz
   - Both buttons same size, side by side

5. **Back button**
   - Text link, left-aligned
   - Returns to Home screen

**Interactions:**
- Quick Quiz → transition directly to Quiz Flow (Screen 3)
- Create Concept → animate concept card flying to home, then start Quiz Flow
- Back → slide back to Home

### 2.2.3 No Notes Found

```
┌─────────────────────────────────────────┐
│  [Quiz]  [Progress]  [Settings]         │
├─────────────────────────────────────────┤
│                                         │
│  ⚠️ No notes found                      │
│                                         │
│  We couldn't find notes about           │
│  "quantum physics" in your vault.       │
│                                         │
│  ─────────────────────────────────────  │
│                                         │
│  Try a different search, or explore     │
│  related topics:                        │
│                                         │
│  ┌─────────────┐  ┌─────────────┐       │
│  │ Physics     │  │ Science     │       │
│  │ basics      │  │ notes       │       │
│  └─────────────┘  └─────────────┘       │
│                                         │
│  ─────────────────────────────────────  │
│                                         │
│  🔍 [Try another search...]             │
│                                         │
│  [← Back to Home]                       │
│                                         │
└─────────────────────────────────────────┘
```

**Components:**

1. **Warning header**
   - Warning icon (⚠️) + "No notes found"
   - User's query shown in quotes
   - Subtle yellow/orange background tint

2. **Explanation text**
   - Friendly message explaining the result
   - 1-2 sentences

3. **Related topic chips**
   - AI-suggested alternative topics from vault
   - Pill-style buttons, 2 per row max
   - Tap chip → restart flow with that topic as query

4. **Search input**
   - Same as home screen input
   - Pre-focused for easy retry

5. **Back button**
   - Returns to Home screen

**Interactions:**
- Tap related topic → transition to Searching (2.2.1) with new query
- Enter in search input → transition to Searching (2.2.1)
- Back → slide back to Home

---

## Screen 3: Quiz Flow

### 3.1 Quiz Question (Multiple Choice)

```
┌─────────────────────────────────────────┐
│  Question 3 of 10              [Golf]   │
│  ━━━━━━━━━○○○○○○○○                      │
├─────────────────────────────────────────┤
│                                         │
│  What's the key to maintaining tempo    │
│  during a golf swing?                   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ ○  Fast backswing, slow         │   │
│  │    downswing                    │   │
│  └─────────────────────────────────┘   │
│  ┌─────────────────────────────────┐   │
│  │ ○  Count "1-2-3" rhythm         │   │
│  └─────────────────────────────────┘   │
│  ┌─────────────────────────────────┐   │
│  │ ○  Keep lower body stable       │   │
│  └─────────────────────────────────┘   │
│  ┌─────────────────────────────────┐   │
│  │ ○  Grip pressure stays constant │   │
│  └─────────────────────────────────┘   │
│                                         │
│  [Submit Answer]                        │
│                                         │
├─────────────────────────────────────────┤
│  [Skip]  [I've mastered this ✓]  [🚩]   │
└─────────────────────────────────────────┘
```

**Components:**

1. **Header**
   - Question counter: "Question X of Y"
   - Concept badge (right): shows current concept
   - Progress bar: filled segments = answered, empty = remaining

2. **Question text**
   - Large, readable font
   - May span 2-4 lines

3. **Answer options (multiple choice)**
   - Radio button style cards
   - Unselected: outlined border
   - Selected: filled background with checkmark icon replacing radio
   - Tap option → select it, deselect others

4. **Submit button**
   - Disabled until an option is selected
   - Enabled: primary color
   - Tap → transition to 3.2 (Feedback)

5. **Bottom action bar**
   - Skip: secondary text button, left-aligned
   - "I've mastered this": text button with checkmark
   - Flag icon (🚩): icon-only button, right-aligned
   - Tap Skip → go to next question, record as skipped
   - Tap "I've mastered this" → mark concept mastered, go to next
   - Tap Flag → show flag menu (3.5)

**Transitions:**
- Question slides in from right
- Options fade in with 75ms stagger

### 3.2 Quiz Question (True/False)

```
┌─────────────────────────────────────────┐
│  Question 5 of 10             [React]   │
│  ━━━━━━━━━━━━━○○○○○                     │
├─────────────────────────────────────────┤
│                                         │
│  React hooks can only be called         │
│  at the top level of a component.       │
│                                         │
│  ┌───────────────┐ ┌───────────────┐   │
│  │               │ │               │   │
│  │     True      │ │     False     │   │
│  │               │ │               │   │
│  └───────────────┘ └───────────────┘   │
│                                         │
│  [Submit Answer]                        │
│                                         │
├─────────────────────────────────────────┤
│  [Skip]  [I've mastered this ✓]  [🚩]   │
└─────────────────────────────────────────┘
```

**Components:**
- Two large buttons side by side (50% width each)
- Selected: filled background
- Tap either → select, enable Submit

### 3.3 Quiz Question (Fill in Blank)

```
┌─────────────────────────────────────────┐
│  Question 7 of 10              [Golf]   │
│  ━━━━━━━━━━━━━━━○○○                     │
├─────────────────────────────────────────┤
│                                         │
│  Complete the sentence:                 │
│                                         │
│  The three phases of a golf swing are   │
│  address, __________, and              │
│  follow-through.                        │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │                                 │   │
│  └─────────────────────────────────┘   │
│                                         │
│  [Submit Answer]                        │
│                                         │
├─────────────────────────────────────────┤
│  [Skip]  [I've mastered this ✓]  [🚩]   │
└─────────────────────────────────────────┘
```

**Components:**
- Question text with blank indicator (underscores)
- Single-line text input
- Placeholder: none (empty field)
- Tap input → focus, keyboard appears
- Submit enabled when input is not empty

### 3.4 Quiz Question (Free-form)

```
┌─────────────────────────────────────────┐
│  Question 9 of 10                [PM]   │
│  ━━━━━━━━━━━━━━━━━━━○                   │
├─────────────────────────────────────────┤
│                                         │
│  Explain in your own words:             │
│                                         │
│  Why is it important to validate        │
│  assumptions before building a          │
│  product?                               │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │                                 │   │
│  │                                 │   │
│  │                                 │   │
│  │                                 │   │
│  └─────────────────────────────────┘   │
│                                         │
│  [Submit Answer]                        │
│                                         │
├─────────────────────────────────────────┤
│  [Skip]  [I've mastered this ✓]  [🚩]   │
└─────────────────────────────────────────┘
```

**Components:**
- Multi-line text area (4 lines visible, expandable)
- Character count optional (bottom right of textarea)
- Submit enabled when input is not empty

### 3.5 Flag Question Menu (Overlay)

```
┌─────────────────────────────────────────┐
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  Flag this question              │   │
│  ├─────────────────────────────────┤   │
│  │  ○ Question is unclear           │   │
│  │  ○ Answer seems wrong            │   │
│  │  ○ Too easy                      │   │
│  │  ○ Not relevant                  │   │
│  │  ○ Other                         │   │
│  ├─────────────────────────────────┤   │
│  │  [Cancel]           [Submit]     │   │
│  └─────────────────────────────────┘   │
│                                         │
└─────────────────────────────────────────┘
```

**Behavior:**
- Modal overlay with backdrop blur
- Select one reason → Submit becomes enabled
- Submit → close modal, record feedback, continue quiz
- Cancel → close modal, return to question

---

## Screen 4: Answer Feedback

### 4.1 Correct Answer

```
┌─────────────────────────────────────────┐
│  Question 3 of 10              [Golf]   │
│  ━━━━━━━━━○○○○○○○○                      │
├─────────────────────────────────────────┤
│                                         │
│  ✅ Correct!                            │
│                                         │
│  The "1-2-3" rhythm helps maintain      │
│  consistent tempo throughout the        │
│  swing, preventing rushed movements.    │
│                                         │
│  ─────────────────────────────────────  │
│                                         │
│  📄 Source: golf-lessons-2024.md        │
│                                         │
│  [Next Question →]                      │
│                                         │
└─────────────────────────────────────────┘
```

**Components:**

1. **Success indicator**
   - Large green checkmark icon + "Correct!" text
   - Background: subtle green tint (5% opacity)

2. **Explanation**
   - AI-generated explanation of the correct answer
   - 2-4 sentences

3. **Source link**
   - File icon + note filename
   - Tap → opens the note in Obsidian main editor

4. **Next button**
   - Primary button, full width
   - Tap → slide to next question

**Animation:**
- Checkmark bounces in (scale 0→1.2→1)
- Confetti particles (subtle, 5-8 particles) for correct answers

### 4.2 Incorrect Answer

```
┌─────────────────────────────────────────┐
│  Question 3 of 10              [Golf]   │
│  ━━━━━━━━━○○○○○○○○                      │
├─────────────────────────────────────────┤
│                                         │
│  ❌ Not quite                           │
│                                         │
│  Your answer: Keep lower body stable    │
│                                         │
│  Correct answer: Count "1-2-3" rhythm   │
│                                         │
│  The "1-2-3" rhythm helps maintain      │
│  consistent tempo throughout the        │
│  swing, preventing rushed movements.    │
│                                         │
│  ─────────────────────────────────────  │
│                                         │
│  📄 Source: golf-lessons-2024.md        │
│                                         │
│  [Next Question →]                      │
│                                         │
└─────────────────────────────────────────┘
```

**Components:**
- Red X icon + "Not quite" text
- User's answer shown (struck through or muted)
- Correct answer highlighted (green text or background)
- Same explanation and source link

**Animation:**
- X icon shakes horizontally (subtle)

### 4.3 Free-form Evaluation

```
┌─────────────────────────────────────────┐
│  Question 9 of 10                [PM]   │
│  ━━━━━━━━━━━━━━━━━━━○                   │
├─────────────────────────────────────────┤
│                                         │
│  ✅ Good answer!                        │
│                                         │
│  Your answer:                           │
│  "Validating assumptions early saves    │
│  time and resources by ensuring you're  │
│  building something users actually      │
│  want."                                 │
│                                         │
│  Key points you covered:                │
│  ✓ Saves time and resources             │
│  ✓ User-centric validation              │
│                                         │
│  You could also mention:                │
│  • Reduces risk of building wrong thing │
│  • Faster iteration cycles              │
│                                         │
│  ─────────────────────────────────────  │
│                                         │
│  How did you do?                        │
│  [😕 Struggled] [😐 Okay] [😊 Nailed it]│
│                                         │
│  📄 Source: pm-principles.md            │
│                                         │
│  [Next Question →]                      │
│                                         │
└─────────────────────────────────────────┘
```

**Components:**
- AI evaluation with checkmarks for covered points
- Suggestions for improvement
- Self-assessment buttons (3 options)
- Tap self-assessment → record, then allow Next

---

## Screen 5: Quiz Complete

```
┌─────────────────────────────────────────┐
│  [Quiz]  [Progress]  [Settings]         │
├─────────────────────────────────────────┤
│                                         │
│  🎉 Quiz Complete!                      │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │         Golf                    │   │
│  │                                 │   │
│  │          7/10                   │   │
│  │         ━━━━━━━○○○              │   │
│  │                                 │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ✅ Solid on:                           │
│     • Putting mechanics                 │
│     • Club selection                    │
│     • Grip fundamentals                 │
│                                         │
│  🔄 Needs review:                       │
│     • Swing tempo                       │
│     • Bunker shots                      │
│                                         │
│  ─────────────────────────────────────  │
│                                         │
│  [📄 View Notes]                        │
│                                         │
│  [🔄 Quiz Again]    [🎯 New Topic]      │
│                                         │
└─────────────────────────────────────────┘
```

**Components:**

1. **Score card**
   - Large score display (X/Y)
   - Visual progress bar
   - Concept name at top

2. **Performance breakdown**
   - "Solid on" section: green checkmark, bullet list
   - "Needs review" section: orange refresh icon, bullet list

3. **Action buttons**
   - View Notes: secondary, full width — opens list of source notes
   - Quiz Again: primary, half width — restarts same concept
   - New Topic: secondary, half width — returns to Home

**Animation:**
- Score number counts up from 0 to final
- Celebration animation for 8+ correct (confetti burst)

---

## Screen 6: Progress Tab

```
┌─────────────────────────────────────────┐
│  [Quiz]  [Progress]  [Settings]         │
├─────────────────────────────────────────┤
│                                         │
│  📊 Your Progress                       │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ 🔥 12-day streak                │   │
│  │ 73% overall mastery             │   │
│  └─────────────────────────────────┘   │
│                                         │
│  Activity (last 30 days)                │
│  ┌─────────────────────────────────┐   │
│  │ ▁▂▃▁▅▂▁▃▄▂▅▆▃▂▁▄▅▃▂▁▃▄▅▆▇▅▄▃▂▅ │   │
│  │ Nov                         Dec │   │
│  └─────────────────────────────────┘   │
│                                         │
│  Concepts                               │
│                                         │
│  🟢 React Hooks                         │
│     Mastered · reviewed 2 days ago      │
│                                         │
│  🟡 Golf Swing                          │
│     Learning · due today                │
│                                         │
│  🟡 TypeScript Generics                 │
│     Learning · due in 3 days            │
│                                         │
│  🔴 System Design                       │
│     Needs work · struggling             │
│                                         │
│  ⚪ Cooking basics                      │
│     Archived                            │
│                                         │
└─────────────────────────────────────────┘
```

**Components:**

1. **Stats card**
   - Streak with fire emoji
   - Mastery percentage

2. **Activity graph**
   - GitHub-style contribution graph (mini bar chart)
   - 30 days of data
   - Height = quiz volume that day
   - Hover/tap bar → tooltip with date and count

3. **Concept list**
   - Status indicator: 🟢 mastered, 🟡 learning, 🔴 needs work, ⚪ archived
   - Concept name (bold)
   - Status + timing info (muted)
   - Tap concept → expand to show options (Quiz, Archive, Rename)

**Interactions:**
- Scroll vertical for long concept lists
- Swipe left on concept → reveal Archive button
- Tap concept → expand inline with action buttons

---

## Screen 7: Settings Tab

```
┌─────────────────────────────────────────┐
│  [Quiz]  [Progress]  [Settings]         │
├─────────────────────────────────────────┤
│                                         │
│  ⚙️ Settings                            │
│                                         │
│  Quiz                                   │
│  ─────────────────────────────────────  │
│                                         │
│  Questions per session                  │
│  [5] [10] [15] [20]                     │
│       ●                                 │
│                                         │
│  Quiz formats                           │
│  [✓] Multiple choice                    │
│  [✓] True/False                         │
│  [✓] Fill in blank                      │
│  [✓] Free-form                          │
│                                         │
│  Notifications                          │
│  ─────────────────────────────────────  │
│                                         │
│  Review reminders          [━━━○]  On   │
│                                         │
│  Reminder cadence                       │
│  [Daily]  [Every 2 days]  [Weekly]      │
│     ●                                   │
│                                         │
│  Advanced                               │
│  ─────────────────────────────────────  │
│                                         │
│  Semantic indexing         [━━━○]  Auto │
│                                         │
│  [Rebuild concept index]                │
│                                         │
│  [Reset all progress]                   │
│                                         │
└─────────────────────────────────────────┘
```

**Components:**

1. **Segmented controls** (Questions per session, Cadence)
   - Pill-style buttons
   - Selected = filled background
   - Tap option → update selection

2. **Checkboxes** (Quiz formats)
   - Standard checkboxes
   - At least one must remain checked

3. **Toggle switches**
   - iOS-style toggle
   - Tap → animate switch, update setting

4. **Danger buttons** (Reset)
   - Red text
   - Tap → confirmation dialog

---

## Micro-interactions

### Loading States
- Skeleton screens for concept cards while loading
- Spinner for quiz generation (after search)
- Progress bar for vault analysis

### Transitions
- Tab switch: horizontal slide (200ms ease-out)
- Question transition: slide left (150ms)
- Modal open: fade + scale up from 95% (200ms)
- Modal close: fade + scale down (150ms)

### Feedback
- Button tap: subtle scale down (95%) + haptic
- Correct answer: green flash + confetti
- Incorrect answer: red flash + shake
- Card selection: border glow animation

### Empty States
- No concepts: illustration + "Add your first concept" CTA
- No quizzes due: "You're all caught up!" with celebration illustration
- "Quiz me on..." no results: "No notes found" with related topic suggestions (see Screen 2.2.3)

---

## Color Tokens

| Token | Usage |
|-------|-------|
| `primary` | Buttons, active tabs, checkmarks |
| `success` | Correct answers, mastered status |
| `warning` | Due today, learning status |
| `error` | Incorrect answers, needs work status |
| `muted` | Secondary text, disabled states |
| `background` | Panel background |
| `card` | Card backgrounds |
| `border` | Dividers, card borders |

---

## Responsive Behavior

- Panel width: 320px default, 280px minimum
- Cards scale horizontally to fill width
- Text truncates with ellipsis if too long
- Quiz questions may scroll if content exceeds viewport
