---
created: 2025-12-28
---

# Dev Plan: Manual Overrides & Activity Changelog

This document describes changes to the existing Part 1 implementation (Concept Discovery) to support:
1. **Manual concept overrides** — Users can add/remove notes from concepts
2. **Activity changelog** — Track and display concept evolution for user review

## Context

Part 1 (Concept Discovery pipeline) is already implemented. These changes extend the existing `TrackedConcept` data model and pipeline to support user corrections and transparency.

---

## 1. Manual Overrides

### 1.1 Data Model Changes

**File**: `src/domain/llm/types.ts`

Add `manualOverrides` field to `TrackedConcept`:

```typescript
interface ManualOverrides {
  addedNotes: string[];    // Notes manually added by user
  removedNotes: string[];  // Notes manually removed by user
}

interface TrackedConcept {
  id: string;
  canonicalName: string;
  quizzabilityScore: number;
  clusterId: string;
  noteIds: string[];                    // From clustering
  manualOverrides?: ManualOverrides;    // NEW: User corrections
  metadata: {
    createdAt: number;
    lastUpdated: number;
  };
  evolutionHistory: EvolutionEvent[];
}
```

### 1.2 Effective Note IDs Helper

**File**: `src/domain/llm/getEffectiveNoteIds.ts` (new file)

```typescript
/**
 * Computes the effective note IDs for a concept, applying manual overrides.
 * Effective = (clusterNoteIds ∪ addedNotes) - removedNotes
 */
export function getEffectiveNoteIds(concept: TrackedConcept): string[] {
  const fromCluster = new Set(concept.noteIds);

  // Add manually added notes
  for (const noteId of concept.manualOverrides?.addedNotes ?? []) {
    fromCluster.add(noteId);
  }

  // Remove manually removed notes
  for (const noteId of concept.manualOverrides?.removedNotes ?? []) {
    fromCluster.delete(noteId);
  }

  return [...fromCluster];
}
```

### 1.3 Update Incremental Clustering

**File**: `src/domain/clustering/incrementalUpdater.ts`

Modify to respect manual overrides when assigning new notes:

```typescript
async function incrementalUpdate(
  changes: { added: string[]; modified: string[]; deleted: string[] },
  existingClusters: Cluster[],
  trackedConcepts: TrackedConcept[],  // NEW parameter
  embeddingProvider: IEmbeddingProvider
): Promise<Cluster[]> {
  // ... existing embedding logic ...

  // NEW: Build set of manually removed notes (don't auto-assign these)
  const allRemovedNotes = new Set(
    trackedConcepts.flatMap(c => c.manualOverrides?.removedNotes ?? [])
  );

  for (const embedding of newEmbeddings) {
    // Skip notes that user manually removed from a concept
    if (allRemovedNotes.has(embedding.notePath)) continue;

    const nearest = findNearestCentroid(embedding, centroids, 0.5);
    if (nearest) {
      nearest.noteIds.push(embedding.notePath);
    }
  }

  // ... rest of existing logic ...
}
```

### 1.4 Apply Overrides After Clustering

**File**: `src/domain/pipeline/PipelineOrchestrator.ts`

After clustering completes, apply manual overrides:

```typescript
function applyManualOverrides(
  concept: TrackedConcept,
  newClusterNoteIds: string[]
): string[] {
  const effective = new Set(newClusterNoteIds);

  // Always include manually added notes
  for (const noteId of concept.manualOverrides?.addedNotes ?? []) {
    effective.add(noteId);
  }

  // Always exclude manually removed notes
  for (const noteId of concept.manualOverrides?.removedNotes ?? []) {
    effective.delete(noteId);
  }

  return [...effective];
}
```

### 1.5 User Actions

**File**: `src/domain/llm/conceptManagement.ts` (new file)

