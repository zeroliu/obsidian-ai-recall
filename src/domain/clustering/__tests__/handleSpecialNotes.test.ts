import { describe, it, expect } from 'vitest';
import {
	identifySpecialNotes,
	isTemplateNote,
	isStubNote,
	assignStubNotesToClusters,
	createTemplatesCluster,
	preprocessSpecialNotes,
	DEFAULT_SPECIAL_NOTES_CONFIG,
} from '../handleSpecialNotes';
import { createCluster } from '../types';
import type { FileMetadata, ResolvedLinks } from '@/ports/IMetadataProvider';
import type { FileInfo } from '@/ports/IVaultProvider';

describe('isTemplateNote', () => {
	const patterns = DEFAULT_SPECIAL_NOTES_CONFIG.templatePatterns;

	it('should detect notes starting with "template"', () => {
		expect(isTemplateNote('template-meeting.md', 'template-meeting', patterns)).toBe(true);
		expect(isTemplateNote('Template Daily.md', 'Template Daily', patterns)).toBe(true);
	});

	it('should detect notes ending with "template"', () => {
		expect(isTemplateNote('meeting-template.md', 'meeting-template', patterns)).toBe(true);
		expect(isTemplateNote('Daily Template.md', 'Daily Template', patterns)).toBe(true);
	});

	it('should detect notes starting with "_template"', () => {
		expect(isTemplateNote('_template_note.md', '_template_note', patterns)).toBe(true);
	});

	it('should detect notes in templates folder', () => {
		expect(isTemplateNote('templates/meeting.md', 'meeting', patterns)).toBe(true);
		expect(isTemplateNote('folder/templates/note.md', 'note', patterns)).toBe(true);
	});

	it('should not detect regular notes as templates', () => {
		expect(isTemplateNote('notes/regular.md', 'regular', patterns)).toBe(false);
		expect(isTemplateNote('templating-guide.md', 'templating-guide', patterns)).toBe(false);
	});
});

describe('isStubNote', () => {
	it('should detect notes with very few words and links', () => {
		const meta: FileMetadata = {
			path: 'stub.md',
			tags: [],
			links: ['other.md', 'another.md'],
			headings: [],
			frontmatter: {},
			wordCount: 10,
		};
		expect(isStubNote(meta, 50)).toBe(true);
	});

	it('should not detect notes with sufficient word count', () => {
		const meta: FileMetadata = {
			path: 'normal.md',
			tags: [],
			links: ['other.md'],
			headings: [],
			frontmatter: {},
			wordCount: 100,
		};
		expect(isStubNote(meta, 50)).toBe(false);
	});

	it('should detect notes with more links than words', () => {
		const meta: FileMetadata = {
			path: 'link-heavy.md',
			tags: [],
			links: Array.from({ length: 10 }, (_, i) => `link${i}.md`),
			headings: [],
			frontmatter: {},
			wordCount: 40,
		};
		expect(isStubNote(meta, 50)).toBe(true);
	});

	it('should not detect short notes without links', () => {
		const meta: FileMetadata = {
			path: 'short.md',
			tags: [],
			links: [],
			headings: [],
			frontmatter: {},
			wordCount: 30,
		};
		expect(isStubNote(meta, 50)).toBe(false);
	});
});

describe('identifySpecialNotes', () => {
	it('should separate regular, stub, and template notes', () => {
		const noteIds = [
			'notes/regular.md',
			'notes/stub.md',
			'templates/template.md',
		];

		const metadata = new Map<string, FileMetadata>([
			[
				'notes/regular.md',
				{
					path: 'notes/regular.md',
					tags: [],
					links: [],
					headings: [],
					frontmatter: {},
					wordCount: 100,
				},
			],
			[
				'notes/stub.md',
				{
					path: 'notes/stub.md',
					tags: [],
					links: ['other.md'],
					headings: [],
					frontmatter: {},
					wordCount: 10,
				},
			],
			[
				'templates/template.md',
				{
					path: 'templates/template.md',
					tags: [],
					links: [],
					headings: [],
					frontmatter: {},
					wordCount: 50,
				},
			],
		]);

		const files = new Map<string, FileInfo>([
			['notes/regular.md', { path: 'notes/regular.md', basename: 'regular', folder: 'notes', modifiedAt: 0, createdAt: 0 }],
			['notes/stub.md', { path: 'notes/stub.md', basename: 'stub', folder: 'notes', modifiedAt: 0, createdAt: 0 }],
			['templates/template.md', { path: 'templates/template.md', basename: 'template', folder: 'templates', modifiedAt: 0, createdAt: 0 }],
		]);

		const result = identifySpecialNotes(noteIds, metadata, files);

		expect(result.regularNotes).toEqual(['notes/regular.md']);
		expect(result.stubNotes).toEqual(['notes/stub.md']);
		expect(result.templateNotes).toEqual(['templates/template.md']);
	});
});

