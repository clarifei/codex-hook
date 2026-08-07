---
name: codebase-memory
description: Use the configured codebase-memory-mcp as the primary source for repository architecture, code discovery, symbols, relationships, callers, and impact analysis. Use for every task that reads, changes, reviews, debugs, or explains repository code.
---

# Codebase Memory

Treat the indexed graph as the source of truth for code structure and relationships. Do not start with shell search when an MCP query can answer the question.

## Flow

1. Identify the repository root and index a missing or stale graph: `fast` for lookup, `moderate` for normal work, `full` for semantic or similarity queries. Persist only when a shared artifact is needed.
2. Reuse the returned project identifier.
3. Make at least one relevant MCP read before reasoning, editing, or proposing code. Re-query after edits when callers, relationships, or impact matter.

## Routing

- `get_architecture`: packages, entry points, dependencies, routes, layers, and hotspots.
- `search_graph`: functions, classes, routes, variables, and relationships; get an exact qualified name before `get_code_snippet`.
- `get_code_snippet`: exact source for a symbol found by `search_graph`.
- `search_code`: graph-enriched text matches.
- `trace_path`: callers, callees, data flow, and impact.
- `query_graph`: bounded multi-hop or aggregate queries; add `LIMIT` when broad.

## Limits

- Use shell tools for edits, tests, metadata, and files the graph cannot index.
- If MCP fails, state it and use the smallest fallback; never claim results not retrieved.
- Keep queries narrow. Follow `has_more` pagination and `search_code` truncation fields.

Source: https://github.com/DeusData/codebase-memory-mcp
