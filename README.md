<p align="center">
  <img src="logo.png" alt="Clawmarks" width="128" height="128">
</p>

<h1 align="center">Clawmarks</h1>

<p align="center">
  Storybook-style annotated bookmarks for code exploration.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/clawmarks"><img src="https://img.shields.io/npm/v/clawmarks.svg" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/clawmarks"><img src="https://img.shields.io/npm/dm/clawmarks.svg" alt="npm downloads"></a>
  <a href="https://github.com/mrilikecoding/clawmarks/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/clawmarks.svg" alt="license"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/node/v/clawmarks.svg" alt="node version"></a>
</p>

## The Problem

Working with an LLM agent on a complex problem often means iterating across multiple files, considering alternatives, making decisions, and building understanding over time. But when the conversation ends, you're left with a wall of chat history and modified files—no clear trail of *where* you went and *why*.

Clawmarks solves this by letting agents drop annotated bookmarks as they work. These clawmarks capture the narrative of your exploration: decision points, open questions, alternatives considered, and how they all connect. The result is a navigable map of your coding session, not just a transcript.

## What It Does

Clawmarks is an MCP server that gives LLM agents tools to create annotated bookmarks in your codebase. Clawmarks are organized into trails (narrative journeys), can reference each other (knowledge graph style), and are stored in a simple JSON file that any editor can consume.

Each clawmark captures:

- **Where** - File, line, column
- **What** - An annotation explaining why this location matters
- **Type** - Decision, question, change needed, alternative approach, etc.
- **Connections** - References to other clawmarks (knowledge graph edges)
- **Context** - Tags and trail groupings

## Quick Start

1. Install globally:
   ```bash
   npm install -g clawmarks
   ```

2. Add `.clawmarks.json` to your global gitignore (one-time setup):
   ```bash
   echo ".clawmarks.json" >> ~/.gitignore_global
   git config --global core.excludesfile ~/.gitignore_global
   ```

3. Add the MCP server:

   **Option A: Claude CLI (recommended)**
   ```bash
   claude mcp add --scope user clawmarks -- clawmarks mcp
   ```

   **Option B: Manual configuration**

   Add to your project's `.mcp.json`:
   ```json
   {
     "mcpServers": {
       "clawmarks": {
         "command": "clawmarks",
         "args": ["mcp"]
       }
     }
   }
   ```

The server stores `.clawmarks.json` in the current working directory. To override the project root:

```bash
claude mcp add --scope user clawmarks -- clawmarks mcp --env CLAWMARKS_PROJECT_ROOT=/path/to/project
```

Or in `.mcp.json`:

```json
{
  "mcpServers": {
    "clawmarks": {
      "command": "clawmarks",
      "args": ["mcp"],
      "env": {
        "CLAWMARKS_PROJECT_ROOT": "/path/to/project"
      }
    }
  }
}
```

## MCP Tools

### Trail Management

| Tool | Description |
|------|-------------|
| `create_trail` | Create a new trail to organize related clawmarks |
| `list_trails` | List all trails (optionally filter by status) |
| `get_trail` | Get trail details with all its clawmarks |
| `archive_trail` | Archive a completed trail |

### Clawmark Management

| Tool | Description |
|------|-------------|
| `add_clawmark` | Add an annotated bookmark at a file location |
| `update_clawmark` | Update clawmark metadata |
| `delete_clawmark` | Remove a clawmark |
| `list_clawmarks` | List clawmarks with optional filters |

### Knowledge Graph

| Tool | Description |
|------|-------------|
| `link_clawmarks` | Create a reference from one clawmark to another |
| `unlink_clawmarks` | Remove a reference |
| `get_references` | Get all clawmarks connected to a clawmark |
| `list_tags` | List all tags used across clawmarks |

### Clawmark Types

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
  "trails": [
    {
      "id": "t_abc123",
      "name": "Auth Refactor Options",
      "description": "Exploring JWT vs session-based auth",
      "status": "active",
      "created_at": "2025-12-17T10:30:00Z"
    }
  ],
  "clawmarks": [
    {
      "id": "c_xyz789",
      "trail_id": "t_abc123",
      "file": "src/auth/handler.ts",
      "line": 42,
      "column": 8,
      "annotation": "Current session logic - could replace with JWT",
      "type": "alternative",
      "tags": ["#security", "#breaking-change"],
      "references": ["c_def456"],
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

In a conversation with your LLM agent:

> "Let's explore two approaches to refactoring the auth system. Can you create a trail and mark the key decision points?"

The agent will:
1. Create a trail called "Auth Refactor Options"
2. Add clawmarks at relevant code locations
3. Link related clawmarks together
4. Tag clawmarks with relevant concerns

You can then browse these clawmarks in your editor to revisit the exploration's journey through your code.

## License

MIT
