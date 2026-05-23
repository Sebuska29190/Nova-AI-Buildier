/**
 * Minimal i18n for NOVA UI — Polish default, with get/set/lang exports.
 */

type Dict = Record<string, string>;

const pl: Dict = {
  // ── Global ──
  "app.name": "NOVA",
  "app.loading": "Ładowanie...",
  "app.online": "Online",
  "app.offline": "Offline",
  "app.search": "Szukaj...",
  "app.close": "Zamknij",
  "app.save": "Zapisz",
  "app.cancel": "Anuluj",
  "app.delete": "Usuń",
  "app.edit": "Edytuj",
  "app.add": "Dodaj",
  "app.create": "Utwórz",
  "app.noData": "Brak danych",
  "app.underConstruction": "Strona w budowie",

  // ── Nav ──
  "nav.main": "GŁÓWNE",
  "nav.data": "DANE",
  "nav.tools": "NARZĘDZIA",
  "nav.config": "KONFIGURACJA",
  "nav.recent": "OSTATNIE",
  "nav.toggle": "Przełącz sidebar",

  // ── Pages ──
  "chat.title": "Chat",
  "chat.placeholder": "Napisz wiadomość...",
  "chat.send": "Wyślij",
  "chat.selectModel": "Wybierz model",
  "chat.newSession": "Nowa sesja",
  "agents.title": "Agenci",
  "agents.new": "Nowy agent",
  "agents.running": "Uruchomiony",
  "agents.stopped": "Zatrzymany",
  "skills.title": "Skille",
  "skills.new": "Nowy skill",
  "skills.activate": "Aktywuj",
  "skills.deactivate": "Deaktywuj",
  "config.title": "Konfiguracja",
  "config.prompt": "System Prompt",
  "env.title": "Klucze API",
  "env.subtitle": "Zarządzaj kluczami API dla wszystkich providerów",
  "env.add": "Dodaj klucz",
  "env.noKeys": "Brak zapisanych kluczy API.",
  "env.save": "💾",
  "models.title": "Modele AI",
  "models.subtitle": "Katalog dostępnych modeli AI",
  "models.search": "Szukaj modelu...",
  "analytics.title": "Analityka",
  "analytics.subtitle": "Statystyki użycia agenta",
  "logs.title": "Logi",
  "logs.subtitle": "Podgląd logów systemowych",
  "logs.filterComponent": "Filtruj komponent...",
  "logs.noLogs": "Brak logów spełniających kryteria.",
  "cron.title": "Harmonogram",
  "cron.subtitle": "Zaplanowane zadania cron",
  "cron.new": "Nowe zadanie",
  "cron.noJobs": "Brak zaplanowanych zadań.",
  "cron.runNow": "Uruchom teraz",
  "cron.active": "Aktywne",
  "cron.disabled": "Wyłączone",
  "profiles.title": "Profile",
  "profiles.subtitle": "Profile konfiguracyjne agenta",
  "profiles.new": "Nowy profil",
  "profiles.active": "Aktywny",
  "profiles.activate": "Aktywuj",
  "docs.title": "Dokumentacja",
  "docs.subtitle": "Przewodnik po interfejsie NOVA",
  "sessions.title": "Sesje",
  "channels.title": "Kanały",
  "memory.title": "Pamięć",
  "workspace.title": "Workspace",
  "video.title": "Video",
  "video.editor": "Edytor",
  "worker.title": "Worker",
  "crypto.title": "Crypto",
  "trading.title": "Trading",
  "shopping.title": "Zakupy",
  "terminal.title": "Terminal",
  "plugins.title": "Pluginy",

  // ── Placeholder ──
  "placeholder": "Wprowadź wartość...",
};

const en: Dict = {
  "app.name": "NOVA",
  "app.loading": "Loading...",
  "app.online": "Online",
  "app.offline": "Offline",
  "app.search": "Search...",
  "app.close": "Close",
  "app.save": "Save",
  "app.cancel": "Cancel",
  "app.delete": "Delete",
  "app.edit": "Edit",
  "app.add": "Add",
  "app.create": "Create",
  "app.noData": "No data",
  "app.underConstruction": "Page under construction",
  "nav.main": "MAIN",
  "nav.data": "DATA",
  "nav.tools": "TOOLS",
  "nav.config": "CONFIG",
  "nav.recent": "RECENT",
  "nav.toggle": "Toggle sidebar",
  "chat.title": "Chat",
  "chat.placeholder": "Type a message...",
  "chat.send": "Send",
  "chat.selectModel": "Select model",
  "chat.newSession": "New session",
  "agents.title": "Agents",
  "agents.new": "New agent",
  "agents.running": "Running",
  "agents.stopped": "Stopped",
  "skills.title": "Skills",
  "skills.new": "New skill",
  "skills.activate": "Activate",
  "skills.deactivate": "Deactivate",
  "config.title": "Configuration",
  "config.prompt": "System Prompt",
  "env.title": "API Keys",
  "env.subtitle": "Manage API keys for all providers",
  "env.add": "Add key",
  "env.noKeys": "No API keys saved.",
  "env.save": "💾",
  "models.title": "AI Models",
  "models.subtitle": "Available AI model catalog",
  "models.search": "Search model...",
  "analytics.title": "Analytics",
  "analytics.subtitle": "Agent usage statistics",
  "logs.title": "Logs",
  "logs.subtitle": "System log viewer",
  "logs.filterComponent": "Filter component...",
  "logs.noLogs": "No logs matching criteria.",
  "cron.title": "Schedule",
  "cron.subtitle": "Scheduled cron tasks",
  "cron.new": "New task",
  "cron.noJobs": "No scheduled tasks.",
  "cron.runNow": "Run now",
  "cron.active": "Active",
  "cron.disabled": "Disabled",
  "profiles.title": "Profiles",
  "profiles.subtitle": "Agent configuration profiles",
  "profiles.new": "New profile",
  "profiles.active": "Active",
  "profiles.activate": "Activate",
  "docs.title": "Documentation",
  "docs.subtitle": "NOVA interface guide",
  "sessions.title": "Sessions",
  "channels.title": "Channels",
  "memory.title": "Memory",
  "workspace.title": "Workspace",
  "video.title": "Video",
  "video.editor": "Editor",
  "worker.title": "Worker",
  "crypto.title": "Crypto",
  "trading.title": "Trading",
  "shopping.title": "Shopping",
  "terminal.title": "Terminal",
  "plugins.title": "Plugins",
  "placeholder": "Enter value...",
};

const dicts: Record<string, Dict> = { pl, en };

// ── Store ──
let currentLang = $state("pl");
let currentDict = $derived(dicts[currentLang] ?? pl);

export function t(key: string, fallback = key): string {
  return currentDict[key] ?? fallback;
}

export function setLang(lang: string) {
  if (dicts[lang]) {
    currentLang = lang;
    if (typeof localStorage !== "undefined") localStorage.setItem("nova-lang", lang);
  }
}

export function getLang(): string {
  return currentLang;
}

// Init from localStorage
if (typeof localStorage !== "undefined") {
  const saved = localStorage.getItem("nova-lang");
  if (saved && dicts[saved]) currentLang = saved;
}
