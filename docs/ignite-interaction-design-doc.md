# Ignite UI Design Document

> For AI prototype builders (V0, Lovable) — Obsidian Plugin Side Panel

---

## Design Overview

### Product Context

Ignite is an Obsidian plugin that transforms passive note collections into goal-driven action systems. Users create goals, AI matches relevant notes from their vault, and they engage with knowledge through focused actions like Q&A.

### Interaction Model

- **Primary UI**: Right-side panel (400px width, full height)
- **Settings**: Modal overlay
- **Notifications**: Toast messages (bottom-right)

### Visual Style: Rich & Engaging

- **Colors**:
  - Primary: `#FF6B35` (ignite orange — energy, action)
  - Secondary: `#4ECDC4` (teal — calm, knowledge)
  - Background: `#1E1E2E` (dark, Obsidian-native)
  - Surface: `#2A2A3C` (elevated cards)
  - Text Primary: `#FFFFFF`
  - Text Secondary: `#A0A0B0`
  - Success: `#4ADE80`
  - Warning: `#FBBF24`
- **Typography**: System font stack, Inter fallback
- **Radius**: 12px for cards, 8px for buttons, 20px for pills
- **Shadows**: Subtle elevation with colored glow on interactive elements
- **Animations**: Smooth 200ms transitions, spring physics for modals

---

## Component Library

### Button Variants

```
Primary: Orange fill, white text, subtle glow on hover
Secondary: Transparent, orange border, orange text
Ghost: Transparent, white text, hover shows surface color
Icon: 32x32, rounded, ghost style
```

### Cards

```
Goal Card: Surface color, 12px radius, 16px padding
  - Left accent bar (4px) showing goal status color
  - Hover: slight lift + glow

Note Card: Compact, 8px padding
  - Checkbox for selection
  - Note title + excerpt
  - Tag pills
```

### Input Fields

```
Text Input: Surface background, 1px border, focus glow
Text Area: Same, auto-resize
Search: With search icon, clear button
```

### Progress Indicators

```
Milestone Progress Bar: Shows completed/total milestones
  - Hidden when goal has no milestones
  - Fill color: Primary orange
  - Track color: Surface color
Deadline Pill: Color-coded (green > 7 days, yellow 3-7, red < 3)
Note Count Badge: Circular, surface color
Activity Dot: Pulsing animation for recent activity
```

### AI Elements

```
AI Suggestion Card: Dashed border, gradient background
AI Typing Indicator: Three bouncing dots
AI Avatar: Small flame icon with glow
```

---

## Screen Specifications

---

## 1. First-Time Experience (Onboarding)

### Screen 1.1: Welcome

**Purpose**: Introduce the goal-oriented philosophy

```
┌─────────────────────────────────────┐
│                                     │
│         🔥 (large flame icon)       │
│                                     │
│           Welcome to Ignite         │
│                                     │
│    "Your notes aren't a library.    │
│     They're a toolkit waiting       │
│       for a purpose."               │
│                                     │
│   ┌─────────────────────────────┐   │
│   │    Create your first goal   │   │
│   └─────────────────────────────┘   │
│                                     │
│        Skip for now (ghost link)    │
│                                     │
└─────────────────────────────────────┘
```

**Interactions**:

- "Create your first goal" → Navigates to Brainstorm Agent
- "Skip for now" → Shows empty Home screen with CTA

---

## 2. Home Screen (Goal List)

### Screen 2.1: Empty State

**Purpose**: Encourage first goal creation

```
┌─────────────────────────────────────┐
│  🔥 Ignite                    ⚙️    │
├─────────────────────────────────────┤
│                                     │
│                                     │
│      ┌───────────────────────┐      │
│      │   📋 (illustration)   │      │
│      │                       │      │
│      │   No active goals     │      │
│      │                       │      │
│      │   What are you trying │      │
│      │   to accomplish?      │      │
│      └───────────────────────┘      │
│                                     │
│   ┌─────────────────────────────┐   │
│   │    + Create a goal          │   │
│   └─────────────────────────────┘   │
│                                     │
└─────────────────────────────────────┘
```

### Screen 2.2: With Goals

**Purpose**: Quick overview and navigation to goals

```
┌─────────────────────────────────────┐
│  🔥 Ignite                    ⚙️    │
├─────────────────────────────────────┤
│                                     │
│  Active Goals (2)                   │
│                                     │
│  ┌─────────────────────────────────┐│
│  │▌ Build portfolio website       ││
│  │  ━━━━━━━━░░░░  3/5 milestones  ││
│  │  📄 12 notes  ⏰ 5 days left   ││
│  └─────────────────────────────────┘│
│                                     │
│  ┌─────────────────────────────────┐│
│  │▌ System design interviews      ││
│  │  ━━━━░░░░░░░░  1/4 milestones  ││
│  │  📄 24 notes  ⏰ 14 days left  ││
│  └─────────────────────────────────┘│
│                                     │
│  ─────────────────────────────────  │
│                                     │
│  Completed (1)              Show ▼  │
│                                     │
│  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐│
│  │ ✓ Learn TypeScript basics     ││
│  │   Completed Dec 15            ││
│  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘│
│                                     │
│         ┌─────────────────┐         │
│         │  + New Goal     │         │
│         └─────────────────┘         │
│                                     │
└─────────────────────────────────────┘
```

**Goal Card States**:

- Active: Orange left accent, full opacity
- Approaching deadline (< 3 days): Red left accent, warning icon
- Completed: Dashed border, muted colors, checkmark

**Interactions**:

- Click goal card → Navigate to Goal Detail
- Click "+ New Goal" → Open Brainstorm Agent
- Click ⚙️ → Open Settings modal
- "Show ▼" → Expand/collapse completed goals section

---

## 3. Goal Creation (Brainstorm Agent) — Hybrid Flow

### Screen 3.1: Chat + Form Layout

**Purpose**: Conversational goal refinement with real-time form population

```
┌─────────────────────────────────────┐
│  ← Back          Creating Goal      │
├─────────────────────────────────────┤
│                                     │
│  ┌─────────────────────────────────┐│
│  │ GOAL PREVIEW              Live ││
│  │ ─────────────────────────────  ││
│  │ Name: Build portfolio website  ││
│  │ Description: Create a personal ││
│  │ site to showcase my React...   ││
│  │ Deadline: Jan 15, 2025         ││
│  │                                ││
│  │ Milestones:                    ││
│  │ ○ Research portfolio examples  ││
│  │ ○ Design layout and structure  ││
│  │ ○ Build core React components  ││
│  │ ○ Add projects and content     ││
│  │ ○ Deploy and test              ││
│  │                                ││
│  │ [Edit manually]                ││
│  └─────────────────────────────────┘│
│                                     │
│  ───────── Chat ─────────────────── │
│                                     │
│  🔥 What are you trying to          │
│     accomplish? Tell me about       │
│     your goal in your own words.    │
│                                     │
│     ┌─────────────────────────────┐ │
│     │ I want to build a portfolio │ │
│     │ website to land a frontend  │ │
│     │ dev job                     │ │
│     └─────────────────────────────┘ │
│                                 You │
│                                     │
│  🔥 Great! A portfolio site for     │
│     job hunting. What technologies  │
│     are you planning to use?        │
│                                     │
│     I have the form updating as we  │
│     chat ↑                          │
│                                     │
├─────────────────────────────────────┤
│  ┌─────────────────────────────┐    │
│  │ Type your response...       │ ➤  │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
```

