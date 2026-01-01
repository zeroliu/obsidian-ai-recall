import { DEFAULT_VOYAGE_API_URL } from '@/adapters/voyage/VoyageEmbeddingAdapter';
import type IgnitePlugin from '@/main';
import { type App, Notice, PluginSettingTab, Setting } from 'obsidian';

/**
 * Plugin settings interface
 */
export interface IgniteSettings {
  /** Anthropic API key for LLM features */
  anthropicApiKey: string;
  /** Voyage API key for embedding-based note relevance */
  voyageApiKey: string;
  /** Glob patterns for files to include (e.g., "notes/**", "projects/*.md") */
  includePaths: string[];
  /** Glob patterns for files to exclude (e.g., "templates/**", "archive/**") */
  excludePaths: string[];
}

/**
 * Default settings
 */
export const DEFAULT_SETTINGS: IgniteSettings = {
  anthropicApiKey: '',
  voyageApiKey: '',
  includePaths: [],
  excludePaths: [],
};

/**
 * Validation result for API key.
 */
export interface ApiKeyValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate an Anthropic API key format.
 * This performs basic format validation, not actual API connectivity check.
 */
export function validateAnthropicApiKey(apiKey: string): ApiKeyValidationResult {
  if (!apiKey || apiKey.trim().length === 0) {
    return { valid: false, error: 'API key is required' };
  }

  const trimmedKey = apiKey.trim();

  // Check for valid Anthropic API key prefix
  if (!trimmedKey.startsWith('sk-ant-')) {
    return { valid: false, error: 'API key must start with "sk-ant-"' };
  }

  // Check minimum length (sk-ant- prefix + at least some characters)
  if (trimmedKey.length < 20) {
    return { valid: false, error: 'API key appears to be too short' };
  }

  // Check for common mistakes like spaces or newlines
  if (/\s/.test(trimmedKey)) {
    return { valid: false, error: 'API key cannot contain spaces or newlines' };
  }

  return { valid: true };
}

/**
 * Check if API key is configured and valid.
 */
export function isApiKeyConfigured(settings: IgniteSettings): boolean {
  return validateAnthropicApiKey(settings.anthropicApiKey).valid;
}

/**
 * Validate a Voyage API key format.
 * Voyage API keys typically start with 'pa-' prefix.
 */
export function validateVoyageApiKey(apiKey: string): ApiKeyValidationResult {
  if (!apiKey || apiKey.trim().length === 0) {
    return { valid: false, error: 'Voyage API key is required for note relevance' };
  }

  const trimmedKey = apiKey.trim();

  // Voyage keys are typically at least 20 characters
  if (trimmedKey.length < 10) {
    return { valid: false, error: 'API key appears to be too short' };
  }

  // Check for common mistakes like spaces or newlines
  if (/\s/.test(trimmedKey)) {
    return { valid: false, error: 'API key cannot contain spaces or newlines' };
  }

  return { valid: true };
}

/**
 * Check if Voyage API key is configured and valid.
 */
export function isVoyageApiKeyConfigured(settings: IgniteSettings): boolean {
  return validateVoyageApiKey(settings.voyageApiKey).valid;
}

/**
 * Settings tab for the Ignite plugin
 */
export class IgniteSettingsTab extends PluginSettingTab {
  plugin: IgnitePlugin;
  private apiKeyStatusEl: HTMLElement | null = null;
  private voyageApiKeyStatusEl: HTMLElement | null = null;

