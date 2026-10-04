# StudyMate Offline: 2–3 Minute Demo Video Script & Screenshot Guide

This document provides a turnkey production plan for recording the submission demo video and capturing presentation-ready screenshots for StudyMate Offline for hackathon judging (Devpost, GitHub, and slide decks).

---

## 🎬 2.5-Minute Demo Video Recording Script

* **Total Target Duration:** 2 minutes 30 seconds (150 seconds)
* **Format:** Screen capture with voiceover narration (1080p, 60fps or 30fps)
* **Tone:** Professional, clear, confident, student-centric
* **Visual Setup:** 
  * Browser: Chrome or Edge maximized at 1920x1080, zoom at 100% or 110%.
  * Terminal: PowerShell / Terminal split or docked showing local `ollama` activity (optional picture-in-picture or quick cut).
  * DevTools / Airplane Mode: Toggle Wi-Fi off at the start or during the wrap-up to physically prove offline execution.

---

### Segment 1: The Problem & The Offline Solution (0:00 – 0:30)

| Timestamp | Screen Action | Voiceover Narration | Visual Focus |
|---|---|---|---|
| **0:00 – 0:10** | Start on the StudyMate Offline homepage (`http://localhost:3000`). Mouse hovers over the glowing **"100% Offline"** badge in the top navigation bar. | *"Meet StudyMate Offline—a privacy-first, locally runnable AI study companion designed for students who need deep focus without cloud surveillance, subscription fees, or internet dependency."* | Top navbar, brand logo, and the pulsing green "100% Offline" indicator. |
| **0:10 – 0:25** | Gently scroll past the hero section displaying the feature cards: Document Library, Semantic Search, Grounded AI Tutor, Study Planner, and Quiz Generator. | *"Most AI study tools upload private course notes, research papers, and assignments to third-party cloud servers. They break down the moment you lose Wi-Fi in a library basement or on a flight, and they hallucinate answers with zero accountability."* | Clean modern dark UI with purple/emerald ambient glow. |
| **0:25 – 0:30** | Click on the **"Document Library"** tab in the main navigation. | *"StudyMate changes that. Everything runs locally on your machine—from embedding generation to language model reasoning."* | Page transition into Document Library. |

---

### Segment 2: Document Ingestion & Transparent Semantic Search (0:30 – 1:05)

| Timestamp | Screen Action | Voiceover Narration | Visual Focus |
|---|---|---|---|
| **0:30 – 0:45** | Show the uploaded documents list (e.g., `Biology Lecture Notes` or `Physics Notes`). Drag-and-drop or select a file to demonstrate instant ingestion, chunking, and vector embedding. | *"In the Document Library, students upload their lecture notes in PDF or text format. StudyMate extracts the text, slices it into semantic overlapping chunks, and generates 768-dimensional vector embeddings using a local Nomic Embed model."* | Document card showing filename, file size, chunk count, and green "Indexed" badge. |
| **0:45 – 1:05** | Switch to the **"Search & Excerpts"** tab. Type a conceptual query into the search bar: *"Where do light reactions take place in chloroplasts?"* and press Enter. | *"Under Search & Excerpts, we don't do simple keyword matching. We run local cosine vector similarity search directly inside SQLite. Notice how each result displays the exact document name, page number, and similarity score, giving students instant clarity on where facts originate."* | Search result card highlighting `Page 1`, `Chunk #0`, and `Similarity Score 0.80+` with passage preview. |

---

### Segment 3: Grounded AI Tutor & Citation Transparency (1:05 – 1:45)

| Timestamp | Screen Action | Voiceover Narration | Visual Focus |
|---|---|---|---|
| **1:05 – 1:20** | Navigate to the **"AI Tutor"** tab. Select the document from the dropdown. Toggle the explanation mode between **"Standard"**, **"Concise"**, and **"Simple Analogies"** (leave on "Concise"). | *"Now let's open the AI Tutor. Students can configure explanation depth—Standard, Concise, or Simple Analogies for conceptual hurdles. Let's ask: 'Where do light reactions take place and what do they produce?'"* | Mode selector pills and clean chat window. |
| **1:20 – 1:35** | Click Send. Show the loading pulse, followed by the grounded answer appearing with `[Source 1]` inline citation. Click the `[Source 1]` badge to open the source excerpt drawer. | *"The local Llama 3.2 model synthesizes the answer using only retrieved context. Notice the `[Source 1]` citation tag. Clicking it reveals the exact extracted passage. No hallucinations, no generic internet noise—every sentence is grounded in course materials."* | Grounded answer with highlighted citation badge and source drawer slide-out. |
| **1:35 – 1:45** | Type an unsupported out-of-domain question: *"What is the recipe for chocolate cake?"* or *"Who won the 1994 World Cup?"* and hit Send. | *"What happens if a student asks something not in the notes? StudyMate refuses honestly with strict anti-hallucination guardrails instead of fabricating false information."* | Honest refusal badge (`insufficientEvidence: true`) stating notes do not contain evidence. |

---

### Segment 4: Adaptive Study Planner & AI Quiz Engine (1:45 – 2:15)

| Timestamp | Screen Action | Voiceover Narration | Visual Focus |
|---|---|---|---|
| **1:45 – 2:00** | Click on the **"Study Planner"** tab. Show an exam date 5 days away, daily study time set to 2 hours, and key topics selected. Click **"Generate Study Plan"**. | *"Next is the Study Planner. Students input their target exam date, daily available hours, and challenging topics. StudyMate generates a structured, day-by-day revision schedule with spaced sessions and prioritized focus areas."* | Timeline card grid with session breakdown, duration, and completion checkboxes. |
| **2:00 – 2:15** | Click on the **"Quiz Generator"** tab. Select the document, choose 2 questions, and click **"Generate Quiz"**. Select an answer and submit. | *"To test mastery before the exam, the Quiz Generator produces grounded multiple-choice questions with 4 options each, immediate grading, and detailed explanations."* | Multiple-choice question card, option selection, instant green correct feedback, and score counter. |

