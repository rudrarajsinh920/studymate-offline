# StudyMate Offline 🎓

> **A privacy-first, locally runnable AI study companion for students.**  
> Grounded document Q&A with source citations, semantic vector search, practice quiz generation, and adaptive study planning powered entirely by local open-source models (Ollama).  
> **100% offline. Zero cloud data transmission. Zero subscription fees.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61dafb.svg)](https://react.dev/)
[![Ollama](https://img.shields.io/badge/Ollama-Local%20AI-black.svg)](https://ollama.com/)
[![SQLite](https://img.shields.io/badge/SQLite-WAL%20Mode-003B57.svg)](https://www.sqlite.org/)
[![Hacktoberfest](https://img.shields.io/badge/Hacktoberfest-2026-orange.svg)](https://hacktoberfest.com/)
[![Audit](https://img.shields.io/badge/Audit-10%2F10%20Pass-emerald.svg)](scripts/audit_workflows.cjs)

---

## 📑 Table of Contents

1. [Project Overview](#-project-overview)
2. [The Problem: Why Cloud AI Fails Students](#-the-problem-why-cloud-ai-fails-students)
3. [Why Local Open-Source AI Matters](#-why-local-open-source-ai-matters)
4. [Key Features](#-key-features)
5. [System Architecture & Data Flow](#-system-architecture--data-flow)
6. [Technology Stack](#-technology-stack)
7. [Prerequisites & Hardware Guidance](#-prerequisites--hardware-guidance)
8. [Installation & Local Startup Commands](#-installation--local-startup-commands)
9. [Automated Verification & Testing](#-automated-verification--testing)
10. [Troubleshooting Guide](#-troubleshooting-guide)
11. [Deployment Feasibility Assessment](#-deployment-feasibility-assessment)
12. [Hackathon Judging & Demonstration Resources](#-hackathon-judging--demonstration-resources)
13. [Contributing & Open Source Roadmap](#-contributing--open-source-roadmap)
14. [License](#-license)

---

## 📖 Project Overview

**StudyMate Offline** is a personal, fully private AI study platform engineered for students, researchers, and self-learners. Instead of sending sensitive academic notes, proprietary textbooks, and personal assignments to remote third-party cloud APIs, StudyMate executes every stage of the AI pipeline locally:

* **Document Parsing & Text Extraction:** Ingests PDF and TXT lecture materials.
* **Vector Embeddings:** Computes high-density 768-dimensional embeddings on-device via `nomic-embed-text`.
* **Semantic Vector Search:** Indexes chunks in local SQLite and performs cosine similarity search.
* **Grounded AI Tutor:** Generates answers via `llama3.2:3b` restricted strictly to retrieved document excerpts, appending verifiable citations (`[Source 1]`) and refusing unsupported questions honestly.
* **Study Planning & Quiz Generation:** Synthesizes structured revision schedules and multi-choice practice exams with immediate scoring and contextual rationales.

---

## 🚨 The Problem: Why Cloud AI Fails Students

Modern students face major structural hurdles when using conventional cloud-based AI tools:

1. **Privacy Violations & Academic Surveillance:** Commercial LLM providers frequently train models on uploaded files, scrape proprietary research, or retain student data indefinitely. Students uploading unpublished thesis drafts or proprietary courseware risk severe academic and intellectual property breaches.
2. **The "Wi-Fi Cliff" & Inequity:** Cloud study tools fail completely when internet access is unavailable—during campus Wi-Fi outages, on long commutes, during flights, or in rural areas with poor connectivity.
3. **Hallucinations & Academic Misinformation:** Generic cloud chatbots generate confident-sounding but completely fabricated formulas, dates, and historical citations. Students have no easy way to verify whether an answer came from their course syllabus or model fantasy.
4. **Subscription Paywalls:** Commercial AI subscriptions cost \$20–\$40/month—an unsustainable cost burden for many students across the globe.

---

## 🛡️ Why Local Open-Source AI Matters

StudyMate Offline is built on four core principles of open-source local AI:

* **1. Absolute Privacy & Data Sovereignty:**  
  Your lecture notes, research drafts, and quiz scores never leave your hard drive. No trackers, no remote telemetries, no cloud logging, and zero exposure to data breaches.
* **2. True Offline Autonomy:**  
  Once models are downloaded locally, StudyMate works 100% offline. Whether you are studying in a basement library, off-grid during travel, or experiencing network drops, your tutor is always instant and reliable.
* **3. Verifiable Academic Grounding:**  
  StudyMate enforces strict RAG (Retrieval-Augmented Generation) guardrails. If a fact cannot be proven from your uploaded notes, the AI tutor explicitly states that the document does not contain enough evidence, eliminating hallucinated misinformation.
* **4. Democratized, Zero-Cost Longevity:**  
  By utilizing efficient quantized open-source models (`llama3.2:3b` at 4-bit quantization and `nomic-embed-text`), students achieve near-cloud reasoning capabilities on consumer-grade laptops without API keys or ongoing subscription fees.

---

## 🌟 Key Features

| Feature | Description |
|---|---|
| 📄 **Document Ingestion & Chunking** | Upload PDF and TXT documents. Text is extracted, parsed into semantic overlapping chunks (500–1000 chars with 100–150 char overlap), and stored with exact page numbers and character offsets. |
| 🔍 **Local Semantic Search** | Direct vector similarity search utilizing 768-dimensional embeddings generated by local `nomic-embed-text`. Results present similarity scores, document names, page numbers, and chunk previews. |
| 🤖 **Grounded AI Tutor** | Ask conceptual questions against specific documents. Responses provide inline `[Source N]` tags that link directly to extracted chunks. Unsupported queries trigger honest refusals (`insufficientEvidence: true`). |
| ⚙️ **Configurable Explanation Modes** | Tailor AI explanations to your learning style: **Standard** (balanced conceptual breakdown), **Concise** (rapid revision summaries), or **Simple Analogies** (intuitive real-world metaphors). |
| 📝 **Practice Quiz Engine** | Automatically generates 4-option multiple-choice questions (MCQs) grounded in your course materials, complete with real-time scoring, question explanations, and attempt history tracking. |
| 📅 **Adaptive Study Planner** | Generates prioritized day-by-day revision timetables based on your upcoming exam dates, daily available study hours, and difficult topics. Features interactive session progress tracking. |
| ⚡ **Laptop-CPU Optimization** | Built-in context budgeting (top-3 excerpt filtering, adaptive generation token limits: 256–512) and a 300-second abort guardrail allow smooth execution on standard laptops without discrete GPUs. |

---

## 🛠️ System Architecture & Data Flow

```
                      STUDYMATE OFFLINE ARCHITECTURE
                      
    ┌─────────────────────────────────────────────────────────────┐
    │                     React 18 + Vite UI                      │
    │        (Tailwind CSS, Lucide Icons, TypeScript, :3000)      │
    │   • Document Library  • Semantic Search  • Grounded Tutor   │
    │   • Study Planner     • Quiz Generator   • Offline Badge    │
    └──────────────────────────────┬──────────────────────────────┘
                                   │ Vite Proxy (/api)
    ┌──────────────────────────────▼──────────────────────────────┐
    │                  Express + TypeScript API                   │
    │                        (Port 5000)                          │
    ├──────────────────────────────┬──────────────────────────────┤
    │    Application Services:     │    Storage & Repositories:   │
    │    • documentParser (pdf)    │    • Better-SQLite3 (WAL)    │
    │    • chunkingService         │    • documents & chunks      │
    │    • vectorRetrievalService  │    • vector blob cache (768d)│
    │    • tutorService (grounding)│    • chat_sessions & history │
    │    • plannerService (spaced) │    • study_plans & sessions  │
    │    • quizService (MCQ engine)│    • quizzes & attempts      │
    └──────────────────────────────┬──────────────────────────────┘
                                   │ Internal HTTP (127.0.0.1:11434)
    ┌──────────────────────────────▼──────────────────────────────┐
    │                 Local Ollama AI Daemon                      │
    │   • nomic-embed-text (Embeddings: 768 dimensions, ~274 MB)  │
    │   • llama3.2:3b      (Reasoning & Generation, ~2.0 GB)      │
    └─────────────────────────────────────────────────────────────┘
```

### Retrieval & Grounding Workflow
1. **User Query:** Student submits a question in the AI Tutor interface.
2. **Local Embedding:** The query is transformed into a 768-dimensional vector via `POST http://127.0.0.1:11434/api/embeddings`.
3. **Cosine Ranking:** SQLite executes in-memory cosine dot-product comparisons against stored chunk embeddings. The top-$k$ relevant excerpts are retrieved.
4. **Context Budgeting & Grounding:** A strict prompt template injects only retrieved excerpts and instructs the model: *"Answer strictly using only the provided context. If evidence is lacking, state that you cannot answer based on the notes."*
5. **Inference & Citation Extraction:** `llama3.2:3b` generates the grounded answer with verifiable source references.

---

## 💻 Technology Stack

* **Frontend:** React 18, TypeScript 5.7, Vite, Tailwind CSS, Lucide React
* **Backend:** Node.js (v18–v24), Express, TypeScript, Better-SQLite3, Multer, `pdf-parse`
* **Local AI Inference:** [Ollama](https://ollama.com) running:
  * `llama3.2:3b` (Meta's lightweight instruction-tuned 3B LLM, 4-bit quantized)
  * `nomic-embed-text` (Nomic AI's 768-dimensional text embedding model)
* **Database:** SQLite3 in Write-Ahead Logging (WAL) mode with foreign keys and serialized BLOB vector storage
* **Architecture:** npm Workspaces Monorepo (`client`, `server`, `shared`)

---

## 📋 Prerequisites & Hardware Guidance

### Minimum Hardware (Tested on standard ultrabooks):
* **CPU:** Quad-Core x86_64 or Apple Silicon (M1/M2/M3/M4)
* **RAM:** 8 GB minimum (16 GB recommended for concurrent OS workflows)
* **Disk Space:** ~4 GB free disk space (Ollama models: ~2.3 GB total)
* **GPU:** None required! Fully optimized for CPU-only inference.

### Software Prerequisites:
1. **Node.js:** v18.0.0 or higher ([nodejs.org](https://nodejs.org))
2. **npm:** v9.0.0 or higher
3. **Ollama:** Installed from [ollama.com](https://ollama.com)

---

## 🚀 Installation & Local Startup Commands

### 1. Clone Repository & Install Dependencies
```bash
git clone https://github.com/YOUR_USERNAME/studymate-offline.git
cd studymate-offline
npm install
```

### 2. Download Required Local AI Models
Ensure Ollama is running (`ollama serve`), then pull the two lightweight models:
```bash
ollama pull llama3.2:3b
ollama pull nomic-embed-text
```
*Verify models exist:* `ollama list` should list both models.

### 3. Setup Configuration File
Copy the pre-configured `.env.example` template:
```bash
# Windows PowerShell
Copy-Item server/.env.example server/.env

# Linux / macOS
cp server/.env.example server/.env
```

*Pre-tuned parameters in `server/.env`:*
```env
PORT=5000
NODE_ENV=development
DATABASE_PATH=./data/studymate.db
UPLOAD_DIR=./uploads
MAX_FILE_SIZE_MB=25

# Ollama Local Configuration
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_LLM_MODEL=llama3.2:3b
OLLAMA_EMBED_MODEL=nomic-embed-text
OLLAMA_TIMEOUT_MS=300000
OLLAMA_MAX_TOKENS=512
```

### 4. Start the Application
Start the backend and frontend in separate terminals:

```bash
# Terminal 1: Start Backend API (Port 5000)
npm run dev:server

# Terminal 2: Start Frontend Client (Port 3000)
npm run dev:client
```

Open your browser to: **[http://localhost:3000](http://localhost:3000)**.

---

## 🧪 Automated Verification & Testing

StudyMate Offline includes end-to-end automated testing to verify system integrity:

### 1. Comprehensive 10-Workflow Audit Script
Run the automated end-to-end workflow verification:
```bash
npm run audit
```
This tests document upload, chunking, 768-d embedding generation, semantic retrieval, grounded Q&A, citation presence, honest refusals, study planner, quiz generator, timeout handling, offline verification, and git secret protection against live services.

### 2. Automated Integration Test Suite
```bash
npm test
```
Executes `test-milestone4.cjs` and `test-milestone5.cjs` covering SQLite schema integrity, vector retrieval, tutor grounding, and quiz scoring.

### 3. TypeScript Type Checks & Builds
```bash
npm run build
```

---

## 🔧 Troubleshooting Guide

| Issue | Root Cause | Solution |
|---|---|---|
| **Top bar shows "Ollama Offline"** | Ollama daemon is not running on port 11434. | Open terminal and execute `ollama serve`. Verify with `curl http://127.0.0.1:11434/api/tags`. |
| **"Model llama3.2:3b not found"** | Models have not been pulled yet. | Run `ollama pull llama3.2:3b` and `ollama pull nomic-embed-text`. |
| **Inference takes ~30–45s** | Model is running on consumer CPU without GPU acceleration. | Normal for 3B parameter models on CPU. The app's `OLLAMA_TIMEOUT_MS=300000` prevents aborts, and concise token budgeting keeps answers snappy. |
| **Port 5000 or 3000 conflict** | Port is bound by another service. | Kill existing processes or update `PORT` in `server/.env` and `client/vite.config.ts`. |
| **Reset Database** | Corrupted or unwanted test data. | Delete `server/data/studymate.db`. The application automatically regenerates fresh tables and schemas on reboot. |

---

## ⚖️ Deployment Feasibility Assessment

### ⚠️ Local-First Architectural Reality
> **No public cloud deployment is provided or claimed.**  
> StudyMate Offline is intentionally designed as an **edge / on-device application** rather than a multi-tenant SaaS website.

### Why a Public Web Deployment is Not Feasible for this Project:
1. **Ollama Local Daemon Dependency:** The application communicates directly with a local Ollama instance over internal loopback (`http://127.0.0.1:11434`). A public serverless host (e.g., Vercel, Netlify, or Render Free Tier) lacks GPU compute, persistent RAM, and the ~2.5 GB local model storage required to run Llama 3.2.
2. **Cloud Hosting Costs vs. Student Free Access:** Hosting continuous GPU compute instances on AWS (e.g., `g4dn.xlarge` or `g5.xlarge`) costs hundreds of dollars monthly. Running on-device is 100% free forever for students.
3. **Privacy Compromise:** Deploying to a public multi-tenant server would contradict the core value proposition: students would once again be uploading their private documents to a remote server.

### Realistic Institutional & Production Deployment Paths:
If universities or student organizations wish to deploy StudyMate at scale:
* **Option A: Containerized Self-Hosted Server (On-Premises):**  
  Deploy via Docker Compose with NVIDIA Container Toolkit on campus server hardware, allowing students in computer labs to connect locally over the university LAN.
* **Option B: Native Desktop Packaging (Recommended Consumer Path):**  
  Package the React frontend and Express backend using **Electron** or **Tauri**, bundling a portable Ollama binary installer to provide a one-click `.exe` / `.dmg` installer for students.

---

## 🎯 Hackathon Judging & Demonstration Resources

For evaluators and judges reviewing this submission:

* 📋 **[Judges Reproduction Guide](docs/JUDGES_REPRODUCTION_GUIDE.md):** 5-minute rapid reproduction instructions, expected audit outputs, and manual walkthrough checklists.
* 🎬 **[Demo Recording Script & Screenshots](docs/DEMO_SCRIPT.md):** 2.5-minute video presentation script with exact timestamped narration and a list of 8 essential screenshots to capture.

---

## 🤝 Contributing & Open Source Roadmap

StudyMate Offline is open source under the MIT License and warmly welcomes Hacktoberfest contributions!

### Planned Enhancements:
* 🎴 **Interactive Flashcard Generator:** Convert lecture chunks into spaced-repetition flashcards.
* 📦 **Anki (.apkg) Export:** One-click export for study decks into Anki and Quizlet.
* 🎙️ **Offline Lecture Transcription:** Local Whisper AI integration to transcribe recorded lecture audio directly into notes.
* 📊 **Study Analytics Dashboard:** Heatmaps, revision streaks, and mastery progress charts.
* 🔍 **Hybrid BM25 + Vector Search:** Combining lexical keyword matching with dense embeddings for high-precision retrieval of acronyms and formulas.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