  constructor(app: App, plugin: IgnitePlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();

    containerEl.createEl('h2', { text: 'Ignite Settings' });

    // LLM Settings section
    containerEl.createEl('h3', { text: 'API Keys' });

    const apiKeySetting = new Setting(containerEl)
      .setName('Anthropic API key')
      .setDesc('API key for AI-powered features like question generation and research.')
      .addText((text) =>
        text
          .setPlaceholder('sk-ant-...')
          .setValue(this.plugin.settings.anthropicApiKey)
          .onChange(async (value) => {
            this.plugin.settings.anthropicApiKey = value;
            await this.plugin.saveSettings();
            this.updateApiKeyStatus(value);
          }),
      )
      .then((setting) => {
        const inputEl = setting.controlEl.querySelector('input');
        if (inputEl) {
          inputEl.type = 'password';
          inputEl.autocomplete = 'off';
        }
      });

    // Add validation status indicator
    this.apiKeyStatusEl = apiKeySetting.descEl.createDiv('ignite-api-key-status');
    this.updateApiKeyStatus(this.plugin.settings.anthropicApiKey);

    // Add test connection button
    new Setting(containerEl)
      .setName('Test API connection')
      .setDesc('Verify that your API key works correctly')
      .addButton((button) =>
        button.setButtonText('Test Connection').onClick(async () => {
          await this.testApiConnection();
        }),
      );

    // Voyage API key for embeddings
    const voyageApiKeySetting = new Setting(containerEl)
      .setName('Voyage API key')
      .setDesc('API key for embedding-based note relevance scoring. Get one at voyageai.com.')
      .addText((text) =>
        text
          .setPlaceholder('pa-...')
          .setValue(this.plugin.settings.voyageApiKey)
          .onChange(async (value) => {
            this.plugin.settings.voyageApiKey = value;
            await this.plugin.saveSettings();
            this.updateVoyageApiKeyStatus(value);
          }),
      )
      .then((setting) => {
        const inputEl = setting.controlEl.querySelector('input');
        if (inputEl) {
          inputEl.type = 'password';
          inputEl.autocomplete = 'off';
        }
      });

    // Add validation status indicator for Voyage
    this.voyageApiKeyStatusEl = voyageApiKeySetting.descEl.createDiv('ignite-api-key-status');
    this.updateVoyageApiKeyStatus(this.plugin.settings.voyageApiKey);

    // Add test connection button for Voyage
    new Setting(containerEl)
      .setName('Test Voyage connection')
      .setDesc('Verify that your Voyage API key works correctly')
      .addButton((button) =>
        button.setButtonText('Test Connection').onClick(async () => {
          await this.testVoyageApiConnection();
        }),
      );

    // Path filtering section
    containerEl.createEl('h3', { text: 'Note Filtering' });

    new Setting(containerEl)
      .setName('Include paths')
      .setDesc(
        'Glob patterns for files to include (one per line). Leave empty to include all files. Examples: "notes/**", "projects/*.md"',
      )
      .addTextArea((text) =>
        text
          .setPlaceholder('notes/**\nprojects/*.md')
          .setValue(this.plugin.settings.includePaths.join('\n'))
          .onChange(async (value) => {
            this.plugin.settings.includePaths = value
              .split('\n')
              .map((line) => line.trim())
              .filter((line) => line.length > 0);
            await this.plugin.saveSettings();
          }),
      )
      .then((setting) => {
        const textAreaEl = setting.controlEl.querySelector('textarea');
        if (textAreaEl) {
          textAreaEl.rows = 4;
        }
      });

    new Setting(containerEl)
      .setName('Exclude paths')
      .setDesc(
        'Glob patterns for files to exclude (one per line). Examples: "templates/**", "archive/**", "*.excalidraw.md"',
      )
      .addTextArea((text) =>
        text
          .setPlaceholder('templates/**\narchive/**\n*.excalidraw.md')
          .setValue(this.plugin.settings.excludePaths.join('\n'))
          .onChange(async (value) => {
            this.plugin.settings.excludePaths = value
              .split('\n')
              .map((line) => line.trim())
              .filter((line) => line.length > 0);
            await this.plugin.saveSettings();
          }),
      )
      .then((setting) => {
        const textAreaEl = setting.controlEl.querySelector('textarea');
        if (textAreaEl) {
          textAreaEl.rows = 4;
        }
      });

    // Info section
    containerEl.createEl('h3', { text: 'About' });
    containerEl.createEl('p', {
      text: 'Ignite transforms your notes into goal-oriented learning. Create goals, and Ignite will help you achieve mastery through personalized quizzes, research, and drafts.',
    });
  }