```typescript
export async function addNoteToConcept(
  conceptId: string,
  noteId: string,
  storage: IStorageAdapter
): Promise<void> {
  const concept = await storage.loadConcept(conceptId);

  concept.manualOverrides = concept.manualOverrides ?? {
    addedNotes: [],
    removedNotes: []
  };

  // Add to addedNotes if not already there
  if (!concept.manualOverrides.addedNotes.includes(noteId)) {
    concept.manualOverrides.addedNotes.push(noteId);
  }

  // Remove from removedNotes if it was there
  concept.manualOverrides.removedNotes =
    concept.manualOverrides.removedNotes.filter(id => id !== noteId);

  concept.metadata.lastUpdated = Date.now();
  await storage.saveConcept(concept);
}

export async function removeNoteFromConcept(
  conceptId: string,
  noteId: string,
  storage: IStorageAdapter
): Promise<void> {
  const concept = await storage.loadConcept(conceptId);

  concept.manualOverrides = concept.manualOverrides ?? {
    addedNotes: [],
    removedNotes: []
  };

  // Add to removedNotes if not already there
  if (!concept.manualOverrides.removedNotes.includes(noteId)) {
    concept.manualOverrides.removedNotes.push(noteId);
  }

  // Remove from addedNotes if it was there
  concept.manualOverrides.addedNotes =
    concept.manualOverrides.addedNotes.filter(id => id !== noteId);

  concept.metadata.lastUpdated = Date.now();
  await storage.saveConcept(concept);
}
```

---

## 2. Activity Changelog

### 2.1 Data Model

**File**: `src/domain/activity/types.ts` (new file)

```typescript
export interface NoteMovement {
  noteId: string;
  fromConceptId: string | null;  // null = unassigned/noise
  toConceptId: string | null;    // null = removed/misfit
  reason: 'clustering' | 'manual' | 'misfit' | 'dissolved';
  conceptName?: string;
  timestamp: number;
}

export interface ConceptChange {
  conceptId: string;
  changeType: 'renamed' | 'created' | 'dissolved';
  oldName?: string;
  newName?: string;
  reason?: string;
}

export interface NewConceptSuggestion {
  conceptId: string;
  name: string;
  noteCount: number;
  status: 'pending' | 'tracked' | 'ignored';
}

export interface ActivityLog {
  version: 1;
  pipelineRunId: string;
  timestamp: number;
  noteMovements: NoteMovement[];
  conceptChanges: ConceptChange[];
  newConcepts: NewConceptSuggestion[];
}
```

### 2.2 Storage

**File**: `src/adapters/obsidian/activityStorage.ts` (new file)

```typescript
const ACTIVITY_PATH = '.recall/activity/latest.json';

export class ActivityStorageAdapter {
  constructor(private vault: Vault) {}

  async save(log: ActivityLog): Promise<void> {
    const content = JSON.stringify(log, null, 2);
    await this.vault.adapter.write(ACTIVITY_PATH, content);
  }

  async load(): Promise<ActivityLog | null> {
    try {
      const content = await this.vault.adapter.read(ACTIVITY_PATH);
      return JSON.parse(content);
    } catch {
      return null;
    }
  }
}
```

### 2.3 Track Note Movements

**File**: `src/domain/activity/trackNoteMovements.ts` (new file)

```typescript
export function trackNoteMovements(
  oldConcepts: TrackedConcept[],
  newConcepts: TrackedConcept[]
): NoteMovement[] {
  const movements: NoteMovement[] = [];

  // Build lookup: noteId -> conceptId
  const oldNoteMap = buildNoteToConceptMap(oldConcepts);
  const newNoteMap = buildNoteToConceptMap(newConcepts);

  // Find all notes across both states
  const allNotes = new Set([...oldNoteMap.keys(), ...newNoteMap.keys()]);

  for (const noteId of allNotes) {
    const oldConceptId = oldNoteMap.get(noteId) ?? null;
    const newConceptId = newNoteMap.get(noteId) ?? null;

    if (oldConceptId !== newConceptId) {
      const newConcept = newConcepts.find(c => c.id === newConceptId);

      movements.push({
        noteId,
        fromConceptId: oldConceptId,
        toConceptId: newConceptId,
        reason: newConceptId ? 'clustering' : 'misfit',
        conceptName: newConcept?.canonicalName,
        timestamp: Date.now()
      });
    }
  }

  return movements;
}

function buildNoteToConceptMap(concepts: TrackedConcept[]): Map<string, string> {
  const map = new Map<string, string>();

  for (const concept of concepts) {
    const effectiveNotes = getEffectiveNoteIds(concept);
    for (const noteId of effectiveNotes) {
      map.set(noteId, concept.id);
    }
  }

  return map;
}
```

