import "./app.css";
import { mount } from "svelte";
import App from "./App.svelte";

try {
  mount(App, { target: document.getElementById("app")! });
} catch (e) {
  document.getElementById("app")!.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;gap:1rem;color:#ef4444;font-family:sans-serif;background:#041c1c">
      <h2 style="color:#2dd4bf">Błąd ładowania</h2>
      <pre style="font-size:0.8rem;max-width:80%;overflow:auto;color:#f0e6d2">${e instanceof Error ? e.message : String(e)}</pre>
      <button onclick="location.reload()" style="padding:0.5rem 1rem;border-radius:6px;border:1px solid #2dd4bf;background:rgba(45,212,191,0.1);color:#f0e6d2;cursor:pointer">Odśwież</button>
    </div>`;
}
