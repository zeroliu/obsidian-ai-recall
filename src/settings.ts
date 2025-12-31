import type IgnitePlugin from '@/main';
import { type App, PluginSettingTab, Setting } from 'obsidian';

/**
 * Plugin settings interface
 */
export interface IgniteSettings {
  /** Anthropic API key for LLM features */
  anthropicApiKey: string;
}

/**
 * Default settings
 */
export const DEFAULT_SETTINGS: IgniteSettings = {
  anthropicApiKey: '',
};

/**
 * Settings tab for the Ignite plugin
 */
export class IgniteSettingsTab extends PluginSettingTab {
  plugin: IgnitePlugin;

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

    new Setting(containerEl)
      .setName('Anthropic API key')
      .setDesc('API key for AI-powered features like question generation and research.')
      .addText((text) =>
        text
          .setPlaceholder('sk-ant-...')
          .setValue(this.plugin.settings.anthropicApiKey)
          .onChange(async (value) => {
            this.plugin.settings.anthropicApiKey = value;
            await this.plugin.saveSettings();
          }),
      )
      .then((setting) => {
        const inputEl = setting.controlEl.querySelector('input');
        if (inputEl) {
          inputEl.type = 'password';
          inputEl.autocomplete = 'off';
        }
      });

    // Info section
    containerEl.createEl('h3', { text: 'About' });
    containerEl.createEl('p', {
      text: 'Ignite transforms your notes into goal-oriented learning. Create goals, and Ignite will help you achieve mastery through personalized quizzes, research, and drafts.',
    });
  }
}
