---
name: codebase-memory
description: Use the configured codebase-memory-mcp server as the primary source for repository architecture, code discovery, symbol definitions, relationships, callers, and impact analysis. Use for every task that reads, changes, reviews, debugs, or explains source code in a repository.
---

# Codebase Memory

Use the `codebase-memory-mcp` MCP server before reasoning about repository code. Treat its indexed graph as the source of truth for structure and relationships; do not begin code discovery with shell grep/glob when an MCP query can answer it.

Upstream project: https://github.com/DeusData/codebase-memory-mcp

## Workflow

1. Identify the repository root and call `index_repository` when the project is not indexed or the graph may be stale. Use `fast` for a quick lookup, `moderate` for normal work, and `full` when semantic/similarity queries are needed. Do not enable persistence unless the task needs a shareable artifact.
2. Reuse the project identifier returned by indexing for subsequent calls.
3. Make at least one relevant MCP read before editing or proposing a code change. Re-query after edits when validating callers, relationships, or affected behavior.

## Tool Selection

- `get_architecture`: establish packages, entry points, dependencies, routes, layers, or hotspots.
- `search_graph`: find functions, classes, routes, variables, and relationships. Use it before `get_code_snippet` to obtain an exact qualified name.
- `get_code_snippet`: read a specific function, class, or symbol after `search_graph`.
- `search_code`: locate text patterns and receive graph-enriched matches.
- `trace_path`: inspect callers, callees, data flow, or cross-service impact.
- `query_graph`: run bounded Cypher queries for multi-hop or aggregate analysis; include `LIMIT` when broad.

## Boundaries

- Use shell tools for editing, running tests, inspecting non-code metadata, or checking files the MCP cannot index.
- If the MCP server is unavailable or indexing fails, state that limitation plainly, then use the smallest safe fallback; never claim MCP context that was not retrieved.
- Keep searches narrow and paginate `search_graph` when `has_more` is true. Check truncation fields from `search_code` before drawing conclusions.