**Form Fields** (in Goal Preview):

- Name (required): Auto-populated from chat, editable
- Description (required): AI-generated summary, editable
- Deadline (required): Date picker, AI suggests based on scope

**AI Conversation Flow**:

1. "What are you trying to accomplish?" → Extracts goal name
2. "What will success look like?" → Builds description
3. "When do you want to finish this?" → Sets deadline
4. "Here are some milestones to get you there..." → Suggests 3-5 milestones
5. "Let me suggest some notes..." → Transitions to note assignment

**Interactions**:

- Type message + Enter/click ➤ → Send message
- Click "Edit manually" → Expand form for direct editing
- Click "← Back" → Confirm discard, return to Home
- AI detects completeness → Shows "Create Goal" button

### Screen 3.2: Goal Ready State

**Purpose**: Confirm goal details before proceeding to note assignment

```
┌─────────────────────────────────────┐
│  ← Back          Creating Goal      │
├─────────────────────────────────────┤
│                                     │
│  ┌─────────────────────────────────┐│
│  │ ✨ GOAL READY                  ││
│  │ ─────────────────────────────  ││
│  │ Name: Build portfolio website  ││
│  │                                ││
│  │ Description: Create a modern   ││
│  │ React-based portfolio site     ││
│  │ showcasing 3-4 projects to     ││
│  │ support job applications.      ││
│  │                                ││
│  │ Deadline: Jan 15, 2025         ││
│  │            (18 days from now)  ││
│  │                                ││
│  │ Milestones (5):                ││
│  │ ○ Research portfolio examples  ││
│  │ ○ Design layout and structure  ││
│  │ ○ Build core React components  ││
│  │ ○ Add projects and content     ││
│  │ ○ Deploy and test              ││
│  │                                ││
│  │ [Edit]                         ││
│  └─────────────────────────────────┘│
│                                     │
│  🔥 Looks good! Ready to find       │
│     relevant notes in your vault?   │
│                                     │
│  ┌─────────────────────────────────┐│
│  │  🔍 Find Relevant Notes         ││
│  └─────────────────────────────────┘│
│                                     │
│  Or skip and add notes manually     │
│                                     │
└─────────────────────────────────────┘
```

**Interactions**:

- "Find Relevant Notes" → Proceed to AI Note Assignment
- "skip and add notes manually" → Create goal, go to Goal Detail

---

## 4. AI Note Assignment

### Screen 4.1: Scanning State

**Purpose**: Show progress while AI analyzes vault

```
┌─────────────────────────────────────┐
│  ← Back       Assigning Notes       │
├─────────────────────────────────────┤
│                                     │
│                                     │
│                                     │
│         ┌───────────────────┐       │
│         │                   │       │
│         │   🔍 (animated)   │       │
│         │                   │       │
│         │  Scanning vault   │       │
│         │                   │       │
│         │  234 notes        │       │
│         │  analyzed...      │       │
│         │                   │       │
│         └───────────────────┘       │
│                                     │
│         ████████░░░░  67%           │
│                                     │
│                                     │
│                                     │
└─────────────────────────────────────┘
```

### Screen 4.2: Note Suggestions

**Purpose**: Review and confirm AI-suggested notes

```
┌─────────────────────────────────────┐
│  ← Back       Assigning Notes       │
├─────────────────────────────────────┤
│                                     │
│  For: Build portfolio website       │
│                                     │
│  AI found 12 relevant notes         │
│                                     │
│  ┌─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┐ │
│  │ 🔥 These notes contain info    │ │
│  │ about React, portfolios, and   │ │
│  │ web development that could     │ │
│  │ help with your goal.           │ │
│  └─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┘ │
│                                     │
│  ☑️ All  │  🔍 Search notes         │
│  ─────────────────────────────────  │
│                                     │
│  [✓] React Best Practices      98%  │
│      #react #frontend               │
│      "Component composition..."     │
│                                     │
│  [✓] Portfolio Inspiration     94%  │
│      #design #portfolio             │
│      "Minimalist layouts..."        │
│                                     │
│  [✓] CSS Grid Guide            91%  │
│      #css #layout                   │
│      "Grid template areas..."       │
│                                     │
│  [ ] Webpack Deep Dive         67%  │
│      #bundler #tools                │
│      "Code splitting..."            │
│                                     │
│  ─────────────────────────────────  │
│  + Browse vault for more notes      │
│                                     │
├─────────────────────────────────────┤
│  8 notes selected                   │
│  ┌─────────────────────────────────┐│
│  │      Confirm & Create Goal      ││
│  └─────────────────────────────────┘│
└─────────────────────────────────────┘
```

**Note Card Details**:

- Checkbox: Toggle inclusion
- Title: Note filename
- Relevance %: AI confidence score (sorted high to low)
- Tags: Pill badges
- Excerpt: First line or AI-generated summary

**Interactions**:

- Click checkbox → Toggle note selection
- Click "All" checkbox → Select/deselect all
- Click note row (not checkbox) → Expand to show full excerpt
- Search → Filter notes by title/tags
- "+ Browse vault" → Open file picker modal
- "Confirm & Create Goal" → Create goal, navigate to Goal Detail

---

## 5. Goal Detail Screen

### Screen 5.1: Active Goal

**Purpose**: Central hub for goal engagement

```
┌─────────────────────────────────────┐
│  ← Goals    Build portfolio website │
├─────────────────────────────────────┤
│                                     │
│  ┌─────────────────────────────────┐│
│  │  ⏰ 18 days left   📄 12 notes ││
│  └─────────────────────────────────┘│
│                                     │
│  ═══════════════════════════════    │
│                                     │
│  MILESTONES (3/5)            + Add  │
│  ━━━━━━━━━━━━░░░░░░  60%            │
│                                     │
│  [✓] Research portfolio examples    │
│  [✓] Design layout and structure    │
│  [✓] Build core React components    │
│  [ ] Add projects and content       │
│  [ ] Deploy and test                │
│                                     │
│  ═══════════════════════════════    │
│                                     │
│  ACTIONS                            │
│                                     │
│  ┌─────────────────────────────────┐│
│  │  💬 Discuss          ▼ Explore ││
│  │  Chat with different modes     ││
│  │                     Start →     ││
│  └─────────────────────────────────┘│
│                                     │
│  ┌─────────────────────────────────┐│
│  │  🔍 Research                   ││
│  │  Fill knowledge gaps           ││
│  │                     Start →     ││
│  └─────────────────────────────────┘│
│                                     │
│  ┌─────────────────────────────────┐│
│  │  ✏️ Draft                       ││
│  │  Create new documents          ││
│  │                     Start →     ││
│  └─────────────────────────────────┘│
│                                     │
│  ┌─────────────────────────────────┐│
│  │  ❓ Q&A                         ││
│  │  Test your understanding       ││
│  │                     Start →     ││
│  └─────────────────────────────────┘│
│                                     │
│  ═══════════════════════════════    │
│                                     │
│  KNOWLEDGE BASE                     │
│                                     │
│  ┌─────────────────────────────────┐│
│  │  📄 Notes (12)              →  ││
│  └─────────────────────────────────┘│
│  ┌─────────────────────────────────┐│
│  │  💬 Conversations (3)       →  ││
│  └─────────────────────────────────┘│
│  ┌─────────────────────────────────┐│
│  │  🔍 Research (1)            →  ││
│  └─────────────────────────────────┘│
│  ┌─────────────────────────────────┐│
│  │  ✏️ Drafts (2)               →  ││
│  └─────────────────────────────────┘│
│                                     │
│  ═══════════════════════════════    │
│                                     │
│  ACTIVITY                           │
│  • Discussed React patterns (2h)    │
│  • Research: CSS animations (1d)    │
│  • Q&A: 5 questions (3d)            │
│                                     │
├─────────────────────────────────────┤
│  ┌─────────────────┐ ┌────────────┐ │
│  │  ✓ Complete     │ │  ⋯ More   │ │
│  └─────────────────┘ └────────────┘ │
└─────────────────────────────────────┘
```

