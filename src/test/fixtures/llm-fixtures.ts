import type { Cluster } from '@/domain/clustering/types';
import type { FileInfo } from '@/ports/IVaultProvider';
import type {
	ClusterSummary,
	Concept,
	ConceptNamingResult,
	ConceptSummary,
	SynonymPattern,
	MisfitNote,
} from '@/domain/llm/types';

/**
 * Create a test cluster with default values
 */
export function createTestCluster(overrides: Partial<Cluster> = {}): Cluster {
	const id = overrides.id ?? `cluster-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
	return {
		id,
		candidateNames: overrides.candidateNames ?? ['Test'],
		noteIds: overrides.noteIds ?? ['note-1.md', 'note-2.md'],
		dominantTags: overrides.dominantTags ?? ['#test'],
		folderPath: overrides.folderPath ?? 'test',
		internalLinkDensity: overrides.internalLinkDensity ?? 0.5,
		createdAt: overrides.createdAt ?? Date.now(),
		reasons: overrides.reasons ?? ['test'],
	};
}

/**
 * Create a test cluster summary with default values
 */
export function createTestClusterSummary(overrides: Partial<ClusterSummary> = {}): ClusterSummary {
	return {
		clusterId: overrides.clusterId ?? `cluster-${Date.now()}`,
		candidateNames: overrides.candidateNames ?? ['Test Concept'],
		representativeTitles: overrides.representativeTitles ?? ['Test Note 1', 'Test Note 2'],
		commonTags: overrides.commonTags ?? ['#test'],
		folderPath: overrides.folderPath ?? 'test',
		noteCount: overrides.noteCount ?? 5,
	};
}

/**
 * Create a test concept with default values
 */
export function createTestConcept(overrides: Partial<Concept> = {}): Concept {
	const id = overrides.id ?? `concept-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
	return {
		id,
		name: overrides.name ?? 'Test Concept',
		noteIds: overrides.noteIds ?? ['note-1.md', 'note-2.md'],
		quizzabilityScore: overrides.quizzabilityScore ?? 0.8,
		isQuizzable: overrides.isQuizzable ?? true,
		originalClusterIds: overrides.originalClusterIds ?? ['cluster-1'],
		createdAt: overrides.createdAt ?? Date.now(),
	};
}

/**
 * Create a test naming result
 */
export function createTestNamingResult(
	overrides: Partial<ConceptNamingResult> = {},
): ConceptNamingResult {
	return {
		clusterId: overrides.clusterId ?? 'cluster-1',
		canonicalName: overrides.canonicalName ?? 'Test Concept',
		quizzabilityScore: overrides.quizzabilityScore ?? 0.8,
		isQuizzable: overrides.isQuizzable ?? true,
		nonQuizzableReason: overrides.nonQuizzableReason,
		suggestedMerges: overrides.suggestedMerges ?? [],
	};
}

/**
 * Create a file map from note paths
 */
export function createFileMap(paths: string[]): Map<string, FileInfo> {
	const map = new Map<string, FileInfo>();
	for (const path of paths) {
		const basename = path.split('/').pop()?.replace(/\.md$/, '') ?? '';
		const folder = path.split('/').slice(0, -1).join('/');
		map.set(path, { path, basename, folder, modifiedAt: Date.now(), createdAt: Date.now() });
	}
	return map;
}

// ==================== Fixture Sets ====================

/**
 * React development cluster fixture
 */
export const reactClusterFixture: Cluster = createTestCluster({
	id: 'cluster-react',
	candidateNames: ['React', 'Frontend', 'Web Development'],
	noteIds: [
		'tech/react/hooks-guide.md',
		'tech/react/state-management.md',
		'tech/react/component-patterns.md',
		'tech/react/useEffect-tips.md',
		'tech/react/context-api.md',
	],
	dominantTags: ['#react', '#frontend', '#javascript'],
	folderPath: 'tech/react',
	internalLinkDensity: 0.65,
	reasons: ['folder', 'tags', 'links'],
});

/**
 * Meeting notes cluster fixture (non-quizzable)
 */
export const meetingClusterFixture: Cluster = createTestCluster({
	id: 'cluster-meetings',
	candidateNames: ['Meetings', 'Work'],
	noteIds: [
		'work/meetings/standup-2024-12-20.md',
		'work/meetings/team-sync.md',
		'work/meetings/quarterly-review.md',
	],
	dominantTags: ['#meeting', '#work'],
	folderPath: 'work/meetings',
	internalLinkDensity: 0.1,
	reasons: ['folder', 'tags'],
});

/**
 * Daily journal cluster fixture (non-quizzable)
 */
export const journalClusterFixture: Cluster = createTestCluster({
	id: 'cluster-journal',
	candidateNames: ['Daily', 'Journal'],
	noteIds: [
		'journal/2024-12-25.md',
		'journal/2024-12-24.md',
		'journal/2024-12-23.md',
		'journal/2024-12-22.md',
	],
	dominantTags: ['#daily', '#journal'],
	folderPath: 'journal',
	internalLinkDensity: 0.05,
	reasons: ['folder', 'tags'],
});

/**
 * JavaScript cluster fixture (for synonym testing with React)
 */
export const javascriptClusterFixture: Cluster = createTestCluster({
	id: 'cluster-js',
	candidateNames: ['JavaScript', 'JS'],
	noteIds: ['tech/js/es6-features.md', 'tech/js/async-await.md', 'tech/js/array-methods.md'],
	dominantTags: ['#javascript', '#js'],
	folderPath: 'tech/js',
	internalLinkDensity: 0.4,
	reasons: ['folder', 'tags'],
});

/**
 * Expected concept summaries for refinement testing
 */
export const conceptSummaryFixtures: ConceptSummary[] = [
	{
		conceptId: 'concept-js-1',
		name: 'JavaScript Development',
		sampleTitles: ['ES6 Features', 'Async/Await', 'Array Methods'],
		noteCount: 30,
	},
	{
		conceptId: 'concept-js-2',
		name: 'JS Tutorials',
		sampleTitles: ['JS Basics', 'JavaScript Functions', 'DOM Manipulation'],
		noteCount: 15,
	},
	{
		conceptId: 'concept-react',
		name: 'React Development',
		sampleTitles: ['React Hooks', 'My Grocery List', 'Component Patterns'],
		noteCount: 20,
	},
];

/**
 * Expected synonym pattern result
 */
export const expectedSynonymPattern: SynonymPattern = {
	primaryConceptId: 'concept-js-1',
	aliasConceptIds: ['concept-js-2'],
	confidence: 0.95,
	reason: 'JS is the standard abbreviation for JavaScript',
};

/**
 * Expected misfit note result
 */
export const expectedMisfitNote: MisfitNote = {
	noteId: 'note-grocery-list',
	noteTitle: 'My Grocery List',
	currentConceptId: 'concept-react',
	suggestedTags: ['#personal', '#shopping', '#lists'],
	confidence: 0.9,
	reason: 'A grocery list is personal/productivity content, not React development knowledge',
};

/**
 * Complete fixture set for LLM pipeline integration testing
 */
export const llmPipelineTestFixture = {
	clusters: [reactClusterFixture, meetingClusterFixture, journalClusterFixture],
	fileMap: createFileMap([
		...reactClusterFixture.noteIds,
		...meetingClusterFixture.noteIds,
		...journalClusterFixture.noteIds,
	]),
	expectedQuizzableCount: 1, // Only React
	expectedNonQuizzableCount: 2, // Meetings + Journal
};
