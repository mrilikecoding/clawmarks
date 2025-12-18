import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ClawmarksStorage } from './storage.js';
import { mkdir, rm, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('ClawmarksStorage', () => {
  let testDir: string;
  let storage: ClawmarksStorage;

  beforeEach(async () => {
    // Create a unique temp directory for each test
    testDir = join(tmpdir(), `clawmarks-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(testDir, { recursive: true });
    storage = new ClawmarksStorage(testDir);
  });

  afterEach(async () => {
    // Clean up temp directory
    await rm(testDir, { recursive: true, force: true });
  });

  describe('load', () => {
    it('should return default data when file does not exist', async () => {
      const data = await storage.load();

      expect(data).toEqual({
        version: 1,
        trails: [],
        clawmarks: [],
      });
    });

    it('should load existing data from file', async () => {
      const existingData = {
        version: 1,
        trails: [{ id: 't_test', name: 'Test Trail', status: 'active', created_at: '2025-01-01' }],
        clawmarks: [],
      };

      await writeFile(join(testDir, '.clawmarks.json'), JSON.stringify(existingData));

      const data = await storage.load();

      expect(data).toEqual(existingData);
    });

    it('should cache data after loading', async () => {
      const data1 = await storage.load();
      const data2 = await storage.load();

      expect(data1).toBe(data2); // Same reference
    });
  });

  describe('save', () => {
    it('should save data to file', async () => {
      await storage.load();
      await storage.updateData((data) => {
        data.trails.push({ id: 't_1', name: 'Trail 1', status: 'active', created_at: '2025-01-01' });
      });

      const fileContent = await readFile(join(testDir, '.clawmarks.json'), 'utf-8');
      const savedData = JSON.parse(fileContent);

      expect(savedData.trails).toHaveLength(1);
      expect(savedData.trails[0].name).toBe('Trail 1');
    });

    it('should throw if save called before load', async () => {
      await expect(storage.save()).rejects.toThrow('No data to save');
    });
  });

  describe('updateData', () => {
    it('should update and persist data', async () => {
      await storage.updateData((data) => {
        data.trails.push({ id: 't_1', name: 'New Trail', status: 'active', created_at: '2025-01-01' });
      });

      // Reload from file to verify persistence
      await storage.reload();
      const data = await storage.getData();

      expect(data.trails).toHaveLength(1);
      expect(data.trails[0].name).toBe('New Trail');
    });

    it('should return updated data', async () => {
      const result = await storage.updateData((data) => {
        data.version = 2;
      });

      expect(result.version).toBe(2);
    });
  });

  describe('reload', () => {
    it('should clear cache and reload from file', async () => {
      await storage.load();

      // Manually write new data to file
      const newData = {
        version: 1,
        trails: [{ id: 't_new', name: 'Externally Added', status: 'active', created_at: '2025-01-01' }],
        clawmarks: [],
      };
      await writeFile(join(testDir, '.clawmarks.json'), JSON.stringify(newData));

      // Reload should pick up new data
      const data = await storage.reload();

      expect(data.trails).toHaveLength(1);
      expect(data.trails[0].name).toBe('Externally Added');
    });
  });

  describe('getFilePath', () => {
    it('should return the correct file path', () => {
      expect(storage.getFilePath()).toBe(join(testDir, '.clawmarks.json'));
    });
  });

  describe('getProjectRoot', () => {
    it('should return the project root', () => {
      expect(storage.getProjectRoot()).toBe(testDir);
    });
  });
});
