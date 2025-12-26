import type { ILLMProvider } from '@/ports/ILLMProvider';
import type {
	ConceptNamingRequest,
	ConceptNamingResponse,
	ConceptNamingResult,
	ClusterRefinementRequest,
	ClusterRefinementResponse,
	ClusterSummary,
	ConceptSummary,
	SynonymPattern,
	MisfitNote,
	LLMConfig,
} from '@/domain/llm/types';
import { DEFAULT_LLM_CONFIG } from '@/domain/llm/types';

/**
 * Rule for naming clusters based on pattern matching
 */
export interface NamingRule {
	/** Pattern to match against candidate names, titles, tags, or folder */
	pattern: RegExp;
	/** Canonical name to assign when pattern matches */
	canonicalName: string;
	/** Quizzability score (0-1) */
	quizzabilityScore: number;
	/** Whether the concept is quizzable */
	isQuizzable: boolean;
	/** Reason if not quizzable */
	nonQuizzableReason?: string;
}

/**
 * Rule for detecting synonym patterns
 */
export interface SynonymRule {
	/** Pattern to identify primary concept */
	primaryPattern: RegExp;
	/** Patterns that are aliases of the primary */
	aliasPatterns: RegExp[];
	/** Confidence score (0-1) */
	confidence: number;
}

/**
 * Rule for detecting misfit notes
 */
export interface MisfitRule {
	/** Pattern to match note titles that are misfits in any concept */
	pattern: RegExp;
	/** Suggested tags for re-clustering */
	suggestedTags: string[];
	/** Confidence score (0-1) */
	confidence: number;
	/** Reason for being a misfit */
	reason: string;
}

/**
 * Fixture for testing with custom rules
 */
export interface MockLLMFixture {
	namingRules: NamingRule[];
	synonymRules: SynonymRule[];
	misfitRules: MisfitRule[];
}

/**
 * Record of an LLM call for testing
 */
export interface LLMCallRecord {
	type: 'nameConceptsBatch' | 'refineClustersBatch';
	request: ConceptNamingRequest | ClusterRefinementRequest;
	timestamp: number;
}

/**
 * Default naming rules for common patterns
 */
const DEFAULT_NAMING_RULES: NamingRule[] = [
	// Technical/Learning content (high quizzability)
	{
		pattern: /react/i,
		canonicalName: 'React Development',
		quizzabilityScore: 0.9,
		isQuizzable: true,
	},
	{
		pattern: /typescript|ts\b/i,
		canonicalName: 'TypeScript',
		quizzabilityScore: 0.9,
		isQuizzable: true,
	},
	{
		pattern: /javascript|js\b/i,
		canonicalName: 'JavaScript',
		quizzabilityScore: 0.85,
		isQuizzable: true,
	},
	{
		pattern: /python/i,
		canonicalName: 'Python Programming',
		quizzabilityScore: 0.9,
		isQuizzable: true,
	},
	{
		pattern: /golf/i,
		canonicalName: 'Golf Mechanics',
		quizzabilityScore: 0.75,
		isQuizzable: true,
	},
	{
		pattern: /algorithm/i,
		canonicalName: 'Algorithms',
		quizzabilityScore: 0.95,
		isQuizzable: true,
	},

	// Non-quizzable content
	{
		pattern: /meeting|standup|sync\b/i,
		canonicalName: 'Meeting Notes',
		quizzabilityScore: 0.1,
		isQuizzable: false,
		nonQuizzableReason: 'Meeting notes are time-bound and not suitable for spaced repetition',
	},
	{
		pattern: /daily|journal/i,
		canonicalName: 'Daily Journal',
		quizzabilityScore: 0.15,
		isQuizzable: false,
		nonQuizzableReason: 'Daily journal entries are personal reflections, not knowledge to recall',
	},
	{
		pattern: /todo|task/i,
		canonicalName: 'Task Lists',
		quizzabilityScore: 0.05,
		isQuizzable: false,
		nonQuizzableReason: 'Task lists are ephemeral and not suitable for long-term recall',
	},
];

/**
 * Default synonym rules
 */
const DEFAULT_SYNONYM_RULES: SynonymRule[] = [
	{
		primaryPattern: /firework/i,
		aliasPatterns: [/\bfw\b/i],
		confidence: 0.95,
	},
	{
		primaryPattern: /javascript/i,
		aliasPatterns: [/\bjs\b/i],
		confidence: 0.98,
	},
	{
		primaryPattern: /typescript/i,
		aliasPatterns: [/\bts\b/i],
		confidence: 0.98,
	},
	{
		primaryPattern: /react\s*hooks?/i,
		aliasPatterns: [/hooks?\s*(in\s*)?react/i],
		confidence: 0.9,
	},
];

