import { ClawmarksStorage } from './storage.js';
import { Trail, Clawmark, ClawmarkType, TrailStatus, generateId } from './types.js';

export class ClawmarksTools {
  private storage: ClawmarksStorage;

  constructor(storage: ClawmarksStorage) {
    this.storage = storage;
  }

  // ==================== Trail Operations ====================

  async createTrail(name: string, description?: string): Promise<Trail> {
    const trail: Trail = {
      id: generateId('t'),
      name,
      description,
      status: 'active',
      created_at: new Date().toISOString(),
    };

    await this.storage.updateData((data) => {
      data.trails.push(trail);
    });

    return trail;
  }

  async listTrails(status?: TrailStatus): Promise<Trail[]> {
    const data = await this.storage.getData();
    if (status) {
      return data.trails.filter((t) => t.status === status);
    }
    return data.trails;
  }

  async getTrail(trailId: string): Promise<{ trail: Trail; clawmarks: Clawmark[] } | null> {
    const data = await this.storage.getData();
    const trail = data.trails.find((t) => t.id === trailId);
    if (!trail) {
      return null;
    }
    const clawmarks = data.clawmarks.filter((c) => c.trail_id === trailId);
    return { trail, clawmarks };
  }

  async archiveTrail(trailId: string): Promise<Trail | null> {
    let archivedTrail: Trail | null = null;

    await this.storage.updateData((data) => {
      const trail = data.trails.find((t) => t.id === trailId);
      if (trail) {
        trail.status = 'archived';
        archivedTrail = trail;
      }
    });

    return archivedTrail;
  }

  async deleteTrail(trailId: string): Promise<boolean> {
    let deleted = false;

    await this.storage.updateData((data) => {
      const trailIndex = data.trails.findIndex((t) => t.id === trailId);
      if (trailIndex !== -1) {
        data.trails.splice(trailIndex, 1);
        // Also remove all clawmarks in this trail
        data.clawmarks = data.clawmarks.filter((c) => c.trail_id !== trailId);
        deleted = true;
      }
    });

    return deleted;
  }

  // ==================== Clawmark Operations ====================

  async addClawmark(params: {
    trail_id: string;
    file: string;
    line: number;
    column?: number;
    annotation: string;
    type?: ClawmarkType;
    tags?: string[];
  }): Promise<Clawmark | { error: string }> {
    const data = await this.storage.getData();

    // Verify trail exists
    const trail = data.trails.find((t) => t.id === params.trail_id);
    if (!trail) {
      return { error: `Trail ${params.trail_id} not found` };
    }

    const clawmark: Clawmark = {
      id: generateId('c'),
      trail_id: params.trail_id,
      file: params.file,
      line: params.line,
      column: params.column,
      annotation: params.annotation,
      type: params.type || 'reference',
      tags: params.tags || [],
      references: [],
      created_at: new Date().toISOString(),
    };

    await this.storage.updateData((d) => {
      d.clawmarks.push(clawmark);
    });

    return clawmark;
  }

  async updateClawmark(
    clawmarkId: string,
    updates: {
      annotation?: string;
      type?: ClawmarkType;
      tags?: string[];
      line?: number;
      column?: number;
    }
  ): Promise<Clawmark | null> {
    let updatedClawmark: Clawmark | null = null;

    await this.storage.updateData((data) => {
      const clawmark = data.clawmarks.find((c) => c.id === clawmarkId);
      if (clawmark) {
        if (updates.annotation !== undefined) clawmark.annotation = updates.annotation;
        if (updates.type !== undefined) clawmark.type = updates.type;
        if (updates.tags !== undefined) clawmark.tags = updates.tags;
        if (updates.line !== undefined) clawmark.line = updates.line;
        if (updates.column !== undefined) clawmark.column = updates.column;
        updatedClawmark = clawmark;
      }
    });

    return updatedClawmark;
  }

  async deleteClawmark(clawmarkId: string): Promise<boolean> {
    let deleted = false;

    await this.storage.updateData((data) => {
      const index = data.clawmarks.findIndex((c) => c.id === clawmarkId);
      if (index !== -1) {
        data.clawmarks.splice(index, 1);
        // Also remove references to this clawmark from other clawmarks
        for (const clawmark of data.clawmarks) {
          clawmark.references = clawmark.references.filter((ref) => ref !== clawmarkId);
        }
        deleted = true;
      }
    });

    return deleted;
  }

