---
created: 2025-12-25
updated: 2025-12-25
---

# Recall Plugin - Phase 1 Technical Design Document

## The Core Problem

**How do we generate relevant quiz questions from a vault of 100,000+ notes without:**

1. Calling the LLM on every note (too expensive, too slow)
2. Creating inconsistent/duplicate concepts (React Hooks vs useEffect patterns)
3. Missing important notes when a concept spans 1000+ files
4. Rebuilding everything when a single note changes

This TDD focuses on the **architectural decisions** that make this work at scale.

---

## Part 1: Concept Discovery at Scale

### The Challenge

A user has 100,000 notes. We need to identify quizzable concepts without LLM-analyzing every note.

### Approach: Hierarchical Filtering with Deferred LLM

```
100,000 notes
     ↓  (Local metadata extraction)
100,000 note metadata records (cheap)
     ↓  (Local clustering by filename/tags/folder)
~500 topic clusters
     ↓  (LLM: Name and validate top clusters)
~50-100 named concepts (presented to user)
     ↓  (User selects which to track)
~10-20 tracked concepts
     ↓  (On-demand: Deep analysis of notes in tracked concepts)
Quiz generation
```

### Stage 1: Leverage Obsidian's MetadataCache (No LLM)

**Critical Design Decision**: Don't duplicate work Obsidian already does!

Obsidian's `app.metadataCache` already parses and indexes all notes. We leverage this instead of building our own metadata layer:

```typescript
// Access note metadata via Obsidian's built-in cache
const file = app.vault.getAbstractFileByPath('notes/react/hooks-guide.md');
const cache = app.metadataCache.getFileCache(file);

// Available from metadataCache:
cache.tags; // [{tag: '#react', position: ...}, ...]
cache.links; // [{link: 'useState', ...}, ...]
cache.headings; // [{heading: 'Introduction', level: 1}, ...]
cache.frontmatter; // {created: '2024-12-20', ...}

// Link graph is pre-computed:
const resolvedLinks = app.metadataCache.resolvedLinks;
// resolvedLinks['notes/react/hooks-guide.md'] = {'useState.md': 3, 'useEffect.md': 2}
```

| Field        | Source                          | Example                                     |
| ------------ | ------------------------------- | ------------------------------------------- |
| `path`       | `TFile.path`                    | `notes/react/hooks-guide.md`                |
| `title`      | `cache.headings[0]` or filename | "Complete Guide to React Hooks"             |
| `folder`     | `TFile.parent.path`             | "notes/react"                               |
| `tags`       | `cache.tags`                    | `["#react", "#frontend", "#hooks"]`         |
| `links`      | `cache.links`                   | `["useState", "useEffect"]`                 |
| `headings`   | `cache.headings`                | `["Introduction", "useState", "useEffect"]` |
| `modifiedAt` | `TFile.stat.mtime`              | 1703088000000                               |
| `wordCount`  | Computed on-demand              | 2,450 words                                 |

**Cost**: Zero LLM calls. Metadata is already in memory.

**Storage**: We do NOT store duplicate note metadata. Instead, we only persist:

- Concept definitions and mappings
- Quiz history (event-sourced)
- Question cache

### Stage 2: Local Clustering (No LLM) — Deep Dive

Group notes using **local signals only**. No embeddings, no LLM.

#### The Core Insight

Most personal vaults have **natural organization signals** that users have already created:

- Folder structure (`/golf/swing/`, `/react/hooks/`)
- Tags (`#golf`, `#react-hooks`)
- Wiki-links (`[[useState]]` appears in 20 notes)
- Naming patterns (`golf-*.md`, `*-hooks.md`)

We exploit these signals systematically.

#### Clustering Algorithm: Multi-Pass Approach

**Pass 1: Folder-Based Seeding**

```
For each unique folder path:
  Create initial cluster
  Assign all notes in that folder

Example:
  /notes/golf/swing/    → cluster_golf_swing (23 notes)
  /notes/golf/putting/  → cluster_golf_putting (12 notes)
  /notes/react/hooks/   → cluster_react_hooks (45 notes)
  /notes/daily/         → cluster_daily (500 notes)  ← too big, will split
```

**Pass 2: Tag-Based Refinement**

```
For each cluster:
  Extract all tags from notes in cluster
  If dominant tag(s) differ from folder name:
    Consider splitting by tag

Example:
  cluster_golf_swing has notes with:
    #golf (23), #swing (20), #driver (8), #iron (6)
  → No split needed, tags align with folder

  cluster_daily has notes with:
    #journal (400), #work (150), #personal (100), #health (50)
  → Split into: cluster_daily_journal, cluster_daily_work, etc.
```

**Pass 3: Link-Based Merging (Sample-Based for Performance)**

**Problem**: Building a full adjacency matrix for 100k notes is O(n²) - too slow.

**Solution**: Use sample-based analysis with Obsidian's pre-computed `resolvedLinks`:

```typescript
// Obsidian already has the link graph computed!
const resolvedLinks = app.metadataCache.resolvedLinks;

function analyzeClusterLinks(
  cluster: Cluster,
  sampleSize = 50
): ClusterLinkStats {
  // Sample representative notes (weighted by link count)
  const sample = weightedSample(cluster.noteIds, sampleSize);

  const outgoingClusters = new Map<string, number>();

  for (const noteId of sample) {
    const links = resolvedLinks[noteId] || {};
    for (const linkedNote of Object.keys(links)) {
      const targetCluster = noteToCluster.get(linkedNote);
      if (targetCluster && targetCluster !== cluster.id) {
        outgoingClusters.set(
          targetCluster,
          (outgoingClusters.get(targetCluster) || 0) + 1
        );
      }
    }
  }

  return {outgoingClusters, sampleSize};
}
```

**Merge heuristic** (based on sampled data):

```
Merge clusters if:
  - Cross-cluster link density > 0.3 (30% of SAMPLED notes link to other cluster)
  - Cluster sizes are similar (within 3x)

Example:
  cluster_react_hooks sample: 50 notes, 18 link to cluster_react_state (36%)
  cluster_react_state sample: 50 notes, 15 link to cluster_react_hooks (30%)
  → Merge into cluster_react_hooks_and_state
```

**Performance**: O(sampleSize × avgLinks) per cluster, not O(n²)

**Pass 4: Title Keyword Grouping**

```
For remaining unclustered or single-note clusters:
  Extract keywords from titles using TF-IDF
  Group notes with similar title keywords

Example:
  "Advanced Golf Driving Tips.md"
  "Driver Club Selection Guide.md"
  "How to Hit Longer Drives.md"
  → All share "driv*" keyword, group together
```

**Pass 5: Size Normalization**

```
Split clusters > 500 notes:
  Use sub-folder or secondary tag
  If no sub-signal, use temporal splits (by year/quarter)

Merge clusters < 5 notes:
  Into nearest related cluster (by tag similarity)
  Or into "uncategorized" for manual review
```

#### Candidate Name Generation (No LLM)

For each cluster, generate candidate names from:

1. **Folder name**: `golf/swing` → "Golf Swing"
2. **Dominant tag**: `#react-hooks` → "React Hooks"
3. **Common title prefix**: "Golf - \*.md" → "Golf"
4. **Most-linked note title**: If `[[useState Guide]]` is linked by 30 notes, use "useState Guide"

Store multiple candidates for LLM to choose from in Stage 3.

#### Output Data Structure