### 2.4 Track Concept Changes

**File**: `src/domain/activity/trackConceptChanges.ts` (new file)

```typescript
export function trackConceptChanges(
  oldConcepts: TrackedConcept[],
  newConcepts: TrackedConcept[]
): ConceptChange[] {
  const changes: ConceptChange[] = [];

  const oldById = new Map(oldConcepts.map(c => [c.id, c]));
  const newById = new Map(newConcepts.map(c => [c.id, c]));

  // Check for renames
  for (const [id, newConcept] of newById) {
    const oldConcept = oldById.get(id);

    if (oldConcept && oldConcept.canonicalName !== newConcept.canonicalName) {
      changes.push({
        conceptId: id,
        changeType: 'renamed',
        oldName: oldConcept.canonicalName,
        newName: newConcept.canonicalName
      });
    }
  }

  // Check for dissolved concepts
  for (const [id, oldConcept] of oldById) {
    if (!newById.has(id)) {
      changes.push({
        conceptId: id,
        changeType: 'dissolved',
        oldName: oldConcept.canonicalName
      });
    }
  }

  // Check for new concepts
  for (const [id, newConcept] of newById) {
    if (!oldById.has(id)) {
      changes.push({
        conceptId: id,
        changeType: 'created',
        newName: newConcept.canonicalName
      });
    }
  }

  return changes;
}
```

### 2.5 Integrate with Pipeline

**File**: `src/domain/pipeline/PipelineOrchestrator.ts`

Add activity tracking to the pipeline:

```typescript
async function runPipeline(): Promise<PipelineResult> {
  // Load previous state
  const oldConcepts = await storage.loadTrackedConcepts();

  // ... existing pipeline stages ...

  // After LLM naming, before saving
  const newConcepts = llmResult.concepts;

  // Track changes for Activity tab
  const activityLog: ActivityLog = {
    version: 1,
    pipelineRunId: generateId('run'),
    timestamp: Date.now(),
    noteMovements: trackNoteMovements(oldConcepts, newConcepts),
    conceptChanges: trackConceptChanges(oldConcepts, newConcepts),
    newConcepts: detectNewConceptSuggestions(newConcepts, oldConcepts)
  };

  await activityStorage.save(activityLog);

  // ... save concepts ...
}
```

### 2.6 User Actions from Activity Tab

**File**: `src/domain/activity/activityActions.ts` (new file)

```typescript
export async function reassignNote(
  noteId: string,
  fromConceptId: string | null,
  toConceptId: string,
  storage: IStorageAdapter
): Promise<void> {
  // Remove from old concept (if any)
  if (fromConceptId) {
    await removeNoteFromConcept(fromConceptId, noteId, storage);
  }

  // Add to new concept
  await addNoteToConcept(toConceptId, noteId, storage);
}

export async function undoConceptRename(
  conceptId: string,
  previousName: string,
  storage: IStorageAdapter
): Promise<void> {
  const concept = await storage.loadConcept(conceptId);
  concept.canonicalName = previousName;
  concept.metadata.lastUpdated = Date.now();
  await storage.saveConcept(concept);
}

export async function trackNewConcept(
  conceptId: string,
  storage: IStorageAdapter,
  activityStorage: ActivityStorageAdapter
): Promise<void> {
  const log = await activityStorage.load();
  if (!log) return;

  const suggestion = log.newConcepts.find(c => c.conceptId === conceptId);
  if (suggestion) {
    suggestion.status = 'tracked';
    await activityStorage.save(log);
  }
}

export async function ignoreNewConcept(
  conceptId: string,
  activityStorage: ActivityStorageAdapter
): Promise<void> {
  const log = await activityStorage.load();
  if (!log) return;

  const suggestion = log.newConcepts.find(c => c.conceptId === conceptId);
  if (suggestion) {
    suggestion.status = 'ignored';
    await activityStorage.save(log);
  }
}
```