  async listClawmarks(filters?: {
    trail_id?: string;
    file?: string;
    type?: ClawmarkType;
    tag?: string;
  }): Promise<Clawmark[]> {
    const data = await this.storage.getData();
    let clawmarks = data.clawmarks;

    if (filters) {
      if (filters.trail_id) {
        clawmarks = clawmarks.filter((c) => c.trail_id === filters.trail_id);
      }
      if (filters.file) {
        clawmarks = clawmarks.filter((c) => c.file === filters.file);
      }
      if (filters.type) {
        clawmarks = clawmarks.filter((c) => c.type === filters.type);
      }
      if (filters.tag) {
        const tag = filters.tag;
        clawmarks = clawmarks.filter((c) => c.tags.includes(tag));
      }
    }

    return clawmarks;
  }

  async getClawmark(clawmarkId: string): Promise<Clawmark | null> {
    const data = await this.storage.getData();
    return data.clawmarks.find((c) => c.id === clawmarkId) || null;
  }

  // ==================== Reference/Link Operations ====================

  async linkClawmarks(sourceId: string, targetId: string): Promise<boolean> {
    let linked = false;

    await this.storage.updateData((data) => {
      const source = data.clawmarks.find((c) => c.id === sourceId);
      const target = data.clawmarks.find((c) => c.id === targetId);

      if (source && target && !source.references.includes(targetId)) {
        source.references.push(targetId);
        linked = true;
      }
    });

    return linked;
  }

  async unlinkClawmarks(sourceId: string, targetId: string): Promise<boolean> {
    let unlinked = false;

    await this.storage.updateData((data) => {
      const source = data.clawmarks.find((c) => c.id === sourceId);
      if (source) {
        const index = source.references.indexOf(targetId);
        if (index !== -1) {
          source.references.splice(index, 1);
          unlinked = true;
        }
      }
    });

    return unlinked;
  }

  async getReferences(clawmarkId: string): Promise<{ outgoing: Clawmark[]; incoming: Clawmark[] }> {
    const data = await this.storage.getData();
    const clawmark = data.clawmarks.find((c) => c.id === clawmarkId);

    if (!clawmark) {
      return { outgoing: [], incoming: [] };
    }

    // Outgoing: clawmarks this clawmark references
    const outgoing = data.clawmarks.filter((c) => clawmark.references.includes(c.id));

    // Incoming: clawmarks that reference this clawmark
    const incoming = data.clawmarks.filter((c) => c.references.includes(clawmarkId));

    return { outgoing, incoming };
  }

  // ==================== Tag Operations ====================

  async addTagToClawmark(clawmarkId: string, tag: string): Promise<boolean> {
    // Ensure tag starts with #
    const normalizedTag = tag.startsWith('#') ? tag : `#${tag}`;
    let added = false;

    await this.storage.updateData((data) => {
      const clawmark = data.clawmarks.find((c) => c.id === clawmarkId);
      if (clawmark && !clawmark.tags.includes(normalizedTag)) {
        clawmark.tags.push(normalizedTag);
        added = true;
      }
    });

    return added;
  }

  async removeTagFromClawmark(clawmarkId: string, tag: string): Promise<boolean> {
    const normalizedTag = tag.startsWith('#') ? tag : `#${tag}`;
    let removed = false;

    await this.storage.updateData((data) => {
      const clawmark = data.clawmarks.find((c) => c.id === clawmarkId);
      if (clawmark) {
        const index = clawmark.tags.indexOf(normalizedTag);
        if (index !== -1) {
          clawmark.tags.splice(index, 1);
          removed = true;
        }
      }
    });

    return removed;
  }

  async listAllTags(): Promise<string[]> {
    const data = await this.storage.getData();
    const tagSet = new Set<string>();
    for (const clawmark of data.clawmarks) {
      for (const tag of clawmark.tags) {
        tagSet.add(tag);
      }
    }
    return Array.from(tagSet).sort();
  }
}