**Sections**:

1. **Header Stats**: Deadline countdown, total note count
2. **Milestones**: Checkable milestone list with progress bar (hidden if no milestones)
3. **Actions**: Four engagement actions with mode selector on Discuss
4. **Knowledge Base**: Categorized view of all goal-related content
5. **Activity**: Recent engagement history

**Knowledge Base Categories**:

- **Notes**: Original vault notes linked to the goal
- **Conversations**: Auto-saved discussion threads (clickable to resume)
- **Research**: AI-generated research notes
- **Drafts**: AI-generated documents

**Interactions**:

- Click milestone checkbox → Toggle completion (updates progress bar)
- "+ Add" on Milestones → Add new milestone inline
- Long-press/right-click milestone → Edit or delete
- Click mode dropdown on Discuss → Select Explore/Teach Me/Challenge
- "Start →" on any action → Navigate to that action flow
- Click Knowledge Base category → Expand to show items
- Click conversation → Open resume conversation flow
- Click note/research/draft → Open in Obsidian
- "✓ Complete" → Open completion confirmation
- "⋯ More" → Menu: Edit goal, Delete goal

### Screen 5.2: Note Management

**Purpose**: Add/remove notes from goal

```
┌─────────────────────────────────────┐
│  ✕ Close         Manage Notes       │
├─────────────────────────────────────┤
│                                     │
│  🔍 Search your vault...            │
│                                     │
│  ─────────────────────────────────  │
│                                     │
│  ASSIGNED (12)                      │
│                                     │
│  [✓] React Best Practices       ✕   │
│  [✓] Portfolio Inspiration      ✕   │
│  [✓] CSS Grid Guide             ✕   │
│                                     │
│  ─────────────────────────────────  │
│                                     │
│  SUGGESTIONS                        │
│                                     │
│  [ ] Deployment Strategies     78%  │
│  [ ] Next.js Tutorial          72%  │
│                                     │
│  ─────────────────────────────────  │
│                                     │
│  ALL VAULT NOTES                    │
│                                     │
│  [ ] Daily Note 2024-12-28          │
│  [ ] Meeting Notes - Team           │
│  [ ] Random Thoughts                │
│                                     │
├─────────────────────────────────────┤
│  ┌─────────────────────────────────┐│
│  │           Save Changes          ││
│  └─────────────────────────────────┘│
└─────────────────────────────────────┘
```

---

## 6. Discuss Action Flow

### Screen 6.1: New Conversation Start

**Purpose**: Start a new discussion with mode selection

```
┌─────────────────────────────────────┐
│  ← Goal           Discuss           │
├─────────────────────────────────────┤
│                                     │
│  Mode:                              │
│  ┌──────────┐┌──────────┐┌────────┐│
│  │● Explore ││ Teach Me ││Challenge││
│  └──────────┘└──────────┘└────────┘│
│                                     │
│  ┌─────────────────────────────────┐│
│  │ 🔥 I can help you explore your ││
│  │ knowledge about building your  ││
│  │ portfolio website. Ask me      ││
│  │ anything!                      ││
│  │                                ││
│  │ I'll draw from your 12 notes   ││
│  │ plus my own knowledge.         ││
│  └─────────────────────────────────┘│
│                                     │
│  Suggested questions:               │
│  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐│
│  │ What React patterns should I  ││
│  │ use for my portfolio?         ││
│  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘│
│  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐│
│  │ How should I structure my     ││
│  │ project sections?             ││
│  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘│
│                                     │
│  ─────────────────────────────────  │
│  Previous conversations:            │
│  • React patterns (Dec 28)     →    │
│  • CSS approaches (Dec 26)     →    │
│                                     │
├─────────────────────────────────────┤
│  ┌─────────────────────────────┐    │
│  │ Ask about your project...   │ ➤  │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
```

**Mode Descriptions**:

- **Explore** (default): Open-ended discussion, "yes and" energy for brainstorming
- **Teach Me**: Explains concepts simply, assumes beginner level, patient and thorough
- **Challenge**: Devil's advocate that pushes back on assumptions, finds holes in thinking

### Screen 6.2: Active Discussion

**Purpose**: Ongoing conversation with source attribution

```
┌─────────────────────────────────────┐
│  ← Goal      Discuss Project        │
├─────────────────────────────────────┤
│                                     │
│  ┌─────────────────────────────────┐│
│  │ What React patterns should I   ││
│  │ use for my portfolio?          ││
│  └─────────────────────────────────┘│
│                                 You │
│                                     │
│  🔥 Based on your notes and best    │
│     practices, here are the key     │
│     patterns for a portfolio:       │
│                                     │
│     1. **Component Composition**    │
│        Break your portfolio into    │
│        reusable sections: Header,   │
│        ProjectCard, SkillBadge...   │
│                                     │
│     2. **Custom Hooks**             │
│        Use hooks like useScrollTo   │
│        for smooth navigation and    │
│        useMediaQuery for...         │
│                                     │
│     3. **Lazy Loading**             │
│        Load project images and      │
│        demos on demand to keep...   │
│                                     │
│     ┌───────────────────────────┐   │
│     │ 📄 Sources                │   │
│     │ • React Best Practices    │   │
│     │ • Portfolio Inspiration   │   │
│     └───────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────────┐│
│  │ Should I use CSS-in-JS or      ││
│  │ regular CSS for styling?       ││
│  └─────────────────────────────────┘│
│                                 You │
│                                     │
│  🔥 Great question! Your notes      │
│     mention both approaches...      │
│                                     │
│  (scrollable conversation)          │
│                                     │
├─────────────────────────────────────┤
│  ┌─────────────────────────────┐    │
│  │ Ask follow-up...            │ ➤  │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
```

### Screen 6.3: Off-Topic Redirect

**Purpose**: Keep conversation focused on goal

