# Plan Naprawczy: Agent Workspace + Full Agent Modal

## Co trzeba zrobić:

### 1. Frontend: AgentsPage.svelte — przywrócić pełne okno agenta

Zastąpić obecny modal "Run Task" (linie ~289-335) pełnym oknem z:

```
┌─ Agent: [name] ───────────────────────┐
│  Status: 🟢 ready  Skills: [3]         │
│  Model: deepseek/deepseek-chat         │
│                                         │
│  📝 Task / Prompt:                      │
│  ┌──────────────────────────────────┐  │
│  │                                   │  │
│  │                                   │  │
│  └──────────────────────────────────┘  │
│                                         │
│  📂 Workspace:                          │
│  [C:\Users\...\project]  [Browse...]    │
│                                         │
│  🛠 Skills to enable:                   │
│  [✓] codesmith  [✓] tool-caller        │
│  [ ] memory  [✓] web-search            │
│                                         │
│  ⚙ Advanced:                            │
│  Model: [deepseek/deepseek-chat ▼]      │
│  Thinking: [medium ▼]                   │
│                                         │
│        [Cancel]      [▶ Execute Task]   │
└─────────────────────────────────────────┘
```

Kluczowe funkcje:
- `Browse...` → woła `POST /api/workspace/browse` (otwiera natywne okno Windows)
- Skills → checkboxy z `selectedAgent.skills`
- Execute → wysyła `POST /api/agent/send` z `{ message, agentId, model, skills, workspace }`

### 2. Frontend: AgentsPage.svelte — przycisk Browser w card

Zamiast `window.open("/agents/" + id)`, przycisk Browser powinien:
- Wołać `POST /api/workspace/browse`
- Po wybraniu folderu, ustawić go jako workspace agenta: `PUT /api/agents/:id/workspace`
- Wyświetlić wybraną ścieżkę w card

### 3. Backend: routes.ts — dodać workspace support do /api/agent/send

W endpoint `/api/agent/send` (linia 153) dodać:
```ts
// Jeśli workspace jest przekazany, ustaw go
if (body.workspace) {
  workspaceManager.setRoot(body.workspace);
}
// Jeśli skills są przekazane, dodaj do runAgent
const skills = body.skills || (body.agentId ? agentStore.get(body.agentId)?.skills : undefined);
// ... i przekaż do runAgent
```

### 4. Backend: routes.ts — dodać PUT /api/agents/:id/workspace

Endpoint do ustawiania workspace dla konkretnego agenta:
```ts
app.put("/api/agents/:id/workspace", async (c) => {
  const { path } = await c.req.json<{ path: string }>();
  agentStore.update(c.req.param("id"), { workspace: path });
  workspaceManager.setRoot(path);
  return c.json({ status: "ok", workspace: path });
});
```

### 5. Backend: routes.ts — dodać GET /api/agents/:id

Endpoint do pobierania szczegółów agenta (w tym workspace):
```ts
app.get("/api/agents/:id", (c) => {
  const agent = agentStore.get(c.req.param("id"));
  if (!agent) return c.json({ error: "Not found" }, 404);
  return c.json({ agent });
});
```

### 6. Node modules — fix `'head' is not recognized`

Błąd `'head' is not recognized` pochodzi z workspace manager. W `workspace/manager.ts` jest komenda `head` (Unix) która nie działa na Windows. Fix:
```ts
// Zamiast execSync("head -n 5 file.txt")
// Użyć Node.js readFileSync
const lines = readFileSync(path, "utf-8").split("\n").slice(0, 5).join("\n");
```
