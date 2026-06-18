# 🔷 NEXUS AI — Premium Rebranding & Complete Design Plan v2

> **Data:** 2026-06-18 · **Wersja:** v2.0 "Aurora" · **Autor:** AutoClaw  
> **Status:** Plan strategiczny — do akceptacji  
> **Zakres:** Wszystkie 28 funkcji + usunięcie zbędnych modułów

---

## 📐 SPIS TREŚCI

1. [Decyzje strategiczne](#1-decyzje-strategiczne)
2. [Nowa tożsamość marki](#2-nowa-tożsamość-marki)
3. [System Design — kompletny redesign](#3-system-design)
4. [Główny Chat — funkcja premium](#4-główny-chat)
5. [Interconnected Agent Mesh](#5-interconnected-agent-mesh)
6. **Pełna specyfikacja każdej funkcji:**
   - [6.1 Chat Assistant](#61-chat-assistant)
   - [6.2 Agents](#62-agents)
   - [6.3 Agent Chambers](#63-agent-chambers)
   - [6.4 Knowledge Graph](#64-knowledge-graph)
   - [6.5 Knowledge Base (RAG)](#65-knowledge-base-rag)
   - [6.6 Code Editor](#66-code-editor)
   - [6.7 Git Automation](#67-git-automation)
   - [6.8 Terminal](#68-terminal)
   - [6.9 Workspace](#69-workspace)
   - [6.10 Workflows](#610-workflows)
   - [6.11 Skills](#611-skills)
   - [6.12 Plugins](#612-plugins)
   - [6.13 Integrations](#613-integrations)
   - [6.14 Worker Nodes](#614-worker-nodes)
   - [6.15 Prompt Playground](#615-prompt-playground)
   - [6.16 Sessions](#616-sessions)
   - [6.17 Channels](#617-channels)
   - [6.18 Memory DB](#618-memory-db)
   - [6.19 Settings](#619-settings)
   - [6.20 API Keys](#620-api-keys)
   - [6.21 System Logs](#621-system-logs)
   - [6.22 User Profiles](#622-user-profiles)
   - [6.23 AI Models](#623-ai-models)
   - [6.24 Cron Schedule](#624-cron-schedule)
   - [6.25 Analytics](#625-analytics)
   - [6.26 Tool Analytics](#626-tool-analytics)
   - [6.27 Documentation](#627-documentation)
   - [6.28 Creative Studio (opcjonalnie)](#628-creative-studio-opcjonalnie)
7. [Moduły do usunięcia](#7-moduły-do-usunięcia)
8. [Architektura techniczna v2](#8-architektura-techniczna-v2)
9. [Roadmap wdrożenia](#9-roadmap-wdrożenia)
10. [Tokeny designu v2](#10-tokeny-designu-v2)

---

## 1. DECYZJE STRATEGICZNE

### 1.1 Co to jest Nexus AI?

**Nexus AI to premium, self-hosted platforma do budowania, łączenia i orkiestracji agentów AI.**

Nie jesteśmy:
- ❌ Narzędziem do generowania wideo (usuwamy)
- ❌ Platformą crypto/trading (usuwamy)
- ❌ Narzędziem social media (usuwamy)
- ❌ Shopping agentem (usuwamy)

Jesteśmy:
- ✅ **Agent-first** platformą — wszystko kręci się wokół agentów
- ✅ **Connected** — każdy agent może współpracować z każdym
- ✅ **Developer-focused** — code editor, git, terminal, workflow builder
- ✅ **Knowledge-powered** — RAG, knowledge graph, memory
- ✅ **Enterprise-ready** — integracje, worker nodes, cron, analytics

### 1.2 Co usuwamy (wraz z uzasadnieniem)?

| Moduł | Powód usunięcia |
|-------|-----------------|
| **Video Generation** | Rozprasza, niszowe, rozdęte. Nie pasuje do agent-first platformy |
| **Crypto Hub** | Nieprofesjonalne, wysokie ryzyko, nie pasuje do premium |
| **Shopping Agent** | Niszowe, brak wartości premium |
| **Social Media (Bluesky/Twitter)** | Nie pasuje do developer-focused platformy |
| **AI Dubbing (Whisper/TTS pipeline)** | Związane z video — usuń razem |
| **Crypto Trading Agent** | Usuń razem z Crypto Hub |

**Backend do usunięcia:**
```
packages/core/src/video/          → DELETE
packages/core/src/crypto-hub/     → DELETE
packages/core/src/shopping/       → DELETE
packages/core/src/social/         → DELETE
packages/core/src/bsky/           → DELETE
packages/core/src/media/          → DELETE
packages/core/src/browser/        → DELETE (opcjonalnie, tylko jeśli nieużywane)
data/crypto_cache.json            → DELETE
data/crypto_history.json          → DELETE
data/video-jobs.json              → DELETE
data/video_uploads/               → DELETE
data/social/                      → DELETE
skills/blockchain/                → DELETE
skills/crypto-*                   → DELETE
skills/shopping-*                 → DELETE
agents/crypto-news-agent/         → DELETE
agents/shopping-agent/            → DELETE
agents/video-editor-agent/        → DELETE
agents/video-post-processor/      → DELETE
```

**Frontend do usunięcia:**
```
src/routes/VideoPage.tsx          → DELETE
src/routes/VideoEditorPage.tsx    → DELETE
src/routes/CryptoHubPage.tsx      → DELETE
src/routes/ShoppingPage.tsx       → DELETE
src/routes/SocialPage.tsx         → DELETE
src/lib/components/crypto/*       → DELETE
src/lib/config/chains.ts          → DELETE
src/lib/config/tokens.ts          → DELETE
src/lib/config/reown.ts           → DELETE
src/lib/hooks/useMultiChain.ts   → DELETE
src/lib/hooks/useWallet.ts       → DELETE
src/lib/workflow/                 → DELETE (zastąpione nowym)
```

**Szacowana oszczędność:** ~40% kodu, ~50% złożoności, szybszy build, czystszy kod.

---

## 2. NOWA TOŻSAMOŚĆ MARKI

### 2.1 Nazwa i tagline

**NEXUS AI** — *"Connect. Create. Automate."*

Logo: Heksagonalny węzeł (⬡) z gradientem cyan → indigo → violet.

### 2.2 Paleta kolorów — Premium Dark Spectrum

```css
/* Tło */
--nx-bg-deepest:    #050510;
--nx-bg-primary:    #0a0b1e;
--nx-bg-secondary:  #11132b;
--nx-bg-tertiary:   #1a1d3a;
--nx-bg-glass:      rgba(255, 255, 255, 0.025);
--nx-bg-glass-hover: rgba(255, 255, 255, 0.05);

/* Akcenty */
--nx-accent-cyan:    #00d4ff;
--nx-accent-blue:    #3b82f6;
--nx-accent-indigo:  #6366f1;
--nx-accent-violet:  #8b5cf6;
--nx-accent-purple:  #a78bfa;

/* Tekst */
--nx-text-primary:    #e8ecf2;
--nx-text-secondary:  #8892a8;
--nx-text-muted:      #4a5068;

/* Semantyczne */
--nx-success: #10b981;
--nx-warning: #f59e0b;
--nx-error:   #ef4444;
--nx-info:    #3b82f6;
```

### 2.3 Typografia

| Rola | Font | Weights |
|------|------|---------|
| Display (nagłówki, branding) | **Clash Display** | 500, 600, 700 |
| Body (UI, tekst) | **Inter** | 400, 500, 600 |
| Mono (kod, terminal, dane) | **JetBrains Mono** | 400, 500 |

### 2.4 Voice & Tone

Premium ≠ sztywny. Premium = pewny siebie, pomocny, konkretny.

- ✅ Krótkie, treściwe odpowiedzi
- ✅ Emoji max 1 na wiadomość
- ❌ Bez korporacyjnego żargonu
- ❌ Bez "as an AI language model..."

---

## 3. SYSTEM DESIGN — KOMPLETNY REDESIGN

### 3.1 Układ aplikacji

```
┌──────────────────────────────────────────────────────────┐
│ TOP BAR — unified command center                         │
│ [⬡ Nexus AI] [⌘K Global Search] [⚡ Online] [👤 Profile] │
├────────┬───────────────────────────────────┬─────────────┤
│        │                                   │             │
│ NAV    │        MAIN CANVAS               │ CONTEXT     │
│        │                                   │ PANEL       │
│ ────── │  ┌─ Dynamic View ─────────────┐  │             │
│ 📡 HUB │  │ (zmienia się per strona)    │  │ Quick       │
│  💬    │  │                             │  │ Actions     │
│  🔀    │  │ Chat / Workflow / Code /    │  │ Agent       │
│  🏢    │  │ Agents / Settings / etc.    │  │ Status      │
│  📚    │  │                             │  │ Files       │
│        │  └─────────────────────────────┘  │ Memory      │
│ 🤖 AGT │                                   │             │
│  👥    │                                   │ ▸ Collapse   │
│  🧠    │                                   │             │
│  ⚡    │                                   │             │
│  🔌    │                                   │             │
│        │                                   │             │
│ ⚙️ SYS │                                   │             │
│  🎛️   │                                   │             │
│  ...   │                                   │             │
│        │                                   │             │
├────────┴───────────────────────────────────┴─────────────┤
│ STATUS BAR — agents · model · tokens · latency · session  │
└──────────────────────────────────────────────────────────┘
```

### 3.2 Nowa nawigacja — 3 sekcje, 28 funkcji

```
📡 HUB
  ├─ 💬 Chat Assistant       ← DEFAULT VIEW
  ├─ 🔀 Workflows            ← NEW (visual workflow builder)
  ├─ 🏢 Agent Chambers       ← NEW (multi-agent rooms)
  └─ 📚 Knowledge Base (RAG) ← (document upload + search)

🤖 AGENTS
  ├─ 👥 Agent Mesh           ← (zarządzanie agentami + połączenia)
  ├─ 🧠 Memory & Knowledge   ← (memory DB + knowledge graph)
  ├─ ⚡ Skills               ← (skills marketplace)
  ├─ 🔌 Integrations         ← (API integrations hub)
  ├─ 📦 Plugins              ← (plugin manager)
  └─ 🧪 Prompt Playground    ← (test & compare prompts)

⚙️ SYSTEM
  ├─ 💻 Code Editor          ← (Monaco + LSP)
  ├─ 🔀 Git Automation       ← (auto branch, commit, PR)
  ├─ 🖥️ Terminal              ← (multiplexer)
  ├─ 📂 Workspace            ← (file browser)
  ├─ ⚙️ Worker Nodes          ← (background jobs)
  ├─ 📊 Sessions             ← (session history)
  ├─ 📡 Channels             ← (messaging config)
  ├─ 🎛️ Settings              ← (general settings)
  ├─ 🔑 API Keys             ← (key management)
  ├─ 📋 System Logs          ← (log viewer)
  ├─ 👤 User Profiles        ← (profile management)
  ├─ 🧠 AI Models            ← (model config)
  ├─ ⏰ Cron Schedule         ← (task scheduler)
  ├─ 📈 Analytics            ← (usage dashboard)
  ├─ 🔧 Tool Analytics       ← (tool usage stats)
  └─ 📖 Documentation        ← (help & docs)
```

### 3.3 Responsywność

| Breakpoint | Layout |
|------------|--------|
| < 768px | Single column, bottom tab bar, BottomSheet zamiast modali |
| 768-1024px | Sidebar collapsed (icons only), 2-column |
| 1024-1440px | Full sidebar + canvas + context panel |
| > 1440px | Dodatkowy inspector panel |

---

## 4. GŁÓWNY CHAT — FUNKCJA PREMIUM ⭐

### 4.1 Architektura wiadomości

```
┌─────────────────────────────────────────────────────────┐
│ CHAT HEADER                                             │
│ [🤖 Avatar] Main Assistant · Nexus-4 Pro ▾ · Session ▾  │
│ [★ Star] [📋 Copy Session] [⊕ New Chat] [⚙️ Settings]   │
├─────────────────────────────────────────────────────────┤
│ MESSAGE AREA (virtualized infinite scroll)              │
│                                                         │
│  ┌─ User Message ───────────────────────────────────┐  │
│  │ 👤 │ Zbuduj dashboard dla danych sprzedażowych   │  │
│  │    │ [📎 raport.xlsx] [🖼️ screen.png]           │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  ┌─ Agent Response ─────────────────────────────────┐  │
│  │ 🤖 │ ## Plan budowy dashboardu                   │  │
│  │    │ (markdown + code + tables)                  │  │
│  │    │                                             │  │
│  │    │ ┌─ Thinking Panel ──────────────────────┐  │  │
│  │    │ │ "Analizuję strukturę danych..."        │  │  │
│  │    │ │ (collapsed default)                    │  │  │
│  │    │ └───────────────────────────────────────┘  │  │
│  │    │                                             │  │
│  │    │ ┌─ Agent Mesh Activity ────────────────┐  │  │
│  │    │ │ 🧠 Research Agent · searching...     │  │  │
│  │    │ │ 💻 Coder Agent · analyzing...        │  │  │
│  │    │ │ 📊 Data Agent · processing...        │  │  │
│  │    │ └──────────────────────────────────────┘  │  │
│  │    │                                             │  │
│  │    │ ┌─ Tool Call ─────────────────────────┐  │  │
│  │    │ │ 🔧 web_search · 1.2s · ✅ 3 results │  │  │
│  │    │ └─────────────────────────────────────┘  │  │
│  │    │                                             │  │
│  │    │ Token usage: 1.2K in · 3.4K out · $0.008   │  │
│  │    │ [👍] [👎] [📋 Copy] [🔄 Retry] [🔀 Fork]   │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
├─────────────────────────────────────────────────────────┤
│ CONTEXT BAR                                             │
│ [████████░░] 78% · 156K/200K tokens · 📎 3 files       │
├─────────────────────────────────────────────────────────┤
│ CHAT INPUT                                              │
│ ┌───────────────────────────────────────────────────┐  │
│ │ [📎][/] Napisz wiadomość...              [🎤][⏎] │  │
│ └───────────────────────────────────────────────────┘  │
│ [🤖 Agent: Main ▾] [🧠 Model: Nexus-4 ▾] [🔧Auto]    │
└─────────────────────────────────────────────────────────┘
```

### 4.2 Kluczowe funkcje chatu

| Funkcja | Status | Opis |
|---------|--------|------|
| Streaming Markdown | ✅ Ulepszyć | Renderowanie w czasie rzeczywistym |
| Thinking Panel | ✅ Ulepszyć | Collapsed default, animowane rozwijanie |
| Tool Call Cards | ✅ Ulepszyć | Z timingiem, ikoną statusu, rozwijane |
| Code Blocks | ✅ Ulepszyć | Syntax highlighting + copy + language label |
| Agent Switcher | 🆕 | Dropdown przy inpucie — wybierz agenta przed wysłaniem |
| Model Switcher | 🆕 | Dropdown przy inpucie — zmieniaj model w locie |
| Slash Commands | 🆕 | `/help` `/clear` `/agents` `/fork` `/voice` `/memory` `/search` `/save` `/export` `/summarize` `/undo` `/retry` `/settings` `/docs` |
| Threading & Forking | 🆕 | Rozgałęziaj konwersację w dowolnym punkcie |
| Context Window Viz | 🆕 | Pasek pokazujący zużycie okna kontekstowego |
| Voice Mode | 🆕 | Push-to-talk + Web Speech API STT |
| File Upload | 🆕 | Drag & drop PDF, DOCX, XLSX, CSV, JSON, TXT, obrazy |
| URL Auto-Fetch | 🆕 | Wklej link → automatycznie pobiera i parsuje treść |
| Message Actions | 🆕 | 👍 👎 📋 🔄 🔀 na hover |
| Conversation Export | 🆕 | Eksport jako Markdown / JSON / PDF |
| Session Management | 🆕 | Zapisane sesje, wyszukiwanie, przełączanie |

### 4.3 Slash commands — full spec

```
/help         — pokaż wszystkie komendy
/clear        — wyczyść konwersację
/agents       — lista dostępnych agentów z statusem
/agent [name] — przełącz na konkretnego agenta
/tools        — lista narzędzi aktywnego agenta
/models       — lista dostępnych modeli
/skills       — lista aktywnych skilli
/memory       — przeszukaj pamięć: /memory "keyword"
/search       — przeszukaj workspace: /search "pattern"
/knowledge    — zapytaj knowledge base
/sessions     — lista zapisanych sesji
/save         — zapisz bieżącą konwersację
/export       — eksportuj jako [md|json|pdf]
/summarize    — podsumuj konwersację
/fork         — rozgałęź od ostatniej wiadomości
/undo         — cofnij ostatnią wiadomość
/retry        — ponów ostatnią odpowiedź
/voice        — przełącz tryb głosowy
/settings     — ustawienia chatu
/docs         — otwórz dokumentację
```

---

## 5. INTERCONNECTED AGENT MESH 🔗

### 5.1 Agent Mesh Protocol (AMP)

Każdy agent może:
- ✅ Być wywołany przez Main Agenta (jak teraz)
- ✅ Być wywołany przez innego agenta (**NOWE**)
- ✅ Wywołać Main Agenta o pomoc (**NOWE**)
- ✅ Czytać/zapisywać do współdzielonej pamięci (AgentFS)
- ✅ Subskrybować eventy innych agentów (**NOWE**)
- ✅ Delegować podzadania (**NOWE**)

### 5.2 Agent-to-Agent Communication

```typescript
interface AgentMessage {
  from: string;        // agent ID
  to: string;          // agent ID lub '*' (broadcast)
  type: 'task' | 'query' | 'result' | 'handoff' | 'alert';
  payload: unknown;
  replyTo?: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
}

// Eventy systemowe:
// 'agent:task-complete'   — agent skończył zadanie
// 'agent:need-help'       — agent prosi o pomoc
// 'agent:found-issue'     — agent znalazł problem
// 'agent:context-update'  — zmiana w shared memory
// 'mesh:agent-online'     — agent dołączył do mesh
// 'mesh:agent-offline'    — agent opuścił mesh
```

### 5.3 Automatyczny routing

Main Agent analizuje zapytanie użytkownika i automatycznie deleguje do odpowiednich agentów:

```
"Zbuduj dashboard" → PM Agent (plan) → Coder Agent (kod) → Tester (testy)
"Zbadaj konkurencję" → Research Agent → Data Analyst → Main (formatowanie)
"Znajdź bug w auth" → Security Auditor → Coder Agent → Tester
"Napisz dokumentację API" → Documentation Writer → Coder Agent (review)
```

---

## 6. PEŁNA SPECYFIKACJA KAŻDEJ FUNKCJI

---

### 6.1 Chat Assistant

**Status:** 🔄 Pełny redesign (opisany szczegółowo w §4)

**Co się zmienia:**
- Nowy layout z context barem i agent mesh activity
- Streaming odpowiedzi z thinking panel + tool cards
- Multi-model switching w locie
- Agent switcher przy inpucie
- Slash commands z autocomplete
- Threading & forking konwersacji
- Context window visualization
- Voice mode (push-to-talk)
- File upload drag & drop
- Message actions (👍👎📋🔄🔀)
- Eksport konwersacji (MD/JSON/PDF)

**Stan obecny:** Działa (ChatPage.tsx, ~480 linii)  
**Stan docelowy:** Premium chat, ~800 linii, rozbity na komponenty  

---

### 6.2 Agents

**Status:** 🔄 Redesign

**Aktualnie:** AgentsPage.tsx — lista 16 agentów z podstawowymi informacjami  
**Problem:** Statyczna lista, brak interakcji, brak wizualizacji połączeń, brak real-time statusu

**Docelowy design — Agent Mesh Dashboard:**

```
┌─────────────────────────────────────────────────────────┐
│ AGENT MESH                                          [⚙️] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │              AGENT MESH CANVAS                   │   │
│  │                                                 │   │
│  │         🧠 Research ─────┐                      │   │
│  │            │             │                      │   │
│  │  💻 Coder ─┼── 🤖 MAIN ──┼── 📊 Data           │   │
│  │            │             │                      │   │
│  │         🔒 Security ─────┘                      │   │
│  │            │                                    │   │
│  │         🧪 Tester                               │   │
│  │                                                 │   │
│  │  (interaktywna mapa połączeń, drag & drop)      │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ─── Active Agents ──────────────────────────────────   │
│  ┌──────────────────────────────────────────────────┐  │
│  │ 🤖 Main Assistant      🟢 online   3 active tasks│  │
│  │ 🧠 Research Agent      🟢 online   1 active task │  │
│  │ 💻 Coder Agent         🟡 busy     2 active tasks│  │
│  │ 📊 Data Analyst        ⚪ idle                   │  │
│  │ 🔒 Security Auditor    ⚪ idle                   │  │
│  │ 🚀 DevOps Engineer     ⚪ idle                   │  │
│  │ 📋 Project Manager     ⚪ idle                   │  │
│  │ 📝 Documentation Writer⚪ idle                   │  │
│  │ 🧪 Tester              ⚪ idle                   │  │
│  │ 📄 Paper Writer        ⚪ idle                   │  │
│  │ [+ Add Custom Agent]                            │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  ─── Agent Details (po kliknięciu) ─────────────────   │
│  Agent: Coder Agent                                    │
│  Status: 🟡 Busy · 2 active tasks                      │
│  Model: Nexus-4 Pro                                    │
│  Tools: 24 · Skills: 8                                 │
│  Connections: Main, Tester, DevOps                     │
│  Memory entries: 42                                    │
│  [Configure] [View Memory] [View Sessions] [Deactivate] │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Kluczowe funkcje:**
- 🆕 Interaktywna mapa połączeń agentów (wizualizacja mesh)
- 🆕 Real-time status agentów (WebSocket)
- 🆕 Drag & drop agenta na innego = utwórz połączenie
- 🆕 Agent detail panel (tools, skills, memory, sessions)
- 🆕 Custom agent creator (nowy agent z własną osobowością i narzędziami)
- ✅ Lista agentów z podstawowymi informacjami (ulepszone)
- 🆕 Agent activity log (co który agent ostatnio robił)

---

### 6.3 Agent Chambers

**Status:** 🆕 NOWA FUNKCJA

**Koncepcja:** Wirtualne pokoje, gdzie wiele agentów pracuje razem nad wspólnym zadaniem. Użytkownik obserwuje i moderuje.

```
┌─────────────────────────────────────────────────────────┐
│ CHAMBER: "Dashboard Sprint"                         [⚙️] │
│ Members: 🤖Main 🧠Research 💻Coder 📊Data 📋PM           │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  CHAMBER CHAT (współdzielony dla wszystkich agentów)    │
│                                                         │
│  📋 PM Agent: "Plan na dziś:"                           │
│    1. Research: zbadaj najlepsze praktyki dashboardów   │
│    2. Coder: przygotuj szkielet komponentu              │
│    3. Data: przygotuj mock data do testów               │
│                                                         │
│  🧠 Research Agent: "Znalazłem 3 świetne referencje..." │
│  💻 Coder Agent: "Szkielet gotowy, przekazuję do testów"│
│  📊 Data Agent: "Mock data wygenerowane — 10K rekordów" │
│                                                         │
│  👤 You: "Dodajcie też dark mode do dashboardu"         │
│  🤖 Main Agent: "Przekazuję do Codera..."               │
│  💻 Coder Agent: "Done — dark mode dodany"              │
│                                                         │
├─────────────────────────────────────────────────────────┤
│ [📎 Attach] [⚡ Add Agent] [⏸️ Pause Chamber] [🗑️ End]  │
│ [👤 You:] ___________________________________________ [→]│
└─────────────────────────────────────────────────────────┘
```

**Kluczowe funkcje:**
- Tworzenie pokoju z wybranymi agentami
- Współdzielony czat (agenci + user)
- Automatyczna koordynacja przez PM Agenta
- User może wtrącać się w dowolnym momencie
- Pause/Resume/End chamber
- Eksport całej sesji chamber
- Szablony chamber (np. "Code Review", "Research Sprint", "Bug Hunt")

---

### 6.4 Knowledge Graph

**Status:** 🆕 NOWA FUNKCJA

**Koncepcja:** Wizualna mapa powiązań między encjami w pamięci agentów — pliki, osoby, projekty, koncepty, decyzje.

```
┌─────────────────────────────────────────────────────────┐
│ KNOWLEDGE GRAPH                                    [🔍] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │           INTERAKTYWNY GRAF                     │   │
│  │                                                 │   │
│  │    [Projekt Alpha] ─── zawiera ──→ [Dashboard]  │   │
│  │          │                            │         │   │
│  │       używa                       używa         │   │
│  │          │                            │         │   │
│  │    [React 19]                  [Tailwind CSS]   │   │
│  │          │                            │         │   │
│  │       stworzył                     stworzył     │   │
│  │          │                            │         │   │
│  │    [Coder Agent] ◄── współpracuje ──→ [PM Agent]│   │
│  │                                                 │   │
│  │  (zoom, pan, click to expand, drag to rearrange)│   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ─── Entities ──────────────────────────────────────   │
│  🔍 Search entities...                                  │
│  ┌──────────────────────────────────────────────────┐  │
│  │ 📁 Projekt Alpha    12 relacji   3 dokumenty     │  │
│  │ 📁 Dashboard         8 relacji   1 dokument      │  │
│  │ 👤 Coder Agent       5 relacji   42 sesje        │  │
│  │ 🏷️ React 19         3 relacji   -               │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Kluczowe funkcje:**
- Automatyczna ekstrakcja encji z sesji agentów
- Wizualizacja grafu (D3.js / Cytoscape.js)
- Zoom, pan, kliknięcie = szczegóły encji
- Ręczne dodawanie/usuwanie relacji
- Filtrowanie po typie encji
- Eksport grafu jako PNG/SVG
- Wyszukiwanie ścieżek między encjami

---

### 6.5 Knowledge Base (RAG)

**Status:** 🔄 Pełny redesign + RAG Pipeline

**Aktualnie:** RagPage.tsx + prosty store  
**Problem:** Brak pipeline'u upload → chunk → embed → search, brak citation highlighting

**Docelowy design:**

```
┌─────────────────────────────────────────────────────────┐
│ KNOWLEDGE BASE (RAG)                               [⚙️] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─ Upload Zone ───────────────────────────────────┐   │
│  │  📤 Drop documents here or click to upload       │   │
│  │  Supports: PDF, DOCX, TXT, MD, CSV, HTML, EPUB   │   │
│  │  Max size: 50MB per file                         │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
│  ─── Document Library ──────────────────────────────   │
│  ┌──────────────────────────────────────────────────┐  │
│  │ 🔍 Search documents...                     [📤]  │  │
│  │                                                  │  │
│  │ 📄 raport_sprzedazy_2025.pdf    12 chunks  45KB  │  │
│  │    Status: ✅ Indexed  ·  Added: 2 days ago      │  │
│  │    [🔍 Query] [📋 View] [🗑️ Delete] [🔄 Reindex] │  │
│  │                                                  │  │
│  │ 📄 dokumentacja_api.md           8 chunks   12KB  │  │
│  │    Status: ✅ Indexed  ·  Added: 5 days ago      │  │
│  │                                                  │  │
│  │ 📄 specyfikacja_projektu.docx   15 chunks   89KB  │  │
│  │    Status: ⚠️ Indexing...                        │  │
│  │                                                  │  │
│  │ Total: 3 documents · 35 chunks · 146KB           │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  ─── Query ─────────────────────────────────────────   │
│  ┌──────────────────────────────────────────────────┐  │
│  │ 🔍 Jakie były wyniki sprzedaży w Q1 2025?   [→] │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  ─── Results ───────────────────────────────────────   │
│  ┌──────────────────────────────────────────────────┐  │
│  │ 📄 raport_sprzedazy_2025.pdf                     │  │
│  │ Relevance: 94%                                   │  │
│  │ "...wyniki sprzedaży w Q1 2025 wyniosły          │  │
│  │  2.4M PLN, co stanowi wzrost o 15% r/r..."      │  │
│  │ [📋 Copy] [🔗 Link]                              │  │
│  │ ──────────────────────────────────────────────── │  │
│  │ 📄 specyfikacja_projektu.docx                    │  │
│  │ Relevance: 78%                                   │  │
│  │ "...prognozy na Q1 2025 zakładały..."            │  │
│  │ [📋 Copy] [🔗 Link]                              │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  ─── Settings ──────────────────────────────────────   │
│  Chunk size: 1024 tokens · Overlap: 128 tokens          │
│  Embedding model: text-embedding-3-small                │
│  Top K: 5 · Similarity threshold: 0.7                  │
│  [💾 Save Settings]                                     │
└─────────────────────────────────────────────────────────┘
```

**Kluczowe funkcje:**
- 🆕 Drag & drop upload (PDF, DOCX, TXT, MD, CSV, HTML, EPUB)
- 🆕 Auto-chunking z configurowalnym rozmiarem
- 🆕 Embedding generation (OpenAI / local)
- 🆕 Semantic search z similarity scoring
- 🆕 Citation highlighting w wynikach
- ✅ Istniejący store wiedzy (ulepszony)
- 🆕 Document viewer z podglądem
- 🆕 Chunk size / overlap / top-K configuration

---

### 6.6 Code Editor

**Status:** 🔄 Redesign (Monaco Editor)

**Aktualnie:** CodeEditorPage.tsx — prosty edytor  
**Problem:** Brak prawdziwego edytora z LSP, brak integracji z agentami

**Docelowy design:**

```
┌─────────────────────────────────────────────────────────┐
│ CODE EDITOR                                        [⚙️] │
│ File: src/components/Dashboard.tsx    TypeScript React   │
├────────┬────────────────────────────────────────────────┤
│        │                                                │
│ FILES  │  EDITOR (Monaco)                               │
│        │                                                │
│ 📁 src  │  1  import { useState } from 'react';         │
│  📁 comp│  2  import { Card, Chart } from '@/ui';       │
│   📄 Dash│  3                                            │
│   📄 Card│  4  export function Dashboard() {            │
│   📄 Chart│  5    const [data, setData] = useState();    │
│  📁 lib  │  6                                            │
│   📄 api │  7    return (                               │
│  📁 hooks│  8      <div className="...">               │
│   📄 useDa│  9        <Chart data={data} />             │
│ 📁 public│ 10      </div>                              │
│ 📄 package│ 11    );                                    │
│        │  12  }                                         │
│        │                                                │
│        │  ─── Diagnostics ───                           │
│        │  ⚠️ Line 5: 'data' is declared but never used  │
│        │  ⚠️ Line 8: Missing return type annotation     │
│        │                                                │
├────────┴────────────────────────────────────────────────┤
│ [🤖 Agent Review] [🔍 Find] [🔄 Format] [💾 Save] [▶ Run]│
└─────────────────────────────────────────────────────────┘
```

**Kluczowe funkcje:**
- 🆕 Monaco Editor z pełnym syntax highlighting
- 🆕 LSP diagnostics (TypeScript, JavaScript, Python, JSON)
- 🆕 File tree browser (zintegrowany z Workspace)
- 🆕 Agent code review (przycisk — agent analizuje kod)
- 🆕 Auto-format on save (Prettier)
- 🆕 Find & replace z regex
- 🆕 Multi-tab editing
- 🆕 Git diff inline (zintegrowane z Git Automation)
- 🆕 Agent-assisted refactoring

---

### 6.7 Git Automation

**Status:** 🔄 Redesign

**Aktualnie:** GitAutomationPage.tsx + git/manager.ts  
**Problem:** Podstawowa funkcjonalność, brak PR automation, brak wizualizacji

**Docelowy design:**

```
┌─────────────────────────────────────────────────────────┐
│ GIT AUTOMATION                                    [⚙️] │
├─────────────────────────────────────────────────────────┤
│ Repo: /projects/nexus-ai · Branch: main · 3 files Δ     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ─── Status ────────────────────────────────────────   │
│  ┌──────────────────────────────────────────────────┐  │
│  │ 📝 Modified:                                      │  │
│  │   src/components/Dashboard.tsx    +45 -12         │  │
│  │   src/lib/api.ts                  +8 -3           │  │
│  │                                                 │  │
│  │ 🆕 New:                                          │  │
│  │   src/components/NewFeature.tsx   +120            │  │
│  │                                                 │  │
│  │ Branch: feature/dashboard-redesign               │  │
│  │ Ahead of origin: 3 commits                       │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  ─── AI-Powered Actions ────────────────────────────   │
│  ┌──────────────────────────────────────────────────┐  │
│  │ [🤖 Auto-Commit]  Generate commit message via AI │  │
│  │ [🤖 Auto-PR]      Create PR with AI description  │  │
│  │ [🤖 Auto-Review]  AI reviews all changes         │  │
│  │ [🤖 Auto-Fix]     AI fixes lint/test issues      │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  ─── Recent Activity ───────────────────────────────   │
│  ┌──────────────────────────────────────────────────┐  │
│  │ 🔀 feature/dashboard-redesign → main · PR #42    │  │
│  │    "Add dark mode support to Dashboard"           │  │
│  │    🤖 Auto-generated · 3 files · ✅ Merged       │  │
│  │                                                   │  │
│  │ 💾 commit a1b2c3d · 5 min ago                     │  │
│  │    "fix: resolve chart rendering edge case"       │  │
│  │    🤖 Auto-committed                              │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Kluczowe funkcje:**
- ✅ Git status (zmodyfikowane, nowe, usunięte pliki)
- ✅ Branch management
- 🆕 Auto-commit z AI-generated message
- 🆕 Auto-PR creation z AI description
- 🆕 AI Code Review (agent Security Auditor + Coder)
- 🆕 Auto-fix (agent naprawia lint/test issues)
- 🆕 Git diff viewer inline
- 🆕 Branch visualization (git graph)
- 🆕 Conflict resolution assistant

---

### 6.8 Terminal

**Status:** 🔄 Redesign (multiplexer)

**Aktualnie:** TerminalPage.tsx z xterm.js  
**Problem:** Pojedynczy terminal, brak integracji z agentami

**Docelowy design:**

```
┌─────────────────────────────────────────────────────────┐
│ TERMINAL                                           [⚙️] │
│ [Tab 1: zsh] [Tab 2: build] [Tab 3: logs] [+] [🗑️]    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─ Tab 1: zsh ────────────────────────────────────┐   │
│  │ $ ls -la                                        │   │
│  │ drwxr-xr-x  12 user  staff   384 Jun 18 01:52 .  │   │
│  │ drwxr-xr-x   5 user  staff   160 Jun 17 12:30 .. │   │
│  │ -rw-r--r--   1 user  staff  1234 Jun 18 01:30 .md│   │
│  │                                                  │   │
│  │ $ npm run build                                 │   │
│  │ > nexus-ai@2.0.0 build                          │   │
│  │ > vite build                                    │   │
│  │                                                  │   │
│  │ vite v6.0.0 building for production...           │   │
│  │ ✓ 342 modules transformed.                      │   │
│  │ ✓ built in 2.3s                                 │   │
│  │                                                  │   │
│  │ $ █                                             │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
├─────────────────────────────────────────────────────────┤
│ [🤖 Send to Agent] [📋 Copy Selection] [🔍 Find] [🧹 Clear]│
└─────────────────────────────────────────────────────────┘
```

**Kluczowe funkcje:**
- ✅ xterm.js terminal (ulepszone)
- 🆕 Multiplexer — wiele tabów/paneli
- 🆕 "Send to Agent" — zaznacz output → wyślij do chatu
- 🆕 Command history z wyszukiwaniem
- 🆕 Agent może wykonywać komendy w terminalu (z potwierdzeniem usera)
- 🆕 Syntax highlighting dla outputu (logi, JSON, błędy)
- 🆕 Session persistence (terminal nie traci stanu po przeładowaniu)

---

### 6.9 Workspace

**Status:** 🔄 Redesign

**Aktualnie:** WorkspacePage.tsx + workspace/manager.ts  
**Problem:** Prosty file browser, brak zaawansowanych operacji

**Docelowy design:**

```
┌─────────────────────────────────────────────────────────┐
│ WORKSPACE                                          [⚙️] │
│ Current: /home/user/projects/nexus-ai                    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─ File Browser ──────────────────────────────────┐   │
│  │ 🔍 Search files...                          [📤] │   │
│  │                                                  │   │
│  │ 📁 src/                  407 files              │   │
│  │   📁 components/         89 files               │   │
│  │     📄 Dashboard.tsx     4.2KB  · modified      │   │
│  │     📄 Sidebar.tsx       2.1KB                  │   │
│  │   📁 lib/                45 files               │   │
│  │   📁 routes/             28 files               │   │
│  │ 📁 docs/                 12 files               │   │
│  │ 📁 tests/                34 files               │   │
│  │ 📄 package.json          2.1KB                  │   │
│  │ 📄 README.md             5.4KB                  │   │
│  │                                                  │   │
│  │ Total: 892 files · 3.4MB                        │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
│  ─── File Preview ──────────────────────────────────   │
│  ┌──────────────────────────────────────────────────┐  │
│  │ 📄 Dashboard.tsx                          [🔗] [🗑️] │
│  │ Size: 4.2KB · Modified: 2 hours ago               │  │
│  │                                                    │  │
│  │  1  import { useState } from 'react';              │  │
│  │  2  import { Card, Chart } from '@/ui';            │  │
│  │  3                                                 │  │
│  │  4  export function Dashboard() {                  │  │
│  │  ... (preview first 20 lines)                      │  │
│  │                                                    │  │
│  │ [Open in Code Editor] [🤖 Analyze with Agent]      │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  ─── Quick Actions ─────────────────────────────────   │
│  [📄 New File] [📁 New Folder] [📤 Upload] [🤖 AI Ops] │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Kluczowe funkcje:**
- ✅ File tree browser (ulepszone UI)
- 🆕 File preview (pierwsze 20 linii z syntax highlighting)
- 🆕 "Open in Code Editor" — płynne przejście
- 🆕 "Analyze with Agent" — wyślij plik do chatu
- 🆕 Search files (nazwa + zawartość)
- 🆕 Drag & drop upload
- 🆕 Multi-select + batch operations
- 🆕 Git status indicators (modified/new/deleted)
- 🆕 File size / last modified

---

### 6.10 Workflows

**Status:** 🆕 NOWA FUNKCJA (zastępuje stary workflow builder)

**Koncepcja:** Visual drag & drop workflow builder do łączenia agentów, narzędzi i warunków w automatyzacje.

**Docelowy design:**

```
┌─────────────────────────────────────────────────────────┐
│ WORKFLOWS · "Dashboard Auto-Deploy"                [⚙️] │
│ [▶ Run] [⏸️] [💾 Save] [📋 Export] [📂 Templates]      │
├────────┬────────────────────────────────────────────────┤
│        │                                                │
│ PALETTE│  WORKFLOW CANVAS (ReactFlow)                   │
│        │                                                │
│ 🟢 Start│  [▶ Start]                                    │
│        │      │                                         │
│ 🤖 Agent│  [🤖 PM Agent]                                │
│        │      │                                         │
│ 🔧 Tool │  [📊 Data Analyst] ──── [🔀 If data OK?]     │
│        │      │                    │          │         │
│ 🔀 If/El│  [💻 Coder Agent]     [⚠️ Alert]  [✅ Done]  │
│        │      │                                         │
│ 🔁 Loop │  [🧪 Tester]                                  │
│        │      │                                         │
│ 📥 Input│  [✅ Deploy]                                  │
│        │      │                                         │
│ 📤 Outpu│  [⏹️ End]                                    │
│        │                                                │
│ ⏱️ Delay│                                                │
│        │                                                │
│ 🔔 Notif│                                                │
│        │                                                │
├────────┴────────────────────────────────────────────────┤
│ Node Config (po kliknięciu):                            │
│ Agent: Coder Agent                                      │
│ Task: "Zaimplementuj dashboard z ciemnym motywem"       │
│ Timeout: 300s · Model: Nexus-4 Pro                      │
│ On Error: Retry 3x → Alert                              │
└─────────────────────────────────────────────────────────┘
```

**Kluczowe funkcje:**
- 🆕 ReactFlow-based canvas z drag & drop
- 🆕 Node types: Start, Agent, Tool, Condition (If/Else), Loop, Input, Output, Delay, Notification, End
- 🆕 Łączenie node'ów krawędziami (przeciąganie)
- 🆕 Konfiguracja node'a po kliknięciu (parametry, timeout, error handling)
- 🆕 Workflow templates (pre-built do częstych scenariuszy)
- 🆕 Run / Pause / Stop workflow z podglądem na żywo
- 🆕 Workflow history (logi wykonania)
- 🆕 Import / Export workflow (JSON)
- 🆕 Agent może dynamicznie tworzyć/modyfikować workflow

---

### 6.11 Skills

**Status:** 🔄 Redesign (Marketplace)

**Aktualnie:** SkillsPage.tsx — lista 46+ skilli  
**Problem:** Statyczna lista, brak kategoryzacji, brak marketplace, brak ocen

**Docelowy design:**

```
┌─────────────────────────────────────────────────────────┐
│ SKILLS MARKETPLACE                                 [🔍] │
│ [All] [Development] [Research] [Security] [DevOps] [Custom]│
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─ Featured Skills ───────────────────────────────┐   │
│  │ ┌──────────┐ ┌──────────┐ ┌──────────┐         │   │
│  │ │ 🧠 Deep  │ │ 💻 Agent │ │ 🔒 Secur │         │   │
│  │ │ Research │ │ Coding   │ │ Audit    │         │   │
│  │ │ ⭐ 4.8   │ │ ⭐ 4.9   │ │ ⭐ 4.6   │         │   │
│  │ │ 2.3K use │ │ 5.1K use │ │ 890 use  │         │   │
│  │ └──────────┘ └──────────┘ └──────────┘         │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
│  ─── Installed (46) ─────────────────────────────────   │
│  ┌──────────────────────────────────────────────────┐  │
│  │ 🔍 Search skills...                          [📤] │  │
│  │                                                  │  │
│  │ ⚡ academic-deep-research     v1.0.0  ✅ Active  │  │
│  │   2-cyklowy research, APA 7, evidence hierarchy  │  │
│  │   [Disable] [Configure] [Update] [Remove]        │  │
│  │                                                  │  │
│  │ ⚡ agentic-coding            v1.2.0  ✅ Active  │  │
│  │   Micro-diffs, red-green loops, acceptance...    │  │
│  │   [Disable] [Configure] [Update] [Remove]        │  │
│  │                                                  │  │
│  │ ⚡ github                    v1.0.0  ✅ Active  │  │
│  │   GitHub CLI integration                         │  │
│  │   [Disable] [Configure] [Update] [Remove]        │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  ─── Discover ──────────────────────────────────────   │
│  ┌──────────────────────────────────────────────────┐  │
│  │ 🆕 frontend-design          ⭐ 4.7  by @community │  │
│  │    Production-grade UI components                 │  │
│  │    [Install] [Preview]                            │  │
│  │                                                   │  │
│  │ 🆕 backtest-expert          ⭐ 4.5  by @community │  │
│  │    Systematic trading strategy backtesting        │  │
│  │    [Install] [Preview]                            │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Kluczowe funkcje:**
- 🆕 Skill cards z ocenami, użyciami, opisem
- 🆕 Kategorie i filtrowanie
- 🆕 Marketplace — przeglądaj i instaluj nowe skille
- ✅ Lista zainstalowanych skilli (ulepszona)
- 🆕 Enable/Disable/Configure per skill
- 🆕 Skill detail view (dokumentacja, konfiguracja, statystyki)
- 🆕 Custom skill creator
- ✅ Self-improving skills (zachowane)

---

### 6.12 Plugins

**Status:** 🔄 Redesign

**Aktualnie:** PluginsPage.tsx — lista pluginów  
**Problem:** Statyczna lista, brak zarządzania stanem, brak marketplace

**Docelowy design:**

```
┌─────────────────────────────────────────────────────────┐
│ PLUGINS                                            [🔍] │
│ [Installed] [Marketplace] [Updates (3)]                  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ─── Installed Plugins ─────────────────────────────   │
│  ┌──────────────────────────────────────────────────┐  │
│  │ 🔌 chromadb              v2.1.0    ✅ Running    │  │
│  │    Vector database for embeddings                 │  │
│  │    Port: 8000 · Status: Healthy                   │  │
│  │    [Configure] [Restart] [Logs] [Remove]          │  │
│  │                                                   │  │
│  │ 🔌 mcp-servers           v1.5.0    ✅ Running    │  │
│  │    Model Context Protocol servers                  │  │
│  │    3 servers active                               │  │
│  │    [Configure] [Restart] [Logs] [Remove]          │  │
│  │                                                   │  │
│  │ 🔌 browser-use           v0.9.0    ⚪ Stopped    │  │
│  │    Web browser automation                         │  │
│  │    [Configure] [▶ Start] [Logs] [Remove]          │  │
│  │                                                   │  │
│  │ 🔌 screenpipe            v1.2.0    ⚠️ Error      │  │
│  │    24/7 screen recording & OCR                     │  │
│  │    Error: Port 3030 already in use                │  │
│  │    [Configure] [🔄 Restart] [Logs] [Remove]       │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  ─── Plugin Marketplace ─────────────────────────────   │
│  ┌──────────────────────────────────────────────────┐  │
│  │ 🔍 Search plugins...                             │  │
│  │                                                   │  │
│  │ 🆕 continue-dev           ⭐ 4.8  AI code editor  │  │
│  │ 🆕 open-webui             ⭐ 4.9  Chat UI         │  │
│  │ 🆕 crawl4ai               ⭐ 4.6  Web crawler     │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Kluczowe funkcje:**
- ✅ Lista pluginów (ulepszona — karty z statusem, portem, stanem)
- 🆕 Plugin health monitoring (Running/Stopped/Error)
- 🆕 Start/Stop/Restart per plugin
- 🆕 Plugin logs (podgląd logów w czasie rzeczywistym)
- 🆕 Plugin marketplace (przeglądaj + instaluj)
- 🆕 Plugin update notification
- ✅ Plugin configuration (ulepszone)

---

### 6.13 Integrations

**Status:** 🔄 Redesign + rozbudowa

**Aktualnie:** IntegrationsPage.tsx + integrations/manager.ts  
**Problem:** Mało integracji, brak OAuth flow, brak zarządzania

**Docelowy design:**

```
┌─────────────────────────────────────────────────────────┐
│ INTEGRATIONS HUB                                  [🔍] │
│ [All] [Communication] [Development] [Productivity] [Data]│
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ─── Connected ─────────────────────────────────────   │
│  ┌──────────────────────────────────────────────────┐  │
│  │ 📧 Gmail                 ✅ Connected            │  │
│  │    user@gmail.com · Last sync: 2 min ago         │  │
│  │    [Configure] [Disconnect] [Test]               │  │
│  │                                                   │  │
│  │ 💬 Slack                ✅ Connected            │  │
│  │    nexus-ai.slack.com · 3 channels               │  │
│  │    [Configure] [Disconnect] [Test]               │  │
│  │                                                   │  │
│  │ 🐙 GitHub               ✅ Connected            │  │
│  │    github.com/nexus-ai · 12 repos                │  │
│  │    [Configure] [Disconnect] [Test]               │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  ─── Available Integrations ─────────────────────────   │
│  ┌──────────────────────────────────────────────────┐  │
│  │ 🔍 Search integrations...                        │  │
│  │                                                   │  │
│  │ 📋 Jira                Connect  🔗 OAuth         │  │
│  │ 📝 Notion              Connect  🔗 OAuth         │  │
│  │ 📊 Google Sheets       Connect  🔗 OAuth         │  │
│  │ 📅 Google Calendar     Connect  🔗 OAuth         │  │
│  │ 🗄️ PostgreSQL          Connect  🔑 Credentials   │  │
│  │ 🗄️ MySQL               Connect  🔑 Credentials   │  │
│  │ 🐳 Docker              Connect  🔑 API Key       │  │
│  │ ☁️ AWS                  Connect  🔑 API Key       │  │
│  │ 📦 Linear              Connect  🔑 API Key       │  │
│  │ 🔔 Discord             Connect  🤖 Bot Token     │  │
│  │ 📞 Twilio              Connect  🔑 API Key       │  │
│  │ 📄 Google Drive        Connect  🔗 OAuth         │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Kluczowe funkcje:**
- 🆕 Integration cards z statusem, typem autoryzacji
- 🆕 OAuth flow (przekierowanie → callback → token storage)
- 🆕 API Key / Credentials management (szyfrowane)
- 🆕 Connection test
- 🆕 Sync status (last sync timestamp)
- 🆕 Kategorie integracji
- ✅ Istniejące integracje (Email, Discord, Slack — ulepszone)
- 🆕 50+ nowych integracji (Slack, Notion, Google Suite, GitHub, Jira, Linear, Docker, AWS, PostgreSQL, MySQL, Redis, Twilio, Discord, Telegram, WhatsApp, MS Teams, Figma, Airtable, Stripe, Sentry, Datadog, Cloudflare, Vercel, Netlify, Supabase, Firebase...)

---

### 6.14 Worker Nodes

**Status:** 🔄 Redesign

**Aktualnie:** WorkerPage.tsx + worker/manager.ts  
**Problem:** Brak persystencji, hardcoded model, brak real-time progress, brak retry

**Docelowy design:**

```
┌─────────────────────────────────────────────────────────┐
│ WORKER NODES                                      [⚙️] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ─── Active Jobs ───────────────────────────────────   │
│  ┌──────────────────────────────────────────────────┐  │
│  │ 🔄 Job #42 · "Generate weekly report"            │  │
│  │    Status: Running · 67% · ETA: 3 min            │  │
│  │    Model: Nexus-4 Pro · Agent: Data Analyst      │  │
│  │    Started: 2 min ago                            │  │
│  │    [⏸️ Pause] [⏹️ Stop] [📋 Logs]              │  │
│  │ ──────────────────────────────────────────────── │  │
│  │ ⏳ Job #41 · "Index new documents"               │  │
│  │    Status: Queued · Position: #1                 │  │
│  │    Model: Nexus-4 · Agent: Main Assistant        │  │
│  │    [⏹️ Cancel] [⬆️ Priority]                     │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  ─── Create New Job ────────────────────────────────   │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Task: __________________________________________ │  │
│  │ Agent: [Main Assistant ▾]                        │  │
│  │ Model: [Nexus-4 Pro ▾]                           │  │
│  │ Priority: [Normal ▾]                             │  │
│  │ Max Retries: [3]                                 │  │
│  │ Schedule: [Run Now ▾]                            │  │
│  │                                                  │  │
│  │ [▶ Start Job]                                    │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  ─── Job History ───────────────────────────────────   │
│  ┌──────────────────────────────────────────────────┐  │
│  │ ✅ Job #40 · "Analyze customer feedback"         │  │
│  │    Completed · 2 hours ago · Duration: 4m 32s    │  │
│  │    Tokens: 12K · Cost: $0.04                     │  │
│  │    [📋 View Result] [🔄 Re-run]                   │  │
│  │                                                   │  │
│  │ ❌ Job #39 · "Deploy to staging"                 │  │
│  │    Failed · 3 hours ago · Error: Timeout          │  │
│  │    Retries: 3/3 exhausted                        │  │
│  │    [📋 View Logs] [🔄 Re-run with changes]        │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Kluczowe funkcje:**
- 🆕 Persystencja zadań (JSON file + auto-load)
- 🆕 Model selection per job
- 🆕 Cancel/Pause running jobs
- 🆕 Real-time progress via SSE
- 🆕 Auto-retry z exponential backoff
- 🆕 Job scheduling (run now / run at time / recurring)
- 🆕 Priority queue
- 🆕 Job history z logami
- 🆕 Token usage & cost tracking per job

---

### 6.15 Prompt Playground

**Status:** 🔄 Redesign

**Aktualnie:** PromptPlaygroundPage.tsx — podstawowy interfejs  
**Problem:** Brak side-by-side porównania modeli, brak template'ów, brak historii

**Docelowy design:**

```
┌─────────────────────────────────────────────────────────┐
│ PROMPT PLAYGROUND                                 [⚙️] │
│ [Single] [Side-by-Side] [History] [Templates]            │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  System Prompt:                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │ You are a helpful assistant...              [📋] │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  User Prompt:                                           │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Explain quantum computing in simple terms   [📋] │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  ─── Side-by-Side Comparison ───────────────────────   │
│  ┌─────────────────────┐ ┌─────────────────────────┐  │
│  │ Model: Nexus-4 Pro  │ │ Model: Claude 4 Opus    │  │
│  │ Temp: 0.7           │ │ Temp: 0.7               │  │
│  │ ─────────────────── │ │ ─────────────────────── │  │
│  │                     │ │                         │  │
│  │ "Wyobraź sobie      │ │ "Komputery kwantowe     │  │
│  │  komputer, który..." │ │  wykorzystują..."       │  │
│  │                     │ │                         │  │
│  │ ⏱ 0.8s · 234 tokens │ │ ⏱ 1.2s · 312 tokens    │  │
│  │ 💰 $0.0012          │ │ 💰 $0.0045              │  │
│  └─────────────────────┘ └─────────────────────────┘  │
│                                                         │
│  [▶ Run All] [🔄 Rerun] [💾 Save as Template]           │
│                                                         │
│  ─── Variables ─────────────────────────────────────   │
│  {{topic}} = "quantum computing"                        │
│  {{tone}} = "simple"                                    │
│  [+ Add Variable]                                       │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Kluczowe funkcje:**
- 🆕 Side-by-side model comparison (2-4 modele jednocześnie)
- 🆕 System prompt editor + user prompt editor
- 🆕 Zmienne w promptach ({{variable}})
- 🆕 Timing & token usage per response
- 🆕 Cost calculation per model
- 🆕 Save as template
- 🆕 Template library (pre-built prompty do częstych zadań)
- 🆕 History (poprzednie testy)
- ✅ Podstawowy playground (ulepszony)

---

### 6.16 Sessions

**Status:** 🔄 Redesign

**Aktualnie:** SessionsPage.tsx + session/manager.ts  
**Problem:** Podstawowa lista, brak wyszukiwania full-text, brak analityki

**Docelowy design:**

```
┌─────────────────────────────────────────────────────────┐
│ SESSIONS                                           [🔍] │
│ [All] [Chat] [Agent] [Worker] [Chamber]                  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  🔍 Search sessions...                           [📊]   │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │ 💬 Chat · "Dashboard redesign"                   │  │
│  │    Agent: Main Assistant · Model: Nexus-4 Pro    │  │
│  │    42 messages · 12 tool calls · 45K tokens      │  │
│  │    Duration: 23 min · Cost: $0.18                │  │
│  │    Created: 2026-06-18 01:23                     │  │
│  │    [▶ Resume] [📋 Export] [⭐ Star] [🗑️ Delete]  │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │ 🤖 Agent · "Auto-bug-fix #142"                   │  │
│  │    Agent: Bug Fixer · Model: Nexus-4 Pro         │  │
│  │    8 messages · 6 tool calls · 12K tokens        │  │
│  │    Duration: 4 min · Cost: $0.02                 │  │
│  │    Created: 2026-06-17 22:15                     │  │
│  │    [▶ Resume] [📋 Export] [🗑️ Delete]            │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  ─── Session Stats ─────────────────────────────────   │
│  Total sessions: 247                                    │
│  This month: 34 · This week: 8 · Today: 3               │
│  Total tokens: 2.3M · Total cost: $8.42                 │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Kluczowe funkcje:**
- 🆕 Session cards z pełnymi metadanymi (agent, model, tokens, cost, duration)
- 🆕 FTS5 full-text search w sesjach
- 🆕 Filtrowanie po typie (Chat/Agent/Worker/Chamber)
- 🆕 Session stats (total, this month, this week, today)
- ✅ Lista sesji (ulepszona)
- 🆕 Resume session (wznów konwersację)
- 🆕 Export session (MD/JSON/PDF)
- 🆕 Star/Bookmark sesje
- 🆕 Batch delete

---

### 6.17 Channels

**Status:** 🔄 Redesign (uproszczenie)

**Aktualnie:** ChannelsPage.tsx  
**Problem:** Skomplikowana konfiguracja, rozproszona po wielu stronach

**Docelowy design:**

```
┌─────────────────────────────────────────────────────────┐
│ CHANNELS                                           [⚙️] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Manage messaging channels where Nexus AI can respond.  │
│                                                         │
│  ─── Active Channels ────────────────────────────────   │
│  ┌──────────────────────────────────────────────────┐  │
│  │ 💬 Discord              ✅ Connected            │  │
│  │    Server: Nexus AI Community · 3 channels       │  │
│  │    Bot: @NexusAI#1234                            │  │
│  │    [Configure] [Test] [Disconnect]               │  │
│  │                                                   │  │
│  │ 📱 Telegram             ✅ Connected            │  │
│  │    Bot: @NexusAIBot · 12 chats                   │  │
│  │    [Configure] [Test] [Disconnect]               │  │
│  │                                                   │  │
│  │ 📧 Email (SMTP/IMAP)    ✅ Connected            │  │
│  │    user@gmail.com                                │  │
│  │    [Configure] [Test] [Disconnect]               │  │
│  │                                                   │  │
│  │ 💬 Slack                ⚪ Not Connected         │  │
│  │    [Connect → OAuth]                             │  │
│  │                                                   │  │
│  │ 📞 WhatsApp             ⚪ Not Connected         │  │
│  │    [Connect → QR Code]                           │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  ─── Channel Rules ─────────────────────────────────   │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Auto-respond: ✅ Enabled                          │  │
│  │ Response delay: 0s (immediate)                    │  │
│  │ Max messages/session: 50                          │  │
│  │ Allowed senders: Everyone                         │  │
│  │ [💾 Save Rules]                                   │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Kluczowe funkcje:**
- 🆕 Uproszczona konfiguracja — jeden ekran na wszystko
- 🆕 Channel status (Connected/Not Connected)
- 🆕 Test connection button
- 🆕 Auto-respond rules (delay, max messages, allowed senders)
- 🆕 OAuth / QR Code / Bot Token flow per channel
- ✅ Discord, Telegram, Email (ulepszone)
- 🆕 Slack, WhatsApp, Signal, iMessage, Google Chat, IRC

---

### 6.18 Memory DB

**Status:** 🔄 Redesign

**Aktualnie:** MemoryPage.tsx + memory/store.ts  
**Problem:** Podstawowa lista, brak wizualizacji, brak kategoryzacji

**Docelowy design:**

```
┌─────────────────────────────────────────────────────────┐
│ MEMORY DB                                         [🔍] │
│ [Entries] [Graph] [Search] [Settings]                    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  🔍 Search memory...                           [📊]     │
│                                                         │
│  ─── Recent Entries ────────────────────────────────   │
│  ┌──────────────────────────────────────────────────┐  │
│  │ 🧠 "User prefers TypeScript over JavaScript"     │  │
│  │    Category: preference · Confidence: High        │  │
│  │    Source: Chat · 2026-06-18                     │  │
│  │    [Edit] [Delete] [🔗 View Source]              │  │
│  │ ──────────────────────────────────────────────── │  │
│  │ 🧠 "Project Nexus uses React 19 + Tailwind 4"    │  │
│  │    Category: project · Confidence: High           │  │
│  │    Source: Agent · 2026-06-17                     │  │
│  │    [Edit] [Delete] [🔗 View Source]              │  │
│  │ ──────────────────────────────────────────────── │  │
│  │ 🧠 "API keys stored in data/jwt_secret.txt"      │  │
│  │    Category: config · Confidence: Medium          │  │
│  │    Source: Agent · 2026-06-16                     │  │
│  │    [Edit] [Delete] [🔗 View Source]              │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  ─── Memory Stats ──────────────────────────────────   │
│  Total entries: 342                                     │
│  Categories: preference(45) · project(89) · config(34)  │
│             · learning(67) · decision(41) · other(66)   │
│  Sources: Chat(156) · Agent(142) · Manual(44)           │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Kluczowe funkcje:**
- 🆕 Memory entries z kategoriami, confidence score, źródłem
- 🆕 Full-text search (FTS5)
- 🆕 Filtrowanie po kategorii, źródle, confidence
- 🆕 Memory Graph (przejście do Knowledge Graph)
- 🆕 Auto-kategoryzacja wpisów
- 🆕 Manual add/edit/delete
- 🆕 "View Source" — zobacz sesję z której pochodzi wpis
- ✅ Istniejący memory store (ulepszony)

---

### 6.19 Settings

**Status:** 🔄 Redesign + konsolidacja

**Aktualnie:** Rozproszone po ConfigPage, EnvPage, ProfilesPage, ModelsPage, ChannelsPage  
**Problem:** Rozbite na 5+ stron, niespójne

**Docelowy design — jeden ekran z zakładkami:**

```
┌─────────────────────────────────────────────────────────┐
│ SETTINGS                                           [🔍] │
│ [General] [Models] [API Keys] [Profiles] [Channels]     │
│        [Integrations] [Cron] [Logs] [About]             │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ─── General Settings ──────────────────────────────   │
│  ┌──────────────────────────────────────────────────┐  │
│  │ App Name:     [Nexus AI_______________]          │  │
│  │ Language:     [English ▾]                        │  │
│  │ Timezone:     [Europe/Warsaw ▾]                  │  │
│  │ Theme:        ● Dark  ○ Darker                  │  │
│  │ Animations:   ✅ Enabled                          │  │
│  │ Sounds:       ❌ Disabled                         │  │
│  │                                                      │
│  │ Auto-start:   ❌ Disabled                         │  │
│  │ Port:         [3000________________]              │  │
│  │ Host:         [0.0.0.0______________]             │  │
│  │                                                      │  │
│  │ [💾 Save Settings] [🔄 Reset to Defaults]         │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  ─── Security ──────────────────────────────────────   │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Authentication: ✅ Enabled (JWT)                  │  │
│  │ Session timeout: [24h_________]                   │  │
│  │ Max login attempts: [5]                           │  │
│  │ [💾 Save Security Settings]                       │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  ─── Agent Defaults ────────────────────────────────   │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Default Agent:  [Main Assistant ▾]               │  │
│  │ Default Model:  [Nexus-4 Pro ▾]                  │  │
│  │ Max iterations: [15]                              │  │
│  │ Auto-approve:   ❌ Disabled                       │  │
│  │ Thinking mode:  ○ Off  ● On                      │  │
│  │ [💾 Save Agent Defaults]                          │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Kluczowe funkcje:**
- 🆕 Jedna strona Settings z zakładkami (zamiast 5 osobnych stron)
- 🆕 General: app name, language, timezone, theme, animations, sounds, port, host
- 🆕 Security: auth toggle, session timeout, max login attempts
- 🆕 Agent defaults: default agent, default model, max iterations, auto-approve, thinking mode
- 🆕 Wszystkie dotychczasowe ustawienia skonsolidowane

---

### 6.20 API Keys

**Status:** 🔄 Redesign (bezpieczeństwo premium)

**Aktualnie:** Część EnvPage / provider-config.json  
**Problem:** Plaintext w JSON, brak rotacji, brak maskowania, brak audit logu

**Docelowy design:**

```
┌─────────────────────────────────────────────────────────┐
│ API KEYS                                           [🔍] │
├─────────────────────────────────────────────────────────┤
│  ⚠️ API keys are encrypted at rest. Never share them.   │
│                                                         │
│  ─── LLM Providers ─────────────────────────────────   │
│  ┌──────────────────────────────────────────────────┐  │
│  │ 🧠 OpenAI                sk-pr****b2c3  ✅ Valid │  │
│  │    Last tested: 2 hours ago                       │  │
│  │    [👁️ Show] [📋 Copy] [🔄 Rotate] [🗑️ Delete]   │  │
│  │ ──────────────────────────────────────────────── │  │
│  │ 🧠 Anthropic             sk-an****d4e5  ✅ Valid │  │
│  │    Last tested: 2 hours ago                       │  │
│  │    [👁️ Show] [📋 Copy] [🔄 Rotate] [🗑️ Delete]   │  │
│  │ ──────────────────────────────────────────────── │  │
│  │ 🧠 DeepSeek              sk-de****f6g7  ⚠️ Error │  │
│  │    Error: Invalid API key (401)                   │  │
│  │    [👁️ Show] [📋 Copy] [✏️ Update] [🗑️ Delete]   │  │
│  │ ──────────────────────────────────────────────── │  │
│  │ 🧠 Gemini                AIza****h8i9  ✅ Valid  │  │
│  │    [👁️ Show] [📋 Copy] [🔄 Rotate] [🗑️ Delete]   │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  ─── Add New Key ───────────────────────────────────   │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Provider: [OpenAI ▾]                              │  │
│  │ API Key:  [__________________________________]   │  │
│  │ [🔑 Add Key] [🧪 Test Connection]                 │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  ─── Key Audit Log ─────────────────────────────────   │
│  ┌──────────────────────────────────────────────────┐  │
│  │ 2026-06-18 01:23 · OpenAI key tested · ✅ Success │  │
│  │ 2026-06-17 22:15 · Anthropic key added · Admin   │  │
│  │ 2026-06-17 18:40 · DeepSeek key failed · ❌ 401   │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Kluczowe funkcje:**
- 🆕 Encrypted storage (AES-256-GCM z kluczem w JWT secret)
- 🆕 Masked display (pierwsze 4 znaki + ****)
- 🆕 Show/Copy (z potwierdzeniem)
- 🆕 Key validity test (automatyczny + manualny)
- 🆕 Key rotation (generuj nowy + dezaktywuj stary)
- 🆕 Audit log (kto dodał/przetestował/usunął klucz)
- 🆕 Provider status indicator (✅ Valid / ⚠️ Error / ⚪ Untested)

---

### 6.21 System Logs

**Status:** 🔄 Redesign

**Aktualnie:** LogsPage.tsx + log/capture.ts  
**Problem:** Podstawowy log viewer, brak filtrowania, brak search, brak level indicators

**Docelowy design:**

```
┌─────────────────────────────────────────────────────────┐
│ SYSTEM LOGS                                       [🔍] │
│ [All] [ERROR] [WARN] [INFO] [DEBUG] [AGENT] [API]       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  🔍 Search logs...                              [📥]    │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │ 01:52:03 🔴 ERROR  [api] POST /api/chat          │  │
│  │   Request timeout after 30s — provider: DeepSeek │  │
│  │   Session: abc123 · Agent: Main Assistant        │  │
│  │   [📋 Copy] [🔗 Link]                            │  │
│  │ ──────────────────────────────────────────────── │  │
│  │ 01:51:45 🟡 WARN   [quota] Session limit near   │  │
│  │   Session xyz789 at 92% of daily quota           │  │
│  │   [📋 Copy] [🔗 Link]                            │  │
│  │ ──────────────────────────────────────────────── │  │
│  │ 01:51:30 🔵 INFO   [agent] Agent switched        │  │
│  │   Main Assistant → Coder Agent · Session: abc123 │  │
│  │   [📋 Copy] [🔗 Link]                            │  │
│  │ ──────────────────────────────────────────────── │  │
│  │ 01:51:00 🟢 DEBUG  [tool] web_search completed   │  │
│  │   Duration: 1.2s · Results: 3 · Tokens: 450      │  │
│  │   [📋 Copy] [🔗 Link]                            │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  ─── Log Stats ─────────────────────────────────────   │
│  Last hour: 🔴 3 errors · 🟡 12 warnings · 🔵 45 info  │
│  [⏹️ Auto-scroll: ON] [🧹 Clear Logs] [📥 Export]      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Kluczowe funkcje:**
- 🆕 Log level indicators (🔴 ERROR 🟡 WARN 🔵 INFO 🟢 DEBUG)
- 🆕 Filtrowanie po levelu, module (agent/api/quota/tool)
- 🆕 Full-text search w logach
- 🆕 Real-time log streaming (WebSocket)
- 🆕 Auto-scroll toggle
- 🆕 Copy log entry / link do konkretnego loga
- 🆕 Log stats (count per level, per hour)
- 🆕 Export logs (JSON/CSV)
- 🆕 Clear logs (z potwierdzeniem)

---

### 6.22 User Profiles

**Status:** 🔄 Redesign

**Aktualnie:** ProfilesPage.tsx + auth/manager.ts  
**Problem:** Podstawowe zarządzanie profilami

**Docelowy design:**

```
┌─────────────────────────────────────────────────────────┐
│ USER PROFILES                                     [🔍] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ─── Current Profile ───────────────────────────────   │
│  ┌──────────────────────────────────────────────────┐  │
│  │ 👤 Admin                          🟢 Active      │  │
│  │    Role: Administrator · Created: 2026-05-20     │  │
│  │    Last login: 2026-06-18 01:50                  │  │
│  │    Sessions: 247 · Tokens used: 2.3M              │  │
│  │    [Edit Profile] [Change Password]              │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  ─── All Users ─────────────────────────────────────   │
│  ┌──────────────────────────────────────────────────┐  │
│  │ 👤 Admin            🟢 Active    Administrator   │  │
│  │ 👤 Developer        🟢 Active    Developer       │  │
│  │ 👤 Viewer           ⚪ Inactive  Viewer          │  │
│  │                                                   │  │
│  │ [+ Add User]                                      │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  ─── Add / Edit User ──────────────────────────────   │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Username:     [________________________]         │  │
│  │ Password:     [________________________]         │  │
│  │ Role:         [Developer ▾]                       │  │
│  │ Permissions:                                      │  │
│  │   ☑ Chat Access                                  │  │
│  │   ☑ Agent Management                             │  │
│  │   ☑ Settings Access                              │  │
│  │   ☐ Admin Access                                 │  │
│  │ [💾 Save User]                                    │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Kluczowe funkcje:**
- 🆕 Profile detail (role, created, last login, stats)
- 🆕 Role-based permissions (Admin/Developer/Viewer)
- 🆕 Granular permissions (Chat, Agents, Settings, Admin)
- 🆕 Add/Edit/Delete users
- 🆕 Password change
- 🆕 Activity log per user (ostatnie logowania, akcje)
- ✅ Istniejący auth system (ulepszony)

---

### 6.23 AI Models

**Status:** 🔄 Redesign

**Aktualnie:** ModelsPage.tsx + config/provider-config.ts  
**Problem:** Podstawowa konfiguracja providerów

**Docelowy design:**

```
┌─────────────────────────────────────────────────────────┐
│ AI MODELS                                         [🔍] │
│ [Providers] [Models] [Defaults] [Testing]                │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ─── Providers ─────────────────────────────────────   │
│  ┌──────────────────────────────────────────────────┐  │
│  │ 🧠 OpenAI               ✅ Connected             │  │
│  │    Models: gpt-5, gpt-4o, gpt-4o-mini            │  │
│  │    [Configure] [Test] [Disable]                  │  │
│  │ ──────────────────────────────────────────────── │  │
│  │ 🧠 Anthropic            ✅ Connected             │  │
│  │    Models: claude-opus-4, claude-sonnet-4        │  │
│  │    [Configure] [Test] [Disable]                  │  │
│  │ ──────────────────────────────────────────────── │  │
│  │ 🧠 DeepSeek             ⚠️ Error (401)           │  │
│  │    Models: deepseek-chat, deepseek-reasoner      │  │
│  │    [Configure] [Test] [Disable]                  │  │
│  │ ──────────────────────────────────────────────── │  │
│  │ 🧠 Google Gemini        ✅ Connected             │  │
│  │    Models: gemini-2.5-pro, gemini-2.5-flash      │  │
│  │    [Configure] [Test] [Disable]                  │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  ─── Default Models ────────────────────────────────   │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Chat:        [GPT-5 ▾]              (OpenAI)     │  │
│  │ Code:        [Claude Opus 4 ▾]      (Anthropic)  │  │
│  │ Research:    [Gemini 2.5 Pro ▾]     (Google)     │  │
│  │ Reasoning:   [DeepSeek Reasoner ▾]  (DeepSeek)   │  │
│  │ Fast:        [GPT-4o-mini ▾]        (OpenAI)     │  │
│  │                                                     │  │
│  │ [💾 Save Defaults]                                 │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  ─── Model Testing ─────────────────────────────────   │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Model: [GPT-5 ▾]                                 │  │
│  │ Test prompt: "Say hello in 5 languages"          │  │
│  │ [▶ Test]                                          │  │
│  │ ──────────────────────────────────────────────── │  │
│  │ Response: "Hello, Hola, Bonjour, Ciao, 你好"     │  │
│  │ ⏱ 0.3s · 15 tokens · ✅ Success                 │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Kluczowe funkcje:**
- 🆕 Provider cards z statusem, listą modeli
- 🆕 Configure/Test/Disable per provider
- 🆕 Default model per task type (Chat/Code/Research/Reasoning/Fast)
- 🆕 Model testing panel (wyślij test prompt → zobacz response)
- 🆕 Provider health monitoring
- ✅ Istniejący provider system (ulepszony)

---

### 6.24 Cron Schedule

**Status:** 🔄 Redesign

**Aktualnie:** CronPage.tsx + cron/manager.ts + cron/scheduler.ts  
**Problem:** Podstawowy interfejs

**Docelowy design:**

```
┌─────────────────────────────────────────────────────────┐
│ CRON SCHEDULE                                      [🔍] │
│ [Active] [History] [Templates] [Create]                  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ─── Active Schedules ──────────────────────────────   │
│  ┌──────────────────────────────────────────────────┐  │
│  │ ⏰ "Daily AI News Summary"                       │  │
│  │    Schedule: Every day at 08:00                   │  │
│  │    Agent: Research Assistant · Model: Nexus-4    │  │
│  │    Last run: Today 08:00 ✅ · Next: Tomorrow      │  │
│  │    [▶ Run Now] [⏸️ Pause] [✏️ Edit] [🗑️ Delete]  │  │
│  │ ──────────────────────────────────────────────── │  │
│  │ ⏰ "Weekly System Health Check"                  │  │
│  │    Schedule: Every Monday at 09:00                │  │
│  │    Agent: DevOps Engineer · Model: Nexus-4 Pro   │  │
│  │    Last run: Mon Jun 15 ✅ · Next: Mon Jun 22     │  │
│  │    [▶ Run Now] [⏸️ Pause] [✏️ Edit] [🗑️ Delete]  │  │
│  │ ──────────────────────────────────────────────── │  │
│  │ ⏰ "Hourly Market Monitor"                       │  │
│  │    Schedule: Every hour                           │  │
│  │    Agent: Data Analyst · Model: Nexus-4 Fast     │  │
│  │    Status: ⏸️ Paused                              │  │
│  │    [▶ Run Now] [▶ Resume] [✏️ Edit] [🗑️ Delete]  │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  ─── Create Schedule ───────────────────────────────   │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Name: [_______________________________]          │  │
│  │ Schedule: [Every day at ▾] [08:00]               │  │
│  │   Options: Every N hours/days/weeks               │  │
│  │           Specific days (Mon, Wed, Fri)           │  │
│  │           Cron expression: [0 8 * * *]           │  │
│  │ Agent: [Research Assistant ▾]                     │  │
│  │ Model: [Nexus-4 ▾]                                │  │
│  │ Prompt: [___________________________________]    │  │
│  │         [___________________________________]    │  │
│  │ [💾 Create Schedule]                              │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  ─── Run History ───────────────────────────────────   │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Today 08:00 · Daily AI News · ✅ 2.3s · $0.01   │  │
│  │ Today 07:00 · Hourly Market · ⏸️ Skipped(paused) │  │
│  │ Mon 09:00  · Weekly Health · ✅ 12.4s · $0.05    │  │
│  │ Sun 08:00  · Daily AI News · ❌ Timeout          │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Kluczowe funkcje:**
- ✅ Cron scheduler (ulepszone UI)
- 🆕 Schedule cards z następnym czasem wykonania
- 🆕 Run Now / Pause / Resume / Edit / Delete
- 🆕 Cron expression editor + natural language builder
- 🆕 Agent & Model selection per schedule
- 🆕 Schedule templates (Daily Summary, Weekly Report, Health Check)
- 🆕 Run history z statusem, duration, cost
- 🆕 Pause all / Resume all

---

### 6.25 Analytics

**Status:** 🔄 Redesign

**Aktualnie:** AnalyticsPage.tsx + analytics/dashboard.ts  
**Problem:** Podstawowe metryki

**Docelowy design:**

```
┌─────────────────────────────────────────────────────────┐
│ ANALYTICS                                          [📥] │
│ [Overview] [Usage] [Costs] [Agents] [Models]             │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ─── Overview (Last 30 Days) ───────────────────────   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │ Sessions │ │ Messages │ │  Tokens  │ │   Cost   │  │
│  │   247    │ │  3,421   │ │  2.3M   │ │  $8.42   │  │
│  │  ↑12%    │ │  ↑18%    │ │  ↑22%   │ │  ↑15%    │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
│                                                         │
│  ─── Usage Over Time ───────────────────────────────   │
│  ┌──────────────────────────────────────────────────┐  │
│  │  ██                                                │  │
│  │  ██ ██                                           │  │
│  │  ██ ██ ██ ██                                     │  │
│  │  ██ ██ ██ ██ ██ ██                              │  │
│  │  ██ ██ ██ ██ ██ ██ ██ ██                       │  │
│  │  W1   W2   W3   W4   W5   W6   W7   W8          │  │
│  │  ── Sessions  ── Messages  ── Tokens            │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  ─── Cost Breakdown ────────────────────────────────   │
│  ┌──────────────────────────────────────────────────┐  │
│  │ OpenAI:       $3.42  (40%)  ████████████████████ │  │
│  │ Anthropic:    $2.85  (34%)  █████████████████    │  │
│  │ Google:       $1.20  (14%)  ███████              │  │
│  │ DeepSeek:     $0.95  (11%)  █████                │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  ─── Top Agents ────────────────────────────────────   │
│  ┌──────────────────────────────────────────────────┐  │
│  │ 1. Main Assistant    1,247 sessions   $4.20      │  │
│  │ 2. Coder Agent         523 sessions   $2.10      │  │
│  │ 3. Research Agent      312 sessions   $1.25      │  │
│  │ 4. Data Analyst        187 sessions   $0.65      │  │
│  │ 5. Security Auditor     89 sessions   $0.22      │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Kluczowe funkcje:**
- 🆕 Dashboard z KPI cards (sessions, messages, tokens, cost)
- 🆕 Usage over time chart (sessions/messages/tokens)
- 🆕 Cost breakdown per provider (pie chart)
- 🆕 Top agents ranking
- 🆕 Date range selector (7d, 30d, 90d, custom)
- 🆕 Export analytics (CSV/PDF)
- 🆕 Trend indicators (↑/↓ percentage)

---

### 6.26 Tool Analytics

**Status:** 🔄 Redesign

**Aktualnie:** ToolsAnalyticsPage.tsx + safety/tool-audit.ts  
**Problem:** Podstawowe statystyki

**Docelowy design:**

```
┌─────────────────────────────────────────────────────────┐
│ TOOL ANALYTICS                                    [📥] │
│ [Overview] [Tools] [Errors] [Performance] [Audit Log]    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ─── Tool Usage Overview ───────────────────────────   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │Tool Calls│ │ Success  │ │ Avg Time │ │  Errors  │  │
│  │  12,847  │ │  98.2%   │ │  1.4s    │ │   234    │  │
│  │  ↑8%     │ │  ↑0.3%   │ │  ↓0.2s   │ │  ↓15%    │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
│                                                         │
│  ─── Most Used Tools ───────────────────────────────   │
│  ┌──────────────────────────────────────────────────┐  │
│  │ 1. 🔧 web_search         3,421 calls   98.5% ✅  │  │
│  │ 2. 🔧 read_file          2,847 calls   99.2% ✅  │  │
│  │ 3. 🔧 write_file         1,923 calls   97.8% ✅  │  │
│  │ 4. 🔧 exec               1,542 calls   96.1% ✅  │  │
│  │ 5. 🔧 web_fetch          1,234 calls   99.0% ✅  │  │
│  │ 6. 🔧 sessions_spawn       892 calls   95.3% ✅  │  │
│  │ 7. 🔧 image                654 calls   99.5% ✅  │  │
│  │ 8. 🔧 memory_search        421 calls   100%  ✅  │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  ─── Error-Prone Tools ─────────────────────────────   │
│  ┌──────────────────────────────────────────────────┐  │
│  │ ⚠️ exec                58 errors    (3.8%)        │  │
│  │    Top error: Process timeout (42)                │  │
│  │ ⚠️ sessions_spawn      42 errors    (4.7%)        │  │
│  │    Top error: Agent unavailable (38)              │  │
│  │ ⚠️ web_fetch           12 errors    (1.0%)        │  │
│  │    Top error: HTTP 403 Forbidden (8)              │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  ─── Performance (Avg Duration) ─────────────────────   │
│  ┌──────────────────────────────────────────────────┐  │
│  │ web_search     ████ 1.2s                         │  │
│  │ read_file      ██ 0.3s                           │  │
│  │ write_file     ██ 0.4s                           │  │
│  │ exec           ██████ 3.2s                        │  │
│  │ sessions_spawn ████████ 8.5s                      │  │
│  │ image          ██████████ 12.4s                   │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  ─── Audit Log (Recent) ─────────────────────────────   │
│  ┌──────────────────────────────────────────────────┐  │
│  │ 01:52:03 · web_search · ✅ · 1.2s · Session abc  │  │
│  │ 01:51:45 · read_file · ✅ · 0.3s · Session abc   │  │
│  │ 01:51:30 · exec · ❌ · Timeout · Session xyz     │  │
│  │ 01:51:00 · write_file · ✅ · 0.4s · Session abc  │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Kluczowe funkcje:**
- 🆕 Tool usage overview (total calls, success rate, avg time, errors)
- 🆕 Most used tools ranking
- 🆕 Error-prone tools analysis (jakie narzędzia mają najwięcej błędów)
- 🆕 Performance chart (avg duration per tool)
- 🆕 Audit log (pełna historia wywołań narzędzi)
- ✅ Istniejący tool audit system (ulepszony)

---

### 6.27 Documentation

**Status:** 🔄 Redesign (wbudowana w app)

**Aktualnie:** DocsPage.tsx + docs/ folder  
**Problem:** Oddzielna strona, słaba nawigacja

**Docelowy design:**

```
┌─────────────────────────────────────────────────────────┐
│ DOCUMENTATION                                     [🔍] │
│ [Guides] [API Reference] [Agents] [Tools] [Tutorials]   │
├────────┬────────────────────────────────────────────────┤
│        │                                                │
│ DOC    │  DOCUMENTATION CONTENT (Markdown)              │
│ TREE   │                                                │
│        │  # Getting Started                             │
│ 📚 Get  │                                                │
│  📄 Quick│  Welcome to Nexus AI! This guide will...     │
│  📄 Insta│                                                │
│  📄 Config│  ## Prerequisites                            │
│ 📚 Agent│  - Bun >= 1.1.0                               │
│  📄 Overv│  - Node.js >= 18                              │
│  📄 Creat│  - Git                                        │
│  📄 Mesh │                                                │
│ 📚 Tools │  ## Installation                              │
│  📄 Overv│                                                │
│  📄 Web S│  ```bash                                      │
│  📄 File │  curl -fsSL https://nexus.ai/install | bash  │
│  📄 Code │  ```                                          │
│ 📚 API   │                                                │
│  📄 Auth │  [Edit this page] [📋 Copy link]              │
│  📄 Chat │                                                │
│  📄 Agent│                                                │
│        │                                                │
├────────┴────────────────────────────────────────────────┤
│ Was this page helpful? [👍] [👎]                         │
└─────────────────────────────────────────────────────────┘
```

**Kluczowe funkcje:**
- 🆕 Wbudowana w app (nie oddzielna strona)
- 🆕 Doc tree nawigacja (sidebar w sidebarze)
- 🆕 Markdown rendering z syntax highlighting
- 🆕 Search across all docs
- 🆕 "Edit this page" (dla developerów)
- 🆕 Feedback per page (👍👎)
- 🆕 Interactive tutorials (krok po kroku z agentem)
- 🆕 API Reference z auto-generowanymi przykładami

---

### 6.28 Creative Studio (opcjonalnie)

**Decyzja:** Usuwamy Video Generation jako główny moduł.

**ALE:** Zachowujemy szkielet pod przyszły moduł "Creative Studio" jako plugin. Jeśli user chce generować wideo — instaluje plugin. Nie jest to core produktu.

---

## 7. MODUŁY DO USUNIĘCIA

### 7.1 Lista do usunięcia (back end)

```bash
# Core modules — DELETE
rm -rf packages/core/src/video/
rm -rf packages/core/src/crypto-hub/
rm -rf packages/core/src/shopping/
rm -rf packages/core/src/social/
rm -rf packages/core/src/bsky/
rm -rf packages/core/src/media/          # video/audio generation
rm -rf packages/core/src/browser/        # browser automation (opcjonalnie)

# Data files — DELETE
rm -f data/crypto_cache.json
rm -f data/crypto_history.json
rm -f data/video-jobs.json
rm -rf data/video_uploads/
rm -rf data/social/
rm -rf data/screenshots/

# Skills — DELETE
rm -rf skills/blockchain/
rm -rf skills/crypto-*/
rm -rf skills/shopping-*/
rm -rf skills/debug-audio-video-processing-project/
rm -rf skills/debug-milkdrop-project-issues/

# Agents — DELETE
rm -rf agents/crypto-news-agent/
rm -rf agents/shopping-agent/
rm -rf agents/video-editor-agent/
rm -rf agents/video-post-processor/

# Plugins (opcjonalnie — zdecyduj)
# rm -rf plugins/browser-use/
# rm -rf plugins/browser-use-test/
```

### 7.2 Lista do usunięcia (frontend)

```bash
# Pages — DELETE
rm -f packages/ui/src/routes/VideoPage.tsx
rm -f packages/ui/src/routes/VideoEditorPage.tsx
rm -f packages/ui/src/routes/CryptoHubPage.tsx
rm -f packages/ui/src/routes/ShoppingPage.tsx
rm -f packages/ui/src/routes/SocialPage.tsx

# Components — DELETE
rm -rf packages/ui/src/lib/components/crypto/
rm -rf packages/ui/src/lib/components/BridgeInterface.tsx
rm -rf packages/ui/src/lib/components/SwapInterface.tsx

# Config — DELETE
rm -f packages/ui/src/lib/config/chains.ts
rm -f packages/ui/src/lib/config/tokens.ts
rm -f packages/ui/src/lib/config/reown.ts

# Hooks — DELETE
rm -f packages/ui/src/lib/hooks/useMultiChain.ts
rm -f packages/ui/src/lib/hooks/useWallet.ts

# Old workflow (replaced) — DELETE
rm -rf packages/ui/src/lib/workflow/

# Scripts — DELETE
rm -f scripts/bluesky_news_poster.py
rm -f scripts/bluesky_post.py

# npm dependencies (po usunięciu kodu)
bun remove wagmi viem @reown-appkit/appkit
```

### 7.3 Oszczędności po usunięciu

| Metryka | Przed | Po | Oszczędność |
|---------|-------|-----|-------------|
| Strony UI | 35 | 28 | -7 stron |
| Backend moduły | 30+ | 22 | -8 modułów |
| Agenci | 17 | 13 | -4 agentów |
| Skille | 64+ | 58+ | -6 skilli |
| npm dependencies | ~15 | ~12 | -3 paczki |
| Szacowana redukcja kodu | 100% | ~60% | **~40% mniej** |
| Szacowana redukcja złożoności | 100% | ~50% | **~50% prostsze** |

---

## 8. ARCHITEKTURA TECHNICZNA v2

### 8.1 Stack

```
Frontend:  React 19 + TypeScript + Tailwind CSS 4 + Vite
           + Framer Motion + Zustand + TanStack Query
           + Monaco Editor + ReactFlow + Lucide Icons

Backend:   Bun + TypeScript + SQLite
           + Plugin Architecture + Event Bus + WebSocket

Nowe moduły:
  packages/core/src/
    agent-mesh/           🆕 Agent Mesh Protocol
    rag-pipeline/         🆕 RAG Pipeline
    workflow-engine/      🆕 Visual Workflow Engine
    knowledge-graph/      🆕 Knowledge Graph Engine
```

### 8.2 State Management

```typescript
// Zustand store (zastępuje rozproszone useState)
interface AppStore {
  chat: ChatState;
  agents: AgentMeshState;
  ui: UIState;
  settings: SettingsState;
}
```

---

## 9. ROADMAP WDROŻENIA (20 tygodni)

### Faza 0: Cleanup + Foundation (Tydzień 1-2)
```
□ Usunięcie: video, crypto, shopping, social, browser, dubbing
□ Nowy design system — tokeny, kolory, typografia
□ Brand assets — logo Nexus AI, favicon
□ Zustand store setup
□ Nowa struktura nawigacji (3 sekcje)
□ Usunięcie zbędnych stron + konsolidacja Settings
```

### Faza 1: Chat Premium (Tydzień 3-5)
```
□ Pełny redesign ChatPage — nowa architektura wiadomości
□ Streaming + Thinking Panel + Tool Cards (ulepszone)
□ Agent Switcher + Model Switcher przy inpucie
□ Slash Commands z autocomplete
□ Threading & Forking konwersacji
□ Context Window Visualization
□ Voice Mode (push-to-talk)
□ File Upload drag & drop + URL auto-fetch
□ Message Actions (👍👎📋🔄🔀)
```

### Faza 2: Agent Mesh (Tydzień 6-8)
```
□ Agent Mesh Protocol (backend)
□ Agent Router + Event Bus
□ Agent-to-Agent Messaging
□ Agents Page — redesign (mesh canvas)
□ Agent Chambers — nowa funkcja
□ Real-time agent status (WebSocket)
```

### Faza 3: Knowledge + Developer Tools (Tydzień 9-11)
```
□ Knowledge Graph — nowa funkcja
□ RAG Pipeline (upload → chunk → embed → search)
□ Code Editor (Monaco + LSP)
□ Git Automation (auto-commit, auto-PR)
□ Terminal (multiplexer)
□ Workspace (file browser redesign)
```

### Faza 4: Workflows + Integrations (Tydzień 12-14)
```
□ Visual Workflow Builder (ReactFlow)
□ Integrations Hub (50+ integracji)
□ Prompt Playground (side-by-side)
□ Worker Nodes (persistence, retry, SSE)
```

### Faza 5: Data + System (Tydzień 15-17)
```
□ Skills Marketplace
□ Plugins redesign + marketplace
□ Sessions (FTS5 search, export)
□ Channels (uproszczenie)
□ Memory DB (kategorie, graph)
□ Settings (konsolidacja)
□ API Keys (encrypted, audit)
□ System Logs (real-time, filtering)
□ User Profiles (RBAC)
□ AI Models (per-task defaults)
□ Cron Schedule (templates)
□ Analytics (dashboard)
□ Tool Analytics (error analysis)
□ Documentation (wbudowana)
```

### Faza 6: Polish & Launch (Tydzień 18-20)
```
□ Performance optimization
□ Accessibility audit (WCAG 2.1 AA)
□ i18n (English + Polski)
□ Documentation final
□ Landing page
□ Beta testing
□ Launch 🚀
```

---

## 10. TOKENY DESIGNU v2

```typescript
// design-tokens-v2.ts — Nexus AI Premium Design System
export const nexus = {
  colors: {
    bg: {
      deepest: '#050510',
      primary: '#0a0b1e',
      secondary: '#11132b',
      tertiary: '#1a1d3a',
      glass: 'rgba(255, 255, 255, 0.025)',
      glassHover: 'rgba(255, 255, 255, 0.05)',
    },
    accent: {
      cyan: '#00d4ff',
      blue: '#3b82f6',
      indigo: '#6366f1',
      violet: '#8b5cf6',
      purple: '#a78bfa',
    },
    text: {
      primary: '#e8ecf2',
      secondary: '#8892a8',
      muted: '#4a5068',
    },
    semantic: {
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
      info: '#3b82f6',
    },
    agent: {
      main: '#6366f1',
      research: '#00d4ff',
      coder: '#22c55e',
      data: '#f59e0b',
      security: '#ef4444',
      devops: '#8b5cf6',
      pm: '#ec4899',
    },
  },
  typography: {
    fontFamily: {
      display: '"Clash Display", "Inter", sans-serif',
      body: '"Inter", sans-serif',
      mono: '"JetBrains Mono", monospace',
    },
  },
  glass: {
    card: 'bg-[rgba(255,255,255,0.025)] backdrop-blur-xl border border-[rgba(255,255,255,0.06)] rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.3)]',
    cardHover: 'hover:border-[rgba(0,212,255,0.15)] hover:shadow-[0_8px_32px_rgba(0,0,0,0.4),0_0_0_1px_rgba(0,212,255,0.1)]',
    input: 'bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-xl text-[#e8ecf2] focus:border-[rgba(0,212,255,0.4)] focus:shadow-[0_0_0_3px_rgba(0,212,255,0.1)]',
  },
  animation: {
    duration: { fast: '0.15s', normal: '0.25s', slow: '0.4s' },
    easing: { default: 'cubic-bezier(0.16,1,0.3,1)', spring: 'cubic-bezier(0.34,1.56,0.64,1)' },
  },
} as const;
```

---

## 📋 PODSUMOWANIE

### Kluczowe decyzje:

| Decyzja | Impact |
|---------|--------|
| **Usuwamy video, crypto, shopping, social** | -40% kodu, -50% złożoności, czystszy produkt |
| **Chat jako centralny element** | Wszystko kręci się wokół chatu |
| **Agent Mesh Protocol** | Agenci połączeni, komunikują się, współdzielą pamięć |
| **Każda funkcja ma własny redesign** | 28 funkcji, każda opisana szczegółowo |
| **Konsolidacja Settings** | 5+ stron → 1 strona z zakładkami |
| **Nowy Visual Workflow Builder** | ReactFlow, drag & drop, zastępuje stary |
| **RAG Pipeline** | Upload → chunk → embed → semantic search |
| **50+ nowych integracji** | Slack, Notion, Google, GitHub, Jira... |

### Następne kroki:

1. **Zaakceptuj plan** — omówimy szczegóły
2. **Faza 0** — cleanup + foundation (zaczynamy od usunięcia ~40% kodu)
3. **Faza 1** — Chat Premium (prototyp w 3 tygodnie)
4. **Faza 2** — Agent Mesh (backend protocol + UI)

---

> **AutoClaw** · 2026-06-18 · v2.0 planu  
> *"Connect. Create. Automate."*
