import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ClawmarksStorage } from './storage.js';
import { ClawmarksTools } from './tools.js';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('ClawmarksTools', () => {
  let testDir: string;
  let storage: ClawmarksStorage;
  let tools: ClawmarksTools;

  beforeEach(async () => {
    testDir = join(tmpdir(), `clawmarks-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(testDir, { recursive: true });
    storage = new ClawmarksStorage(testDir);
    tools = new ClawmarksTools(storage);
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  // ==================== Trail Tests ====================

  describe('Trail Operations', () => {
    describe('createTrail', () => {
      it('should create a trail with name only', async () => {
        const trail = await tools.createTrail('My Trail');

        expect(trail.id).toMatch(/^t_[a-z0-9]{8}$/);
        expect(trail.name).toBe('My Trail');
        expect(trail.description).toBeUndefined();
        expect(trail.status).toBe('active');
        expect(trail.created_at).toBeDefined();
      });

      it('should create a trail with name and description', async () => {
        const trail = await tools.createTrail('My Trail', 'A detailed description');

        expect(trail.name).toBe('My Trail');
        expect(trail.description).toBe('A detailed description');
      });

      it('should persist trail to storage', async () => {
        await tools.createTrail('Persisted Trail');

        const trails = await tools.listTrails();
        expect(trails).toHaveLength(1);
        expect(trails[0].name).toBe('Persisted Trail');
      });
    });

    describe('listTrails', () => {
      it('should return empty array when no trails exist', async () => {
        const trails = await tools.listTrails();
        expect(trails).toEqual([]);
      });

      it('should return all trails', async () => {
        await tools.createTrail('Trail 1');
        await tools.createTrail('Trail 2');
        await tools.createTrail('Trail 3');

        const trails = await tools.listTrails();
        expect(trails).toHaveLength(3);
      });

      it('should filter trails by status', async () => {
        const trail1 = await tools.createTrail('Active Trail');
        await tools.createTrail('Another Active');
        await tools.archiveTrail(trail1.id);

        const activeTrails = await tools.listTrails('active');
        const archivedTrails = await tools.listTrails('archived');

        expect(activeTrails).toHaveLength(1);
        expect(archivedTrails).toHaveLength(1);
        expect(archivedTrails[0].name).toBe('Active Trail');
      });
    });

    describe('getTrail', () => {
      it('should return null for non-existent trail', async () => {
        const result = await tools.getTrail('t_nonexistent');
        expect(result).toBeNull();
      });

      it('should return trail with its clawmarks', async () => {
        const trail = await tools.createTrail('Test Trail');
        await tools.addClawmark({
          trail_id: trail.id,
          file: 'test.ts',
          line: 10,
          annotation: 'Test annotation',
        });

        const result = await tools.getTrail(trail.id);

        expect(result).not.toBeNull();
        expect(result!.trail.name).toBe('Test Trail');
        expect(result!.clawmarks).toHaveLength(1);
      });
    });

    describe('archiveTrail', () => {
      it('should archive an existing trail', async () => {
        const trail = await tools.createTrail('To Archive');

        const archived = await tools.archiveTrail(trail.id);

        expect(archived).not.toBeNull();
        expect(archived!.status).toBe('archived');
      });

      it('should return null for non-existent trail', async () => {
        const result = await tools.archiveTrail('t_nonexistent');
        expect(result).toBeNull();
      });
    });

    describe('deleteTrail', () => {
      it('should delete an existing trail', async () => {
        const trail = await tools.createTrail('To Delete');

        const deleted = await tools.deleteTrail(trail.id);

        expect(deleted).toBe(true);
        expect(await tools.listTrails()).toHaveLength(0);
      });

      it('should delete associated clawmarks', async () => {
        const trail = await tools.createTrail('Trail with clawmarks');
        await tools.addClawmark({
          trail_id: trail.id,
          file: 'test.ts',
          line: 1,
          annotation: 'Will be deleted',
        });

        await tools.deleteTrail(trail.id);

        const clawmarks = await tools.listClawmarks();
        expect(clawmarks).toHaveLength(0);
      });

      it('should return false for non-existent trail', async () => {
        const deleted = await tools.deleteTrail('t_nonexistent');
        expect(deleted).toBe(false);
      });
    });
  });

  // ==================== Clawmark Tests ====================

  describe('Clawmark Operations', () => {
    let trailId: string;

    beforeEach(async () => {
      const trail = await tools.createTrail('Test Trail');
      trailId = trail.id;
    });

    describe('addClawmark', () => {
      it('should create a clawmark with required fields', async () => {
        const clawmark = await tools.addClawmark({
          trail_id: trailId,
          file: 'src/index.ts',
          line: 42,
          annotation: 'Important code here',
        });

        expect(clawmark).not.toHaveProperty('error');
        if (!('error' in clawmark)) {
          expect(clawmark.id).toMatch(/^c_[a-z0-9]{8}$/);
          expect(clawmark.trail_id).toBe(trailId);
          expect(clawmark.file).toBe('src/index.ts');
          expect(clawmark.line).toBe(42);
          expect(clawmark.annotation).toBe('Important code here');
          expect(clawmark.type).toBe('reference'); // default
          expect(clawmark.tags).toEqual([]);
          expect(clawmark.references).toEqual([]);
        }
      });

      it('should create a clawmark with all optional fields', async () => {
        const clawmark = await tools.addClawmark({
          trail_id: trailId,
          file: 'src/index.ts',
          line: 42,
          column: 10,
          annotation: 'Decision point',
          type: 'decision',
          tags: ['#important', '#refactor'],
        });

        expect(clawmark).not.toHaveProperty('error');
        if (!('error' in clawmark)) {
          expect(clawmark.column).toBe(10);
          expect(clawmark.type).toBe('decision');
          expect(clawmark.tags).toEqual(['#important', '#refactor']);
        }
      });

      it('should return error for non-existent trail', async () => {
        const result = await tools.addClawmark({
          trail_id: 't_nonexistent',
          file: 'test.ts',
          line: 1,
          annotation: 'Test',
        });

        expect(result).toHaveProperty('error');
        if ('error' in result) {
          expect(result.error).toContain('not found');
        }
      });

      it('should support all clawmark types', async () => {
        const types = ['decision', 'question', 'change_needed', 'reference', 'alternative', 'dependency'] as const;

        for (const type of types) {
          const clawmark = await tools.addClawmark({
            trail_id: trailId,
            file: 'test.ts',
            line: 1,
            annotation: `Type: ${type}`,
            type,
          });

          expect(clawmark).not.toHaveProperty('error');
          if (!('error' in clawmark)) {
            expect(clawmark.type).toBe(type);
          }
        }
      });
    });

    describe('updateClawmark', () => {
      it('should update clawmark annotation', async () => {
        const clawmark = await tools.addClawmark({
          trail_id: trailId,
          file: 'test.ts',
          line: 1,
          annotation: 'Original',
        });

        if (!('error' in clawmark)) {
          const updated = await tools.updateClawmark(clawmark.id, {
            annotation: 'Updated annotation',
          });

          expect(updated).not.toBeNull();
          expect(updated!.annotation).toBe('Updated annotation');
        }
      });

      it('should update clawmark type', async () => {
        const clawmark = await tools.addClawmark({
          trail_id: trailId,
          file: 'test.ts',
          line: 1,
          annotation: 'Test',
          type: 'reference',
        });

        if (!('error' in clawmark)) {
          const updated = await tools.updateClawmark(clawmark.id, {
            type: 'decision',
          });

          expect(updated!.type).toBe('decision');
        }
      });

      it('should update clawmark tags', async () => {
        const clawmark = await tools.addClawmark({
          trail_id: trailId,
          file: 'test.ts',
          line: 1,
          annotation: 'Test',
        });

        if (!('error' in clawmark)) {
          const updated = await tools.updateClawmark(clawmark.id, {
            tags: ['#new-tag'],
          });

          expect(updated!.tags).toEqual(['#new-tag']);
        }
      });

      it('should update clawmark line and column', async () => {
        const clawmark = await tools.addClawmark({
          trail_id: trailId,
          file: 'test.ts',
          line: 1,
          annotation: 'Test',
        });

        if (!('error' in clawmark)) {
          const updated = await tools.updateClawmark(clawmark.id, {
            line: 100,
            column: 25,
          });

          expect(updated!.line).toBe(100);
          expect(updated!.column).toBe(25);
        }
      });

      it('should return null for non-existent clawmark', async () => {
        const result = await tools.updateClawmark('c_nonexistent', {
          annotation: 'New',
        });

        expect(result).toBeNull();
      });
    });

    describe('deleteClawmark', () => {
      it('should delete an existing clawmark', async () => {
        const clawmark = await tools.addClawmark({
          trail_id: trailId,
          file: 'test.ts',
          line: 1,
          annotation: 'To delete',
        });

        if (!('error' in clawmark)) {
          const deleted = await tools.deleteClawmark(clawmark.id);

          expect(deleted).toBe(true);
          expect(await tools.listClawmarks()).toHaveLength(0);
        }
      });

      it('should remove references to deleted clawmark', async () => {
        const clawmark1 = await tools.addClawmark({
          trail_id: trailId,
          file: 'test.ts',
          line: 1,
          annotation: 'Source',
        });
        const clawmark2 = await tools.addClawmark({
          trail_id: trailId,
          file: 'test.ts',
          line: 2,
          annotation: 'Target',
        });

        if (!('error' in clawmark1) && !('error' in clawmark2)) {
          await tools.linkClawmarks(clawmark1.id, clawmark2.id);
          await tools.deleteClawmark(clawmark2.id);

          const remaining = await tools.getClawmark(clawmark1.id);
          expect(remaining!.references).toEqual([]);
        }
      });

      it('should return false for non-existent clawmark', async () => {
        const deleted = await tools.deleteClawmark('c_nonexistent');
        expect(deleted).toBe(false);
      });
    });

    describe('listClawmarks', () => {
      it('should return empty array when no clawmarks exist', async () => {
        const clawmarks = await tools.listClawmarks();
        expect(clawmarks).toEqual([]);
      });

      it('should return all clawmarks', async () => {
        await tools.addClawmark({ trail_id: trailId, file: 'a.ts', line: 1, annotation: 'A' });
        await tools.addClawmark({ trail_id: trailId, file: 'b.ts', line: 2, annotation: 'B' });

        const clawmarks = await tools.listClawmarks();
        expect(clawmarks).toHaveLength(2);
      });

      it('should filter by trail_id', async () => {
        const trail2 = await tools.createTrail('Trail 2');
        await tools.addClawmark({ trail_id: trailId, file: 'a.ts', line: 1, annotation: 'A' });
        await tools.addClawmark({ trail_id: trail2.id, file: 'b.ts', line: 2, annotation: 'B' });

        const clawmarks = await tools.listClawmarks({ trail_id: trailId });
        expect(clawmarks).toHaveLength(1);
        expect(clawmarks[0].annotation).toBe('A');
      });

      it('should filter by file', async () => {
        await tools.addClawmark({ trail_id: trailId, file: 'src/index.ts', line: 1, annotation: 'A' });
        await tools.addClawmark({ trail_id: trailId, file: 'src/other.ts', line: 2, annotation: 'B' });

        const clawmarks = await tools.listClawmarks({ file: 'src/index.ts' });
        expect(clawmarks).toHaveLength(1);
      });

      it('should filter by type', async () => {
        await tools.addClawmark({ trail_id: trailId, file: 'a.ts', line: 1, annotation: 'A', type: 'decision' });
        await tools.addClawmark({ trail_id: trailId, file: 'b.ts', line: 2, annotation: 'B', type: 'question' });

        const clawmarks = await tools.listClawmarks({ type: 'decision' });
        expect(clawmarks).toHaveLength(1);
        expect(clawmarks[0].type).toBe('decision');
      });

      it('should filter by tag', async () => {
        await tools.addClawmark({ trail_id: trailId, file: 'a.ts', line: 1, annotation: 'A', tags: ['#important'] });
        await tools.addClawmark({ trail_id: trailId, file: 'b.ts', line: 2, annotation: 'B', tags: ['#minor'] });

        const clawmarks = await tools.listClawmarks({ tag: '#important' });
        expect(clawmarks).toHaveLength(1);
      });

      it('should combine multiple filters', async () => {
        await tools.addClawmark({ trail_id: trailId, file: 'a.ts', line: 1, annotation: 'A', type: 'decision', tags: ['#important'] });
        await tools.addClawmark({ trail_id: trailId, file: 'a.ts', line: 2, annotation: 'B', type: 'question', tags: ['#important'] });
        await tools.addClawmark({ trail_id: trailId, file: 'b.ts', line: 3, annotation: 'C', type: 'decision', tags: ['#important'] });

        const clawmarks = await tools.listClawmarks({ file: 'a.ts', type: 'decision' });
        expect(clawmarks).toHaveLength(1);
        expect(clawmarks[0].annotation).toBe('A');
      });
    });

    describe('getClawmark', () => {
      it('should return clawmark by id', async () => {
        const created = await tools.addClawmark({
          trail_id: trailId,
          file: 'test.ts',
          line: 1,
          annotation: 'Test',
        });

        if (!('error' in created)) {
          const clawmark = await tools.getClawmark(created.id);
          expect(clawmark).not.toBeNull();
          expect(clawmark!.id).toBe(created.id);
        }
      });

      it('should return null for non-existent clawmark', async () => {
        const clawmark = await tools.getClawmark('c_nonexistent');
        expect(clawmark).toBeNull();
      });
    });
  });

  // ==================== Reference/Link Tests ====================

  describe('Reference Operations', () => {
    let trailId: string;

    beforeEach(async () => {
      const trail = await tools.createTrail('Test Trail');
      trailId = trail.id;
    });

    describe('linkClawmarks', () => {
      it('should create a reference between clawmarks', async () => {
        const source = await tools.addClawmark({ trail_id: trailId, file: 'a.ts', line: 1, annotation: 'Source' });
        const target = await tools.addClawmark({ trail_id: trailId, file: 'b.ts', line: 2, annotation: 'Target' });

        if (!('error' in source) && !('error' in target)) {
          const linked = await tools.linkClawmarks(source.id, target.id);

          expect(linked).toBe(true);

          const updated = await tools.getClawmark(source.id);
          expect(updated!.references).toContain(target.id);
        }
      });

      it('should not duplicate references', async () => {
        const source = await tools.addClawmark({ trail_id: trailId, file: 'a.ts', line: 1, annotation: 'Source' });
        const target = await tools.addClawmark({ trail_id: trailId, file: 'b.ts', line: 2, annotation: 'Target' });

        if (!('error' in source) && !('error' in target)) {
          await tools.linkClawmarks(source.id, target.id);
          await tools.linkClawmarks(source.id, target.id);

          const updated = await tools.getClawmark(source.id);
          expect(updated!.references).toHaveLength(1);
        }
      });

      it('should return false for non-existent clawmarks', async () => {
        const linked = await tools.linkClawmarks('c_nonexistent', 'c_also_nonexistent');
        expect(linked).toBe(false);
      });
    });

    describe('unlinkClawmarks', () => {
      it('should remove a reference between clawmarks', async () => {
        const source = await tools.addClawmark({ trail_id: trailId, file: 'a.ts', line: 1, annotation: 'Source' });
        const target = await tools.addClawmark({ trail_id: trailId, file: 'b.ts', line: 2, annotation: 'Target' });

        if (!('error' in source) && !('error' in target)) {
          await tools.linkClawmarks(source.id, target.id);
          const unlinked = await tools.unlinkClawmarks(source.id, target.id);

          expect(unlinked).toBe(true);

          const updated = await tools.getClawmark(source.id);
          expect(updated!.references).toHaveLength(0);
        }
      });

      it('should return false when reference does not exist', async () => {
        const source = await tools.addClawmark({ trail_id: trailId, file: 'a.ts', line: 1, annotation: 'Source' });
        const target = await tools.addClawmark({ trail_id: trailId, file: 'b.ts', line: 2, annotation: 'Target' });

        if (!('error' in source) && !('error' in target)) {
          const unlinked = await tools.unlinkClawmarks(source.id, target.id);
          expect(unlinked).toBe(false);
        }
      });
    });

    describe('getReferences', () => {
      it('should return outgoing references', async () => {
        const source = await tools.addClawmark({ trail_id: trailId, file: 'a.ts', line: 1, annotation: 'Source' });
        const target = await tools.addClawmark({ trail_id: trailId, file: 'b.ts', line: 2, annotation: 'Target' });

        if (!('error' in source) && !('error' in target)) {
          await tools.linkClawmarks(source.id, target.id);

          const refs = await tools.getReferences(source.id);

          expect(refs.outgoing).toHaveLength(1);
          expect(refs.outgoing[0].id).toBe(target.id);
          expect(refs.incoming).toHaveLength(0);
        }
      });

      it('should return incoming references', async () => {
        const source = await tools.addClawmark({ trail_id: trailId, file: 'a.ts', line: 1, annotation: 'Source' });
        const target = await tools.addClawmark({ trail_id: trailId, file: 'b.ts', line: 2, annotation: 'Target' });

        if (!('error' in source) && !('error' in target)) {
          await tools.linkClawmarks(source.id, target.id);

          const refs = await tools.getReferences(target.id);

          expect(refs.incoming).toHaveLength(1);
          expect(refs.incoming[0].id).toBe(source.id);
          expect(refs.outgoing).toHaveLength(0);
        }
      });

      it('should return empty arrays for non-existent clawmark', async () => {
        const refs = await tools.getReferences('c_nonexistent');

        expect(refs.outgoing).toEqual([]);
        expect(refs.incoming).toEqual([]);
      });

      it('should handle bidirectional references', async () => {
        const cm1 = await tools.addClawmark({ trail_id: trailId, file: 'a.ts', line: 1, annotation: 'A' });
        const cm2 = await tools.addClawmark({ trail_id: trailId, file: 'b.ts', line: 2, annotation: 'B' });

        if (!('error' in cm1) && !('error' in cm2)) {
          await tools.linkClawmarks(cm1.id, cm2.id);
          await tools.linkClawmarks(cm2.id, cm1.id);

          const refs1 = await tools.getReferences(cm1.id);
          const refs2 = await tools.getReferences(cm2.id);

          expect(refs1.outgoing).toHaveLength(1);
          expect(refs1.incoming).toHaveLength(1);
          expect(refs2.outgoing).toHaveLength(1);
          expect(refs2.incoming).toHaveLength(1);
        }
      });
    });
  });

  // ==================== Tag Tests ====================

  describe('Tag Operations', () => {
    let trailId: string;

    beforeEach(async () => {
      const trail = await tools.createTrail('Test Trail');
      trailId = trail.id;
    });

    describe('addTagToClawmark', () => {
      it('should add a tag to a clawmark', async () => {
        const clawmark = await tools.addClawmark({
          trail_id: trailId,
          file: 'test.ts',
          line: 1,
          annotation: 'Test',
        });

        if (!('error' in clawmark)) {
          const added = await tools.addTagToClawmark(clawmark.id, '#new-tag');

          expect(added).toBe(true);

          const updated = await tools.getClawmark(clawmark.id);
          expect(updated!.tags).toContain('#new-tag');
        }
      });

      it('should normalize tags to start with #', async () => {
        const clawmark = await tools.addClawmark({
          trail_id: trailId,
          file: 'test.ts',
          line: 1,
          annotation: 'Test',
        });

        if (!('error' in clawmark)) {
          await tools.addTagToClawmark(clawmark.id, 'no-hash');

          const updated = await tools.getClawmark(clawmark.id);
          expect(updated!.tags).toContain('#no-hash');
        }
      });

      it('should not add duplicate tags', async () => {
        const clawmark = await tools.addClawmark({
          trail_id: trailId,
          file: 'test.ts',
          line: 1,
          annotation: 'Test',
          tags: ['#existing'],
        });

        if (!('error' in clawmark)) {
          const added = await tools.addTagToClawmark(clawmark.id, '#existing');

          expect(added).toBe(false);

          const updated = await tools.getClawmark(clawmark.id);
          expect(updated!.tags).toHaveLength(1);
        }
      });
    });

    describe('removeTagFromClawmark', () => {
      it('should remove a tag from a clawmark', async () => {
        const clawmark = await tools.addClawmark({
          trail_id: trailId,
          file: 'test.ts',
          line: 1,
          annotation: 'Test',
          tags: ['#to-remove', '#to-keep'],
        });

        if (!('error' in clawmark)) {
          const removed = await tools.removeTagFromClawmark(clawmark.id, '#to-remove');

          expect(removed).toBe(true);

          const updated = await tools.getClawmark(clawmark.id);
          expect(updated!.tags).toEqual(['#to-keep']);
        }
      });

      it('should normalize tag when removing', async () => {
        const clawmark = await tools.addClawmark({
          trail_id: trailId,
          file: 'test.ts',
          line: 1,
          annotation: 'Test',
          tags: ['#my-tag'],
        });

        if (!('error' in clawmark)) {
          const removed = await tools.removeTagFromClawmark(clawmark.id, 'my-tag');

          expect(removed).toBe(true);

          const updated = await tools.getClawmark(clawmark.id);
          expect(updated!.tags).toHaveLength(0);
        }
      });

      it('should return false when tag does not exist', async () => {
        const clawmark = await tools.addClawmark({
          trail_id: trailId,
          file: 'test.ts',
          line: 1,
          annotation: 'Test',
        });

        if (!('error' in clawmark)) {
          const removed = await tools.removeTagFromClawmark(clawmark.id, '#nonexistent');
          expect(removed).toBe(false);
        }
      });
    });

    describe('listAllTags', () => {
      it('should return empty array when no tags exist', async () => {
        const tags = await tools.listAllTags();
        expect(tags).toEqual([]);
      });

      it('should return all unique tags sorted', async () => {
        await tools.addClawmark({ trail_id: trailId, file: 'a.ts', line: 1, annotation: 'A', tags: ['#zebra', '#alpha'] });
        await tools.addClawmark({ trail_id: trailId, file: 'b.ts', line: 2, annotation: 'B', tags: ['#beta', '#alpha'] });

        const tags = await tools.listAllTags();

        expect(tags).toEqual(['#alpha', '#beta', '#zebra']);
      });

      it('should not include duplicate tags', async () => {
        await tools.addClawmark({ trail_id: trailId, file: 'a.ts', line: 1, annotation: 'A', tags: ['#common'] });
        await tools.addClawmark({ trail_id: trailId, file: 'b.ts', line: 2, annotation: 'B', tags: ['#common'] });

        const tags = await tools.listAllTags();

        expect(tags).toHaveLength(1);
        expect(tags[0]).toBe('#common');
      });
    });
  });
});