/**
 * Default misfit rules
 */
const DEFAULT_MISFIT_RULES: MisfitRule[] = [
	{
		pattern: /grocery|shopping\s*list/i,
		suggestedTags: ['#personal', '#shopping', '#lists'],
		confidence: 0.9,
		reason: 'Shopping lists are personal/productivity content, not knowledge',
	},
	{
		pattern: /recipe/i,
		suggestedTags: ['#cooking', '#recipes', '#personal'],
		confidence: 0.85,
		reason: 'Recipes belong in a cooking/food category',
	},
];

/**
 * Mock implementation of ILLMProvider for testing
 * Uses deterministic pattern-based rules for reproducible tests
 */
export class MockLLMAdapter implements ILLMProvider {
	private config: LLMConfig;
	private namingRules: NamingRule[];
	private synonymRules: SynonymRule[];
	private misfitRules: MisfitRule[];
	private callHistory: LLMCallRecord[] = [];

	constructor(config?: Partial<LLMConfig>) {
		this.config = { ...DEFAULT_LLM_CONFIG, ...config };
		this.namingRules = [...DEFAULT_NAMING_RULES];
		this.synonymRules = [...DEFAULT_SYNONYM_RULES];
		this.misfitRules = [...DEFAULT_MISFIT_RULES];
	}

	async nameConceptsBatch(request: ConceptNamingRequest): Promise<ConceptNamingResponse> {
		this.callHistory.push({
			type: 'nameConceptsBatch',
			request,
			timestamp: Date.now(),
		});

		const results: ConceptNamingResult[] = request.clusters.map((cluster) =>
			this.nameSingleCluster(cluster),
		);

		// Detect merge suggestions based on similar names
		this.detectMergeSuggestions(results);

		return {
			results,
			usage: {
				inputTokens: this.estimateInputTokens(request),
				outputTokens: this.estimateOutputTokens(results),
			},
		};
	}

	async refineClustersBatch(request: ClusterRefinementRequest): Promise<ClusterRefinementResponse> {
		this.callHistory.push({
			type: 'refineClustersBatch',
			request,
			timestamp: Date.now(),
		});

		const synonymPatterns = this.detectSynonyms(request.concepts);
		const misfitNotes = this.detectMisfits(request.concepts);

		return {
			synonymPatterns,
			misfitNotes,
			usage: {
				inputTokens: this.estimateInputTokens(request),
				outputTokens: 50,
			},
		};
	}

	getConfig(): LLMConfig {
		return { ...this.config };
	}

	updateConfig(config: Partial<LLMConfig>): void {
		this.config = { ...this.config, ...config };
	}

	/**
	 * Name a single cluster based on pattern matching
	 */
	private nameSingleCluster(cluster: ClusterSummary): ConceptNamingResult {
		// Build search text from all cluster info
		const searchText = [
			...cluster.candidateNames,
			...cluster.representativeTitles,
			...cluster.commonTags,
			cluster.folderPath,
		].join(' ');

		// Find matching rule
		for (const rule of this.namingRules) {
			if (rule.pattern.test(searchText)) {
				return {
					clusterId: cluster.clusterId,
					canonicalName: rule.canonicalName,
					quizzabilityScore: rule.quizzabilityScore,
					isQuizzable: rule.isQuizzable,
					nonQuizzableReason: rule.nonQuizzableReason,
					suggestedMerges: [],
				};
			}
		}

		// Default: use first candidate name or generate from folder
		const defaultName =
			cluster.candidateNames[0] ||
			this.generateNameFromFolder(cluster.folderPath) ||
			'Unnamed Concept';

		return {
			clusterId: cluster.clusterId,
			canonicalName: defaultName,
			quizzabilityScore: 0.5,
			isQuizzable: true,
			suggestedMerges: [],
		};
	}

	/**
	 * Generate a concept name from folder path
	 */
	private generateNameFromFolder(folderPath: string): string {
		if (!folderPath) return '';
		const parts = folderPath.split('/').filter(Boolean);
		if (parts.length === 0) return '';
		const lastPart = parts[parts.length - 1];
		// Title case and replace hyphens/underscores
		return lastPart.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
	}