```json
{
  "clusters": {
    "cluster_golf_swing": {
      "candidateNames": ["Golf Swing", "Swing Mechanics", "Golf Technique"],
      "noteCount": 45,
      "dominantTags": ["#golf", "#swing"],
      "folderPath": "/notes/golf/swing/",
      "representativeNotes": [
        "notes/golf/swing/tempo-guide.md",
        "notes/golf/swing/backswing-basics.md"
      ],
      "internalLinkDensity": 0.6, // 60% of notes link to each other
      "createdAt": "2024-12-20"
    }
  }
}
```

#### Performance Characteristics

With sample-based link analysis and Obsidian's metadataCache:

| Vault Size | Pass 1 | Pass 2 | Pass 3 (sampled) | Pass 4 | Pass 5 | Total |
| ---------- | ------ | ------ | ---------------- | ------ | ------ | ----- |
| 1k notes   | <1s    | <1s    | <1s              | <1s    | <1s    | <3s   |
| 10k notes  | <2s    | <3s    | <2s              | <3s    | <1s    | <12s  |
| 100k notes | <10s   | <15s   | <5s              | <10s   | <3s    | <45s  |

**Key optimizations**:

- Pass 1-2: Iterate `app.vault.getMarkdownFiles()` once
- Pass 3: Sample 50 notes per cluster, use pre-computed `resolvedLinks`
- All passes: Single-threaded but with progress callbacks for UI feedback

#### Edge Cases

| Case                              | Handling                                       |
| --------------------------------- | ---------------------------------------------- |
| Flat vault (no folders)           | Rely on tags → titles → links                  |
| No tags used                      | Rely on folders → titles → links               |
| Daily notes (1000+ in one folder) | Split by date/week/month                       |
| Orphan notes (no links, no tags)  | Group by title keywords, else "Uncategorized"  |
| Non-English notes                 | Use Intl.Segmenter for CJK, tags/folders work  |

#### CJK Language Support (Chinese, Japanese, Korean)

**The Problem**: TF-IDF keyword extraction assumes space-separated words. CJK languages don't use spaces:

```
"React钩子使用指南" (React hooks usage guide)
→ Without segmentation: treated as one "word", TF-IDF fails
→ With segmentation: ["React", "钩子", "使用", "指南"]
```

**Solution**: Use `Intl.Segmenter` — a native browser/JS API with zero bundle cost.

```typescript
function extractTitleKeywords(title: string): string[] {
  const lang = detectLanguage(title);

  if (isCJK(lang)) {
    return segmentCJK(title, lang);
  }

  return extractEnglishKeywords(title); // Existing TF-IDF
}

function segmentCJK(text: string, lang: string): string[] {
  // Intl.Segmenter: native API, zero bundle size, works on mobile
  if (typeof Intl.Segmenter === 'undefined') {
    // Fallback for very old devices: skip CJK keyword extraction
    // These notes will cluster by folders/tags only
    return [];
  }

  const segmenter = new Intl.Segmenter(lang, { granularity: 'word' });
  return [...segmenter.segment(text)]
    .filter(s => s.isWordLike)
    .map(s => s.segment);
}

function detectLanguage(text: string): string {
  const totalChars = text.replace(/\s/g, '').length;
  if (totalChars === 0) return 'en';

  // Count CJK characters
  const cjkPattern = /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/g;
  const cjkChars = (text.match(cjkPattern) || []).length;
  const cjkRatio = cjkChars / totalChars;

  // Only treat as CJK if >30% of characters are CJK
  if (cjkRatio < 0.3) return 'en';

  // Determine specific CJK language
  const hiragana = (text.match(/[\u3040-\u309f]/g) || []).length;
  const katakana = (text.match(/[\u30a0-\u30ff]/g) || []).length;
  const hangul = (text.match(/[\uac00-\ud7af]/g) || []).length;

  if (hiragana + katakana > hangul && hiragana + katakana > 0) return 'ja';
  if (hangul > 0) return 'ko';
  return 'zh';
}

function isCJK(lang: string): boolean {
  return ['zh', 'ja', 'ko'].includes(lang);
}
```

**Language Detection Examples**:

| Title | CJK Ratio | Result |
| ----- | --------- | ------ |
| "React钩子使用指南" | 6/10 = 60% | `zh` ✅ |
| "React Tutorial by 张三" | 2/18 = 11% | `en` ✅ |
| "Reactフック入門ガイド" | 7/12 = 58% | `ja` ✅ |
| "Korean 한글 Test" | 2/12 = 17% | `en` ✅ |
| "한글로 작성된 노트" | 8/9 = 89% | `ko` ✅ |

**Platform Support**:

| Platform | Intl.Segmenter Support |
| -------- | ---------------------- |
| Desktop (Electron) | ✅ Full support |
| iOS (Safari 14.1+) | ✅ iOS 14.5+ |
| Android (WebView) | ✅ Chrome 87+ |
| Older devices | ⚠️ Falls back to folder/tag clustering only |

**Why not external dictionaries?**

| Approach | Bundle Size | Mobile Friendly |
| -------- | ----------- | --------------- |
| nodejieba (Chinese) | 15MB | ❌ Too large |
| kuromoji (Japanese) | 20MB | ❌ Too large |
| Intl.Segmenter | 0KB | ✅ Native API |

**Graceful Degradation**: If `Intl.Segmenter` is unavailable, CJK notes still cluster via:
- Folder structure (Pass 1)
- Tags (Pass 2)
- Link relationships (Pass 3)

Only title keyword grouping (Pass 4) is skipped — acceptable tradeoff for older devices.

### Stage 3: LLM Concept Naming (Limited LLM)

Only now do we use the LLM—but strategically:

**Input to LLM**: Batched cluster summaries (not full notes)

```
For each cluster:
- Candidate names from local analysis
- Top 5 representative note titles
- Common tags
- Folder path
```

**LLM Task**:

1. Assign a canonical concept name
2. Suggest related clusters to merge
3. Score "quizzability" (0-1)
4. Flag clusters that aren't quizzable (meeting notes, daily journals)

**Batch Strategy**:

- Send 20 clusters per LLM call
- ~25 LLM calls total for 500 clusters
- Estimated tokens: ~50k total

**Output**: Named concepts with metadata

### Stage 4: User Concept Selection

Present top 50-100 concepts ordered by:

1. Quizzability score (from LLM)
2. Note count (more notes = more quizzable content)
3. Recency (recently modified notes = still relevant)

User selects which concepts to track. Only **tracked concepts** get deep analysis.

---

## Part 2: Concept Identity and Consistency — Deep Dive

### The Core Problem

Users don't think in consistent terminology. The same topic appears as:

- "React Hooks" (folder name)
- "useEffect patterns" (note title)
- "Custom hooks in React" (another note)
- `#hooks` (tag)
- `[[useState]]` (linked note)

**Without careful design, we get:**

- `concept_react_hooks` (156 notes)
- `concept_useEffect` (23 notes) ← These are the same topic!
- `concept_custom_hooks` (8 notes) ← Also the same!

### Solution: Multi-Level Identity Resolution

#### Level 1: Canonical Concept Registry

Each concept has a **stable identity** that survives renames:

