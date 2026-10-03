# StudyMate Offline 🎓

> **A privacy-focused, locally runnable AI study companion for students.**  
> Ask questions, generate practice quizzes, and plan study sessions backed by local LLMs (Ollama) and retrieval-augmented generation (RAG) — **100% offline, zero cloud data transmission.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61dafb.svg)](https://react.dev/)
[![Ollama](https://img.shields.io/badge/Ollama-Local%20AI-black.svg)](https://ollama.com/)
[![SQLite](https://img.shields.io/badge/SQLite-WAL%20Mode-003B57.svg)](https://www.sqlite.org/)
[![Hacktoberfest](https://img.shields.io/badge/Hacktoberfest-2026-orange.svg)](https://hacktoberfest.com/)

---

## 🌟 Key Features

* 🔒 **100% Offline & Private:** All embeddings, retrieval, and model reasoning run entirely on your local machine using Ollama. No tracking, no cloud telemetry, no API fees.
* 📄 **Document Ingestion & Chunking:** Upload PDF and TXT lecture notes. Text is extracted, partitioned into overlapping semantic chunks, and stored with page numbers and character offsets.
* 🔍 **Local Semantic Retrieval:** Vector embeddings are generated via `nomic-embed-text` (768 dimensions) and indexed directly in SQLite with high-precision cosine similarity search.
* 🤖 **Grounded AI Tutor with Citations:** Strict hallucination guardrails. The AI tutor only answers using your notes and appends traceable source tags (e.g., `[Source 1]`) linking back to document names, page numbers, and exact text passages.
* 📝 **Practice Quiz Generator:** Automatically produces grounded multiple-choice questions (MCQs) testing core course concepts, with instant grading, score history, and question explanations.
* 📅 **Personalized Study Planner:** Generates realistic, difficulty-weighted daily study schedules that strictly adhere to your daily available study hours and target exam dates.
* ⚡ **Laptop-CPU Optimized:** Tailored context budgeting and configurable inference timeouts (`OLLAMA_TIMEOUT_MS`) prevent timeouts even on standard laptops without dedicated GPUs.

---

## 🛠️ Architecture & Tech Stack

```
   ┌─────────────────────────────────────────────────────────────┐
   │                     React 18 + Vite UI                      │
   │      (Tailwind CSS, Lucide Icons, TypeScript, Port 3000)     │
   └──────────────────────────────┬──────────────────────────────┘
                                  │ Proxy (/api)
   ┌──────────────────────────────▼──────────────────────────────┐
   │                  Express + TypeScript API                   │
   │                        (Port 5000)                          │
   ├──────────────────────────────┬──────────────────────────────┤
   │    Modular Services:         │    Repositories & SQLite:    │
   │    • Document Ingestion      │    • Better-SQLite3 (WAL)    │
   │    • Vector Cosine Search    │    • documents & chunks      │
   │    • Grounded AI Tutor       │    • chat_sessions & history │
   │    • Quiz MCQ Generator      │    • study_plans & sessions  │
   │    • Study Planner Logic     │    • quizzes & attempts      │
   └──────────────────────────────┬──────────────────────────────┘
                                  │ HTTP API (Port 11434)
   ┌──────────────────────────────▼──────────────────────────────┐
   │                        Ollama Engine                        │
   │   • nomic-embed-text (Embeddings, 768 dims, ~274 MB)        │
   │   • llama3.2:3b      (Language Model, 4-bit, ~2.0 GB)       │
   └─────────────────────────────────────────────────────────────┘
```

* **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Lucide React
* **Backend:** Node.js, Express, TypeScript, Better-SQLite3, Multer, pdf-parse
* **Storage:** SQLite (WAL mode, foreign keys, local blob vector storage)
* **Local AI:** Ollama (`llama3.2:3b` for LLM reasoning, `nomic-embed-text` for vector embeddings)
* **Monorepo:** npm workspaces (`server`, `client`, `shared`)

---

## 📋 Prerequisites

1. **Node.js**: v18.0.0 or higher (Tested on Node v20 & v24).
2. **npm**: v9.0.0 or higher.
3. **Ollama**: Installed from [ollama.com](https://ollama.com).

---

## 🚀 Quickstart Guide

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/YOUR_USERNAME/studymate-offline.git
cd studymate-offline
npm install
```

### 2. Pull Local AI Models

Ensure Ollama is running (`ollama serve`), then download the required models:

```bash
# Pull lightweight LLM for Q&A, Quizzes, and Planner (~2.0 GB)
ollama pull llama3.2:3b

# Pull high-performance embedding model (~274 MB)
ollama pull nomic-embed-text
```

### 3. Environment Configuration

Copy the example configuration to `.env` in the `server` directory:

```bash
# On Windows PowerShell:
Copy-Item server/.env.example server/.env

# On Linux/macOS:
cp server/.env.example server/.env
```

Default settings in `server/.env`:
```env
PORT=5000
NODE_ENV=development
DATABASE_PATH=./data/studymate.db
UPLOAD_DIR=./uploads
MAX_FILE_SIZE_MB=25

# Ollama Local AI Configuration
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_LLM_MODEL=llama3.2:3b
OLLAMA_EMBED_MODEL=nomic-embed-text
OLLAMA_TIMEOUT_MS=300000
OLLAMA_MAX_TOKENS=512
```

### 4. Run Development Servers

Start both the backend server and frontend client:

```bash
# Terminal 1: Run Backend API Server (Port 5000)
npm run dev:server

# Terminal 2: Run Frontend Vite Client (Port 3000)
npm run dev:client
```

Open your browser at **[http://localhost:3000](http://localhost:3000)**.

---

## 🧪 Testing

Run the automated test suites covering SQLite schema, document parsing, retrieval, grounded Q&A, citations, study planning, and quiz scoring:

```bash
# Run full automated test suite
npm test

# Or run individual milestone verification scripts
node test-milestone4.cjs  # Grounded Tutor & Citations
node test-milestone5.cjs  # Study Planner & Quiz Engine
```

To run TypeScript type checks and production builds:

```bash
npm run build
```

---

## 🤝 Contributing & Hacktoberfest

Contributions are welcome! StudyMate Offline is open to community improvements during Hacktoberfest and beyond.

### Ideas for Contributions
* 🎴 **Flashcard Deck Generator:** Convert notes or quiz questions into interactive flashcards.
* 📦 **Anki Export:** Export generated quizzes and flashcards to `.apkg` format.
* 📊 **Enhanced Analytics:** Study heatmaps, mastery tracking, and revision streaks.
* 🎙️ **Voice / Audio Notes:** Offline whisper transcription for lecture audio recordings.
* 🔍 **Hybrid Search:** Combine BM25 keyword matching with dense cosine embeddings.

### How to Contribute
1. Fork the repository.
2. Create your feature branch (`git checkout -b feature/awesome-feature`).
3. Commit your changes (`git commit -m 'Add awesome feature'`).
4. Push to the branch (`git push origin feature/awesome-feature`).
5. Open a Pull Request.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