	/**
	 * Detect merge suggestions based on similar canonical names
	 */
	private detectMergeSuggestions(results: ConceptNamingResult[]): void {
		const byName = new Map<string, ConceptNamingResult[]>();

		for (const result of results) {
			const normalized = result.canonicalName.toLowerCase();
			const existing = byName.get(normalized) || [];
			existing.push(result);
			byName.set(normalized, existing);
		}

		// Add merge suggestions for duplicates
		for (const group of byName.values()) {
			if (group.length > 1) {
				const primary = group[0];
				const mergeIds = group.slice(1).map((r) => r.clusterId);
				primary.suggestedMerges = mergeIds;
			}
		}
	}

	/**
	 * Detect synonym patterns between concepts
	 */
	private detectSynonyms(concepts: ConceptSummary[]): SynonymPattern[] {
		const patterns: SynonymPattern[] = [];
		const matched = new Set<string>();

		for (const rule of this.synonymRules) {
			let primary: ConceptSummary | null = null;
			const aliases: ConceptSummary[] = [];

			for (const concept of concepts) {
				if (matched.has(concept.conceptId)) continue;

				const searchText = [concept.name, ...concept.sampleTitles].join(' ');

				if (rule.primaryPattern.test(searchText)) {
					primary = concept;
				} else {
					for (const aliasPattern of rule.aliasPatterns) {
						if (aliasPattern.test(searchText)) {
							aliases.push(concept);
							break;
						}
					}
				}
			}

			if (primary && aliases.length > 0) {
				matched.add(primary.conceptId);
				for (const alias of aliases) {
					matched.add(alias.conceptId);
				}

				patterns.push({
					primaryConceptId: primary.conceptId,
					aliasConceptIds: aliases.map((a) => a.conceptId),
					confidence: rule.confidence,
					reason: `"${aliases.map((a) => a.name).join('", "')}" is an alias for "${primary.name}"`,
				});
			}
		}

		return patterns;
	}

	/**
	 * Detect misfit notes in concepts
	 */
	private detectMisfits(concepts: ConceptSummary[]): MisfitNote[] {
		const misfits: MisfitNote[] = [];

		for (const concept of concepts) {
			for (const title of concept.sampleTitles) {
				for (const rule of this.misfitRules) {
					if (rule.pattern.test(title)) {
						misfits.push({
							noteId: `note-${title.toLowerCase().replace(/\s+/g, '-')}`,
							noteTitle: title,
							currentConceptId: concept.conceptId,
							suggestedTags: rule.suggestedTags,
							confidence: rule.confidence,
							reason: rule.reason,
						});
					}
				}
			}
		}

		return misfits;
	}

	/**
	 * Estimate input tokens (rough approximation)
	 */
	private estimateInputTokens(request: ConceptNamingRequest | ClusterRefinementRequest): number {
		const json = JSON.stringify(request);
		// Rough estimate: ~4 characters per token
		return Math.ceil(json.length / 4);
	}

	/**
	 * Estimate output tokens (rough approximation)
	 */
	private estimateOutputTokens(results: ConceptNamingResult[]): number {
		const json = JSON.stringify(results);
		return Math.ceil(json.length / 4);
	}

	// ============ Test Helpers ============

	/**
	 * Get call history for testing
	 */
	_getCallHistory(): LLMCallRecord[] {
		return [...this.callHistory];
	}

	/**
	 * Clear call history
	 */
	_clearCallHistory(): void {
		this.callHistory = [];
	}

	/**
	 * Set fixture to replace all rules
	 */
	_setFixture(fixture: MockLLMFixture): void {
		this.namingRules = [...fixture.namingRules];
		this.synonymRules = [...fixture.synonymRules];
		this.misfitRules = [...fixture.misfitRules];
	}

	/**
	 * Add a single naming rule
	 */
	_addNamingRule(rule: NamingRule): void {
		// Add to beginning for priority
		this.namingRules.unshift(rule);
	}

	/**
	 * Add a single synonym rule
	 */
	_addSynonymRule(rule: SynonymRule): void {
		this.synonymRules.unshift(rule);
	}

	/**
	 * Add a single misfit rule
	 */
	_addMisfitRule(rule: MisfitRule): void {
		this.misfitRules.unshift(rule);
	}

	/**
	 * Reset to default rules
	 */
	_resetRules(): void {
		this.namingRules = [...DEFAULT_NAMING_RULES];
		this.synonymRules = [...DEFAULT_SYNONYM_RULES];
		this.misfitRules = [...DEFAULT_MISFIT_RULES];
	}
}