```json
{
  "id": "concept_a1b2c3d4", // UUID, never changes
  "canonicalName": "React Hooks", // Display name, can change
  "aliases": [
    "useEffect",
    "useState",
    "custom hooks",
    "React hook patterns",
    "hooks API"
  ],
  "matchPatterns": {
    "folders": ["/react/hooks", "/frontend/react", "/code/react"],
    "tags": ["#react-hooks", "#hooks", "#useEffect", "#useState"],
    "titleKeywords": [
      "hook",
      "useEffect",
      "useState",
      "useContext",
      "useReducer"
    ],
    "linkedNotes": ["useState.md", "useEffect.md", "custom-hooks.md"]
  },
  "exclusions": {
    "titleKeywords": ["fishing hook", "crochet hook"], // False positives
    "folders": ["/fishing/"]
  },
  "metadata": {
    "quizzabilityScore": 0.85,
    "noteCount": 187,
    "createdAt": "2024-12-01",
    "lastUpdated": "2024-12-20",
    "mergedFrom": ["concept_useEffect_old", "concept_custom_hooks_old"]
  }
}
```

#### Level 2: Match Pattern Scoring

When assigning a note to concepts, use **weighted scoring** not just presence:

```
Note: "Advanced useEffect Patterns for Data Fetching"
Tags: #react, #patterns, #async
Folder: /notes/react/advanced/

Scoring against concept_react_hooks:
  Folder match ("/react/") :     +0.3  (partial match)
  Tag match ("#react"):          +0.2  (related but not exact)
  Title keyword ("useEffect"):   +0.5  (exact alias match)
  Title keyword ("patterns"):    +0.1  (weak signal)
  Total:                         1.1

Scoring against concept_async_patterns:
  Folder match:                  +0.0  (no match)
  Tag match ("#async"):          +0.4  (exact)
  Title keyword ("async"):       +0.0  (not in title)
  Title keyword ("Data Fetching"):+0.3 (partial)
  Total:                         0.7

Result: Assign to concept_react_hooks (score 1.1 > 0.7)
        Also assign to concept_async_patterns if score > threshold (0.5)
```

#### Level 3: Duplicate Detection and Merging

**Problem**: LLM names two clusters separately that should be one concept.

**Detection heuristics** (run during clustering):

1. **Alias overlap**: If Concept A's aliases overlap >50% with Concept B's aliases
2. **Note overlap**: If >30% of notes in Concept A are also in Concept B
3. **Semantic similarity**: If canonical names are similar ("React Hooks" vs "Hooks in React")
4. **Folder overlap**: If concepts share >50% of folder paths

**Merge decision flow**:

```
Detected potential duplicate:
  Concept A: "React Hooks" (156 notes)
  Concept B: "useEffect Patterns" (23 notes)
  Overlap: 18 notes (78% of B)

Step 1: Check if B is a SUBSET of A
  → Yes (78% overlap), B should merge INTO A

Step 2: LLM confirmation (batched with other decisions)
  → "Should 'useEffect Patterns' merge into 'React Hooks'?"
  → LLM: "Yes, useEffect is a specific React hook"

Step 3: Execute merge
  → Add B's unique notes to A
  → Add "useEffect Patterns" to A's aliases
  → Add B's match patterns to A's match patterns
  → Record merge in A's metadata.mergedFrom
  → Deprecate B (keep ID mapping for history)
```

**Merge storage**:

```json
{
  "deprecatedConcepts": {
    "concept_useEffect_old": {
      "mergedInto": "concept_a1b2c3d4",
      "mergedAt": "2024-12-20",
      "reason": "subset_merge"
    }
  }
}
```

#### Level 4: Incremental Alias Learning

As users interact, learn new aliases:

**Signal 1: Quiz searches**

```
User searches: "hooks for state"
System matches: concept_react_hooks
→ Add "hooks for state" as weak alias (weight 0.3)
```

**Signal 2: Manual concept assignment**

```
User drags note "My useState Guide" into concept "React Hooks"
→ Add "useState Guide" pattern to titleKeywords
```

**Signal 3: Flag patterns**

```
User flags question as "not relevant to React Hooks"
Source note: "Fishing Hook Techniques"
→ Add "fishing" to exclusions.titleKeywords
```

#### Level 5: Handling Hierarchical Concepts

Some concepts are subsets of others:

```
React (parent)
├── React Hooks (child)
│   ├── useState (grandchild)
│   └── useEffect (grandchild)
└── React Components (child)
```

**Options**:

**Option A: Flat with tags** (simpler, recommended for Phase 1)

- All concepts are flat
- Note can belong to multiple: [React, React Hooks, useState]
- Quiz on "React" includes all child concepts

**Option B: Explicit hierarchy** (future enhancement)

- Concepts have `parentId` field
- Quiz on "React" rolls up to include children
- More complex UI for management

### Concept Assignment Algorithm (Complete)

```
function assignNoteToConcepts(note: Note): string[] {
  const scores: Map<string, number> = new Map();

  // Score against all tracked concepts
  for (const concept of trackedConcepts) {
    let score = 0;

    // Folder matching (0.3 - 0.5)
    for (const folder of concept.matchPatterns.folders) {
      if (note.path.startsWith(folder)) {
        score += 0.5;  // Exact match
      } else if (note.path.includes(folder.split('/').pop())) {
        score += 0.3;  // Partial match
      }
    }

    // Tag matching (0.2 - 0.4 per tag)
    for (const tag of concept.matchPatterns.tags) {
      if (note.tags.includes(tag)) {
        score += 0.4;  // Exact match
      } else if (note.tags.some(t => t.includes(tag.slice(1)))) {
        score += 0.2;  // Partial match
      }
    }

    // Title keyword matching (0.3 - 0.5 per keyword)
    const titleLower = note.title.toLowerCase();
    for (const keyword of concept.matchPatterns.titleKeywords) {
      if (titleLower.includes(keyword.toLowerCase())) {
        score += 0.5;
      }
    }

    // Alias matching (0.4 per alias)
    for (const alias of concept.aliases) {
      if (titleLower.includes(alias.toLowerCase())) {
        score += 0.4;
      }
    }

    // Link matching (0.3 per linked note)
    for (const linkedNote of concept.matchPatterns.linkedNotes) {
      if (note.links.includes(linkedNote)) {
        score += 0.3;
      }
    }

    // Exclusion penalties (-1.0 to disqualify)
    for (const exclusion of concept.exclusions.titleKeywords) {
      if (titleLower.includes(exclusion.toLowerCase())) {
        score -= 1.0;
      }
    }
    for (const excludedFolder of concept.exclusions.folders) {
      if (note.path.startsWith(excludedFolder)) {
        score -= 1.0;
      }
    }

    if (score > 0.5) {  // Threshold for assignment
      scores.set(concept.id, score);
    }
  }

  // Return concepts sorted by score, take top 3
  return Array.from(scores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([conceptId]) => conceptId);
}
```

### Avoiding Duplicate Concepts: Prevention Checklist

| Stage       | Prevention Mechanism                                               |
| ----------- | ------------------------------------------------------------------ |
| Clustering  | Merge clusters with >50% tag overlap before LLM naming             |
| LLM Naming  | Prompt includes existing concept names; ask "is this a duplicate?" |
| Post-Naming | Run similarity check on new concept vs existing                    |
| User Action | "Merge concepts" UI action                                         |
| Ongoing     | Weekly maintenance job to detect drift/duplicates                  |

---

## Part 3: Storage Architecture (Partitioned JSON)

### Design Principles

1. **Don't duplicate Obsidian's metadata** - Use `metadataCache` for note info
2. **Partition by entity** - One file per concept, not one giant file
3. **Event-source history** - Store events, not computed state (sync-friendly)
4. **Write-safe** - Backup before write, atomic rename

