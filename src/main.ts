import { Plugin } from 'obsidian';

/**
 * Obsidian AI Recall Plugin
 * AI-powered spaced repetition for Obsidian
 */
export default class AIRecallPlugin extends Plugin {
  async onload(): Promise<void> {
    console.log('Loading AI Recall plugin');

    // TODO: Initialize plugin components
    // - Load settings
    // - Register commands
    // - Set up event listeners
  }

  async onunload(): Promise<void> {
    console.log('Unloading AI Recall plugin');
  }
}