describe('assignStubNotesToClusters', () => {
	it('should assign stub notes to clusters based on outgoing links', () => {
		const stubNotes = ['stub.md'];
		const clusters = [
			createCluster({ noteIds: ['target.md', 'other.md'], reasons: [] }),
		];
		const resolvedLinks: ResolvedLinks = {
			'stub.md': { 'target.md': 1 },
		};
		const metadata = new Map<string, FileMetadata>();

		const result = assignStubNotesToClusters(stubNotes, clusters, resolvedLinks, metadata);

		expect(result[0].noteIds).toContain('stub.md');
	});

	it('should assign stub notes to clusters based on incoming links', () => {
		const stubNotes = ['stub.md'];
		const clusters = [
			createCluster({ noteIds: ['source.md', 'other.md'], reasons: [] }),
		];
		const resolvedLinks: ResolvedLinks = {
			'source.md': { 'stub.md': 1 },
		};
		const metadata = new Map<string, FileMetadata>();

		const result = assignStubNotesToClusters(stubNotes, clusters, resolvedLinks, metadata);

		expect(result[0].noteIds).toContain('stub.md');
	});

	it('should not assign stub notes with no links', () => {
		const stubNotes = ['orphan.md'];
		const clusters = [
			createCluster({ noteIds: ['note1.md', 'note2.md'], reasons: [] }),
		];
		const resolvedLinks: ResolvedLinks = {};
		const metadata = new Map<string, FileMetadata>();

		const result = assignStubNotesToClusters(stubNotes, clusters, resolvedLinks, metadata);

		expect(result[0].noteIds).not.toContain('orphan.md');
	});

	it('should return original clusters when no stub notes', () => {
		const stubNotes: string[] = [];
		const clusters = [
			createCluster({ noteIds: ['note1.md'], reasons: [] }),
		];
		const resolvedLinks: ResolvedLinks = {};
		const metadata = new Map<string, FileMetadata>();

		const result = assignStubNotesToClusters(stubNotes, clusters, resolvedLinks, metadata);

		expect(result).toEqual(clusters);
	});
});

describe('createTemplatesCluster', () => {
	it('should create a cluster for template notes', () => {
		const templateNotes = ['template1.md', 'template2.md'];

		const result = createTemplatesCluster(templateNotes, 'templates');

		expect(result).not.toBeNull();
		expect(result?.noteIds).toEqual(templateNotes);
		expect(result?.candidateNames).toContain('Templates');
		expect(result?.folderPath).toBe('templates');
	});

	it('should return null for empty template list', () => {
		const result = createTemplatesCluster([], '');
		expect(result).toBeNull();
	});
});

describe('preprocessSpecialNotes', () => {
	it('should separate files into categories', () => {
		const files: FileInfo[] = [
			{ path: 'notes/regular.md', basename: 'regular', folder: 'notes', modifiedAt: 0, createdAt: 0 },
			{ path: 'notes/stub.md', basename: 'stub', folder: 'notes', modifiedAt: 0, createdAt: 0 },
			{ path: 'templates/tpl.md', basename: 'tpl', folder: 'templates', modifiedAt: 0, createdAt: 0 },
		];

		const metadata = new Map<string, FileMetadata>([
			['notes/regular.md', { path: 'notes/regular.md', tags: [], links: [], headings: [], frontmatter: {}, wordCount: 100 }],
			['notes/stub.md', { path: 'notes/stub.md', tags: [], links: ['link.md'], headings: [], frontmatter: {}, wordCount: 10 }],
			['templates/tpl.md', { path: 'templates/tpl.md', tags: [], links: [], headings: [], frontmatter: {}, wordCount: 50 }],
		]);

		const result = preprocessSpecialNotes(files, metadata);

		expect(result.regularFiles).toHaveLength(1);
		expect(result.regularFiles[0].path).toBe('notes/regular.md');
		expect(result.stubFiles).toHaveLength(1);
		expect(result.stubFiles[0].path).toBe('notes/stub.md');
		expect(result.templateFiles).toHaveLength(1);
		expect(result.templateFiles[0].path).toBe('templates/tpl.md');
	});
});