### Directory Structure

```
.recall/
├── config.json                    # User settings (small)
├── concepts/
│   ├── index.json                 # Lightweight concept list (~50KB)
│   └── tracked/
│       └── {concept_id}.json      # Full concept data (one per concept)
├── cache/
│   └── questions/
│       └── {note_path_hash}.json  # Cached questions per note
├── history/
│   └── {year}-{month}.json        # Event-sourced quiz history (partitioned)
└── clusters.json                   # Topic clusters (regeneratable)
```

### Why Partitioned?

| Problem with Single File       | Solution with Partitioned                 |
| ------------------------------ | ----------------------------------------- |
| 50MB file corrupts = all lost  | One concept corrupts = others fine        |
| Any change rewrites whole file | Only affected file rewrites               |
| Sync conflict = data loss      | Conflict isolated to single concept/month |
| Slow startup (parse 50MB)      | Load only what's needed                   |

### Key Files Explained

**`concepts/index.json`** (Lightweight index, ~50KB)

```json
{
  "version": 1,
  "concepts": {
    "concept_a1b2c3d4": {
      "canonicalName": "React Hooks",
      "noteCount": 156,
      "isTracked": true,
      "quizzabilityScore": 0.85,
      "lastUpdated": "2024-12-20"
    }
    // Light metadata only - full data in tracked/{id}.json
  }
}
```

**`concepts/tracked/{concept_id}.json`** (Full concept data)

```json
{
  "version": 1,
  "id": "concept_a1b2c3d4",
  "canonicalName": "React Hooks",
  "aliases": ["useEffect", "useState", "custom hooks"],
  "matchPatterns": {
    "folders": ["/react/hooks", "/frontend/react"],
    "tags": ["#react-hooks", "#hooks"],
    "titleKeywords": ["hook", "useEffect", "useState"]
  },
  "exclusions": {
    "titleKeywords": ["fishing hook"],
    "folders": ["/fishing/"]
  },
  "noteIds": ["notes/react/hooks-guide.md", "notes/react/useState.md"],
  "metadata": {
    "createdAt": "2024-12-01",
    "lastUpdated": "2024-12-20"
  }
}
```

**`history/{year}-{month}.json`** (Event-sourced, sync-friendly)

```json
{
  "version": 1,
  "events": [
    {
      "id": "evt_abc123",
      "ts": 1703500000000,
      "type": "answer",
      "noteId": "notes/react/hooks-guide.md",
      "conceptId": "concept_a1b2c3d4",
      "questionId": "q_001",
      "correct": true
    },
    {
      "id": "evt_def456",
      "ts": 1703500100000,
      "type": "flag",
      "questionId": "q_002",
      "reason": "ambiguous"
    }
  ]
}
```

**Why event-sourced history?** See Part 5 for details on sync conflict resolution.

**`cache/questions/{note_path_hash}.json`** (Regeneratable cache)

```json
{
  "version": 1,
  "notePath": "notes/react/hooks-guide.md",
  "contentHash": "abc123",
  "generatedAt": "2024-12-15T10:00:00Z",
  "questions": [
    {
      "id": "q_001",
      "format": "multiple_choice",
      "question": "What does useState return?",
      "options": ["A tuple", "An object", "A function", "A string"],
      "correctAnswer": 0,
      "difficulty": "easy"
    }
  ]
}
```

### Write Safety Pattern

All writes use backup + atomic rename:

```typescript
async function safeWriteJson(path: string, data: any): Promise<void> {
  const adapter = app.vault.adapter;
  const backup = path + '.bak';
  const temp = path + '.tmp';

  // 1. Backup existing file
  if (await adapter.exists(path)) {
    await adapter.copy(path, backup);
  }

  // 2. Write to temp file
  await adapter.write(temp, JSON.stringify(data, null, 2));

  // 3. Atomic rename (or as close as filesystem allows)
  await adapter.rename(temp, path);
}

async function safeReadJson<T>(path: string, fallback: T): Promise<T> {
  const adapter = app.vault.adapter;

  try {
    const content = await adapter.read(path);
    return JSON.parse(content);
  } catch (e) {
    // Try backup
    const backup = path + '.bak';
    if (await adapter.exists(backup)) {
      console.warn(`Recovering ${path} from backup`);
      const content = await adapter.read(backup);
      return JSON.parse(content);
    }
    return fallback;
  }
}
```

### Schema Versioning

Every JSON file includes a `version` field. On load:

```typescript
function migrateIfNeeded<T>(
  data: T & {version: number},
  migrations: Migration[]
): T {
  let current = data;
  for (const migration of migrations) {
    if (current.version < migration.toVersion) {
      current = migration.migrate(current);
      current.version = migration.toVersion;
    }
  }
  return current;
}
```

---

## Part 4: Incremental Updates

### The Challenge

When a note changes, what needs updating?

- If 1 note changes → Don't rebuild everything
- If concept mapping changes → Don't re-analyze all notes
- Since we use `metadataCache`, we don't maintain a separate note index

### Obsidian Event Integration

Use Obsidian's built-in file events instead of polling:

```typescript
class RecallPlugin extends Plugin {
  async onload() {
    // Real-time file events
    this.registerEvent(
      this.app.vault.on('create', (file) => this.onNoteCreated(file))
    );
    this.registerEvent(
      this.app.vault.on('modify', (file) => this.onNoteModified(file))
    );
    this.registerEvent(
      this.app.vault.on('delete', (file) => this.onNoteDeleted(file))
    );
    this.registerEvent(
      this.app.vault.on('rename', (file, oldPath) =>
        this.onNoteRenamed(file, oldPath)
      )
    );

    // MetadataCache events (fires after Obsidian finishes parsing)
    this.registerEvent(
      this.app.metadataCache.on('changed', (file) =>
        this.onMetadataChanged(file)
      )
    );
  }
}
```

### Update Triggers and Actions

| Trigger                   | Detection                     | Action                                          |
| ------------------------- | ----------------------------- | ----------------------------------------------- |
| Note created              | `vault.on('create')`          | Run concept assignment for new note             |
| Note modified             | `metadataCache.on('changed')` | Invalidate question cache if in tracked concept |
| Note deleted              | `vault.on('delete')`          | Remove from concept mappings                    |
| Note renamed              | `vault.on('rename')`          | Update path in concept noteIds arrays           |
| Many notes changed (sync) | `resolvedCount` spike on load | Batch process, defer concept reassignment       |

### Change Detection Strategy

**On plugin load:**

```typescript
async onLayoutReady() {
  // Check if clusters need rebuilding (e.g., first run or version upgrade)
  const clustersExist = await this.app.vault.adapter.exists('.recall/clusters.json');

  if (!clustersExist) {
    // First run: build clusters from scratch
    await this.rebuildClusters();
  } else {
    // Normal load: just validate tracked concepts still have valid notes
    await this.validateTrackedConcepts();
  }
}
```

**On file change (real-time):**

1. Debounce: Wait 2 seconds after last `metadataCache.changed` event
2. Check if note is in tracked concept
3. If yes, invalidate question cache for that note
4. Concept reassignment only if tags/folder changed significantly

**Weekly maintenance (optional background job):**

1. Re-cluster unassigned notes
2. Suggest new concepts from clusters
3. Detect concept drift (notes no longer matching patterns)

### Invalidation Rules

