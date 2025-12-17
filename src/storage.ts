import { readFile, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { ClawmarksData, DEFAULT_CLAWMARKS_DATA } from './types.js';

const CLAWMARKS_FILENAME = '.clawmarks.json';

export class ClawmarksStorage {
  private projectRoot: string;
  private filePath: string;
  private data: ClawmarksData | null = null;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.filePath = join(projectRoot, CLAWMARKS_FILENAME);
  }

  async load(): Promise<ClawmarksData> {
    if (this.data) {
      return this.data;
    }

    try {
      await access(this.filePath);
      const content = await readFile(this.filePath, 'utf-8');
      this.data = JSON.parse(content) as ClawmarksData;
      return this.data;
    } catch {
      // File doesn't exist, return default
      this.data = { ...DEFAULT_CLAWMARKS_DATA };
      return this.data;
    }
  }

  async save(): Promise<void> {
    if (!this.data) {
      throw new Error('No data to save. Call load() first.');
    }
    await writeFile(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8');
  }

  async getData(): Promise<ClawmarksData> {
    return this.load();
  }

  async updateData(updater: (data: ClawmarksData) => void): Promise<ClawmarksData> {
    const data = await this.load();
    updater(data);
    await this.save();
    return data;
  }

  getFilePath(): string {
    return this.filePath;
  }

  getProjectRoot(): string {
    return this.projectRoot;
  }

  // Force reload from disk (useful if external changes)
  async reload(): Promise<ClawmarksData> {
    this.data = null;
    return this.load();
  }
}
