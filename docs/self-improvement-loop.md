# Self-Improvement Loop for Clustering Optimization

## Overview

This document describes an adversarial self-improvement loop where two AI subagents collaborate to iteratively optimize clustering hyperparameters. The loop continues until quality targets are met or the maximum number of iterations is reached.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Self-Improvement Loop                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │   Subagent 1 │    │   Subagent 2 │    │   Subagent 1 │  ...  │
│  │  (Evaluator) │───▶│(Implementer) │───▶│  (Evaluator) │       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
│         │                   │                   │                │
│         ▼                   ▼                   ▼                │
│  ┌────────────┐     ┌────────────┐     ┌────────────┐           │
│  │improvement-│     │ config.json │     │improvement-│           │
│  │plan-1.md   │     │ (updated)   │     │plan-2.md   │           │
│  └────────────┘     └────────────┘     └────────────┘           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Subagent Roles

### Subagent 1: Evaluator

**Responsibilities:**
1. Run clustering with current configuration
2. Execute evaluation script to compute all metrics
3. Analyze individual metrics against targets
4. Identify which specific metrics need improvement
5. Create improvement plan document with parameter changes

**Commands:**
```bash
# Run clustering with current config
npx tsx scripts/run-clustering.ts --config outputs/improvement-loop/current-config.json

# Run evaluation
npx tsx scripts/evaluate-clustering.ts --vault --config outputs/improvement-loop/current-config.json --output outputs/improvement-loop/iteration-N/evaluation.json
```

**Output:**
Create `outputs/improvement-loop/iteration-N/improvement-plan.md` with:
- Table of each metric vs its target
- Which specific metrics need improvement
- Parameter changes to address the weakest metric
- Rationale for each change

### Subagent 2: Implementer

**Responsibilities:**
1. Read the improvement plan from Subagent 1
2. Validate proposed changes are within parameter bounds
3. Update the configuration file
4. Re-run clustering pipeline with new configuration
5. Save results for next evaluation

**Commands:**
```bash
# After updating config, run clustering
npx tsx scripts/run-clustering.ts --config outputs/improvement-loop/current-config.json --output outputs/improvement-loop/iteration-N/clustering-output.json
```

---

## Target Metrics

The loop aims to achieve ALL of the following:

| Metric | Target | Status Thresholds |
|--------|--------|-------------------|
| Silhouette Score | >= 0.3 | good: >=0.3, needs_improvement: 0.1-0.3, poor: <0.1 |
| Noise Ratio | 5-20% | good: 5-20%, needs_improvement: 2-30%, poor: <2% or >30% |
| Tag Homogeneity | >= 50% | good: >=50%, needs_improvement: 30-50%, poor: <30% |

---

## Parameter Bounds

The Implementer must enforce these bounds when making changes:

```typescript
const PARAMETER_BOUNDS = {
  umap: {
    nNeighbors: [5, 10, 15, 30, 50],
    minDist: [0.0, 0.05, 0.1, 0.2, 0.5],
    nComponents: [5, 10, 15, 20],
  },
  hdbscan: {
    minClusterSize: [3, 5, 10, 15, 20, 30],
    minSamples: [1, 3, 5, 10],
  },
};
```

---

## Improvement Plan Template

When creating an improvement plan, use this format:

```markdown
# Improvement Plan - Iteration N

## Current Configuration
```json
{
  "umap": { "nNeighbors": 15, "minDist": 0.1, "nComponents": 10 },
  "hdbscan": { "minClusterSize": 5, "minSamples": 3 }
}
```

## Metric Analysis

| Metric | Value | Target | Status | Gap |
|--------|-------|--------|--------|-----|
| Silhouette Score | 0.25 | >= 0.3 | needs_improvement | -0.05 |
| Noise Ratio | 18% | 5-20% | good | - |
| Tag Homogeneity | 45% | >= 50% | needs_improvement | -5% |

## Priority

Focus on: **Silhouette Score** (weakest metric relative to target)

## Analysis

[Explain what the current metrics indicate about clustering quality]

- Silhouette score of 0.25 suggests notes are somewhat similar to their cluster but not well-separated from other clusters
- The noise ratio is healthy at 18%
- Tag homogeneity is close to target, suggesting semantic clusters partially align with user tags

## Proposed Changes

| Parameter | Current | Proposed | Rationale |
|-----------|---------|----------|-----------|
| umap.nNeighbors | 15 | 10 | Lower nNeighbors preserves more local structure, which should improve within-cluster similarity |

## Expected Outcomes

- Silhouette score should increase by preserving local neighborhood structure
- May see slight increase in cluster count (more fine-grained clusters)
- Noise ratio should remain stable

## Risks

- If nNeighbors is too low, may fragment coherent clusters
- Rollback to nNeighbors=15 if silhouette decreases or noise ratio exceeds 25%
```

