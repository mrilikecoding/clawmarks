export type TrailStatus = 'active' | 'archived';

export type ClawmarkType =
  | 'decision'      // A decision point that was made
  | 'question'      // Open question needing resolution
  | 'change_needed' // Code that needs modification
  | 'reference'     // Reference point (existing code to understand)
  | 'alternative'   // Alternative approach being considered
  | 'dependency';   // Something this depends on

export interface Trail {
  id: string;
  name: string;
  description?: string;
  status: TrailStatus;
  created_at: string;
}

export interface Clawmark {
  id: string;
  trail_id: string;
  file: string;
  line: number;
  column?: number;
  annotation: string;
  type: ClawmarkType;
  tags: string[];
  references: string[];  // IDs of other clawmarks this references
  created_at: string;
}

export interface ClawmarksData {
  version: number;
  trails: Trail[];
  clawmarks: Clawmark[];
}

export const DEFAULT_CLAWMARKS_DATA: ClawmarksData = {
  version: 1,
  trails: [],
  clawmarks: [],
};

// Helper to generate unique IDs
export function generateId(prefix: 't' | 'c'): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 8; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${prefix}_${id}`;
}
