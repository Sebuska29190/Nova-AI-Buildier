import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./app.css";
import { I18nProvider } from "./lib/i18n";
import App from "./App";

try {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <I18nProvider>
        <App />
      </I18nProvider>
    </StrictMode>
  );
} catch (e) {
  document.getElementById("root")!.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;gap:1rem;color:#ef4444;font-family:sans-serif;background:#020408">
      <h2 style="color:#00f2fe">Błąd ładowania</h2>
      <pre style="font-size:0.8rem;max-width:80%;overflow:auto;color:#f0e6d2">${e instanceof Error ? e.message : String(e)}</pre>
      <button onclick="location.reload()" style="padding:0.5rem 1rem;border-radius:6px;border:1px solid #00f2fe;background:rgba(0,242,254,0.1);color:#f0e6d2;cursor:pointer">Odśwież</button>
    </div>`;
}
