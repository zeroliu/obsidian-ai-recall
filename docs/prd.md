---
created: 2025-12-24
updated: 2025-12-25
---
# Recall: Obsidian Quiz Plugin Design Spec

## Problem Statement

People collect knowledge but don't retain it. Modern tools make capturing information effortless, but without active recall, knowledge fades quickly. Research shows that quizzing yourself is one of the most effective ways to actually learn—forcing retrieval strengthens memory and reveals gaps.

**Opportunity**: Obsidian users have rich personal knowledge bases. An AI-native quiz plugin can transform passive note collections into active learning systems—something only an Obsidian plugin can uniquely provide.

---

## Research Backing

Over **200 studies spanning 100+ years** confirm that retrieval practice (quizzing) significantly boosts long-term retention:

- **Stronger than re-reading**: Actively retrieving information strengthens memory more than passive review ([MIT Open Learning](https://openlearning.mit.edu/mit-faculty/research-based-learning-findings/retrieval-practice-testing-effect))
- **Outperforms other strategies**: Retrieval practice beats repeated studying and even elaborate techniques like concept mapping ([PMC Study](https://pmc.ncbi.nlm.nih.gov/articles/PMC3983480/))
- **Classroom evidence**: Students improved on both chapter and semester exams after quizzing vs. re-reading ([Washington University CTL](https://ctl.wustl.edu/resources/using-retrieval-practice-to-increase-student-learning/))
- **Five principles for effectiveness**: Tests should require generation (not recognition), be repeated, spaced for effortful retrieval, and include feedback ([UCSD Psychology](https://psychology.ucsd.edu/undergraduate-program/undergraduate-resources/academic-writing-resources/effective-studying/retrieval-practice.html))

---

## Competitive Analysis

### The Universal Pain Point

**Every existing spaced repetition tool requires manual card creation.** This demands discipline most users don't have. Cards become outdated as notes evolve.

### General Tools

| Tool | Open Source | Pain Point |
|------|-------------|------------|
| **Anki** | Yes | Complex UI, manual card creation, steep learning curve |
| **Mnemosyne** | Yes | Simpler but still fully manual |
| **Mochi Cards** | No | Beautiful UI, but manual cards |
| **Brainscape** | No | Pre-made decks, rigid structure |

Source: [AlternativeTo](https://alternativeto.net/software/anki/?license=opensource)

### Obsidian-Specific Plugins

| Plugin | Approach | Limitation |
|--------|----------|------------|
| **Spaced Repetition** (2.1k stars) | Manual markdown syntax (`Question::Answer`) | Requires discipline to create/maintain cards |
| **SRAI** | AI-assisted flashcard generation | Still generates traditional cards |
| **Learnie** | Creates questions from highlighted text | Requires manual highlighting |
| **Obsidian_to_Anki** | Exports to Anki | Just a bridge, same manual workflow |

Source: [GitHub](https://github.com/st3v3nmw/obsidian-spaced-repetition), [ObsidianStats](https://www.obsidianstats.com/posts/2025-05-01-spaced-repetition-plugins)

### Recall's Differentiation

**Truly AI-native**: No card creation. No deck management. No syntax. No highlighting.

The AI reads your notes, generates questions, evaluates free-form answers, and evolves concepts over time. **Zero friction.**

---

## Core Concept

**Recall** generates personalized quizzes from your vault content, tracks what you've mastered, and uses spaced repetition to surface knowledge before you forget it.

### Key Principles

1. **AI-Native**: The AI decides what's quizzable, generates questions, evaluates answers, and learns from feedback. No manual configuration required.
2. **Concept-Centric**: Concepts (not notes) are the unit of mastery. Concepts emerge organically through note analysis—the AI proposes groupings, users confirm.
3. **Game-Like**: Immediate feedback, streaks, progress visualization. Learning should feel engaging, not like homework.
4. **Pull + Push**: Users can quiz anytime (pull), but the system also suggests what's due for review (push).

---

## User Journey

### First Launch (Onboarding)

```
┌─────────────────────────────────────────┐
│  Welcome to Recall                      │
├─────────────────────────────────────────┤
│  Analyzing your vault...                │
│  ━━━━━━━━━━━━━━━○○○○                    │
│  Found 847 notes across 12 topics       │
└─────────────────────────────────────────┘
          ↓
┌─────────────────────────────────────────┐
│  What do you want to master?            │
│  Pick concepts you'd like to quiz on    │
├─────────────────────────────────────────┤
│  [✓] Golf (23 notes)                    │
│  [✓] React & Frontend (156 notes)       │
│  [ ] Meeting Notes (89 notes)           │
│  [✓] Product Management (45 notes)      │
│  ...                                    │
├─────────────────────────────────────────┤
│  Selected: 4 concepts                   │
│  [Get Started →]                        │
└─────────────────────────────────────────┘
          ↓
First quiz begins immediately
```

Netflix-style selection: AI analyzes vault, suggests concepts, user picks what they care about.

### Regular Session (Action-First Home)

```
┌─────────────────────────────────────────┐
│  🎯 Recall                   [⚙️]       │
├─────────────────────────────────────────┤
│                                         │
│  💡 Your concepts:                      │
│  [🏌️ Golf — due today          ▶]      │
│  [⚛️ React — 2 new notes        ▶]      │
│  [📊 PM — 5 days ago            ▶]      │
│                                         │
│  ✨ New concept detected:               │
│  [Short game techniques — 4 notes]      │
│                            [Add] [Skip] │
│                                         │
│  ─────────────────────────────────────  │
│  🔍 [Quiz me on...]                     │
│                                         │
│  ─────────────────────────────────────  │
│  📈 7-day streak · 73% mastery          │
│  [View Progress →]                      │
└─────────────────────────────────────────┘
```

- One-click to start any suggested quiz
- **Emerging concepts surface here** — AI notices note clusters and proposes new concepts to track
- **"Quiz me on..." input** — semantic search for any topic (see flow below)
- Progress summary at bottom (secondary)

### "Quiz me on..." Flow

User enters a natural language query (e.g., "agentic app development"):

**Step 1: AI searches vault**
```
┌─────────────────────────────────────────┐
│  🔍 Searching for notes about           │
│     "agentic app development"...        │
│  ━━━━━━━━━━━━━○○○○○                     │
└─────────────────────────────────────────┘
```

**Step 2a: Notes found → Topic Discovery**
```
┌─────────────────────────────────────────┐
│  Found 8 notes about                    │
│  "Agentic AI Development"               │
├─────────────────────────────────────────┤
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
└─────────────────────────────────────────┘
```

- **Quick Quiz**: Start quiz immediately, no concept saved
- **Create Concept**: Save concept to tracked list, then start quiz

**Step 2b: No notes found**
```
┌─────────────────────────────────────────┐
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
│  [Physics basics]  [Science notes]      │
│                                         │
│  [← Back to Home]                       │
│                                         │
└─────────────────────────────────────────┘
```

- Shows warning + helpful alternatives
- Related topics are clickable → restart flow with that topic

---

## Quiz Experience

### Question Card

```
┌─────────────────────────────────────────┐
│  Question 3 of 10            [Golf]     │
│  ━━━━━━━━○○○○○○○                        │
├─────────────────────────────────────────┤
│                                         │
│  What's the key to maintaining tempo    │
│  during a golf swing?                   │
│                                         │
│  ○ Fast backswing, slow downswing       │
│  ○ Count "1-2-3" rhythm                 │
│  ● Keep lower body stable               │
│  ○ Grip pressure stays constant         │
│                                         │
│  [Submit Answer]  [I've mastered this ✓]│
│                                         │
├─────────────────────────────────────────┤
│  [Skip]  [🚩 Flag question]             │
└─────────────────────────────────────────┘
```

### After Answering (Immediate Feedback)

```
┌─────────────────────────────────────────┐
│  ✅ Correct!                            │
│                                         │
│  The "1-2-3" rhythm helps maintain      │
│  consistent tempo throughout the swing. │
│                                         │
│  📄 From: golf-lessons-2024.md          │
│                                         │
│  [Next Question →]                      │
└─────────────────────────────────────────┘
```

- Source note revealed AFTER answering (prevents peeking)
- Direct link to source note for deeper review

### Quiz Formats

| Format | Best For | Example |
|--------|----------|---------|
| Multiple choice | Facts, definitions | "What does X mean?" |
| True/False | Quick recall | "React hooks can only be called at top level: T/F" |
| Fill in blank | Terminology, sequences | "The three phases are: address, ___, follow-through" |
| Free-form short | Concepts, explanations | "Explain why spaced repetition works" |
| Free-form application | Deeper understanding | "How would you apply X to Y?" |

- AI selects format based on content type
- Users can filter which formats to include before starting

### Post-Quiz Summary

```
┌─────────────────────────────────────────┐
│  Quiz Complete: Golf                    │
├─────────────────────────────────────────┤
│  Score: 7/10                            │
│                                         │
│  ✅ Solid on:                           │
│     • Putting mechanics                 │
│     • Club selection                    │
│                                         │
│  🔄 Needs review:                       │
│     • Swing tempo (struggled twice)     │
│     • Bunker shots                      │
│                                         │
├─────────────────────────────────────────┤
│  [View Notes]  [Quiz Again]  [New Topic]│
└─────────────────────────────────────────┘
```

Post-quiz focuses on performance feedback. Concept discovery happens on the home screen before quizzing.

---

## Concept & Mastery System

### How Concepts Emerge

1. **On home screen**: AI analyzes vault and proposes new concept clusters ("4 notes seem related to Short Game Techniques")
2. **User confirms or skips**: One-click to add to tracked concepts or dismiss
3. **Continuous discovery**: As notes are added/modified, AI surfaces new concept suggestions
4. Concept graph builds through interaction, not upfront configuration

### Mastery Signals

- **Correctness streak**: Answered similar questions 3+ times correctly
- **Self-reported**: "I've mastered this" button during quiz
- **Explicit archive**: "I don't care about this anymore"

### Spaced Repetition

- Based on Ebbinghaus forgetting curve
- Recently learned = review soon
- Well-mastered = longer intervals
- Time decay: mastered 6 months ago = due for refresh

### Concept Management

```
┌─────────────────────────────────────────┐
│  [Quiz]  [Progress]  [Settings]         │
├─────────────────────────────────────────┤
│  Your Concepts                          │
│                                         │
│  🟢 React Hooks — mastered (2d ago)     │
│  🟡 Golf Swing — learning (due today)   │
│  🟡 TypeScript Generics — learning      │
│  🔴 System Design — needs work          │
│  ⚪ Cooking basics — archived           │
│                                         │
│  💡 Suggested:                          │
│     "Short game techniques" [Add][Skip] │
└─────────────────────────────────────────┘
```

Actions: Rename, merge, archive concepts

---

## Progress & Engagement

### Activity Visualization

- GitHub-style contribution graph (daily quiz volume)
- Streak counter
- Overall mastery percentage

### Progress View

- Concept list with mastery indicators (🟢🟡🔴)
- Knowledge gaps called out
- Activity history over time

### Push Mechanisms

- Sidebar badge showing due items
- Optional system notifications
- Configurable cadence (daily/every 2 days/weekly)

---

## Search & Note Finding

### Hybrid Approach

1. **Primary**: AI agent uses regex/grep search to find relevant notes (no indexing required)
2. **Enhanced**: Optional semantic indexing for improved relevance

The AI decides:
- Which notes are relevant to a topic
- Whether a note is quizzable (based on content length/type)
- How to generate meaningful questions

### Scoping a Quiz

- Search by path, tags, or semantic query
- Examples: "notes about golf", "folder:projects", "#learning"

---

## Settings

| Setting | Default | Options |
|---------|---------|---------|
| Questions per session | 10 | 5-20 |
| Quiz formats | All enabled | Toggle each format |
| Review cadence | Daily | Daily / 2 days / Weekly |
| Notifications | On | Badge + optional system |
| Semantic indexing | Auto | On / Off / Auto-detect |

---

## Handling Edge Cases

- **Bad questions**: Flag button + optional feedback; skips also signal quality issues
- **Quit mid-quiz**: Save whatever was answered, no penalty
- **Empty search**: "No notes found. Try a different search."
- **All mastered**: "You're all caught up! Check back tomorrow."
- **Short notes**: AI decides if quizzable based on content
- **Deleted notes**: Concept persists if other notes support it

---

## Phased Implementation

### Phase 1: Core Engine (MVP)
*Can we generate useful quizzes from vault content?*

- [ ] Agent that reads notes and extracts quizzable concepts
- [ ] Generate quiz questions (multiple formats)
- [ ] Basic panel UI: search → quiz → answer → feedback
- [ ] Record responses (right/wrong/skipped/flagged)
- [ ] Link back to source notes

**Success criteria**: Quiz yourself on golf notes and questions feel relevant and useful.

### Phase 2: Learning Intelligence
*Can we make each quiz smarter than the last?*

- [ ] Concept mastery tracking (based on answer history)
- [ ] Spaced repetition logic (Ebbinghaus intervals)
- [ ] "Due for review" suggestions
- [ ] Struggling concept detection

### Phase 3: Engagement & Habit
*Will users come back daily?*

- [ ] One-click quiz suggestions on home
- [ ] Post-quiz summary with insights
- [ ] Streaks and activity tracking
- [ ] "I've mastered this" and flagging UI

### Phase 4: Onboarding & Discovery
*Can new users get value in 2 minutes?*

- [ ] Vault analysis on first launch
- [ ] Netflix-style concept selection
- [ ] Progress visualization (GitHub-style)
- [ ] Concept management (rename, archive, merge)

### Phase 5: Push Mechanisms
- [ ] Sidebar badge for due items
- [ ] Optional notifications

---

## Open Questions for Implementation

1. Where does this plugin live? New repo or extension of existing project?
2. What AI provider/model to use for question generation and evaluation?
3. How to persist mastery data and quiz history?
4. Semantic indexing implementation (if enabled)?
