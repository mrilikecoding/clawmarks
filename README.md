# Clawmarks

**Claude + Marks** - Storybook-style annotated bookmarks for code.

Clawmarks is an MCP server that lets AI agents (like Claude Code) create annotated bookmarks in your codebase. Marks are organized into threads, can reference each other (knowledge graph style), and are stored in a simple JSON file that any editor or tool can consume.

## What It Does

When you have a conversation with Claude about your code, Claude can drop "marks" at specific locations - annotated bookmarks that capture:

- **Where** - File, line, column
- **What** - An annotation explaining why this location matters
- **Type** - Is this a decision, a question, a change needed, an alternative approach?
- **Connections** - References to other marks (knowledge graph edges)
- **Context** - Tags and thread groupings

The result is a `.clawmarks.json` file - a portable, editor-agnostic record of the conversation's journey through your code.

## Installation

```bash
npm install -g clawmarks
```

## Configuration

Add to your Claude Code MCP configuration (`~/.claude.json` or project `.mcp.json`):

```json
{
  "mcpServers": {
    "clawmarks": {
      "command": "clawmarks"
    }
  }
}
```

The server uses the current working directory to store `.clawmarks.json`. You can override this with:

```json
{
  "mcpServers": {
    "clawmarks": {
      "command": "clawmarks",
      "env": {
        "CLAWMARKS_PROJECT_ROOT": "/path/to/project"
      }
    }
  }
}
```

## MCP Tools

### Thread Management

| Tool | Description |
|------|-------------|
| `create_thread` | Create a new thread to organize related marks |
| `list_threads` | List all threads (optionally filter by status) |
| `get_thread` | Get thread details with all its marks |
| `archive_thread` | Archive a completed thread |

### Mark Management

| Tool | Description |
|------|-------------|
| `add_mark` | Add an annotated bookmark at a file location |
| `update_mark` | Update mark metadata |
| `delete_mark` | Remove a mark |
| `list_marks` | List marks with optional filters |

### Knowledge Graph

| Tool | Description |
|------|-------------|
| `link_marks` | Create a reference from one mark to another |
| `unlink_marks` | Remove a reference |
| `get_references` | Get all marks connected to a mark |
| `list_tags` | List all tags used across marks |

### Mark Types

- `decision` - A decision point that was made
- `question` - Open question needing resolution
- `change_needed` - Code that needs modification
- `reference` - Reference point (existing code to understand)
- `alternative` - Alternative approach being considered
- `dependency` - Something this depends on

## Data Format

Clawmarks stores data in `.clawmarks.json`:

```json
{
  "version": 1,
  "threads": [
    {
      "id": "t_abc123",
      "name": "Auth Refactor Options",
      "description": "Exploring JWT vs session-based auth",
      "status": "active",
      "created_at": "2025-12-17T10:30:00Z"
    }
  ],
  "marks": [
    {
      "id": "m_xyz789",
      "thread_id": "t_abc123",
      "file": "src/auth/handler.ts",
      "line": 42,
      "column": 8,
      "annotation": "Current session logic - could replace with JWT",
      "type": "alternative",
      "tags": ["#security", "#breaking-change"],
      "references": ["m_def456"],
      "created_at": "2025-12-17T10:31:00Z"
    }
  ]
}
```

## Editor Integrations

The `.clawmarks.json` file is designed to be consumed by any editor or tool.

| Editor | Plugin |
|--------|--------|
| Neovim | [clawmarks.nvim](https://github.com/mrilikecoding/clawmarks.nvim) |
| VS Code | Coming soon |
| Emacs | Contributions welcome |

## Example Usage

In a Claude Code conversation:

> "Let's explore two approaches to refactoring the auth system. Can you create a thread and mark the key decision points?"

Claude will:
1. Create a thread called "Auth Refactor Options"
2. Add marks at relevant code locations
3. Link related marks together
4. Tag marks with relevant concerns

You can then browse these marks in your editor to revisit the conversation's journey through your code.

## License

MIT
