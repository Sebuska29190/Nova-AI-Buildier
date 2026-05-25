# Agent Memory

Last consolidated: 2026-05-25T00:14:30.866Z
Total memories: 1

## Key Learnings

- ★★★★ dev/tracks/observability/debugging-tracing/loop-detection/), [Quantum Encoding — Production Lessons](https://quantumencoding.

## Task Report — 2026-05-25T14:06:53.601Z
**Task:** przegladnij to repo dokladnie i przygotuj jakie to ma szanse dzialac np pc 16gb ram , no GPU   https://github.com/mudler/LocalAI

**Result:**
Teraz mam wystarczająco dużo informacji, żeby przygotować kompleksową analizę. Oto raport:

---

# 📋 Szczegółowa analiza LocalAI na PC z 16GB RAM, bez GPU

## 🔍 Czym jest LocalAI?

**LocalAI** to otwartoźródłowy silnik AI, który pozwala uruchamiać lokalnie modele LLM, generować obrazy, audio, wideo i wiele więcej — **bez konieczności posiadania GPU**. Działa jako **drop-in replacement API OpenAI** (kompatybilny z OpenAI, Anthropic, ElevenLabs API).

**Kluczowe cechy:**
- ✅ **36+ backendów** (llama.cpp, transformers, whisper, diffusers, MLX...)
- ✅ Działa na **CPU, NVIDIA, AMD, Intel, Apple Silicon, Vulkan**
- ✅ Gotowe **obrazy Docker** dla CPU i GPU
- ✅ **994 modele** w galerii (od 0.5B do 405B parametrów)
- ✅ Wbudowani agenci AI, RAG, MCP, WebUI
- ✅ Ponad **40k gwiazdek na GitHubie** — bardzo dojrzały projekt (v3.10+)

---

## 💻 Czy to zadziała na PC z 16GB RAM i bez GPU?

### ✅ Krótka odpowiedź: **TAK, ale z ograniczeniami.**

LocalAI został zaprojektowany właśnie po to, by działać na CPU. Używa **llama.cpp** jako głównego backendu, który jest ekstremalnie zoptymalizowany pod CPU. Jednak trzeba dobierać odpowiednie modele.

---

## 📊 Ile RAM potrzebują modele?

Modele w formacie **GGUF** (kwantyzowane):

| Rozmiar modelu | Kwantyzacja Q4_K_M | Kwantyzacja Q8 | Wymagana pamięć |
|---|---|---|---|
| **1B** (np. Llama 3.2 1B) | ~0.7 GB | ~1.1 GB | ✅ 2-4 GB RAM |
| **3B** (np. Phi-3/4 Mini, Llama 3.2 3B) | ~2 GB | ~3.5 GB | ✅ 4-6 GB RAM |
| **7B** (np. Mistral, Gemma 7B, Qwen 7B) | ~4-5 GB | ~7-8 GB | ✅ 8-10 GB RAM |
| **8B** (np. Llama 3.1 8B) | ~5-6 GB | ~9 GB | ⚠️ 10-12 GB RAM |
| **13B** | ~7-8 GB | ~13 GB | ⚠️ 14-16 GB RAM |
| **20B+** | ~12+ GB | ~20+ GB | ❌ Nie zmieści się |

> **Dla 16GB RAM + system (~4GB): zostaje ok. 12 GB dla modeli.** Najlepiej sprawdzą się modele 1B-8B w kwantyzacji Q4_K_M.

---

## 🚀 Rekomendowane modele dla Twojego PC (16GB RAM, CPU)

### Najlepsze opcje:

| Model | Rozmiar | Wydajność na CPU (Q4) | Zastosowanie |
|---|---|---|---|
| **🟢 Llama 3.2 1B/3B Instruct** | 1B-3B | ⚡ Bardzo szybki (30-50 tok/s) | Podstawowe rozmowy, proste zadania |
| **🟢 Phi-4 / Phi-4 Mini** | 3.8B-14B | ⚡ Szybki (20-40 tok/s) | Kodowanie, rozumowanie, matematyka |
| **🟢 Mistral 7B v0.3** | 7B | ✅ Dobry (15-20 tok/s) | Uniwersalny, najlepszy stosunek jakość/szybkość |
| **🟢 Gemma 3 4B** | 4B | ⚡ Szybki (25-35 tok/s) | Google, świetne instrukcje |
| **🟢 Qwen 2.5 7B** | 7B | ✅ Dobry (15-20 tok/s) | Kodowanie, wielojęzyczność |
| **🟢 DeepSeek Coder 1.3B/6.7B** | 1.3B-6.7B | ⚡ Szybki | Kodowanie |
| **🟡 Llama 3.1 8B (Q4_K_M)** | 8B | ⚠️ Wolniejszy (10-15 tok/s) | Wiedza ogólna, ale może być tight na RAM |
| **🔴 Modele 13B+ (np. Llama 3 70B, Qwen 72B)** | 13B-405B | ❌ Za duże | Nie zmieszczą się w RAM |

---

## ⚡ Przewidywane prędkości inferencji na CPU (bez GPU)

**Zakładając: średniej klasy CPU (np. Intel i5/i7 12. gen, AMD Ryzen 5/7)**

| Model | Kwantyzacja | Tokeny/sek (CPU) | Jakość |
|---|---|---|---|
| Llama 3.2 1B Instruct | Q4_K_M | **40-60 tok/s** ⚡ | Podstawowa |
| Phi-4 Mini 3.8B | Q4_K_M | **25-40 tok/s** ⚡ | Dobra |
| Gemma 3 4B | Q4_K_M | **20-35 tok/s** ⚡ | Dobra |
| Mistral 7B v0.3 | Q4_K_M | **15-25 tok/s** ✅ | Bardzo dobra |
| Qwen 2.5 7B | Q4_K_M | **12-20 tok/s** ✅ | Bardzo dobra |
| Llama 3.1 8B | Q4_K_M | **10-18 tok/s** ⚠️ | Świetna |

> **Dla porównania:** Czytanie ze zrozumieniem to ~5-10 tok/s. Wszystko powyżej 10 tok/s jest **używalne na co dzień**. 20+ tok/s to **płynna rozmowa**.

---

## 🛠️ Jak to zainstalować?

### Opcja 1: Docker (najłatwiejsza — zalecana)

```bash
# CPU only — jedno polecenie
docker run -ti --name local-ai -p 8080:8080 localai/localai:latest
```

Następnie ładujesz model:
```bash
# Mały model, który śmiga na CPU
local-ai run llama-3.2-1b-instruct:q4_k_m

# Lub większy, ale wciąż OK na 16GB
local-ai run mistral-7b-instruct-v0.3:q4_k_m
```

### Opcja 2: Binarka (Linux/macOS)
- Pobierasz binary z [Releases](https://github.com/mudler/LocalAI/releases)
- Uruchamiasz: `./local-ai run <model>`

### Opcja 3: Windows — przez WSL2
- Instalujesz Docker Desktop + WSL2
- Uruchamiasz obraz CPU w Dockerze

---

## 📦 Co jeszcze możesz uruchomić na 16GB RAM (CPU)?

LocalAI to nie tylko LLMy! Na swoim PC bez GPU możesz także:

| Zadanie | Czy zadziała? | Uwagi |
|---|---|---|
| **Tekst → Tekst (czat)** | ✅ Świetnie | Modele 1B-8B |
| **Embeddingi** | ✅ Świetnie | Np. all-MiniLM-L6-v2 |
| **Audio → Tekst (Whisper)** | ✅ Dobrze | Whisper tiny/base/small |
| **Tekst → Audio (TTS)** | ✅ Dobrze | Piper TTS, Kokoros |
| **Generowanie obrazów** | ⚠️ Wolno | Stable Diffusion na CPU = **bardzo wolno** (minuty na obraz) |
| **Vision (obrazy jako input)** | ⚠️ Ograniczone | Tylko małe modele vision |
| **Reranker** | ✅ Dobrze | Małe modele |
| **Wideo (generowanie)** | ❌ | Wymaga GPU |
| **Duże modele 70B+** | ❌ | Nie zmieszczą się nawet kwantyzowane |

---

## 👍 Mocne strony LocalAI na Twoim sprzęcie

1. **Prywatność** — wszystko działa lokalnie, zero wysyłania danych w chmurę
2. **Cena** — zero kosztów API, tylko prąd
3. **OpenAI API kompatybilność** — możesz używać z dowolnym klientem (ChatGPT client, LibreChat, itp.)
4. **Wbudowany WebUI** — interfejs graficzny od razu
5. **36+ backendów** — jak znudzi Ci się llama.cpp, możesz przełączyć na inny
6. **Aktywny development** — nowe wersje co miesiąc (kwiecień 2026 dodał voice recognition, face detection, video generation...)
7. **Społeczność** — Discord, 40k+ gwiazdek, mnóstwo dokumentacji

---

## ⚠️ Wyzwania i ograniczenia

1. **Nie pogadasz z modelem 70B** — musisz celować w 1B-8B
2. **Generowanie obrazów będzie b. wolne** — Stable Diffusion na CPU to ~1-5 min na obraz
3. **Wideo generowanie odpada** — wymaga GPU
4. **RAM może być ciasny** — zostaw ~4 GB na system, masz ~12 GB dla modeli
5. **Szybkość** — 10-20 tok/s to używalne, ale nie zawrotne tempo (porównaj z ChatGPT online, który robi ~100+ tok/s)
6. **Docker na Windows** — przez WSL2 działa, ale ma ~5-15% narzutu wydajnościowego

---

## 🎯 Konkretne rekomendacje dla Ciebie

### Zacznij od tego (gwarantowane działanie):
```bash
# 1. Uruchom LocalAI
docker run -ti --name local-ai -p 8080:8080 localai/localai:latest

# 2. Załaduj model startowy — Llama 3.2 1B (błyskawiczny)
local-ai run llama-3.2-1b-instruct:q4_k_m

# 3. Testuj API
curl http://localhost:8080/v1/chat/completions -d '{
  "model": "llama-3.2-1b-instruct",
  "messages": [{"role": "user", "content": "Cześć! Opowiedz coś o sobie."}]
}'
```

### Potem przejdź na:
- **Do codziennego czatu:** `mistral-7b-instruct-v0.3:q4_k_m`
- **Do kodowania:** `phi-4-mini-instruct:q4_k_m` lub `deepseek-coder-6.7b-instruct:q4_k_m`
- **Do analizy dokumentów:** `qwen2.5-7b-instruct:q4_k_m`
- **Do szybkich odpowiedzi:** `gemma-3-4b-it:q4_k_m`

---

## 📊 Ostateczny werdykt

| Aspekt | Ocena |
|---|---|
| **Czy zadziała?** | ✅ **Tak — jak najbardziej** |
| **Jakość odpowiedzi?** | ✅ **Bardzo dobra** (Mistral 7B, Phi-4, Qwen 2.5 są zaskakująco dobre) |
| **Szybkość?** | ⚡ **Używalna** (10-25 tok/s) |
| **Ile modeli zmieści się?** | **1-2 modele** jednocześnie (np. 1x 7B + 1x embeddingi) |
| **Generowanie obrazów?** | ⚠️ **Możliwe, ale bardzo wolne** |
| **Czy warto?** | **👍 Zdecydowanie tak** — szczególnie dla prywatności i uniknięcia opłat za API |

**LocalAI na PC z 16GB RAM i bez GPU to świetny wybór do:** codziennych rozmów z AI, pomocy w kodowaniu, analizy tekstu, embeddignów, transkrypcji audio — **wszystko lokalnie, za darmo i prywatnie.** 🚀

---
*Auto-generated by Nova AI*
