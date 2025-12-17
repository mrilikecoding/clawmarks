import { ClawmarksStorage } from './storage.js';
import { Thread, Mark, MarkType, ThreadStatus, generateId } from './types.js';

export class ClawmarksTools {
  private storage: ClawmarksStorage;

  constructor(storage: ClawmarksStorage) {
    this.storage = storage;
  }

  // ==================== Thread Operations ====================

  async createThread(name: string, description?: string): Promise<Thread> {
    const thread: Thread = {
      id: generateId('t'),
      name,
      description,
      status: 'active',
      created_at: new Date().toISOString(),
    };

    await this.storage.updateData((data) => {
      data.threads.push(thread);
    });

    return thread;
  }

  async listThreads(status?: ThreadStatus): Promise<Thread[]> {
    const data = await this.storage.getData();
    if (status) {
      return data.threads.filter((t) => t.status === status);
    }
    return data.threads;
  }

  async getThread(threadId: string): Promise<{ thread: Thread; marks: Mark[] } | null> {
    const data = await this.storage.getData();
    const thread = data.threads.find((t) => t.id === threadId);
    if (!thread) {
      return null;
    }
    const marks = data.marks.filter((m) => m.thread_id === threadId);
    return { thread, marks };
  }

  async archiveThread(threadId: string): Promise<Thread | null> {
    let archivedThread: Thread | null = null;

    await this.storage.updateData((data) => {
      const thread = data.threads.find((t) => t.id === threadId);
      if (thread) {
        thread.status = 'archived';
        archivedThread = thread;
      }
    });

    return archivedThread;
  }

  async deleteThread(threadId: string): Promise<boolean> {
    let deleted = false;

    await this.storage.updateData((data) => {
      const threadIndex = data.threads.findIndex((t) => t.id === threadId);
      if (threadIndex !== -1) {
        data.threads.splice(threadIndex, 1);
        // Also remove all marks in this thread
        data.marks = data.marks.filter((m) => m.thread_id !== threadId);
        deleted = true;
      }
    });

    return deleted;
  }

  // ==================== Mark Operations ====================

  async addMark(params: {
    thread_id: string;
    file: string;
    line: number;
    column?: number;
    annotation: string;
    type?: MarkType;
    tags?: string[];
  }): Promise<Mark | { error: string }> {
    const data = await this.storage.getData();

    // Verify thread exists
    const thread = data.threads.find((t) => t.id === params.thread_id);
    if (!thread) {
      return { error: `Thread ${params.thread_id} not found` };
    }

    const mark: Mark = {
      id: generateId('m'),
      thread_id: params.thread_id,
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
      d.marks.push(mark);
    });

    return mark;
  }

  async updateMark(
    markId: string,
    updates: {
      annotation?: string;
      type?: MarkType;
      tags?: string[];
      line?: number;
      column?: number;
    }
  ): Promise<Mark | null> {
    let updatedMark: Mark | null = null;

    await this.storage.updateData((data) => {
      const mark = data.marks.find((m) => m.id === markId);
      if (mark) {
        if (updates.annotation !== undefined) mark.annotation = updates.annotation;
        if (updates.type !== undefined) mark.type = updates.type;
        if (updates.tags !== undefined) mark.tags = updates.tags;
        if (updates.line !== undefined) mark.line = updates.line;
        if (updates.column !== undefined) mark.column = updates.column;
        updatedMark = mark;
      }
    });

    return updatedMark;
  }

  async deleteMark(markId: string): Promise<boolean> {
    let deleted = false;

    await this.storage.updateData((data) => {
      const index = data.marks.findIndex((m) => m.id === markId);
      if (index !== -1) {
        data.marks.splice(index, 1);
        // Also remove references to this mark from other marks
        for (const mark of data.marks) {
          mark.references = mark.references.filter((ref) => ref !== markId);
        }
        deleted = true;
      }
    });

    return deleted;
  }

  async listMarks(filters?: {
    thread_id?: string;
    file?: string;
    type?: MarkType;
    tag?: string;
  }): Promise<Mark[]> {
    const data = await this.storage.getData();
    let marks = data.marks;

    if (filters) {
      if (filters.thread_id) {
        marks = marks.filter((m) => m.thread_id === filters.thread_id);
      }
      if (filters.file) {
        marks = marks.filter((m) => m.file === filters.file);
      }
      if (filters.type) {
        marks = marks.filter((m) => m.type === filters.type);
      }
      if (filters.tag) {
        const tag = filters.tag;
        marks = marks.filter((m) => m.tags.includes(tag));
      }
    }

    return marks;
  }

  async getMark(markId: string): Promise<Mark | null> {
    const data = await this.storage.getData();
    return data.marks.find((m) => m.id === markId) || null;
  }

  // ==================== Reference/Link Operations ====================

  async linkMarks(sourceId: string, targetId: string): Promise<boolean> {
    let linked = false;

    await this.storage.updateData((data) => {
      const source = data.marks.find((m) => m.id === sourceId);
      const target = data.marks.find((m) => m.id === targetId);

      if (source && target && !source.references.includes(targetId)) {
        source.references.push(targetId);
        linked = true;
      }
    });

    return linked;
  }

  async unlinkMarks(sourceId: string, targetId: string): Promise<boolean> {
    let unlinked = false;

    await this.storage.updateData((data) => {
      const source = data.marks.find((m) => m.id === sourceId);
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

  async getReferences(markId: string): Promise<{ outgoing: Mark[]; incoming: Mark[] }> {
    const data = await this.storage.getData();
    const mark = data.marks.find((m) => m.id === markId);

    if (!mark) {
      return { outgoing: [], incoming: [] };
    }

    // Outgoing: marks this mark references
    const outgoing = data.marks.filter((m) => mark.references.includes(m.id));

    // Incoming: marks that reference this mark
    const incoming = data.marks.filter((m) => m.references.includes(markId));

    return { outgoing, incoming };
  }

  // ==================== Tag Operations ====================

  async addTagToMark(markId: string, tag: string): Promise<boolean> {
    // Ensure tag starts with #
    const normalizedTag = tag.startsWith('#') ? tag : `#${tag}`;
    let added = false;

    await this.storage.updateData((data) => {
      const mark = data.marks.find((m) => m.id === markId);
      if (mark && !mark.tags.includes(normalizedTag)) {
        mark.tags.push(normalizedTag);
        added = true;
      }
    });

    return added;
  }

  async removeTagFromMark(markId: string, tag: string): Promise<boolean> {
    const normalizedTag = tag.startsWith('#') ? tag : `#${tag}`;
    let removed = false;

    await this.storage.updateData((data) => {
      const mark = data.marks.find((m) => m.id === markId);
      if (mark) {
        const index = mark.tags.indexOf(normalizedTag);
        if (index !== -1) {
          mark.tags.splice(index, 1);
          removed = true;
        }
      }
    });

    return removed;
  }

  async listAllTags(): Promise<string[]> {
    const data = await this.storage.getData();
    const tagSet = new Set<string>();
    for (const mark of data.marks) {
      for (const tag of mark.tags) {
        tagSet.add(tag);
      }
    }
    return Array.from(tagSet).sort();
  }
}