```
┌─────────────────────────────────────┐
│  ← Goal      Discuss Project        │
├─────────────────────────────────────┤
│                                     │
│  ... (previous messages)            │
│                                     │
│  ┌─────────────────────────────────┐│
│  │ What's the best restaurant     ││
│  │ in San Francisco?              ││
│  └─────────────────────────────────┘│
│                                 You │
│                                     │
│  🔥 That's outside my expertise     │
│     for this goal! 😊               │
│                                     │
│     I'm here to help with your      │
│     portfolio website project.      │
│                                     │
│     Some things I can help with:    │
│     • React implementation advice   │
│     • Portfolio structure decisions │
│     • CSS and styling approaches    │
│     • Deployment strategies         │
│                                     │
│     What would you like to explore? │
│                                     │
├─────────────────────────────────────┤
│  ┌─────────────────────────────┐    │
│  │ Ask about your project...   │ ➤  │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
```

### Screen 6.4: Expanding on Notes

**Purpose**: Deep dive into specific note content

````
┌─────────────────────────────────────┐
│  ← Goal      Discuss Project        │
├─────────────────────────────────────┤
│                                     │
│  ┌─────────────────────────────────┐│
│  │ Tell me more about the CSS     ││
│  │ Grid stuff in my notes         ││
│  └─────────────────────────────────┘│
│                                 You │
│                                     │
│  🔥 Your "CSS Grid Guide" note has  │
│     some great content! Here's a    │
│     summary relevant to your        │
│     portfolio:                      │
│                                     │
│     **Grid Template Areas**         │
│     Perfect for your portfolio      │
│     layout. You can define named    │
│     areas like:                     │
│     ```                             │
│     grid-template-areas:            │
│       "header header"               │
│       "sidebar main"                │
│       "footer footer"               │
│     ```                             │
│                                     │
│     **Your Note Also Mentions:**    │
│     • Auto-fit for responsive       │
│       project grids                 │
│     • Minmax for flexible sizing    │
│     • Gap property for spacing      │
│                                     │
│     ┌───────────────────────────┐   │
│     │ 📄 Open: CSS Grid Guide   │   │
│     └───────────────────────────┘   │
│                                     │
│     Want me to explain how to       │
│     apply any of these to your      │
│     specific portfolio sections?    │
│                                     │
├─────────────────────────────────────┤
│  ┌─────────────────────────────┐    │
│  │ Ask follow-up...            │ ➤  │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
````

**Key Features**:

- **Mode Selection**: Choose Explore, Teach Me, or Challenge mode for different interaction styles
- **Source Attribution**: Expandable "Sources" section shows which notes informed the answer
- **Note Links**: Click to open referenced note in Obsidian
- **Suggested Questions**: AI-generated prompts based on goal and notes
- **Off-Topic Handling**: Friendly redirect keeping focus on goal
- **Combined Knowledge**: AI uses notes + its own training for comprehensive answers
- **Auto-Save**: Conversations automatically save when navigating away
- **Resume Conversations**: Previous conversations accessible from Knowledge Base

**Auto-Save Behavior**:

- Conversations auto-save to `ignite/[goal]/conversations/[topic].md`
- AI auto-generates topic name from conversation content (e.g., "React patterns", "CSS approaches")
- Topic name generated after first meaningful exchange
- No user action required to save

**Interactions**:

- Click mode pill → Switch conversation mode
- Type message + Enter/click ➤ → Send message
- Click suggested question pill → Auto-send that question
- Click note in Sources → Open in Obsidian
- Click previous conversation → Resume that conversation
- "← Goal" → Return to Goal Detail (conversation auto-saved)

### Screen 6.5: Resume Conversation

**Purpose**: Continue a previous discussion thread

```
┌─────────────────────────────────────┐
│  ← Goal      React patterns         │
├─────────────────────────────────────┤
│                                     │
│  Mode: Explore           Dec 28     │
│                                     │
│  ┌─────────────────────────────────┐│
│  │ What React patterns should I   ││
│  │ use for my portfolio?          ││
│  └─────────────────────────────────┘│
│                                 You │
│                                     │
│  🔥 Based on your notes and best    │
│     practices, here are the key     │
│     patterns for a portfolio:       │
│     ...                             │
│                                     │
│  ┌─────────────────────────────────┐│
│  │ Should I use CSS-in-JS or      ││
│  │ regular CSS for styling?       ││
│  └─────────────────────────────────┘│
│                                 You │
│                                     │
│  🔥 Great question! Your notes      │
│     mention both approaches...      │
│                                     │
│  ─────────── Resumed ─────────────  │
│                                     │
│  (continue conversation here)       │
│                                     │
├─────────────────────────────────────┤
│  ┌─────────────────────────────┐    │
│  │ Continue discussion...     │ ➤  │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
```

**Resume Behavior**:

- Full conversation history loaded
- "Resumed" divider shows where previous session ended
- Mode preserved from original conversation
- New messages continue the thread

---

## 7. Q&A Action Flow

### Screen 7.1: Q&A Session Start

**Purpose**: Configure and begin Q&A session

```
┌─────────────────────────────────────┐
│  ← Goal           Q&A Session       │
├─────────────────────────────────────┤
│                                     │
│  ┌─────────────────────────────────┐│
│  │         ❓                      ││
│  │                                 ││
│  │   Test your understanding      ││
│  │   of knowledge related to:     ││
│  │                                 ││
│  │   "Build portfolio website"    ││
│  └─────────────────────────────────┘│
│                                     │
│                                     │
│  Session length                     │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌───────┐ │
│  │  5  │ │ 10  │ │ 15  │ │ All   │ │
│  └─────┘ └─────┘ └─────┘ └───────┘ │
│                                     │
│  Question types                     │
│  [✓] Recall (fill in the blank)    │
│  [✓] Multiple choice               │
│  [✓] Open-ended                    │
│                                     │
│  Focus on notes (optional)          │
│  ┌─────────────────────────────────┐│
│  │ All 12 notes              ▼    ││
│  └─────────────────────────────────┘│
│                                     │
│  ┌─────────────────────────────────┐│
│  │        🚀 Start Session         ││
│  └─────────────────────────────────┘│
│                                     │
│  Previous sessions: 3 completed     │
│  View history →                     │
│                                     │
└─────────────────────────────────────┘
```

**Configuration Options**:

- Session length: 5, 10, 15, or all questions
- Question types: Toggle which types to include
- Note focus: Optional filter to specific notes

### Screen 7.2: Question Display (Multiple Choice)

**Purpose**: Present question and capture answer

```
┌─────────────────────────────────────┐
│  ✕ End          Q&A     3 of 10     │
├─────────────────────────────────────┤
│                                     │
│  ████████████░░░░░░░░  30%          │
│                                     │
│  ┌─────────────────────────────────┐│
│  │  From: React Best Practices    ││
│  └─────────────────────────────────┘│
│                                     │
│  Which hook should you use to       │
│  optimize expensive calculations    │
│  in a React component?              │
│                                     │
│                                     │
│  ┌─────────────────────────────────┐│
│  │  A) useState                    ││
│  └─────────────────────────────────┘│
│                                     │
│  ┌─────────────────────────────────┐│
│  │  B) useEffect                   ││
│  └─────────────────────────────────┘│
│                                     │
│  ┌─────────────────────────────────┐│
│  │  C) useMemo                     ││
│  └─────────────────────────────────┘│
│                                     │
│  ┌─────────────────────────────────┐│
│  │  D) useCallback                 ││
│  └─────────────────────────────────┘│
│                                     │
│                                     │
│           Skip question →           │
│                                     │
└─────────────────────────────────────┘
```