```
Note content changed:
  → Invalidate: question cache for this note
  → Keep: concept assignment (unless tags/links changed)

Note tags/folder changed:
  → Re-run: concept assignment
  → Invalidate: question cache

Concept definition changed (matchPatterns):
  → Re-run: concept assignment for all notes in vault
  → Keep: question cache (content unchanged)

Note deleted:
  → Remove: from all concept noteIds arrays
  → Delete: question cache file
```

### Error Recovery

All file writes use the safe write pattern from Part 3. Additionally:

```typescript
// On corrupted data detection, offer rebuild
if (conceptsCorrupted) {
  new Notice('Recall: Concept data corrupted. Rebuilding from vault...');
  await this.rebuildClusters(); // Safe: clusters are regeneratable
}
```

---

## Part 5: Note Selection for Quiz Generation — Deep Dive

### The Core Problem

Concept "React Hooks" has 1,000 notes. User wants 10 questions.

**Naive approaches fail:**

- **Random selection**: Ignores spaced repetition, wastes learning opportunity
- **Top 10 by date**: Always quizzes same recent notes, ignores old knowledge
- **Top 10 by importance**: Same notes every time, user gets bored

**We need**: Intelligent sampling that balances learning effectiveness, variety, and user engagement.

### The Selection Pipeline

```
1,000 notes in concept
     ↓  (Pre-filter: quizzable only)
800 quizzable notes
     ↓  (Score each note)
800 scored notes
     ↓  (Stratified sampling)
15 selected notes (with variety guarantees)
     ↓  (Generate questions)
30-45 candidate questions
     ↓  (Final selection)
10 questions (format + difficulty balanced)
```

### Pre-Filter: Quizzable Notes Only

Not all notes are quizzable. Filter out:

| Filter           | Threshold                                   | Rationale                          |
| ---------------- | ------------------------------------------- | ---------------------------------- |
| Word count       | < 100 words                                 | Too short for meaningful questions |
| Content type     | Daily notes, meeting notes                  | Low quizzability                   |
| Already mastered | correctStreak > 5 AND lastQuizzed < 14 days | Don't over-quiz mastered content   |
| Recently quizzed | < 1 day ago                                 | Prevent immediate repetition       |

```
function isQuizzable(note: Note, history: QuizHistory): boolean {
  if (note.wordCount < 100) return false;
  if (note.tags.includes('#daily') || note.tags.includes('#meeting')) return false;

  const noteHistory = history.getForNote(note.path);
  if (noteHistory.correctStreak > 5 && noteHistory.daysSinceQuiz < 14) return false;
  if (noteHistory.daysSinceQuiz < 1) return false;

  return true;
}
```

### Scoring Function: Multi-Factor Priority

Each note gets a **priority score** from 0 to 1:

```
score = (w₁ × spacedRepScore) +
        (w₂ × richnessScore) +
        (w₃ × recencyScore) +
        (w₄ × varietyScore) +
        (w₅ × struggleScore)
```

**Configurable Weights** (stored in `config.json`):

```json
{
  "selectionWeights": {
    "spacedRep": 0.35,
    "richness": 0.2,
    "recency": 0.15,
    "variety": 0.15,
    "struggle": 0.15
  }
}
```

Users can adjust these in settings. Defaults optimized for learning retention.

### Cold Start Handling

**Problem**: New vaults or new concepts have no quiz history. All notes get similar scores.

**Solution**: Use content-based signals for never-quizzed notes:

```typescript
function calculateNoteScore(
  note: NoteMetadata,
  history: QuizHistory | null
): number {
  const weights = getConfiguredWeights();

  // Cold start: no history for this note
  if (!history || !history.hasQuizzedNote(note.path)) {
    return calculateColdStartScore(note, weights);
  }

  // Normal scoring with history
  return (
    weights.spacedRep * spacedRepScore(note, history) +
    weights.richness * richnessScore(note) +
    weights.recency * recencyScore(note) +
    weights.variety * varietyScore(note, history) +
    weights.struggle * struggleScore(note, history)
  );
}

function calculateColdStartScore(note: NoteMetadata, weights: Weights): number {
  // For never-quizzed notes, use content signals + randomness for variety
  const cache = app.metadataCache.getFileCache(note.file);

  const structureScore = Math.min(1, (cache?.headings?.length || 0) * 0.15);
  const linkPopularity = getIncomingLinkCount(note.path) / 10; // Normalize
  const recency = recencyScore(note);
  const jitter = Math.random() * 0.2; // Prevent deterministic ordering

  return (
    0.25 * structureScore + // Well-structured notes = more quizzable
    0.25 * Math.min(1, linkPopularity) + // Popular notes = important
    0.3 * recency + // Recent notes = still relevant
    0.2 * jitter // Randomness for variety
  );
}
```

#### Factor 1: Spaced Repetition Score (35%)

Based on SM-2 algorithm principles:

```
function spacedRepScore(note: Note, history: QuizHistory): number {
  const h = history.getForNote(note.path);

  // Never quizzed = highest priority
  if (!h.lastQuizzed) return 1.0;

  // Calculate target interval based on correct streak
  const intervals = [1, 3, 7, 14, 30, 60, 120];  // days
  const targetInterval = intervals[Math.min(h.correctStreak, 6)];

  // How overdue is this note?
  const daysSinceDue = h.daysSinceQuiz - targetInterval;

  if (daysSinceDue > 30) return 0.95;   // Very overdue
  if (daysSinceDue > 7) return 0.85;    // Moderately overdue
  if (daysSinceDue > 0) return 0.70;    // Slightly overdue
  if (daysSinceDue > -3) return 0.50;   // Coming due soon
  return 0.20;                           // Not due yet
}
```

**Example timeline for a note:**

```
Quiz 1: Correct → Next review in 1 day
Quiz 2: Correct → Next review in 3 days
Quiz 3: Wrong → Reset to 1 day (correctStreak = 0)
Quiz 4: Correct → Next review in 1 day
Quiz 5: Correct → Next review in 3 days
...
```

#### Factor 2: Content Richness Score (20%)

Notes with more quizzable content should be prioritized:

````
function richnessScore(note: Note): number {
  // Based on cached concept extraction
  const extractedConcepts = cache.getExtractedConcepts(note.path);

  if (!extractedConcepts) {
    // Estimate from note structure
    const headingCount = note.headings.length;
    const hasCodeBlocks = note.content.includes('```');
    const hasBulletLists = (note.content.match(/^[\-\*]/gm) || []).length;

    const structureScore = Math.min(1, (headingCount * 0.1) + (hasBulletLists * 0.05));
    return structureScore;
  }

  // Based on actual extracted concepts
  const conceptCount = extractedConcepts.length;
  const avgConfidence = extractedConcepts.reduce((sum, c) => sum + c.confidence, 0) / conceptCount;

  return Math.min(1, (conceptCount * 0.1) * avgConfidence);
}
````

#### Factor 3: Recency Score (15%)

Recently modified notes may contain fresh, relevant knowledge:

```
function recencyScore(note: Note): number {
  const daysSinceModified = (Date.now() - note.modifiedAt) / (1000 * 60 * 60 * 24);

  if (daysSinceModified < 7) return 1.0;    // This week
  if (daysSinceModified < 30) return 0.7;   // This month
  if (daysSinceModified < 90) return 0.5;   // This quarter
  if (daysSinceModified < 365) return 0.3;  // This year
  return 0.1;                                // Older
}
```

#### Factor 4: Variety Score (15%)