---

## 3. Implementation Checklist

### Phase 1: Manual Overrides
- [ ] Add `ManualOverrides` interface to `src/domain/llm/types.ts`
- [ ] Update `TrackedConcept` interface with optional `manualOverrides`
- [ ] Create `src/domain/llm/getEffectiveNoteIds.ts`
- [ ] Update `src/domain/clustering/incrementalUpdater.ts` to respect removed notes
- [ ] Create `src/domain/llm/conceptManagement.ts` with add/remove functions
- [ ] Update serialization in `src/adapters/obsidian/storageAdapter.ts`
- [ ] Add tests for manual override logic

### Phase 2: Activity Changelog
- [ ] Create `src/domain/activity/types.ts` with activity interfaces
- [ ] Create `src/adapters/obsidian/activityStorage.ts`
- [ ] Create `src/domain/activity/trackNoteMovements.ts`
- [ ] Create `src/domain/activity/trackConceptChanges.ts`
- [ ] Create `src/domain/activity/activityActions.ts`
- [ ] Integrate activity tracking into `PipelineOrchestrator`
- [ ] Add tests for activity tracking

### Phase 3: Integration
- [ ] Update existing tests to handle new `manualOverrides` field
- [ ] Ensure backward compatibility (concepts without `manualOverrides` still work)
- [ ] Add migration logic if needed for existing `.recall/concepts/*.json` files

---

## 4. Testing Strategy

### Unit Tests

```typescript
// getEffectiveNoteIds.test.ts
describe('getEffectiveNoteIds', () => {
  it('returns cluster notes when no overrides', () => {
    const concept = { noteIds: ['a.md', 'b.md'], manualOverrides: undefined };
    expect(getEffectiveNoteIds(concept)).toEqual(['a.md', 'b.md']);
  });

  it('includes manually added notes', () => {
    const concept = {
      noteIds: ['a.md'],
      manualOverrides: { addedNotes: ['c.md'], removedNotes: [] }
    };
    expect(getEffectiveNoteIds(concept)).toContain('c.md');
  });

  it('excludes manually removed notes', () => {
    const concept = {
      noteIds: ['a.md', 'b.md'],
      manualOverrides: { addedNotes: [], removedNotes: ['b.md'] }
    };
    expect(getEffectiveNoteIds(concept)).not.toContain('b.md');
  });
});

// trackNoteMovements.test.ts
describe('trackNoteMovements', () => {
  it('detects note added to concept', () => {
    const old = [{ id: 'c1', noteIds: ['a.md'] }];
    const new_ = [{ id: 'c1', noteIds: ['a.md', 'b.md'] }];

    const movements = trackNoteMovements(old, new_);
    expect(movements).toContainEqual(expect.objectContaining({
      noteId: 'b.md',
      fromConceptId: null,
      toConceptId: 'c1'
    }));
  });
});
```

---

## 5. Files Summary

| File | Action | Description |
|------|--------|-------------|
| `src/domain/llm/types.ts` | Modify | Add `ManualOverrides` interface |
| `src/domain/llm/getEffectiveNoteIds.ts` | Create | Helper to compute effective notes |
| `src/domain/llm/conceptManagement.ts` | Create | Add/remove note functions |
| `src/domain/clustering/incrementalUpdater.ts` | Modify | Respect manual overrides |
| `src/domain/activity/types.ts` | Create | Activity log interfaces |
| `src/domain/activity/trackNoteMovements.ts` | Create | Track note movements |
| `src/domain/activity/trackConceptChanges.ts` | Create | Track concept changes |
| `src/domain/activity/activityActions.ts` | Create | User action handlers |
| `src/adapters/obsidian/activityStorage.ts` | Create | Activity persistence |
| `src/domain/pipeline/PipelineOrchestrator.ts` | Modify | Integrate activity tracking |