### Screen 7.3: Answer Feedback (Correct)

**Purpose**: Reinforce correct answers

```
┌─────────────────────────────────────┐
│  ✕ End          Q&A     3 of 10     │
├─────────────────────────────────────┤
│                                     │
│  ████████████░░░░░░░░  30%          │
│                                     │
│  ┌─────────────────────────────────┐│
│  │  ✓ Correct!                    ││
│  └─────────────────────────────────┘│
│                                     │
│  Which hook should you use to       │
│  optimize expensive calculations    │
│  in a React component?              │
│                                     │
│  ┌─────────────────────────────────┐│
│  │  ✓ C) useMemo          ✓       ││
│  └─────────────────────────────────┘│
│                                     │
│  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐│
│  │  💡 useMemo caches the result  ││
│  │  of expensive calculations and ││
│  │  only recomputes when deps     ││
│  │  change. useCallback is for    ││
│  │  memoizing functions.          ││
│  │                                ││
│  │  📄 From: React Best Practices ││
│  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘│
│                                     │
│  ┌─────────────────────────────────┐│
│  │        Next Question →          ││
│  └─────────────────────────────────┘│
│                                     │
└─────────────────────────────────────┘
```

### Screen 7.4: Answer Feedback (Incorrect)

**Purpose**: Teach through mistakes

```
┌─────────────────────────────────────┐
│  ✕ End          Q&A     3 of 10     │
├─────────────────────────────────────┤
│                                     │
│  ████████████░░░░░░░░  30%          │
│                                     │
│  ┌─────────────────────────────────┐│
│  │  ✗ Not quite                   ││
│  └─────────────────────────────────┘│
│                                     │
│  Which hook should you use to       │
│  optimize expensive calculations    │
│  in a React component?              │
│                                     │
│  ┌─────────────────────────────────┐│
│  │  ✗ B) useEffect         ✗      ││
│  └─────────────────────────────────┘│
│  ┌─────────────────────────────────┐│
│  │  ✓ C) useMemo           ✓      ││
│  └─────────────────────────────────┘│
│                                     │
│  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐│
│  │  💡 useEffect is for side      ││
│  │  effects, not memoization.     ││
│  │  useMemo caches computed       ││
│  │  values between renders.       ││
│  │                                ││
│  │  📄 From: React Best Practices ││
│  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘│
│                                     │
│  ┌─────────────────────────────────┐│
│  │        Next Question →          ││
│  └─────────────────────────────────┘│
│                                     │
└─────────────────────────────────────┘
```

### Screen 7.5: Open-Ended Question

**Purpose**: Free-form response with AI evaluation

```
┌─────────────────────────────────────┐
│  ✕ End          Q&A     5 of 10     │
├─────────────────────────────────────┤
│                                     │
│  █████████████████░░░  50%          │
│                                     │
│  ┌─────────────────────────────────┐│
│  │  From: Portfolio Inspiration   ││
│  └─────────────────────────────────┘│
│                                     │
│  What are 3 key elements that       │
│  make a developer portfolio         │
│  stand out to recruiters?           │
│                                     │
│                                     │
│  ┌─────────────────────────────────┐│
│  │                                 ││
│  │ 1. Clean, minimal design that  ││
│  │ shows attention to detail      ││
│  │                                 ││
│  │ 2. Real projects with code     ││
│  │ samples and live demos         ││
│  │                                 ││
│  │ 3. Clear contact info and...   ││
│  │                                 ││
│  └─────────────────────────────────┘│
│                                     │
│  ┌─────────────────────────────────┐│
│  │        Submit Answer            ││
│  └─────────────────────────────────┘│
│                                     │
│           Skip question →           │
│                                     │
└─────────────────────────────────────┘
```

### Screen 7.6: Open-Ended Feedback

**Purpose**: AI evaluates and provides feedback

```
┌─────────────────────────────────────┐
│  ✕ End          Q&A     5 of 10     │
├─────────────────────────────────────┤
│                                     │
│  █████████████████░░░  50%          │
│                                     │
│  ┌─────────────────────────────────┐│
│  │  ✓ Good answer!                ││
│  └─────────────────────────────────┘│
│                                     │
│  What are 3 key elements that       │
│  make a developer portfolio         │
│  stand out to recruiters?           │
│                                     │
│  Your answer:                       │
│  "1. Clean, minimal design..."      │
│                                     │
│  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐│
│  │  🔥 AI Feedback                ││
│  │                                ││
│  │  You captured the essentials!  ││
│  │  Your notes also mention:      ││
│  │  • Performance optimization    ││
│  │  • Mobile responsiveness       ││
│  │  • Accessibility features      ││
│  │                                ││
│  │  These could strengthen your   ││
│  │  portfolio even more.          ││
│  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘│
│                                     │
│  ┌─────────────────────────────────┐│
│  │        Next Question →          ││
│  └─────────────────────────────────┘│
│                                     │
└─────────────────────────────────────┘
```

### Screen 7.7: Session Complete

**Purpose**: Summarize performance and save results

```
┌─────────────────────────────────────┐
│              Q&A Complete           │
├─────────────────────────────────────┤
│                                     │
│         🎉 (celebration icon)       │
│                                     │
│           Session Complete          │
│                                     │
│  ┌─────────────────────────────────┐│
│  │                                 ││
│  │     8 / 10 questions            ││
│  │      answered correctly         ││
│  │                                 ││
│  │  ━━━━━━━━━━━━━━━━░░  80%       ││
│  │                                 ││
│  └─────────────────────────────────┘│
│                                     │
│  Breakdown                          │
│  ───────────────────────────────    │
│  ✓ Multiple choice    5/6          │
│  ✓ Open-ended         2/3          │
│  ✗ Fill in blank      1/1          │
│                                     │
│  Topics to review:                  │
│  • React state management           │
│  • CSS positioning                  │
│                                     │
│  ┌─────────────────────────────────┐│
│  │      Start Another Session      ││
│  └─────────────────────────────────┘│
│                                     │
│  ┌─────────────────────────────────┐│
│  │      Back to Goal               ││
│  └─────────────────────────────────┘│
│                                     │
└─────────────────────────────────────┘
```

---

## 8. Goal Completion

### Screen 8.1: Completion Confirmation

**Purpose**: Mark goal as done with reflection