---

## Termination Conditions

The loop terminates when ANY of these conditions are met:

### Success (All targets met)
```
silhouetteScore >= 0.3 AND
noiseRatio >= 0.05 AND noiseRatio <= 0.20 AND
tagHomogeneity >= 0.5
```

### Failure Conditions
- **Max iterations reached**: 5 iterations without meeting all targets
- **Declining performance**: Silhouette score decreases for 2 consecutive iterations
- **Parameter space exhausted**: No valid parameter moves remain

---

## Output Structure

```
outputs/
└── improvement-loop/
    ├── current-config.json         # Active configuration
    ├── summary.json                # Overall loop progress
    ├── iteration-1/
    │   ├── clustering-output.json  # Raw clustering results
    │   ├── evaluation.json         # Computed metrics
    │   └── improvement-plan.md     # Plan created by Evaluator
    ├── iteration-2/
    │   ├── clustering-output.json
    │   ├── evaluation.json
    │   └── improvement-plan.md
    └── ...
```

### Summary File Schema

```typescript
interface LoopSummary {
  startedAt: number;
  currentIteration: number;
  status: 'running' | 'success' | 'max_iterations' | 'declining';
  iterations: Array<{
    iteration: number;
    config: {
      umap: { nNeighbors: number; minDist: number; nComponents: number };
      hdbscan: { minClusterSize: number; minSamples: number };
    };
    metrics: {
      silhouetteScore: number;
      noiseRatio: number;
      tagHomogeneity: number;
    };
    meetsAllTargets: boolean;
    timestamp: number;
  }>;
  bestIteration: number;
  bestConfig: object;
}
```

---

## Invoking the Loop

### Manual Invocation with Claude Code

The loop is designed to be driven by Claude Code through conversation. Each iteration involves two steps:

**Step 1: Evaluator Phase**
```
User: "Evaluate the current clustering and create an improvement plan"

Claude (as Evaluator):
1. Runs: npx tsx scripts/evaluate-clustering.ts --vault --config outputs/improvement-loop/current-config.json
2. Analyzes the metrics output
3. Creates: outputs/improvement-loop/iteration-N/improvement-plan.md
4. Reports: "Improvement plan created. Silhouette needs improvement (0.25 vs target 0.3). Proposing to reduce nNeighbors from 15 to 10."
```

**Step 2: Implementer Phase**
```
User: "Implement the changes from the improvement plan"

Claude (as Implementer):
1. Reads: outputs/improvement-loop/iteration-N/improvement-plan.md
2. Validates proposed changes are within bounds
3. Updates: outputs/improvement-loop/current-config.json
4. Runs: npx tsx scripts/run-clustering.ts --config outputs/improvement-loop/current-config.json
5. Reports: "Changes implemented. New clustering has X clusters, Y% noise. Ready for evaluation."
```

**Loop continues until termination conditions are met.**

---

## Prompt Templates

### Evaluator Prompt

```
You are the Evaluator subagent in a clustering optimization loop.

Current iteration: N
Previous results: [summary of metrics from iteration N-1]

Your tasks:
1. Run the evaluation script:
   npx tsx scripts/evaluate-clustering.ts --vault --config outputs/improvement-loop/current-config.json --output outputs/improvement-loop/iteration-N/evaluation.json

2. Read the evaluation output and analyze each metric:
   - Silhouette Score: target >= 0.3
   - Noise Ratio: target 5-20%
   - Tag Homogeneity: target >= 50%

3. Identify which metrics are below target and prioritize the weakest one

4. Create outputs/improvement-loop/iteration-N/improvement-plan.md with:
   - Current metrics table with status
   - Analysis of what the metrics indicate
   - Specific parameter change (only 1-2 parameters at a time)
   - Expected impact and risks

5. Update outputs/improvement-loop/summary.json with the new iteration

Parameter bounds:
- UMAP nNeighbors: [5, 10, 15, 30, 50]
- UMAP minDist: [0.0, 0.05, 0.1, 0.2, 0.5]
- UMAP nComponents: [5, 10, 15, 20]
- HDBSCAN minClusterSize: [3, 5, 10, 15, 20, 30]
- HDBSCAN minSamples: [1, 3, 5, 10]

If all targets are met, report success and stop the loop.
```

