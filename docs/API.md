# Nova API Reference

## Base URL

```
http://localhost:4123
```

## Authentication

### POST /api/auth/register
```json
{ "username": "user", "password": "pass" }
```

### POST /api/auth/login
```json
{ "username": "user", "password": "pass" }
```

## Chat

### POST /v1/chat/completions (OpenAI-compatible)
```json
{
  "model": "deepseek/deepseek-chat",
  "messages": [{"role": "user", "content": "Hello"}],
  "stream": true
}
```

### POST /api/agent/send
```json
{
  "message": "Hello",
  "model": "deepseek/deepseek-chat",
  "sessionKey": "optional-session-id"
}
```

## Sessions

### GET /api/sessions
List all sessions.

### GET /api/sessions/:id
Get session transcript.

## Agents

### GET /api/agents
List all agents.

### POST /api/agents
```json
{ "name": "my-agent", "description": "...", "modelRef": "deepseek/deepseek-chat" }
```

### PUT /api/agents/:id
```json
{ "name": "updated-name", "systemPrompt": "..." }
```

### DELETE /api/agents/:id

## Knowledge Base

### GET /api/knowledge/:category
List entries by category (bug-fix, feature, research, session, etc.).

### GET /api/knowledge/search/:query
Full-text search across all categories.

### POST /api/knowledge
```json
{ "title": "...", "content": "...", "tags": ["tag1", "tag2"], "category": "research" }
```

### GET /api/knowledge/stats
Get entry counts per category.

## Research

### POST /api/research
```json
{ "query": "quantum computing", "sources": ["arxiv", "wikipedia"] }
```

### GET /api/research/sources
List all available research sources (22 sources).

## Trading

### GET /api/trading/:symbol
Analyze a symbol (e.g., AAPL, BTC).

## Workspace

### GET /api/workspace
Get workspace state.

### POST /api/workspace/set
```json
{ "dir": "/path/to/workspace" }
```

### GET /api/workspace/files?dir=&ext=&depth=
List files in workspace.

### GET /api/workspace/read?path=file.ts
Read file from workspace.

### POST /api/workspace/write
```json
{ "path": "file.ts", "content": "..." }
```

### GET /api/workspace/tree?dir=&depth=
Get file tree.

### POST /api/workspace/clear
Clear workspace.

## Kernel

### GET /api/kernel/status
Check kernel initialization.

### GET /api/kernel/agentfs/:agentId
List agent files.

### GET /api/kernel/agentfs/:agentId/:fileName
Read agent file.

### PUT /api/kernel/agentfs/:agentId/:fileName
```json
{ "content": "..." }
```

### GET /api/kernel/global
List global files.

### GET /api/kernel/ledger?agentId=&action=&limit=
Query event ledger.

### GET /api/kernel/ledger/stats
Ledger statistics.

## Tmux

### GET /api/tmux/status
Check tmux availability.

### GET /api/tmux/sessions
List tmux sessions.

### POST /api/tmux/sessions
```json
{ "name": "my-session", "dir": "/path" }
```

### DELETE /api/tmux/sessions/:name

### POST /api/tmux/send
```json
{ "session": "my-session", "command": "ls -la" }
```

### GET /api/tmux/capture?session=my-session
Capture pane output.

## Video

### POST /api/video/generate
```json
{ "topic": "...", "duration": 30, "style": "modern", "language": "en" }
```

### GET /api/video/jobs/:id

## Health

### GET /healthz
### GET /readyz
### GET /metrics