```
┌─────────────────────────────────────┐
│  ✕ Cancel      Complete Goal        │
├─────────────────────────────────────┤
│                                     │
│         🎯 (target icon)            │
│                                     │
│        Ready to complete            │
│    "Build portfolio website"?       │
│                                     │
│  ┌─────────────────────────────────┐│
│  │  Journey summary               ││
│  │  ───────────────────────────   ││
│  │  ✓ 5/5 milestones completed    ││
│  │  📄 12 notes engaged           ││
│  │  ❓ 24 questions answered      ││
│  │  📅 18 days active             ││
│  └─────────────────────────────────┘│
│                                     │
│  Optional: Add a reflection         │
│  ┌─────────────────────────────────┐│
│  │ What I learned...               ││
│  │                                 ││
│  │                                 ││
│  └─────────────────────────────────┘│
│                                     │
│  ┌─────────────────────────────────┐│
│  │     ✓ Mark as Complete          ││
│  └─────────────────────────────────┘│
│                                     │
│  This goal will become read-only    │
│  but you can still view its         │
│  history anytime.                   │
│                                     │
└─────────────────────────────────────┘
```

### Screen 8.2: Archived Goal View

**Purpose**: Read-only historical record

```
┌─────────────────────────────────────┐
│  ← Goals    Build portfolio website │
├─────────────────────────────────────┤
│                                     │
│  ┌─────────────────────────────────┐│
│  │  ✓ COMPLETED                   ││
│  │  Finished Dec 28, 2024         ││
│  └─────────────────────────────────┘│
│                                     │
│  ═══════════════════════════════    │
│                                     │
│  REFLECTION                         │
│  "Learned a lot about React         │
│  component patterns and CSS Grid.   │
│  Site is live at..."                │
│                                     │
│  ═══════════════════════════════    │
│                                     │
│  STATS                              │
│  ✓ 5/5 milestones completed         │
│  📄 12 notes used                   │
│  ❓ 24 questions answered           │
│  📅 18 days from start to finish    │
│                                     │
│  ═══════════════════════════════    │
│                                     │
│  NOTES                              │
│  (read-only list of notes)          │
│                                     │
│  ═══════════════════════════════    │
│                                     │
│  Q&A HISTORY                        │
│  Session 1: Dec 20 - 80%            │
│  Session 2: Dec 25 - 90%            │
│                                     │
└─────────────────────────────────────┘
```

---

## 9. Settings Modal

### Screen 9.1: Settings

**Purpose**: Configure API and preferences

```
┌───────────────────────────────────────────┐
│                                           │
│   ┌───────────────────────────────────┐   │
│   │  ⚙️ Settings                  ✕  │   │
│   ├───────────────────────────────────┤   │
│   │                                   │   │
│   │  AI Configuration                 │   │
│   │  ─────────────────────────────    │   │
│   │                                   │   │
│   │  API Provider                     │   │
│   │  ┌─────────────────────────────┐  │   │
│   │  │ Anthropic (Claude)       ▼ │  │   │
│   │  └─────────────────────────────┘  │   │
│   │                                   │   │
│   │  API Key                          │   │
│   │  ┌─────────────────────────────┐  │   │
│   │  │ sk-ant-••••••••••••••••    │  │   │
│   │  └─────────────────────────────┘  │   │
│   │  🔒 Stored locally, never sent   │   │
│   │     to external servers           │   │
│   │                                   │   │
│   │  ─────────────────────────────    │   │
│   │                                   │   │
│   │  Q&A Preferences                  │   │
│   │  ─────────────────────────────    │   │
│   │                                   │   │
│   │  Default session length           │   │
│   │  ┌─────────────────────────────┐  │   │
│   │  │ 10 questions             ▼ │  │   │
│   │  └─────────────────────────────┘  │   │
│   │                                   │   │
│   │  Show explanations after each     │   │
│   │  question                         │   │
│   │  ┌──────┐                         │   │
│   │  │  ✓  │  Enabled                │   │
│   │  └──────┘                         │   │
│   │                                   │   │
│   │  ─────────────────────────────    │   │
│   │                                   │   │
│   │  Vault Scanning                   │   │
│   │  ─────────────────────────────    │   │
│   │                                   │   │
│   │  Excluded folders                 │   │
│   │  ┌─────────────────────────────┐  │   │
│   │  │ templates/, archive/       │  │   │
│   │  └─────────────────────────────┘  │   │
│   │                                   │   │
│   │  Min note length (characters)     │   │
│   │  ┌─────────────────────────────┐  │   │
│   │  │ 100                        │  │   │
│   │  └─────────────────────────────┘  │   │
│   │                                   │   │
│   ├───────────────────────────────────┤   │
│   │            [Save Settings]        │   │
│   └───────────────────────────────────┘   │
│                                           │
└───────────────────────────────────────────┘
```

**Settings Sections**:

1. **AI Configuration**: Provider selection, API key
2. **Q&A Preferences**: Default session length, explanations toggle
3. **Vault Scanning**: Excluded folders, minimum note length

---

## 10. Research Action Flow

### Screen 10.1: Knowledge Gaps

**Purpose**: Show what's missing for the goal and let user select a research topic

```
┌─────────────────────────────────────┐
│  ← Goal           Research          │
├─────────────────────────────────────┤
│                                     │
│  ┌─────────────────────────────────┐│
│  │ 🔍 Based on your goal and       ││
│  │ current notes, here are some   ││
│  │ knowledge gaps I've identified: ││
│  └─────────────────────────────────┘│
│                                     │
│  Suggested topics:                  │
│                                     │
│  ┌─────────────────────────────────┐│
│  │  CSS animations for portfolios ││
│  │  Add smooth transitions and    ││
│  │  micro-interactions            ││
│  │                      Research → ││
│  └─────────────────────────────────┘│
│                                     │
│  ┌─────────────────────────────────┐│
│  │  Responsive image optimization ││
│  │  Best practices for fast-      ││
│  │  loading portfolio images      ││
│  │                      Research → ││
│  └─────────────────────────────────┘│
│                                     │
│  ┌─────────────────────────────────┐│
│  │  Deployment to Vercel          ││
│  │  Steps to deploy and configure ││
│  │  your portfolio site           ││
│  │                      Research → ││
│  └─────────────────────────────────┘│
│                                     │
│  ─────────────────────────────────  │
│                                     │
│  Or research something else:        │
│  ┌─────────────────────────────┐    │
│  │ What do you want to learn? │ ➤  │
│  └─────────────────────────────┘    │
│                                     │
└─────────────────────────────────────┘
```

### Screen 10.2: Research In Progress

**Purpose**: Show research is happening with web search

```
┌─────────────────────────────────────┐
│  ← Goal           Research          │
├─────────────────────────────────────┤
│                                     │
│                                     │
│                                     │
│         ┌───────────────────┐       │
│         │                   │       │
│         │   🔍 (animated)   │       │
│         │                   │       │
│         │   Researching     │       │
│         │   CSS animations  │       │
│         │   for portfolios  │       │
│         │                   │       │
│         └───────────────────┘       │
│                                     │
│         Searching the web...        │
│         ████████░░░░  67%           │
│                                     │
│         Sources found:              │
│         • MDN Web Docs              │
│         • CSS-Tricks                │
│         • Smashing Magazine         │
│                                     │
│                                     │
│                                     │
└─────────────────────────────────────┘
```

### Screen 10.3: Research Preview

**Purpose**: Review generated research note before saving