### Implementer Prompt

```
You are the Implementer subagent in a clustering optimization loop.

Your tasks:
1. Read the improvement plan: outputs/improvement-loop/iteration-N/improvement-plan.md

2. Validate the proposed changes:
   - Ensure all parameter values are within allowed bounds
   - If invalid, report the issue and suggest valid alternatives

3. Update the configuration file: outputs/improvement-loop/current-config.json

4. Run clustering with the new configuration:
   npx tsx scripts/run-clustering.ts --config outputs/improvement-loop/current-config.json --output outputs/improvement-loop/iteration-N/clustering-output.json

5. Report the results:
   - Number of clusters created
   - Noise ratio
   - Any errors or warnings

Do NOT run the evaluation - that's the Evaluator's job in the next iteration.
```

---

## Parameter Tuning Heuristics

Use these heuristics when proposing parameter changes:

### Low Silhouette Score (< 0.3)
- **Try first**: Reduce `nNeighbors` (preserves local structure)
- **Also consider**: Reduce `minDist` (tighter clusters)
- **Check**: If silhouette is negative, embeddings may be poor quality

### High Noise Ratio (> 20%)
- **Try first**: Reduce `minClusterSize` (allows smaller clusters)
- **Also consider**: Reduce `minSamples` (less strict core point requirement)
- **Caution**: Too low may create spurious clusters

### Low Noise Ratio (< 5%)
- **Try first**: Increase `minClusterSize` (enforces larger clusters)
- **Also consider**: Increase `minSamples`
- **Reason**: Very low noise may indicate over-clustering

### Low Tag Homogeneity (< 50%)
- **Investigate**: May indicate semantic clusters differ from user's mental model
- **Try**: Increase `nNeighbors` (captures more global structure)
- **Note**: Low homogeneity isn't always bad if silhouette is high

### Uneven Cluster Sizes (Gini > 0.6)
- **Try**: Increase `minClusterSize` to prevent tiny clusters
- **Consider**: Post-processing to split large clusters (not in hyperparameter scope)

---

## Example Loop Execution

### Iteration 1
- **Config**: nNeighbors=15, minDist=0.1, minClusterSize=5
- **Results**: Silhouette=0.18, Noise=25%, TagHomog=40%
- **Plan**: Reduce minClusterSize to 3 (address high noise)

### Iteration 2
- **Config**: nNeighbors=15, minDist=0.1, minClusterSize=3
- **Results**: Silhouette=0.15, Noise=15%, TagHomog=42%
- **Plan**: Reduce nNeighbors to 10 (address low silhouette)

### Iteration 3
- **Config**: nNeighbors=10, minDist=0.1, minClusterSize=3
- **Results**: Silhouette=0.28, Noise=18%, TagHomog=48%
- **Plan**: Reduce minDist to 0.05 (push silhouette over threshold)

### Iteration 4
- **Config**: nNeighbors=10, minDist=0.05, minClusterSize=3
- **Results**: Silhouette=0.32, Noise=16%, TagHomog=52%
- **Status**: SUCCESS - All targets met

---

## Monitoring and Rollback

### Track Progress
After each iteration, update `outputs/improvement-loop/summary.json`:
- Record metrics for trend analysis
- Flag if silhouette is declining
- Track best configuration seen

### Rollback Triggers
- Silhouette decreases by more than 0.1 from previous iteration
- Noise ratio exceeds 40%
- Cluster count drops below 5 or exceeds 1000

### Rollback Action
Revert to the configuration from `bestIteration` and try a different parameter change.

---

## Grid Search Reference Data

The following grid search results were generated on 2025-12-28 with 660 notes (267 stubs excluded).
Use this data to inform parameter choices without re-running the full grid search.

### Top 10 by Silhouette Score