Prevent "quiz fatigue" by avoiding over-used notes:

```
function varietyScore(note: Note, history: QuizHistory): number {
  const h = history.getForNote(note.path);

  // Never quizzed = highest variety value
  if (!h.quizCount) return 1.0;

  // Calculate quiz frequency in last 30 days
  const quizzesLast30Days = h.recentQuizDates.filter(
    d => (Date.now() - d) < 30 * 24 * 60 * 60 * 1000
  ).length;

  // Inverse of frequency
  if (quizzesLast30Days === 0) return 0.9;
  if (quizzesLast30Days === 1) return 0.7;
  if (quizzesLast30Days === 2) return 0.5;
  if (quizzesLast30Days >= 3) return 0.2;

  return 0.5;
}
```

#### Factor 5: Struggle Score (15%)

Prioritize notes the user struggles with:

```
function struggleScore(note: Note, history: QuizHistory): number {
  const h = history.getForNote(note.path);

  if (!h.quizCount) return 0.5;  // Unknown difficulty

  const accuracy = h.correctCount / h.quizCount;

  // Low accuracy = high struggle = high priority
  if (accuracy < 0.3) return 1.0;   // Struggling badly
  if (accuracy < 0.5) return 0.8;   // Needs work
  if (accuracy < 0.7) return 0.5;   // Average
  if (accuracy < 0.9) return 0.3;   // Good
  return 0.1;                        // Mastered
}
```

### Stratified Sampling Algorithm

Don't just take top 15 by score. Use **stratified sampling** to ensure diversity:

```
function selectNotes(concept: Concept, targetCount: number = 15): Note[] {
  const quizzableNotes = concept.notes.filter(n => isQuizzable(n));
  const scoredNotes = quizzableNotes.map(n => ({
    note: n,
    score: calculatePriorityScore(n)
  }));

  // Sort by score
  scoredNotes.sort((a, b) => b.score - a.score);

  // Stratified selection
  const selected: Note[] = [];

  // Stratum 1: High priority (top 20% by score) - take 40%
  const highPriority = scoredNotes.slice(0, Math.floor(scoredNotes.length * 0.2));
  selected.push(...weightedSample(highPriority, Math.floor(targetCount * 0.4)));

  // Stratum 2: Medium priority (20-60% by score) - take 35%
  const mediumPriority = scoredNotes.slice(
    Math.floor(scoredNotes.length * 0.2),
    Math.floor(scoredNotes.length * 0.6)
  );
  selected.push(...weightedSample(mediumPriority, Math.floor(targetCount * 0.35)));

  // Stratum 3: "Fresh" notes (never quizzed) - take 25%
  const freshNotes = scoredNotes.filter(n => !history.getForNote(n.note.path).quizCount);
  selected.push(...weightedSample(freshNotes, Math.floor(targetCount * 0.25)));

  // Remove duplicates, fill to target
  return [...new Set(selected)].slice(0, targetCount);
}

function weightedSample(items: ScoredNote[], count: number): Note[] {
  // Weighted random sampling without replacement
  const result: Note[] = [];
  const remaining = [...items];

  while (result.length < count && remaining.length > 0) {
    const totalWeight = remaining.reduce((sum, n) => sum + n.score, 0);
    let random = Math.random() * totalWeight;

    for (let i = 0; i < remaining.length; i++) {
      random -= remaining[i].score;
      if (random <= 0) {
        result.push(remaining[i].note);
        remaining.splice(i, 1);
        break;
      }
    }
  }

  return result;
}
```

### Question Selection from Selected Notes

Once we have 15 notes, we generate questions and make a final selection:

```
function selectQuestions(notes: Note[], targetCount: number = 10): Question[] {
  // Generate 2-3 questions per note (batched LLM call)
  const allQuestions = generateQuestions(notes);  // Returns 30-45 questions

  // Score each question
  const scoredQuestions = allQuestions.map(q => ({
    question: q,
    score: questionQualityScore(q)
  }));

  // Ensure format variety
  const formatBuckets = {
    multiple_choice: [],
    true_false: [],
    fill_blank: [],
    free_form: []
  };

  for (const sq of scoredQuestions) {
    formatBuckets[sq.question.format].push(sq);
  }

  // Target distribution: 4 MC, 2 TF, 2 fill, 2 free
  const targetDistribution = {
    multiple_choice: 4,
    true_false: 2,
    fill_blank: 2,
    free_form: 2
  };

  const selected: Question[] = [];

  for (const [format, count] of Object.entries(targetDistribution)) {
    const bucket = formatBuckets[format].sort((a, b) => b.score - a.score);
    selected.push(...bucket.slice(0, count).map(sq => sq.question));
  }

  // Ensure difficulty variety
  const difficulties = selected.map(q => q.difficulty);
  const easyCount = difficulties.filter(d => d === 'easy').length;
  const hardCount = difficulties.filter(d => d === 'hard').length;

  // Adjust if too skewed (should have 2-4 easy, 2-4 medium, 2-4 hard)
  if (easyCount > 5) {
    // Swap some easy for harder
    // ... implementation
  }

  return selected;
}
```

### Data Model for Quiz History (Event-Sourced)

**Why event sourcing?** Traditional state-based history causes sync conflicts when quizzing on multiple devices. Event sourcing stores what happened, and computes state on load.

**Storage**: `history/{year}-{month}.json` (partitioned by month)

```json
{
  "version": 1,
  "events": [
    {
      "id": "evt_a1b2c3",
      "ts": 1703500000000,
      "type": "answer",
      "noteId": "notes/react/hooks-guide.md",
      "conceptId": "concept_react_hooks",
      "questionId": "q_001",
      "correct": true
    },
    {
      "id": "evt_d4e5f6",
      "ts": 1703500100000,
      "type": "skip",
      "noteId": "notes/react/hooks-guide.md",
      "questionId": "q_002"
    },
    {
      "id": "evt_g7h8i9",
      "ts": 1703500200000,
      "type": "flag",
      "questionId": "q_003",
      "reason": "incorrect_answer"
    }
  ]
}
```

**Computed state on load**:

```typescript
interface ComputedNoteHistory {
  firstQuizzed: number;
  lastQuizzed: number;
  quizCount: number;
  correctCount: number;
  correctStreak: number;
  recentQuizDates: number[];
}

function computeNoteHistory(
  events: QuizEvent[],
  noteId: string
): ComputedNoteHistory {
  // Filter events for this note, sort by timestamp
  const noteEvents = events
    .filter((e) => e.noteId === noteId && e.type === 'answer')
    .sort((a, b) => a.ts - b.ts);

  if (noteEvents.length === 0) return null;

  // Compute current state by replaying events
  let correctStreak = 0;
  let correctCount = 0;

  for (const event of noteEvents) {
    if (event.correct) {
      correctStreak++;
      correctCount++;
    } else {
      correctStreak = 0; // Reset streak on wrong answer
    }
  }

  return {
    firstQuizzed: noteEvents[0].ts,
    lastQuizzed: noteEvents[noteEvents.length - 1].ts,
    quizCount: noteEvents.length,
    correctCount,
    correctStreak,
    recentQuizDates: noteEvents.slice(-10).map((e) => e.ts),
  };
}
```

**Sync conflict resolution**:

```typescript
function mergeHistoryFiles(
  local: HistoryFile,
  remote: HistoryFile
): HistoryFile {
  // Combine events from both, dedupe by id, sort by timestamp
  const allEvents = [...local.events, ...remote.events];
  const uniqueEvents = dedupeById(allEvents);
  const sorted = uniqueEvents.sort((a, b) => a.ts - b.ts);

  return {version: 1, events: sorted};
}

function dedupeById(events: QuizEvent[]): QuizEvent[] {
  const seen = new Set<string>();
  return events.filter((e) => {
    if (seen.has(e.id)) return false;
    seen.add(e.id);
    return true;
  });
}
```

**Benefits**:

- Events have unique IDs → duplicates detected
- Events have timestamps → can merge and sort
- No "which value is correct" conflicts
- Append-only within a month → minimal conflict scope

### Edge Cases

| Case                       | Handling                                        |
| -------------------------- | ----------------------------------------------- |
| Concept has < 15 notes     | Use all quizzable notes                         |
| All notes recently quizzed | Lower freshness threshold, allow re-quiz        |
| User skips many questions  | Reduce skip penalty, increase variety weight    |
| New notes added            | Boost recency score for immediate inclusion     |
| User always gets it right  | Extend intervals, suggest concept as "mastered" |

---

## Part 6: Question Generation Strategy

### The Challenge

We have 15 selected notes. We need 10 high-quality, varied questions.

### Generation Pipeline

```
15 selected notes
     ↓  (Check question cache)
Cache hit: 10 notes have cached questions
Cache miss: 5 notes need LLM analysis
     ↓  (Batch LLM call for 5 notes)
Generate 2-3 questions per note
     ↓  (Question selection)
Pick best 10 questions with variety
     ↓  (Format distribution)
Ensure mix: 4 MC, 2 TF, 2 fill, 2 free-form
```

### Batched Question Generation

**Single LLM call for multiple notes:**

```
Prompt:
"Generate quiz questions for these 5 notes from the user's vault.
Each note should yield 2-3 questions across different formats.

<note_1>
Title: useState Basics
Content: [first 1500 chars]
</note_1>

<note_2>
...
</note_2>

Requirements:
- Vary question formats (MC, TF, fill, free-form)
- Questions should test understanding, not trivia
- Include difficulty ratings
- Map each question to source note

Return JSON array of questions..."
```

**Why batch?**

- 5 notes × 3 questions = 15 questions in ONE LLM call
- Reduces API calls from 15 to 1
- LLM sees context across notes, avoids duplicate questions

### LLM Error Handling

LLM calls can fail. Handle gracefully:

```typescript
interface LLMClient {
  generateQuestions(notes: Note[]): Promise<Question[]>;
}

class ResilientLLMClient implements LLMClient {
  private retryDelays = [1000, 2000, 4000]; // Exponential backoff

  async generateQuestions(notes: Note[]): Promise<Question[]> {
    for (let attempt = 0; attempt <= this.retryDelays.length; attempt++) {
      try {
        const response = await this.callLLM(notes);
        return this.validateAndParseResponse(response);
      } catch (error) {
        if (this.isRetryable(error) && attempt < this.retryDelays.length) {
          await this.delay(this.retryDelays[attempt]);
          continue;
        }
        throw error;
      }
    }
  }

  private isRetryable(error: Error): boolean {
    // Retry on: rate limits (429), server errors (5xx), network failures
    return (
      error.message.includes('429') ||
      error.message.includes('5') ||
      error.message.includes('network')
    );
  }

  private validateAndParseResponse(response: string): Question[] {
    try {
      const parsed = JSON.parse(response);
      // Validate structure
      if (!Array.isArray(parsed)) throw new Error('Expected array');
      return parsed.filter((q) => this.isValidQuestion(q));
    } catch (e) {
      console.error('LLM returned invalid JSON:', response);
      throw new Error('Invalid LLM response format');
    }
  }
}
```

**Fallback strategy when LLM fails**:

```typescript
async function getQuestionsWithFallback(notes: Note[]): Promise<Question[]> {
  try {
    return await llmClient.generateQuestions(notes);
  } catch (error) {
    console.warn('LLM failed, using cached questions');

    // Fallback 1: Use cached questions from previous sessions
    const cached = await loadCachedQuestions(notes);
    if (cached.length >= 5) return cached;

    // Fallback 2: Notify user and offer to retry
    new Notice('Could not generate questions. Using cached content.');
    return cached;
  }
}
```

### Question Caching

```
questions/
└── concept_react_hooks/
    └── abc123.json  # Hash of note content
```

Cache entry:

```json
{
  "noteHash": "abc123",
  "notePath": "notes/react/hooks-guide.md",
  "generatedAt": "2024-12-15",
  "questions": [
    {
      "id": "q_001",
      "format": "multiple_choice",
      "question": "What does useState return?",
      "options": ["...", "...", "...", "..."],
      "correctAnswer": "...",
      "difficulty": "easy"
    }
  ]
}
```

**Cache invalidation:**

- Note content changes (hash mismatch)
- Question flagged by user (regenerate)
- Cache age > 7 days (regenerate for variety)

---

## Part 7: LLM Cost Analysis

### Per-Operation Token Estimates

| Operation                     | Input Tokens | Output Tokens | Frequency                |
| ----------------------------- | ------------ | ------------- | ------------------------ |
| Concept naming (20 clusters)  | 2,000        | 500           | Per clustering cycle     |
| Note analysis (5 notes batch) | 8,000        | 2,000         | Per quiz with cache miss |
| Question generation (5 notes) | 8,000        | 2,000         | Per quiz with cache miss |
| Answer evaluation (free-form) | 500          | 200           | Per free-form answer     |

### Quiz Session Cost

**Best case (full cache hit):**

- 0 LLM calls for question generation
- 2-4 LLM calls for free-form evaluation
- Total: ~3k tokens

**Worst case (no cache):**

- 1 LLM call for note analysis (~10k tokens)
- 1 LLM call for question generation (~10k tokens)
- 2-4 LLM calls for evaluation (~3k tokens)
- Total: ~23k tokens

### Monthly Estimate

Assumption: 5 quiz sessions/day, 30 days, 50% cache hit rate

- Sessions: 150
- Cache hits: 75 sessions × ~3k = 225k tokens
- Cache misses: 75 sessions × ~23k = 1.7M tokens
- Total: ~2M tokens/month

At Claude API pricing: ~$6-10/month
With Claude Code Max: Included in subscription

---

## Part 8: Obsidian API Integration Summary

This section consolidates all Obsidian API usage for easy reference during implementation.

### Core APIs Used

| API                                                 | Purpose                 | Usage                         |
| --------------------------------------------------- | ----------------------- | ----------------------------- |
| `app.vault.getMarkdownFiles()`                      | List all notes          | Clustering, initial scan      |
| `app.metadataCache.getFileCache(file)`              | Get parsed metadata     | Tags, links, headings         |
| `app.metadataCache.resolvedLinks`                   | Pre-computed link graph | Link-based clustering         |
| `app.vault.adapter`                                 | File system operations  | Read/write `.recall/` files   |
| `app.vault.on('create'/'modify'/'delete'/'rename')` | File events             | Real-time updates             |
| `app.metadataCache.on('changed')`                   | Metadata parsed         | Trigger after Obsidian parses |

### Plugin Lifecycle