````
┌─────────────────────────────────────┐
│  ← Goal           Research          │
├─────────────────────────────────────┤
│                                     │
│  ┌─────────────────────────────────┐│
│  │ 🔍 Research complete!          ││
│  │ Review before saving:          ││
│  └─────────────────────────────────┘│
│                                     │
│  ┌─────────────────────────────────┐│
│  │ 📄 CSS Animations for          ││
│  │    Portfolios                  ││
│  │ ─────────────────────────────  ││
│  │                                ││
│  │ ## Key Techniques              ││
│  │                                ││
│  │ **1. Micro-interactions**      ││
│  │ Small animations that provide  ││
│  │ feedback: button hovers, card  ││
│  │ lifts, icon transitions...     ││
│  │                                ││
│  │ **2. Page Transitions**        ││
│  │ Smooth transitions between     ││
│  │ sections using CSS or Framer   ││
│  │ Motion...                      ││
│  │                                ││
│  │ **3. Scroll Animations**       ││
│  │ Elements that animate on       ││
│  │ scroll using Intersection      ││
│  │ Observer API...                ││
│  │                                ││
│  │ ## Code Examples               ││
│  │ ```css                         ││
│  │ .card:hover {                  ││
│  │   transform: translateY(-4px); ││
│  │   transition: transform 0.2s;  ││
│  │ }                              ││
│  │ ```                            ││
│  │                                ││
│  │ (scrollable preview)           ││
│  └─────────────────────────────────┘│
│                                     │
│  ┌───────────────────────────────┐  │
│  │ 📚 Sources                    │  │
│  │ • MDN: CSS Transitions        │  │
│  │ • CSS-Tricks: Animation Guide │  │
│  │ • Smashing: Motion Design     │  │
│  └───────────────────────────────┘  │
│                                     │
├─────────────────────────────────────┤
│  ┌─────────────┐  ┌───────────────┐ │
│  │    Edit     │  │   ✓ Save      │ │
│  └─────────────┘  └───────────────┘ │
│                                     │
│           Discard                   │
│                                     │
└─────────────────────────────────────┘
````

### Screen 10.4: Research Saved

**Purpose**: Confirm save and offer next actions

```
┌─────────────────────────────────────┐
│  ← Goal           Research          │
├─────────────────────────────────────┤
│                                     │
│                                     │
│                                     │
│         ┌───────────────────┐       │
│         │                   │       │
│         │   ✓ (checkmark)   │       │
│         │                   │       │
│         │   Research saved  │       │
│         │                   │       │
│         └───────────────────┘       │
│                                     │
│  Saved to:                          │
│  ignite/Build portfolio/research/   │
│  CSS animations for portfolios.md   │
│                                     │
│                                     │
│  ┌─────────────────────────────────┐│
│  │      Research another topic     ││
│  └─────────────────────────────────┘│
│                                     │
│  ┌─────────────────────────────────┐│
│  │      Back to Goal               ││
│  └─────────────────────────────────┘│
│                                     │
│                                     │
│                                     │
└─────────────────────────────────────┘
```

**Key Features**:

- **Gap Identification**: AI analyzes goal + existing notes to find missing knowledge
- **Suggested Topics**: Pre-populated based on gap analysis
- **Custom Research**: User can type any topic they want
- **Web Search**: Searches and synthesizes multiple sources
- **Source Attribution**: Shows which web sources informed the research
- **Preview Before Save**: User reviews and can edit before committing
- **Vault Integration**: Saves directly to goal's research folder

**Interactions**:

- Click suggested topic → Start research on that topic
- Type custom topic + ➤ → Start research on custom topic
- "Edit" → Open note in edit mode for modifications
- "Save" → Save to vault and show confirmation
- "Discard" → Return to gap selection without saving

---

## 11. Draft Action Flow

### Screen 11.1: Draft Start

**Purpose**: Begin a conversation to understand what user wants to create

```
┌─────────────────────────────────────┐
│  ← Goal             Draft           │
├─────────────────────────────────────┤
│                                     │
│  ┌─────────────────────────────────┐│
│  │ ✏️ What would you like to       ││
│  │ draft for your portfolio       ││
│  │ project?                       ││
│  │                                ││
│  │ I can help you create:         ││
│  └─────────────────────────────────┘│
│                                     │
│  Suggestions:                       │
│  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐│
│  │ Project descriptions for       ││
│  │ your portfolio pieces          ││
│  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘│
│  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐│
│  │ About page copy that           ││
│  │ highlights your skills         ││
│  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘│
│  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐│
│  │ README for your portfolio      ││
│  │ repository                     ││
│  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘│
│                                     │
├─────────────────────────────────────┤
│  ┌─────────────────────────────┐    │
│  │ Describe what you need...  │ ➤  │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
```

### Screen 11.2: Draft Conversation

**Purpose**: Gather requirements through conversation before generating

```
┌─────────────────────────────────────┐
│  ← Goal             Draft           │
├─────────────────────────────────────┤
│                                     │
│  ┌─────────────────────────────────┐│
│  │ I want to write an About page  ││
│  │ that highlights my React and   ││
│  │ frontend skills                ││
│  └─────────────────────────────────┘│
│                                 You │
│                                     │
│  ✏️ Great! To write an effective    │
│     About page, I have a few        │
│     questions:                      │
│                                     │
│     1. What's your experience level │
│        (junior, mid, senior)?       │
│                                     │
│     2. Any specific projects or     │
│        achievements to highlight?   │
│                                     │
│     3. What tone do you prefer?     │
│        (professional, casual,       │
│        creative)                    │
│                                     │
│  ┌─────────────────────────────────┐│
│  │ Mid-level, 3 years experience. ││
│  │ I built an e-commerce app and  ││
│  │ a real-time dashboard. I want  ││
│  │ it professional but friendly.  ││
│  └─────────────────────────────────┘│
│                                 You │
│                                     │
│  ✏️ Perfect! I have enough to       │
│     create a draft. Give me a       │
│     moment...                       │
│                                     │
│     [Generating draft...]           │
│                                     │
├─────────────────────────────────────┤
│  ┌─────────────────────────────┐    │
│  │ Add more details...        │ ➤  │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
```

### Screen 11.3: Draft Preview

**Purpose**: Review generated draft before saving

```
┌─────────────────────────────────────┐
│  ← Goal             Draft           │
├─────────────────────────────────────┤
│                                     │
│  ┌─────────────────────────────────┐│
│  │ ✏️ Here's your draft!           ││
│  │ Review before saving:          ││
│  └─────────────────────────────────┘│
│                                     │
│  ┌─────────────────────────────────┐│
│  │ 📄 About Page                  ││
│  │ ─────────────────────────────  ││
│  │                                ││
│  │ # Hi, I'm [Your Name] 👋       ││
│  │                                ││
│  │ I'm a frontend developer with  ││
│  │ 3 years of experience building ││
│  │ modern web applications with   ││
│  │ React and TypeScript.          ││
│  │                                ││
│  │ ## What I Do                   ││
│  │                                ││
│  │ I specialize in creating       ││
│  │ responsive, performant user    ││
│  │ interfaces that users love.    ││
│  │ From e-commerce platforms to   ││
│  │ real-time dashboards, I enjoy  ││
│  │ solving complex UI challenges. ││
│  │                                ││
│  │ ## Featured Work               ││
│  │                                ││
│  │ **E-commerce App** - Built a   ││
│  │ full-featured shopping         ││
│  │ experience with cart, checkout ││
│  │ and payment integration...     ││
│  │                                ││
│  │ (scrollable preview)           ││
│  └─────────────────────────────────┘│
│                                     │
├─────────────────────────────────────┤
│  ┌───────┐ ┌───────┐ ┌────────────┐ │
│  │Revise │ │ Edit  │ │  ✓ Save    │ │
│  └───────┘ └───────┘ └────────────┘ │
│                                     │
│           Discard                   │
│                                     │
└─────────────────────────────────────┘
```

