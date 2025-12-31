---
created: 2025-12-29
updated: 2025-12-29
---

# Ignite: Product Requirements Document

## Problem Statement

### The Knowledge Hoarder's Paradox

Modern knowledge workers are drowning in saved content. They bookmark articles, clip web pages, take notes, and build elaborate personal knowledge systems—yet rarely use what they collect. Research calls this the **"collector's fallacy"**: the false belief that saving information equals learning it.

The symptoms are universal:

- **Cognitive overload**: Hundreds of unread articles create low-grade anxiety
- **Guilt loops**: Every saved item becomes a silent reproach, a promise unkept
- **Illusion of progress**: Clicking "save" feels productive, but nothing is actually understood
- **Organizing as procrastination**: Elaborate tagging and filing systems become ends in themselves

The root cause is simple: **knowledge without purpose is just organized hoarding**.

### Why Existing Solutions Fail

Traditional approaches attack the wrong problem. Note-taking methodologies (PARA, Zettelkasten, Building a Second Brain) promise organization but often become "productivity procrastination"—sophisticated systems that feel like progress while producing nothing.

The fundamental issue remains: **people collect information with no clear goal for using it**. Better organization of purposeless content is still purposeless.

### The Insight

Educational research consistently shows that **goal-oriented learning** dramatically outperforms passive accumulation:

- **Just-in-time vs just-in-case**: Learning what you need _now_ for a specific project creates real-world value. Learning "just in case" creates digital clutter.
- **Context improves retention**: Knowledge tied to active projects is processed more deeply and remembered longer.
- **Meaning drives motivation**: When learning serves a genuine objective, it naturally feels meaningful rather than obligatory.

The opportunity: **flip the model**. Instead of accumulating knowledge and hoping it becomes useful, start with goals and let them pull in relevant knowledge.

---

## Product Vision

### What is Ignite?

**Ignite** is an Obsidian plugin that transforms passive note collections into goal-driven action systems.

Knowledge sits dormant in your vault until you declare a goal. Then Ignite _ignites_ that knowledge—pulling in relevant notes, helping you consume them with purpose, and driving progress through targeted actions.

### Core Philosophy

```
"Collect freely. Consume with purpose."
```

1. **Goals are the lens**: Knowledge only becomes useful when viewed through the lens of what you're trying to achieve
2. **AI does the heavy lifting**: Organizing notes to goals is trivial because AI handles the matching
3. **No guilt, no judgment**: Unread notes are fine—they're raw material waiting for a goal to give them purpose
4. **Action over accumulation**: Every interaction moves you toward completing something real

### How It Works (High Level)

1. **Create a goal**: "Build my portfolio website" or "Prepare for system design interviews"
2. **AI matches notes**: Ignite scans your vault and suggests relevant notes
3. **Engage with purpose**: Q&A, summaries, action items—all contextualized to your goal
4. **Complete and archive**: Goal becomes a read-only artifact capturing your journey

---

## Competitive Differentiation

### vs. NotebookLM (Google)

| Aspect          | NotebookLM                      | Ignite                          |
| --------------- | ------------------------------- | ------------------------------- |
| **Input**       | Upload documents to a project   | Your existing Obsidian vault    |
| **Orientation** | Source-centric (chat with docs) | Goal-centric (achieve outcomes) |
| **Persistence** | Isolated projects               | Continuous knowledge base       |
| **Philosophy**  | "Understand this content"       | "Accomplish this goal"          |

NotebookLM is excellent for understanding a specific set of documents. Ignite is for turning your _entire_ accumulated knowledge into action across multiple ongoing objectives.

### vs. ChatGPT Projects

| Aspect                  | ChatGPT Projects              | Ignite                             |
| ----------------------- | ----------------------------- | ---------------------------------- |
| **Context**             | Upload files per conversation | Native access to Obsidian vault    |
| **Knowledge ownership** | Lives in OpenAI's cloud       | Lives in your local files          |
| **Workflow**            | General-purpose AI assistant  | Purpose-built for goal achievement |
| **Note evolution**      | Static uploads                | Dynamic vault that grows over time |

ChatGPT Projects is a general assistant that can reference files. Ignite is a specialized system designed specifically for transforming knowledge into action within the Obsidian ecosystem.

### Ignite's Unique Position

No existing tool combines:

- Native Obsidian integration (your existing vault)
- Goal-oriented framing (not topic-based)
- AI-powered organization (zero manual curation)
- Knowledge accumulation (conversations, research, and drafts auto-saved to goal folders)
- JIT note creation (Research and Draft create notes exactly when needed)
- Non-judgmental philosophy (no scores, no guilt)

---

## How Ignite Transforms Knowledge into Action

### The Shift: From Collection to Completion

**Before Ignite**:

