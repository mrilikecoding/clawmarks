export type ThreadStatus = 'active' | 'archived';

export type MarkType =
  | 'decision'      // A decision point that was made
  | 'question'      // Open question needing resolution
  | 'change_needed' // Code that needs modification
  | 'reference'     // Reference point (existing code to understand)
  | 'alternative'   // Alternative approach being considered
  | 'dependency';   // Something this depends on

export interface Thread {
  id: string;
  name: string;
  description?: string;
  status: ThreadStatus;
  created_at: string;
}

export interface Mark {
  id: string;
  thread_id: string;
  file: string;
  line: number;
  column?: number;
  annotation: string;
  type: MarkType;
  tags: string[];
  references: string[];  // IDs of other marks this references
  created_at: string;
}

export interface ClawmarksData {
  version: number;
  threads: Thread[];
  marks: Mark[];
}

export const DEFAULT_CLAWMARKS_DATA: ClawmarksData = {
  version: 1,
  threads: [],
  marks: [],
};

// Helper to generate unique IDs
export function generateId(prefix: 't' | 'm'): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 8; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${prefix}_${id}`;
}