### Screen 11.4: Draft Revision

**Purpose**: Request changes to the draft through conversation

```
┌─────────────────────────────────────┐
│  ← Goal             Draft           │
├─────────────────────────────────────┤
│                                     │
│  (previous draft preview visible)   │
│                                     │
│  ─────────────────────────────────  │
│                                     │
│  ┌─────────────────────────────────┐│
│  │ Can you make it shorter and    ││
│  │ add a section about my         ││
│  │ interest in accessibility?     ││
│  └─────────────────────────────────┘│
│                                 You │
│                                     │
│  ✏️ Sure! I'll condense it and      │
│     add an accessibility section.   │
│                                     │
│     [Revising draft...]             │
│                                     │
├─────────────────────────────────────┤
│  ┌─────────────────────────────┐    │
│  │ Request more changes...    │ ➤  │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
```

### Screen 11.5: Draft Saved

**Purpose**: Confirm save and offer next actions

```
┌─────────────────────────────────────┐
│  ← Goal             Draft           │
├─────────────────────────────────────┤
│                                     │
│                                     │
│                                     │
│         ┌───────────────────┐       │
│         │                   │       │
│         │   ✓ (checkmark)   │       │
│         │                   │       │
│         │   Draft saved     │       │
│         │                   │       │
│         └───────────────────┘       │
│                                     │
│  Saved to:                          │
│  ignite/Build portfolio/drafts/     │
│  About page.md                      │
│                                     │
│                                     │
│  ┌─────────────────────────────────┐│
│  │      Create another draft       ││
│  └─────────────────────────────────┘│
│                                     │
│  ┌─────────────────────────────────┐│
│  │      Back to Goal               ││
│  └─────────────────────────────────┘│
│                                     │
│                                     │
│                                     │
└─────────────────────────────────────┘
```

**Key Features**:

- **Conversational Flow**: AI gathers requirements through natural conversation
- **Contextual Suggestions**: Draft ideas based on goal and existing notes
- **Iterative Refinement**: User can request revisions before saving
- **Preview Before Save**: Full preview with edit option
- **Vault Integration**: Saves directly to goal's drafts folder

**Interactions**:

- Click suggestion → Start conversation with that topic
- Type description + ➤ → Start conversation with custom request
- "Revise" → Open revision conversation to request changes
- "Edit" → Open note in edit mode for manual modifications
- "Save" → Save to vault and show confirmation
- "Discard" → Return to start without saving

---

## Interaction Summary

| Screen              | Entry Point                          | Exit Points                                                      |
| ------------------- | ------------------------------------ | ---------------------------------------------------------------- |
| Welcome             | Plugin first open                    | Home, Brainstorm                                                 |
| Home                | Plugin open, Back from Goal          | Goal Detail, Brainstorm, Settings                                |
| Brainstorm Agent    | "+ New Goal"                         | Home (cancel), Note Assignment                                   |
| Note Assignment     | Brainstorm complete                  | Goal Detail                                                      |
| Goal Detail         | Click goal card                      | Home, Discuss, Research, Draft, Q&A, Note Management, Completion |
| Discuss             | "Start" from Goal                    | Goal Detail (conversation auto-saved)                            |
| Resume Conversation | Click conversation in Knowledge Base | Goal Detail (conversation continues)                             |
| Research            | "Start" from Goal                    | Goal Detail (note saved to research/)                            |
| Draft               | "Start" from Goal                    | Goal Detail (note saved to drafts/)                              |
| Q&A Flow            | "Start" from Goal                    | Goal Detail                                                      |
| Completion          | "Complete" from Goal                 | Home                                                             |
| Settings            | ⚙️ icon                              | Close to previous                                                |

### Progress Tracking Behavior

| State                   | Progress Bar | Display                                        |
| ----------------------- | ------------ | ---------------------------------------------- |
| Goal has milestones     | Visible      | Shows completed/total (e.g., "3/5 milestones") |
| Goal has no milestones  | Hidden       | No progress indicator shown                    |
| All milestones complete | Full         | Shows "5/5 milestones" with 100% fill          |

### Goal Folder Structure

| Folder                | Content                          | Created By                      |
| --------------------- | -------------------------------- | ------------------------------- |
| `ignite/[goal-name]/` | Goal workspace root              | Goal creation                   |
| `goal.md`             | Metadata, milestones, reflection | Goal creation                   |
| `conversations/`      | Auto-saved discussion threads    | Discuss action (auto)           |
| `research/`           | AI-generated research notes      | Research action (user confirms) |
| `drafts/`             | AI-generated documents           | Draft action (user confirms)    |

---

## Prototype Implementation Notes

### For V0/Lovable:

1. **Start with Home screen** as the main entry point
2. **Use Tailwind** for styling with the color palette defined above
3. **Mock data**: Create 2-3 sample goals with various states
4. **Animations**: Use Framer Motion for smooth transitions
5. **State management**: Simple React state is sufficient for prototype
6. **Responsive**: Design is for 400px fixed width (Obsidian panel)

### Key Components to Build:

1. `GoalCard` - Reusable goal preview component
2. `NoteCard` - Note display with checkbox variant
3. `ActionCard` - Action button with icon and description
4. `ProgressBar` - Linear progress indicator (milestone-based)
5. `DeadlinePill` - Color-coded deadline display
6. `MilestoneList` - Checkable milestone list with add/edit/remove
7. `MilestoneItem` - Single milestone row with checkbox
8. `ModeSelector` - Pill-style toggle for Discuss modes (Explore/Teach Me/Challenge)
9. `KnowledgeBaseSection` - Expandable category list (Notes, Conversations, Research, Drafts)
10. `ConversationItem` - Clickable conversation with topic name and date
11. `ChatMessage` - AI and user message bubbles (used in Brainstorm, Discuss, Draft)
12. `SourcesCard` - Collapsible note attribution for AI responses
13. `SuggestionPill` - Clickable suggested question
14. `PreviewCard` - Full-width note preview with Edit/Save/Discard actions
15. `ResearchTopicCard` - Suggested research topic with description and action
16. `SourcesList` - Collapsible list of web sources for Research
17. `QuestionCard` - Q&A question display with variants

### Suggested Build Order:

1. Home screen (empty + populated states)
2. Goal Detail screen (with Knowledge Base section)
3. Discuss flow (with modes and conversation resume)
4. Research flow (all screens)
5. Draft flow (all screens)
6. Q&A flow (all screens)
7. Brainstorm Agent flow
8. Note Assignment flow
9. Completion flow
10. Settings modal
