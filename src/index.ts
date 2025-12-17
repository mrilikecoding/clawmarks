#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { ClawmarksStorage } from './storage.js';
import { ClawmarksTools } from './tools.js';
import { MarkType, ThreadStatus } from './types.js';

// Get project root from environment or use current working directory
const PROJECT_ROOT = process.env.CLAWMARKS_PROJECT_ROOT || process.cwd();

const storage = new ClawmarksStorage(PROJECT_ROOT);
const tools = new ClawmarksTools(storage);

const server = new Server(
  {
    name: 'clawmarks',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      // Thread tools
      {
        name: 'create_thread',
        description: 'Create a new thread to organize related marks. Threads are like chapters in a storybook of code exploration.',
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Name of the thread (e.g., "Auth Refactor Options")',
            },
            description: {
              type: 'string',
              description: 'Optional longer description of what this thread explores',
            },
          },
          required: ['name'],
        },
      },
      {
        name: 'list_threads',
        description: 'List all threads, optionally filtered by status',
        inputSchema: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['active', 'archived'],
              description: 'Filter by thread status',
            },
          },
        },
      },
      {
        name: 'get_thread',
        description: 'Get a thread with all its marks',
        inputSchema: {
          type: 'object',
          properties: {
            thread_id: {
              type: 'string',
              description: 'The thread ID',
            },
          },
          required: ['thread_id'],
        },
      },
      {
        name: 'archive_thread',
        description: 'Archive a thread (mark it as no longer active)',
        inputSchema: {
          type: 'object',
          properties: {
            thread_id: {
              type: 'string',
              description: 'The thread ID to archive',
            },
          },
          required: ['thread_id'],
        },
      },
      // Mark tools
      {
        name: 'add_mark',
        description: 'Add a mark (bookmark with annotation) to a location in the code. Marks are nodes in a knowledge graph of code exploration.',
        inputSchema: {
          type: 'object',
          properties: {
            thread_id: {
              type: 'string',
              description: 'The thread this mark belongs to',
            },
            file: {
              type: 'string',
              description: 'Relative path to the file',
            },
            line: {
              type: 'number',
              description: 'Line number (1-indexed)',
            },
            column: {
              type: 'number',
              description: 'Column number (optional, for precise positioning)',
            },
            annotation: {
              type: 'string',
              description: 'Description of why this location is significant',
            },
            type: {
              type: 'string',
              enum: ['decision', 'question', 'change_needed', 'reference', 'alternative', 'dependency'],
              description: 'Type of mark: decision (made a choice), question (needs resolution), change_needed (code to modify), reference (context), alternative (another approach), dependency (something this depends on)',
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Tags for categorization (e.g., ["#performance", "#breaking-change"])',
            },
          },
          required: ['thread_id', 'file', 'line', 'annotation'],
        },
      },
      {
        name: 'update_mark',
        description: 'Update an existing mark',
        inputSchema: {
          type: 'object',
          properties: {
            mark_id: {
              type: 'string',
              description: 'The mark ID to update',
            },
            annotation: { type: 'string' },
            type: {
              type: 'string',
              enum: ['decision', 'question', 'change_needed', 'reference', 'alternative', 'dependency'],
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
            },
            line: { type: 'number' },
            column: { type: 'number' },
          },
          required: ['mark_id'],
        },
      },
      {
        name: 'delete_mark',
        description: 'Delete a mark',
        inputSchema: {
          type: 'object',
          properties: {
            mark_id: {
              type: 'string',
              description: 'The mark ID to delete',
            },
          },
          required: ['mark_id'],
        },
      },
      {
        name: 'list_marks',
        description: 'List marks with optional filters',
        inputSchema: {
          type: 'object',
          properties: {
            thread_id: {
              type: 'string',
              description: 'Filter by thread',
            },
            file: {
              type: 'string',
              description: 'Filter by file path',
            },
            type: {
              type: 'string',
              enum: ['decision', 'question', 'change_needed', 'reference', 'alternative', 'dependency'],
              description: 'Filter by mark type',
            },
            tag: {
              type: 'string',
              description: 'Filter by tag',
            },
          },
        },
      },
      // Reference/link tools
      {
        name: 'link_marks',
        description: 'Create a reference from one mark to another (knowledge graph edge)',
        inputSchema: {
          type: 'object',
          properties: {
            source_id: {
              type: 'string',
              description: 'The source mark ID',
            },
            target_id: {
              type: 'string',
              description: 'The target mark ID to reference',
            },
          },
          required: ['source_id', 'target_id'],
        },
      },
      {
        name: 'unlink_marks',
        description: 'Remove a reference between marks',
        inputSchema: {
          type: 'object',
          properties: {
            source_id: {
              type: 'string',
              description: 'The source mark ID',
            },
            target_id: {
              type: 'string',
              description: 'The target mark ID to unlink',
            },
          },
          required: ['source_id', 'target_id'],
        },
      },
      {
        name: 'get_references',
        description: 'Get all marks that reference or are referenced by a mark',
        inputSchema: {
          type: 'object',
          properties: {
            mark_id: {
              type: 'string',
              description: 'The mark ID to get references for',
            },
          },
          required: ['mark_id'],
        },
      },
      // Tag tools
      {
        name: 'list_tags',
        description: 'List all unique tags used across all marks',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      // Thread operations
      case 'create_thread': {
        const result = await tools.createThread(
          args?.name as string,
          args?.description as string | undefined
        );
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      case 'list_threads': {
        const result = await tools.listThreads(args?.status as ThreadStatus | undefined);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      case 'get_thread': {
        const result = await tools.getThread(args?.thread_id as string);
        if (!result) {
          return { content: [{ type: 'text', text: 'Thread not found' }], isError: true };
        }
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      case 'archive_thread': {
        const result = await tools.archiveThread(args?.thread_id as string);
        if (!result) {
          return { content: [{ type: 'text', text: 'Thread not found' }], isError: true };
        }
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      // Mark operations
      case 'add_mark': {
        const result = await tools.addMark({
          thread_id: args?.thread_id as string,
          file: args?.file as string,
          line: args?.line as number,
          column: args?.column as number | undefined,
          annotation: args?.annotation as string,
          type: args?.type as MarkType | undefined,
          tags: args?.tags as string[] | undefined,
        });
        if ('error' in result) {
          return { content: [{ type: 'text', text: result.error }], isError: true };
        }
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      case 'update_mark': {
        const result = await tools.updateMark(args?.mark_id as string, {
          annotation: args?.annotation as string | undefined,
          type: args?.type as MarkType | undefined,
          tags: args?.tags as string[] | undefined,
          line: args?.line as number | undefined,
          column: args?.column as number | undefined,
        });
        if (!result) {
          return { content: [{ type: 'text', text: 'Mark not found' }], isError: true };
        }
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      case 'delete_mark': {
        const result = await tools.deleteMark(args?.mark_id as string);
        return {
          content: [{ type: 'text', text: result ? 'Mark deleted' : 'Mark not found' }],
          isError: !result,
        };
      }

      case 'list_marks': {
        const result = await tools.listMarks({
          thread_id: args?.thread_id as string | undefined,
          file: args?.file as string | undefined,
          type: args?.type as MarkType | undefined,
          tag: args?.tag as string | undefined,
        });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      // Reference operations
      case 'link_marks': {
        const result = await tools.linkMarks(
          args?.source_id as string,
          args?.target_id as string
        );
        return {
          content: [{ type: 'text', text: result ? 'Marks linked' : 'Failed to link marks' }],
          isError: !result,
        };
      }

      case 'unlink_marks': {
        const result = await tools.unlinkMarks(
          args?.source_id as string,
          args?.target_id as string
        );
        return {
          content: [{ type: 'text', text: result ? 'Marks unlinked' : 'Failed to unlink marks' }],
          isError: !result,
        };
      }

      case 'get_references': {
        const result = await tools.getReferences(args?.mark_id as string);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      // Tag operations
      case 'list_tags': {
        const result = await tools.listAllTags();
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      default:
        return {
          content: [{ type: 'text', text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: 'text', text: `Error: ${message}` }],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Clawmarks MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