  /**
   * Update the API key validation status display.
   */
  private updateApiKeyStatus(apiKey: string): void {
    if (!this.apiKeyStatusEl) return;

    this.apiKeyStatusEl.empty();

    if (!apiKey || apiKey.trim().length === 0) {
      this.apiKeyStatusEl.addClass('ignite-api-key-status-empty');
      this.apiKeyStatusEl.removeClass(
        'ignite-api-key-status-valid',
        'ignite-api-key-status-invalid',
      );
      this.apiKeyStatusEl.setText('No API key configured');
      return;
    }

    const result = validateAnthropicApiKey(apiKey);
    if (result.valid) {
      this.apiKeyStatusEl.addClass('ignite-api-key-status-valid');
      this.apiKeyStatusEl.removeClass(
        'ignite-api-key-status-empty',
        'ignite-api-key-status-invalid',
      );
      this.apiKeyStatusEl.setText('API key format is valid');
    } else {
      this.apiKeyStatusEl.addClass('ignite-api-key-status-invalid');
      this.apiKeyStatusEl.removeClass('ignite-api-key-status-empty', 'ignite-api-key-status-valid');
      this.apiKeyStatusEl.setText(result.error ?? 'Invalid API key format');
    }
  }

  /**
   * Test the API connection with the configured key.
   */
  private async testApiConnection(): Promise<void> {
    const apiKey = this.plugin.settings.anthropicApiKey;
    const validation = validateAnthropicApiKey(apiKey);

    if (!validation.valid) {
      new Notice(`API key validation failed: ${validation.error}`);
      return;
    }

    new Notice('Testing API connection...');

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'Hi' }],
        }),
      });

      if (response.ok) {
        new Notice('API connection successful! Your API key is working.');
      } else if (response.status === 401) {
        new Notice('API key is invalid. Please check your API key.');
      } else if (response.status === 429) {
        new Notice('Rate limited. Your API key is valid but you are being rate limited.');
      } else {
        const errorText = await response.text();
        new Notice(`API error (${response.status}): ${errorText.slice(0, 100)}`);
      }
    } catch (error) {
      if (error instanceof Error) {
        new Notice(`Connection failed: ${error.message}`);
      } else {
        new Notice('Connection failed: Unknown error');
      }
    }
  }

  /**
   * Update the Voyage API key validation status display.
   */
  private updateVoyageApiKeyStatus(apiKey: string): void {
    if (!this.voyageApiKeyStatusEl) return;

    this.voyageApiKeyStatusEl.empty();

    if (!apiKey || apiKey.trim().length === 0) {
      this.voyageApiKeyStatusEl.addClass('ignite-api-key-status-empty');
      this.voyageApiKeyStatusEl.removeClass(
        'ignite-api-key-status-valid',
        'ignite-api-key-status-invalid',
      );
      this.voyageApiKeyStatusEl.setText('No Voyage API key configured (optional)');
      return;
    }

    const result = validateVoyageApiKey(apiKey);
    if (result.valid) {
      this.voyageApiKeyStatusEl.addClass('ignite-api-key-status-valid');
      this.voyageApiKeyStatusEl.removeClass(
        'ignite-api-key-status-empty',
        'ignite-api-key-status-invalid',
      );
      this.voyageApiKeyStatusEl.setText('API key format is valid');
    } else {
      this.voyageApiKeyStatusEl.addClass('ignite-api-key-status-invalid');
      this.voyageApiKeyStatusEl.removeClass(
        'ignite-api-key-status-empty',
        'ignite-api-key-status-valid',
      );
      this.voyageApiKeyStatusEl.setText(result.error ?? 'Invalid API key format');
    }
  }

  /**
   * Test the Voyage API connection with the configured key.
   */
  private async testVoyageApiConnection(): Promise<void> {
    const apiKey = this.plugin.settings.voyageApiKey;
    const validation = validateVoyageApiKey(apiKey);

    if (!validation.valid) {
      new Notice(`Voyage API key validation failed: ${validation.error}`);
      return;
    }

    new Notice('Testing Voyage API connection...');

    try {
      const response = await fetch(DEFAULT_VOYAGE_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'voyage-3-lite',
          input: ['test'],
        }),
      });

      if (response.ok) {
        new Notice('Voyage API connection successful! Your API key is working.');
      } else if (response.status === 401) {
        new Notice('Voyage API key is invalid. Please check your API key.');
      } else if (response.status === 429) {
        new Notice('Rate limited. Your Voyage API key is valid but you are being rate limited.');
      } else {
        const errorText = await response.text();
        new Notice(`Voyage API error (${response.status}): ${errorText.slice(0, 100)}`);
      }
    } catch (error) {
      if (error instanceof Error) {
        new Notice(`Voyage connection failed: ${error.message}`);
      } else {
        new Notice('Voyage connection failed: Unknown error');
      }
    }
  }
}
