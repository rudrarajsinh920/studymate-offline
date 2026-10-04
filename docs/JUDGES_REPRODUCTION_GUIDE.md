# StudyMate Offline: Evaluator & Judge Reproduction Guide

This guide provides concise, verified instructions for hackathon judges and evaluators to reproduce, run, and audit **StudyMate Offline** locally from source.

---

## ⏱️ Quick Reproduction Summary (Under 5 Minutes)

| Step | Command | Description |
|---|---|---|
| **1. Verify Prerequisites** | `node -v` & `ollama list` | Requires Node 18+ and local Ollama models. |
| **2. Install Dependencies** | `npm install` | Installs root, client, server, and shared workspaces. |
| **3. Configure Environment** | `Copy-Item server/.env.example server/.env` | Sets default local ports and Ollama endpoints. |
| **4. Start Services** | `npm run dev:server` & `npm run dev:client` | Launches backend (:5000) and frontend (:3000). |
| **5. Automated Verification** | `npm run audit` | Runs the 10-point automated end-to-end verification. |
| **6. Open UI** | Open `http://localhost:3000` | Interact with the live application in your browser. |

---

## 📋 System Prerequisites

1. **Operating System:** Windows 10/11, macOS (Intel or Apple Silicon), or Linux (Ubuntu 20.04+).
2. **Node.js:** v18.0.0 or higher (`node -v`).
3. **npm:** v9.0.0 or higher (`npm -v`).
4. **Ollama:** Installed from [ollama.com](https://ollama.com). Ensure the Ollama daemon is active:
   ```bash
   ollama serve
   ```
5. **Required Local AI Models:**
   ```bash
   ollama pull llama3.2:3b
   ollama pull nomic-embed-text
   ```
   *Verify with `ollama list`:* Both `llama3.2:3b` (~2.0 GB) and `nomic-embed-text:latest` (~274 MB) must be present.

---

## 🛠️ Step-by-Step Local Startup Instructions

### 1. Clone & Install
```bash
git clone https://github.com/YOUR_USERNAME/studymate-offline.git
cd studymate-offline
npm install
```

### 2. Configure Environment
A template file is provided with pre-tuned CPU-safe generation limits and timeouts:
```bash
# Windows PowerShell
Copy-Item server/.env.example server/.env

# Linux / macOS
cp server/.env.example server/.env
```

*Pre-configured parameters in `server/.env`:*
```env
PORT=5000
NODE_ENV=development
DATABASE_PATH=./data/studymate.db
UPLOAD_DIR=./uploads
MAX_FILE_SIZE_MB=25

OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_LLM_MODEL=llama3.2:3b
OLLAMA_EMBED_MODEL=nomic-embed-text
OLLAMA_TIMEOUT_MS=300000
OLLAMA_MAX_TOKENS=512
```

### 3. Launch Development Servers

Start the backend and frontend in separate terminals:

**Terminal 1 (Backend API):**
```bash
npm run dev:server
```
*Expected log:* `StudyMate Offline Server running on Port: 5000`, `Health API: http://localhost:5000/api/health`.

**Terminal 2 (Frontend Client):**
```bash
npm run dev:client
```
*Expected log:* `VITE ready in ~300ms`, `Local: http://localhost:3000/`.

---

## 🧪 Automated Verification Audit (Zero-Effort Verification)

To immediately verify that all 10 core application workflows are healthy without manually clicking through every screen, run the built-in audit script from the repository root:

```bash
npm run audit
```

This runs `scripts/audit_workflows.cjs`, executing actual HTTP calls against the live local backend and Ollama daemon.

### Expected Audit Output:
```
================================================================
       STUDYMATE OFFLINE: FINAL SUBMISSION-READINESS AUDIT
================================================================

[PASS] Workflow 1: Application starts successfully
  Result:   Backend online on :5000 (Ollama connected, models: llama3.2:3b, nomic-embed-text:latest). Frontend online on :3000.

[PASS] Workflow 2: Document upload and text extraction work
  Result:   Uploaded 'audit_biology_notes.txt'. Extracted 421 chars into 1 chunk(s). Embeddings generated: 1.

[PASS] Workflow 3: Semantic search retrieves relevant excerpts from selected document
  Result:   Retrieved 1 relevant excerpt(s) with similarity score 0.8003. Passage contains: "Photosynthesis in Higher Plants..."

[PASS] Workflow 4: Search results display correct document names, page numbers, and similarity scores
  Result:   Metadata verified: documentName="audit_biology_notes.txt", pageNumber=1, chunkIndex=0, score=0.8003.

[PASS] Workflow 5: AI Tutor answers questions using retrieved document context
  Result:   Answer generated: "Light reactions take place in the thylakoid membranes... [Source 1]" using 1 source excerpt(s).

[PASS] Workflow 6: AI responses show source citations and handle unsupported questions honestly
  Result:   Supported questions contain verified [Source N] tags; unsupported query returned honest refusal with insufficientEvidence=true.

[PASS] Workflow 7: Planner and quiz generation work with the configured Ollama model
  Result:   Study plan created (12 sessions). Quiz created (2 MCQs with 4 options each, source document linked).

[PASS] Workflow 8: Timeout errors are handled gracefully without crashing the app
  Result:   AbortController cleanly throws LlmServiceError('TIMEOUT') at timeout threshold. Express server remains 100% healthy. Production timeout configured at 300s.

[PASS] Workflow 9: Offline operation works after the required local models are available
  Result:   All network communication is strictly internal loopback (127.0.0.1:11434). No cloud endpoints or external APIs required.

[PASS] Workflow 10: No API keys, credentials, or .env secrets are exposed
  Result:   .gitignore properly excludes .env, *.db, and uploads/. .env.example contains zero credentials/keys. Clean Git repository.

================================================================
TOTAL: 10 / 10 WORKFLOWS PASSED.
================================================================
```

---

## 🖱️ Manual Evaluation & Walkthrough Checklist

If you prefer testing via the web interface at `http://localhost:3000`:

1. **Status Indicator Verification:**
   * Look at the top navigation bar. Confirm the green glowing indicator reads: **"100% Offline • Local Ollama Connected"**.
2. **Document Ingestion Test:**
   * Go to **Document Library**.
   * Upload any `.txt` or `.pdf` file (or use an existing pre-loaded document).
   * Confirm the card reflects chunk count and status **"Indexed"**.
3. **Semantic Search Test:**
   * Go to **Search & Excerpts**.
   * Enter a conceptual query (e.g., *"What are thylakoid membranes?"*).
   * Confirm the returned card displays **Document Name**, **Page Number**, **Chunk Index**, and **Similarity Score** (0.00 – 1.00).
4. **AI Tutor & Grounding Test:**
   * Go to **AI Tutor**.
   * Select your document from the dropdown.
   * Ask a question present in the document. Verify the answer includes clickable **`[Source 1]`** tags.
   * Ask an out-of-domain question (e.g., *"What is the capital of France?"*). Verify the tutor **refuses honestly** stating the document lacks evidence.
5. **Study Planner Test:**
   * Go to **Study Planner**.
   * Enter an upcoming exam date and available hours. Click **Generate Study Plan**.
   * Confirm a day-by-day revision schedule appears with session durations and checkboxes.
6. **Quiz Generator Test:**
   * Go to **Quiz Generator**.
   * Click **Generate Quiz** (2 or 3 questions).
   * Answer questions and verify instant grading, score tally, and contextual rationales.
7. **Offline Isolation Verification:**
   * Disconnect your computer from Wi-Fi or unplug the Ethernet cable.
   * Perform searches, ask tutor questions, and generate quizzes.
   * Confirm that 100% of application features function without disruption.

---

## 🔧 Evaluator Troubleshooting Guide

| Issue | Cause | Fix |
|---|---|---|
| **"Ollama offline" status badge** | Ollama service is not running or blocked on port 11434. | Open a terminal and run `ollama serve`. Refresh the web page. |
| **"Model not found" error** | Missing `llama3.2:3b` or `nomic-embed-text`. | Run `ollama pull llama3.2:3b` and `ollama pull nomic-embed-text`. |
| **Inference takes ~30–45s on laptop** | Normal CPU-only inference behavior on machines without dedicated GPU. | Normal for 3B parameter models on consumer CPUs. The backend has a generous 300s timeout (`OLLAMA_TIMEOUT_MS=300000`) and concise token budgets (`256–512` tokens) to prevent aborts. |
| **Port 5000 or 3000 already in use** | An existing node process is bound to the port. | Terminate the occupying process or adjust `PORT` in `server/.env` and `client/vite.config.ts`. |
| **Clean Database Reset** | Need a fresh test database. | Delete `server/data/studymate.db`. The application will recreate fresh tables and schemas on next launch. |