---

### Segment 5: Verification of Complete Offline Privacy & Wrap-up (2:15 – 2:30)

| Timestamp | Screen Action | Voiceover Narration | Visual Focus |
|---|---|---|---|
| **2:15 – 2:25** | (Optional) Show Windows Wi-Fi toggled to **"Disconnected"** in the taskbar or show terminal running with loopback `127.0.0.1:11434`. Navigate across tabs seamlessly. | *"Notice that our Wi-Fi is completely disabled. Every single model parameter, embedding vector, and database query is running 100% locally on this standard laptop CPU without a single cloud API key or network request."* | Wi-Fi disconnected icon, active browser tabs, zero network errors. |
| **2:25 – 2:30** | Return to the home screen showing the header and GitHub link. | *"StudyMate Offline: Private, reliable, open-source AI education that belongs to the student. Thank you."* | StudyMate logo, tagline, and GitHub repository callout. |

---

## 📸 Presentation Screenshots Guide

Capture the following 8 screenshots in PNG format (1920x1080 resolution, dark mode) to include in your Devpost submission gallery, GitHub `README.md`, or presentation slide deck:

### Screenshot 1: Overview & Ambient Dashboard
* **Route:** `http://localhost:3000` (Home / Dashboard)
* **What to Show:** The main hero banner, navigation bar, top-right pulsing **"100% Offline"** badge, and quick feature navigation cards.
* **Highlight Annotation:** Green outline around the **"100% Offline • Local Ollama Connected"** indicator.
* **Submission Role:** Primary project cover image and Devpost header.

### Screenshot 2: Document Ingestion & Chunk Indexing
* **Route:** `http://localhost:3000/documents`
* **What to Show:** The Document Library view showing uploaded PDF and TXT lecture notes. The cards show filename, page count, extracted chunk count, character count, and an **"Indexed (768d)"** status pill.
* **Highlight Annotation:** Arrow pointing to chunk count and 768-dimensional vector badge.
* **Submission Role:** Demonstrates robust local document parsing and preprocessing.

### Screenshot 3: Local Semantic Search & Cosine Scoring
* **Route:** `http://localhost:3000/search`
* **What to Show:** A completed search for a conceptual term (e.g., *"thylakoid light reactions"*). The result card prominently displays:
  * Document name
  * Page number
  * Chunk index
  * Cosine similarity score (e.g., `0.8003`)
  * Highlighted text passage
* **Highlight Annotation:** Highlight box around the **Similarity Score** and **Page Reference**.
* **Submission Role:** Proves retrieval-augmented generation (RAG) transparency and accuracy.

### Screenshot 4: Grounded AI Tutor with Inline Source Citations
* **Route:** `http://localhost:3000/chat`
* **What to Show:** An active chat dialogue where the student asked a specific question and the AI Tutor returned a concise, accurate answer containing clickable `[Source 1]` citations.
* **Highlight Annotation:** Zoom box on the citation tag and the document name tag at the bottom of the message.
* **Submission Role:** Core feature showcase proving zero hallucination and source attribution.

### Screenshot 5: Source Excerpt Inspector / Drawer
* **Route:** `http://localhost:3000/chat` (with Source drawer opened)
* **What to Show:** The slide-out source drawer displaying the exact raw passage from the student's lecture notes that provided the factual foundation for the answer.
* **Highlight Annotation:** Side-by-side view showing the AI response on the left and the source evidence on the right.
* **Submission Role:** Demonstrates explainability and academic integrity.

### Screenshot 6: Honest Refusal on Unsupported Questions
* **Route:** `http://localhost:3000/chat`
* **What to Show:** A question asking for out-of-scope information (e.g., *"What is quantum entanglement?"* asked against biology notes). The AI Tutor displays a amber/red shield badge stating: *"I cannot answer this question because the selected document does not contain enough evidence."*
* **Highlight Annotation:** Highlight box around the honest refusal message and `0 Sources Used` indicator.
* **Submission Role:** Proves anti-hallucination guardrails and reliable student safety.

### Screenshot 7: Personalized Study Planner
* **Route:** `http://localhost:3000/planner`
* **What to Show:** The generated study schedule timeline. Daily sessions broken down by date, topic priority, duration in minutes, difficulty badges, and interactive session completion checkboxes.
* **Highlight Annotation:** Focus on the chronological schedule cards and total planned study hours counter.
* **Submission Role:** Showcases personalized learning workflows.

### Screenshot 8: Interactive Practice Quiz with Instant Grading
* **Route:** `http://localhost:3000/quizzes`
* **What to Show:** A generated multiple-choice question with 4 distinct options, an option selected, green positive feedback indicating correct answer, and an explanatory rationale citing the lecture note context.
* **Highlight Annotation:** Green banner showing score calculation and rationale card.
* **Submission Role:** Demonstrates active recall and self-assessment features.

---

## 💡 Tips for Recording the Video

1. **Audio Quality:** Use a decent USB microphone or headset. Record in a quiet room with minimal echo.
2. **Cursor Visibility:** Enable mouse click halos or smooth cursor animations (available in OBS, Loom, or Screenflow) so judges can follow actions easily.
3. **Pacing:** Keep a brisk, engaging pace. Do not pause silently during model inference—either edit out 10-second CPU generation pauses with a quick fade or speed up the inference clip by 2x.
4. **Resolution:** 1920x1080 (16:9 widescreen). Ensure fonts in the web application are crisp and legible.
