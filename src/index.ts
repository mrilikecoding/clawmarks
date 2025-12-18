#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { ClawmarksStorage } from './storage.js';
import { ClawmarksTools } from './tools.js';
import { ClawmarkType, TrailStatus } from './types.js';

// Get project root from environment or use current working directory
const PROJECT_ROOT = process.env.CLAWMARKS_PROJECT_ROOT || process.cwd();

const storage = new ClawmarksStorage(PROJECT_ROOT);
const tools = new ClawmarksTools(storage);

const server = new Server(
  {
    name: 'clawmarks',
    version: '0.2.2',
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
      // Trail tools
      {
        name: 'create_trail',
        description: 'Create a new trail to organize related clawmarks. Trails are narrative journeys through your code exploration.',
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Name of the trail (e.g., "Auth Refactor Options")',
            },
            description: {
              type: 'string',
              description: 'Optional longer description of what this trail explores',
            },
          },
          required: ['name'],
        },
      },
      {
        name: 'list_trails',
        description: 'List all trails, optionally filtered by status',
        inputSchema: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['active', 'archived'],
              description: 'Filter by trail status',
            },
          },
        },
      },
      {
        name: 'get_trail',
        description: 'Get a trail with all its clawmarks',
        inputSchema: {
          type: 'object',
          properties: {
            trail_id: {
              type: 'string',
              description: 'The trail ID',
            },
          },
          required: ['trail_id'],
        },
      },
      {
        name: 'archive_trail',
        description: 'Archive a trail (mark it as no longer active)',
        inputSchema: {
          type: 'object',
          properties: {
            trail_id: {
              type: 'string',
              description: 'The trail ID to archive',
            },
          },
          required: ['trail_id'],
        },
      },
      // Clawmark tools
      {
        name: 'add_clawmark',
        description: 'Add a clawmark (annotated bookmark) to a location in the code. Clawmarks are points on your trail through the codebase.',
        inputSchema: {
          type: 'object',
          properties: {
            trail_id: {
              type: 'string',
              description: 'The trail this clawmark belongs to',
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
              description: 'Type of clawmark: decision (made a choice), question (needs resolution), change_needed (code to modify), reference (context), alternative (another approach), dependency (something this depends on)',
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Tags for categorization (e.g., ["#performance", "#breaking-change"])',
            },
          },
          required: ['trail_id', 'file', 'line', 'annotation'],
        },
      },
      {
        name: 'update_clawmark',
        description: 'Update an existing clawmark',
        inputSchema: {
          type: 'object',
          properties: {
            clawmark_id: {
              type: 'string',
              description: 'The clawmark ID to update',
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
          required: ['clawmark_id'],
        },
      },
      {
        name: 'delete_clawmark',
        description: 'Delete a clawmark',
        inputSchema: {
          type: 'object',
          properties: {
            clawmark_id: {
              type: 'string',
              description: 'The clawmark ID to delete',
            },
          },
          required: ['clawmark_id'],
        },
      },
      {
        name: 'list_clawmarks',
        description: 'List clawmarks with optional filters',
        inputSchema: {
          type: 'object',
          properties: {
            trail_id: {
              type: 'string',
              description: 'Filter by trail',
            },
            file: {
              type: 'string',
              description: 'Filter by file path',
            },
            type: {
              type: 'string',
              enum: ['decision', 'question', 'change_needed', 'reference', 'alternative', 'dependency'],
              description: 'Filter by clawmark type',
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
        name: 'link_clawmarks',
        description: 'Create a reference from one clawmark to another (knowledge graph edge)',
        inputSchema: {
          type: 'object',
          properties: {
            source_id: {
              type: 'string',
              description: 'The source clawmark ID',
            },
            target_id: {
              type: 'string',
              description: 'The target clawmark ID to reference',
            },
          },
          required: ['source_id', 'target_id'],
        },
      },
      {
        name: 'unlink_clawmarks',
        description: 'Remove a reference between clawmarks',
        inputSchema: {
          type: 'object',
          properties: {
            source_id: {
              type: 'string',
              description: 'The source clawmark ID',
            },
            target_id: {
              type: 'string',
              description: 'The target clawmark ID to unlink',
            },
          },
          required: ['source_id', 'target_id'],
        },
      },
      {
        name: 'get_references',
        description: 'Get all clawmarks that reference or are referenced by a clawmark',
        inputSchema: {
          type: 'object',
          properties: {
            clawmark_id: {
              type: 'string',
              description: 'The clawmark ID to get references for',
            },
          },
          required: ['clawmark_id'],
        },
      },
      // Tag tools
      {
        name: 'list_tags',
        description: 'List all unique tags used across all clawmarks',
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
      // Trail operations
      case 'create_trail': {
        const result = await tools.createTrail(
          args?.name as string,
          args?.description as string | undefined
        );
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      case 'list_trails': {
        const result = await tools.listTrails(args?.status as TrailStatus | undefined);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      case 'get_trail': {
        const result = await tools.getTrail(args?.trail_id as string);
        if (!result) {
          return { content: [{ type: 'text', text: 'Trail not found' }], isError: true };
        }
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      case 'archive_trail': {
        const result = await tools.archiveTrail(args?.trail_id as string);
        if (!result) {
          return { content: [{ type: 'text', text: 'Trail not found' }], isError: true };
        }
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      // Clawmark operations
      case 'add_clawmark': {
        const result = await tools.addClawmark({
          trail_id: args?.trail_id as string,
          file: args?.file as string,
          line: args?.line as number,
          column: args?.column as number | undefined,
          annotation: args?.annotation as string,
          type: args?.type as ClawmarkType | undefined,
          tags: args?.tags as string[] | undefined,
        });
        if ('error' in result) {
          return { content: [{ type: 'text', text: result.error }], isError: true };
        }
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      case 'update_clawmark': {
        const result = await tools.updateClawmark(args?.clawmark_id as string, {
          annotation: args?.annotation as string | undefined,
          type: args?.type as ClawmarkType | undefined,
          tags: args?.tags as string[] | undefined,
          line: args?.line as number | undefined,
          column: args?.column as number | undefined,
        });
        if (!result) {
          return { content: [{ type: 'text', text: 'Clawmark not found' }], isError: true };
        }
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      case 'delete_clawmark': {
        const result = await tools.deleteClawmark(args?.clawmark_id as string);
        return {
          content: [{ type: 'text', text: result ? 'Clawmark deleted' : 'Clawmark not found' }],
          isError: !result,
        };
      }

      case 'list_clawmarks': {
        const result = await tools.listClawmarks({
          trail_id: args?.trail_id as string | undefined,
          file: args?.file as string | undefined,
          type: args?.type as ClawmarkType | undefined,
          tag: args?.tag as string | undefined,
        });
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      // Reference operations
      case 'link_clawmarks': {
        const result = await tools.linkClawmarks(
          args?.source_id as string,
          args?.target_id as string
        );
        return {
          content: [{ type: 'text', text: result ? 'Clawmarks linked' : 'Failed to link clawmarks' }],
          isError: !result,
        };
      }

      case 'unlink_clawmarks': {
        const result = await tools.unlinkClawmarks(
          args?.source_id as string,
          args?.target_id as string
        );
        return {
          content: [{ type: 'text', text: result ? 'Clawmarks unlinked' : 'Failed to unlink clawmarks' }],
          isError: !result,
        };
      }

      case 'get_references': {
        const result = await tools.getReferences(args?.clawmark_id as string);
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