| Rank | nNeighbors | minDist | minClusterSize | Silhouette | Noise% | Clusters | Tag Homogeneity |
|------|------------|---------|----------------|------------|--------|----------|-----------------|
| 1 | 50 | 0.1 | 5 | 0.2191 | 62.7% | 41 | 8.1% |
| 2 | 30 | 0.2 | 5 | 0.2175 | 60.9% | 37 | 6.6% |
| 3 | 50 | 0.5 | 3 | 0.2149 | 66.2% | 49 | 6.7% |
| 4 | 50 | 0.5 | 10 | 0.2144 | 66.8% | 17 | 6.8% |
| 5 | 10 | 0.5 | 30 | 0.2139 | 72.9% | 5 | 3.9% |
| 6 | 30 | 0.5 | 5 | 0.2128 | 62.4% | 38 | 6.9% |
| 7 | 10 | 0.5 | 5 | 0.2114 | 57.9% | 42 | 9.0% |
| 8 | 50 | 0.5 | 5 | 0.2108 | 64.5% | 38 | 8.1% |
| 9 | 30 | 0.5 | 3 | 0.2106 | 65.0% | 48 | 5.6% |
| 10 | 15 | 0.2 | 5 | 0.2105 | 57.4% | 40 | 6.0% |

### Top 10 by Noise Ratio (closest to 12.5%)

| Rank | nNeighbors | minDist | minClusterSize | Noise% | Silhouette | Clusters | Tag Homogeneity |
|------|------------|---------|----------------|--------|------------|----------|-----------------|
| 1 | 5 | 0.05 | 30 | 36.1% | 0.0583 | 11 | 3.1% |
| 2 | 5 | 0.1 | 20 | 38.0% | 0.0889 | 15 | 3.7% |
| 3 | 5 | 0 | 15 | 38.9% | 0.1006 | 20 | 3.7% |
| 4 | 30 | 0 | 30 | 40.6% | 0.1006 | 11 | 3.6% |
| 5 | 5 | 0 | 10 | 41.1% | 0.1206 | 29 | 4.9% |
| 6 | 5 | 0.05 | 10 | 41.2% | 0.1258 | 29 | 4.9% |
| 7 | 5 | 0.05 | 15 | 43.2% | 0.1002 | 19 | 4.3% |
| 8 | 5 | 0.1 | 10 | 43.5% | 0.1292 | 28 | 4.8% |
| 9 | 15 | 0.05 | 30 | 43.5% | 0.1155 | 8 | 2.9% |
| 10 | 5 | 0.05 | 5 | 43.8% | 0.1579 | 59 | 5.4% |

### Top 10 by Tag Homogeneity

| Rank | nNeighbors | minDist | minClusterSize | Tag Homogeneity | Silhouette | Noise% | Clusters |
|------|------------|---------|----------------|-----------------|------------|--------|----------|
| 1 | 10 | 0.5 | 5 | 9.0% | 0.2114 | 57.9% | 42 |
| 2 | 50 | 0.2 | 3 | 8.5% | 0.1848 | 60.9% | 56 |
| 3 | 30 | 0.1 | 5 | 8.3% | 0.1951 | 54.5% | 44 |
| 4 | 50 | 0.1 | 5 | 8.1% | 0.2191 | 62.7% | 41 |
| 5 | 50 | 0.5 | 5 | 8.1% | 0.2108 | 64.5% | 38 |
| 6 | 50 | 0 | 5 | 8.0% | 0.1896 | 62.1% | 43 |
| 7 | 15 | 0 | 5 | 7.9% | 0.1951 | 52.3% | 48 |
| 8 | 15 | 0.5 | 5 | 7.8% | 0.2023 | 57.1% | 39 |
| 9 | 50 | 0.2 | 5 | 7.7% | 0.2081 | 62.6% | 39 |
| 10 | 10 | 0.5 | 3 | 7.5% | 0.1869 | 65.8% | 52 |

### Key Observations

1. **No configuration met all targets** (Silhouette>=0.3, Noise 5-20%, Tag Homogeneity>=50%)

2. **Trade-offs observed**:
   - Higher `nNeighbors` (30-50) gives better silhouette but higher noise
   - Lower `minClusterSize` (3-5) creates more clusters but doesn't help noise ratio much
   - Higher `minDist` (0.2-0.5) tends to improve silhouette slightly

3. **Best balanced config**: `nNeighbors=10, minDist=0.5, minClusterSize=5`
   - Silhouette: 0.2114 (best among top tag homogeneity configs)
   - Noise: 57.9% (still high but lower than many)
   - Tag Homogeneity: 9.0% (highest observed)

4. **Recommendations for improvement loop**:
   - Focus on reducing noise ratio first (try `minClusterSize=3` with `minSamples=1`)
   - Consider that tag homogeneity may be inherently low for this vault
   - The silhouette target of 0.3 may need to be relaxed to 0.2 for this dataset