```
Notes → (accumulate) → More Notes → (organize) → Elaborate System → (never use)
```

**With Ignite**:

```
Goal declared → (AI matches) → Relevant Notes → (engage) → Actions → Goal Complete
```

### The Goal as a Container

A goal in Ignite is more than a label—it's a **living knowledge workspace** that grows over time:

- **Milestones**: Concrete checkpoints that define progress toward completion
- **Notes**: The subset of your vault relevant to this objective (linked, not copied)
- **Conversations**: Auto-saved discussion threads with AI-generated topic names
- **Research**: AI-generated notes that fill knowledge gaps via web search + synthesis
- **Drafts**: AI-generated documents and artifacts you need for the goal
- **Q&A History**: Record of sessions and areas needing review

When you complete a goal, it becomes a **read-only archive**—a record of what you learned and accomplished that you can revisit anytime.

### Goal Folder Structure

Each goal maps to a folder in your vault, creating a self-contained knowledge workspace:

```
ignite/
└── [goal-name]/
    ├── goal.md                            # Goal metadata, milestones, reflection
    │  ├── conversations/
    │      └── [auto-generated-topic].md   # Auto-saved from Discuss action
    │  └── research/
    │      └── [research-topic].md         # Generated from research action
    │  └── drafts/
    │      └── [document-name].md          # Generated from Draft action
```

This structure enables:

- **Knowledge accumulation**: Everything related to a goal lives in one place
- **JIT note creation**: Research and Draft actions create notes exactly when needed
- **Automatic organization**: No manual filing—AI handles topic naming and placement
- **Portability**: Goals are just folders; they can be moved, shared, or archived

### Progress Tracking

Progress in Ignite is **milestone-based**, not time-based or activity-based:

- **Milestones** are concrete, checkable sub-goals (e.g., "Research existing solutions", "Build first prototype")
- **Progress** = completed milestones ÷ total milestones
- **AI suggests 3-5 milestones** during goal creation based on the goal's scope
- **Users can edit milestones** after creation (add, remove, rename, reorder)
- **No milestone dates**: Only the parent goal has an optional deadline

This approach ensures progress is meaningful—it reflects actual accomplishment, not just time passing or notes consumed.

### Engagement Actions

Within each goal, Ignite offers multiple ways to interact with your knowledge:

| Action       | What it does                                                                                                                  | Output                              |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| **Discuss**  | Chat about your goal with three modes: Explore (open-ended), Teach Me (simplified explanations), Challenge (devil's advocate) | Auto-saved conversation notes       |
| **Research** | Fill knowledge gaps via web search + AI synthesis                                                                             | Generated research notes for review |
| **Draft**    | Create documents and artifacts through conversation                                                                           | Generated drafts for review         |
| **Q&A**      | Test understanding with goal-framed questions                                                                                 | Session history + weak areas        |

**Discuss Modes:**

- **Explore** (default): Open-ended discussion, "yes and" energy for brainstorming
- **Teach Me**: Explains concepts simply, assumes beginner level
- **Challenge**: Devil's advocate that pushes back on assumptions

**Knowledge Building Loop:**

1. Original vault notes feed the goal (assigned at creation)
2. Discuss generates insights → auto-saved as conversation notes
3. Research fills gaps → generates new notes for review
4. Draft produces artifacts → generates documents for review
5. All generated content feeds back into the goal's knowledge base

Every action is framed by the goal. "Summarize my React notes" becomes "Summarize what I know about React _for building my portfolio site_."

---

## User Experience (High Level)

### First-Time Experience

1. User installs Ignite and opens the sidebar panel
2. Ignite explains the goal-oriented philosophy in 2 sentences
3. User clicks "Create your first goal"
4. **Brainstorm Agent** engages in conversation:
   - "What are you trying to accomplish?"
   - "What will success look like?"
   - "When do you want to finish?"
5. Agent nudges toward action-oriented framing (but doesn't block vague goals)
6. **Agent suggests 3-5 milestones** based on the goal's scope
7. User reviews and confirms milestones (can edit, add, or remove)
8. Goal created with name, description, deadline, and milestones
9. AI scans vault, proposes relevant notes
10. User confirms note selection
11. Goal is active, engagement actions available

### Regular Usage

**Home Screen**: Lists active goals with key stats (note count, deadline, recent activity). One tap to enter any goal.

**Goal Detail Screen**: Shows milestones (with progress), assigned notes, available actions, and history of past interactions. User can check off milestones, add/remove notes, run actions, or mark complete.

**Action Flows**: Each action opens a focused experience:

- **Discuss** opens a chat interface with mode selection (Explore/Teach Me/Challenge); AI answers using relevant notes plus its own knowledge; conversations auto-save with AI-generated topic names; users can resume previous conversations
- **Research** identifies knowledge gaps, lets user select a topic, performs web search + synthesis, and presents a generated note for review before saving
- **Draft** asks what the user wants to create, gathers requirements through conversation, generates a draft document for review before saving
- **Q&A** presents questions one at a time with optional explanations; tracks session history and weak areas

### Goal Lifecycle

```
Create → Active → Complete → Archived
```

- **Active goals**: Where work happens. Deadlines visible, actions available.
- **Approaching deadline**: Visual indicator, gentle reminder on open.
- **Completed goals**: Read-only archives preserving full history.
- **Notes**: Never "used up"—same notes can serve multiple goals.

---

## Marketing Positioning

### Tagline Options

- **"Stop collecting. Start completing."**
- **"Knowledge in motion."**
- **"Your notes, ignited."**
- **"From hoarding to doing."**

### Target Audience

**Primary**: Obsidian power users who:

- Have accumulated 100+ notes over months/years
- Feel guilty about unread content
- Have tried and abandoned other knowledge systems
- Want to actually _use_ what they've saved

**Secondary**: Knowledge workers transitioning from other tools (Notion, Roam) who are ready for a more action-oriented approach.

### Key Messages

1. **For the overwhelmed collector**: "You don't need another organization system. You need a reason to use what you already have."

2. **For the productivity skeptic**: "No gamification. No guilt. Just goals and the knowledge to achieve them."

3. **For the Obsidian enthusiast**: "Your vault isn't a library—it's a workshop. Ignite helps you build things with it."

### Differentiation Story

> Most productivity tools ask you to _work harder_ at organizing. Ignite asks a different question: **What are you trying to accomplish?**
>
> Start there, and everything changes. Your notes stop being obligations and become resources. Your vault stops being a graveyard and becomes a toolkit. Learning stops being homework and becomes progress.
>
> Ignite doesn't help you organize knowledge. It helps you _use_ it.

### Launch Channels

1. **Obsidian community forums**: Core early adopter audience
2. **PKM Twitter/X**: Personal knowledge management enthusiasts
3. **Reddit**: r/ObsidianMD, r/productivity, r/PKMS
4. **Product Hunt**: Broader tech audience
5. **YouTube**: Demo videos showing the goal-to-completion flow

---

## Implementation Phases

### MVP (Required for Validation)

All components needed to validate the goal-oriented approach:

1. **Goal Folder Structure**

   - Goals stored as folders at `ignite/[goal-name]/`
   - Subfolders for conversations, research, drafts
   - Goal metadata in `goal.md`

2. **Goal + Notes UI**

   - Goal CRUD (create, read, update, delete)
   - Goal list and detail views
   - Manual note assignment
   - Goal completion/archival
   - Knowledge Base section (Notes, Conversations, Research, Drafts)

3. **AI-Powered Note Assignment**

   - Goal description analysis
   - Note relevance scoring
   - "AI suggests, user confirms" flow

4. **Discuss Action**

   - Chat interface with three modes: Explore (default), Teach Me, Challenge
   - AI uses assigned notes + its own knowledge to answer
   - Source attribution showing which notes informed answers
   - Off-topic question handling (friendly redirect to goal)
   - **Auto-save conversations** with AI-generated topic names
   - **Resume previous conversations** from Knowledge Base

5. **Research Action**

   - AI identifies knowledge gaps based on goal + existing notes
   - User selects topic or enters custom research query
   - Web search + AI synthesis
   - Generated note preview for user review
   - Save to `ignite/[goal]/research/[topic].md`

6. **Draft Action**

   - Conversational flow to understand what user wants to create
   - AI suggests draft types based on goal context
   - Generated document preview for user review
   - Save to `ignite/[goal]/drafts/[document-name].md`

7. **Q&A Action**

   - Goal-contextualized question generation
   - Q&A interface within goal
   - History saved to goal

8. **Brainstorm Agent**

   - Conversational goal creation
   - Nudging toward action-oriented goals
   - Deadline negotiation
   - **Milestone suggestion** (3-5 concrete checkpoints per goal)

9. **Milestone-Based Progress**
   - Milestones as checkable sub-goals
   - Progress bar showing completed/total milestones
   - Progress bar hidden when goal has no milestones
   - Users can add/edit/remove/reorder milestones after creation

### Post-MVP

- Deadline notifications
- Goal suggestions from vault clusters
- Learning paths within goals
- Cross-goal knowledge connections
- Deep research mode (more comprehensive synthesis like ChatGPT deep research)

---

## Appendix: Initial Setup

Before development begins:

- Rename repository: `obsidian-ai-recall` → `obsidian-ignite`
- Update package.json, manifest.json
- Update all code/doc references from "Recall" to "Ignite"