```typescript
import {Plugin, TFile, Notice} from 'obsidian';

export default class RecallPlugin extends Plugin {
  private clusterService: ClusterService;
  private quizService: QuizService;
  private historyService: HistoryService;

  async onload() {
    // 1. Load persisted data
    await this.loadPluginData();

    // 2. Register file event handlers
    this.registerEvent(
      this.app.vault.on('modify', (file) => {
        if (file instanceof TFile && file.extension === 'md') {
          this.onNoteModified(file);
        }
      })
    );

    // 3. Register UI components
    this.addRibbonIcon('brain', 'Recall Quiz', () => this.openQuizView());

    // 4. Wait for layout ready before heavy operations
    this.app.workspace.onLayoutReady(() => {
      this.validateDataIntegrity();
    });
  }

  async onunload() {
    // Persist any pending changes
    await this.savePluginData();
  }
}
```

### Accessing Note Metadata

```typescript
function getNoteMetadata(file: TFile): NoteMetadata {
  const cache = this.app.metadataCache.getFileCache(file);

  return {
    path: file.path,
    title: cache?.headings?.[0]?.heading || file.basename,
    folder: file.parent?.path || '',
    tags: (cache?.tags || []).map((t) => t.tag),
    links: (cache?.links || []).map((l) => l.link),
    headings: (cache?.headings || []).map((h) => h.heading),
    modifiedAt: file.stat.mtime,
  };
}
```

### File System Operations

```typescript
// Use Obsidian's adapter for all file operations in .recall/
const RECALL_DIR = '.recall';

async function ensureRecallDir(): Promise<void> {
  const adapter = this.app.vault.adapter;
  if (!(await adapter.exists(RECALL_DIR))) {
    await adapter.mkdir(RECALL_DIR);
  }
}

async function readRecallFile<T>(path: string, fallback: T): Promise<T> {
  const fullPath = `${RECALL_DIR}/${path}`;
  try {
    const content = await this.app.vault.adapter.read(fullPath);
    return JSON.parse(content);
  } catch {
    return fallback;
  }
}

async function writeRecallFile(path: string, data: any): Promise<void> {
  const fullPath = `${RECALL_DIR}/${path}`;
  await safeWriteJson(this.app.vault.adapter, fullPath, data);
}
```

### Link Graph Access

```typescript
function getIncomingLinks(notePath: string): string[] {
  // resolvedLinks is: { [sourcePath]: { [targetPath]: count } }
  const resolvedLinks = this.app.metadataCache.resolvedLinks;
  const incoming: string[] = [];

  for (const [source, targets] of Object.entries(resolvedLinks)) {
    if (targets[notePath]) {
      incoming.push(source);
    }
  }

  return incoming;
}

function getOutgoingLinks(notePath: string): string[] {
  const resolvedLinks = this.app.metadataCache.resolvedLinks;
  return Object.keys(resolvedLinks[notePath] || {});
}
```

---

## Part 9: Open Architectural Decisions

### Decision 1: Embedding vs. Keyword Matching for Concept Assignment

**Option A: Keyword/Pattern Matching (Current proposal)**

- Pros: Fast, deterministic, no additional infrastructure
- Cons: Misses semantic similarity ("useState" vs "state hook")

**Option B: Local Embeddings (Future enhancement)**

- Pros: Better semantic matching, handles synonyms
- Cons: Requires embedding model, storage overhead (~100MB for 100k notes)

**Recommendation**: Start with keyword matching, add embeddings in Phase 2 if needed.

### Decision 2: Real-time vs. Batched Updates

**Option A: Real-time (Current proposal)**

- Update note-index immediately on file change
- Pros: Always fresh
- Cons: Overhead on every save

**Option B: Batched (Hourly/Daily)**

- Queue changes, process in batch
- Pros: Less overhead
- Cons: Stale data between batches

**Recommendation**: Real-time for metadata, batched for concept reassignment.

### Decision 3: Question Regeneration Strategy

**Option A: Time-based (every 7 days)**

- Pros: Simple, ensures variety
- Cons: Wastes LLM calls on unchanged notes

**Option B: Event-based (on flag, on mastery, on note change)**

- Pros: Efficient
- Cons: May lead to stale questions

**Recommendation**: Event-based with 14-day fallback.

---

## Summary: The Architecture at Scale

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER VAULT                              │
│                       100,000 notes                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │   OBSIDIAN APIs   │  ← USE THESE!
                    │   metadataCache   │     Tags, links, headings
                    │   resolvedLinks   │     Link graph ready
                    │   vault events    │     Real-time updates
                    └─────────┬─────────┘
                              │
                    ┌─────────▼─────────┐
                    │  CLUSTERING LAYER │  ← No LLM, sample-based
                    │  (clusters.json)  │     50 notes/cluster
                    │  ~500 clusters    │     <45s for 100k notes
                    └─────────┬─────────┘
                              │
                    ┌─────────▼─────────┐
                    │  CONCEPT LAYER    │  ← Limited LLM
                    │  (concepts/)      │     Partitioned JSON
                    │  ~100 concepts    │     One file per concept
                    └─────────┬─────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
        ┌─────▼─────┐   ┌─────▼─────┐   ┌─────▼─────┐
        │  Concept  │   │  Concept  │   │  Concept  │
        │  #1.json  │   │  #2.json  │   │  #3.json  │
        │  (tracked)│   │  (tracked)│   │(untracked)│
        └─────┬─────┘   └─────┬─────┘   └───────────┘
              │               │
              │        (user quizzes)
              │               │
        ┌─────▼───────────────▼─────┐
        │    NOTE SELECTION         │  ← Cold start + config weights
        │    (spaced rep + variety) │     15 notes chosen
        └─────────────┬─────────────┘
                      │
        ┌─────────────▼─────────────┐
        │    QUESTION GENERATION    │  ← Resilient LLM client
        │    (cached or batched)    │     Retry + fallback
        └─────────────┬─────────────┘
                      │
        ┌─────────────▼─────────────┐
        │    QUIZ SESSION           │
        │    10 questions           │
        └─────────────┬─────────────┘
                      │
        ┌─────────────▼─────────────┐
        │   HISTORY (event-sourced) │  ← Sync-friendly
        │   history/{year-month}.json│    Append + dedupe
        └───────────────────────────┘
```

### Key Architectural Changes from Review

| Area           | Before                          | After                              |
| -------------- | ------------------------------- | ---------------------------------- |
| Metadata       | Custom `note-index.json` (50MB) | Use Obsidian's `metadataCache`     |
| Storage        | Single large JSON files         | Partitioned (one file per concept) |
| Link Analysis  | O(n²) adjacency matrix          | Sample-based (50 notes/cluster)    |
| History        | State-based (sync conflicts)    | Event-sourced (merge-friendly)     |
| Error Recovery | None                            | Backup + atomic writes             |
| Cold Start     | Not handled                     | Content-based scoring              |
| LLM Failures   | Not handled                     | Retry + cache fallback             |
| Weights        | Hardcoded                       | User configurable                  |

---

## Immediate Actions (No Code)

**Files to create/move:**

| Action | Source                                       | Destination                                          |
| ------ | -------------------------------------------- | ---------------------------------------------------- |
| Create | -                                            | `obsidian-ai-recall/`                                |
| Create | -                                            | `obsidian-ai-recall/docs/`                           |
| Move   | `notes/Recall - Obsidian Quiz Plugin PRD.md` | `obsidian-ai-recall/docs/prd.md`                     |
| Move   | `notes/Recall - Interaction Design Spec.md`  | `obsidian-ai-recall/docs/interaction-design-spec.md` |
| Create | _(this document)_                            | `obsidian-ai-recall/docs/technical-design-phase1.md` |
