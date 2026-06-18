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
  const root = document.getElementById("root")!;
  root.textContent = "";
  const wrapper = document.createElement("div");
  wrapper.style.cssText = "display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;gap:1rem;color:#ef4444;font-family:'Inter',sans-serif;background:#0a0b1e";
  const h2 = document.createElement("h2");
  h2.style.color = "#00d4ff";
  h2.textContent = "Nexus AI — Loading Error";
  const pre = document.createElement("pre");
  pre.style.cssText = "font-size:0.8rem;max-width:80%;overflow:auto;color:#e8ecf2";
  pre.textContent = e instanceof Error ? e.message : String(e);
  const btn = document.createElement("button");
  btn.textContent = "Refresh";
  btn.style.cssText = "padding:0.5rem 1rem;border-radius:0.75rem;border:1px solid rgba(0,212,255,0.2);background:rgba(0,212,255,0.06);color:#e8ecf2;cursor:pointer;font-family:inherit";
  btn.onclick = () => location.reload();
  wrapper.append(h2, pre, btn);
  root.appendChild(wrapper);
}
