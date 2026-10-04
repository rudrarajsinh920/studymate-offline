const Database = require('better-sqlite3');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://localhost:5000/api';
const DB_PATH = path.resolve(__dirname, 'server/data/studymate.db');

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runMilestone4Tests() {
  console.log('=====================================================');
  console.log('  STARTING MILESTONE 4 AUTOMATED TEST SUITE');
  console.log('  Grounded AI Tutor with Source Citations');
  console.log('=====================================================\n');

  const results = {};
  let serverProcess = null;

  try {
    // ---------------------------------------------------------------
    // 1. SQLite Schema Inspection for Chat Sessions & Messages
    // ---------------------------------------------------------------
    console.log('Test 1: Inspecting SQLite schema for chat_sessions and chat_messages...');
    try {
      const { initDatabase } = require('./server/dist/db/database');
      initDatabase();

      const db = new Database(DB_PATH);
      const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table'`).all().map(t => t.name);
      const sessionCols = db.pragma('table_info(chat_sessions)').map(c => c.name);
      const messageCols = db.pragma('table_info(chat_messages)').map(c => c.name);
      const indices = db.prepare(`SELECT name FROM sqlite_master WHERE type='index'`).all().map(i => i.name);
      db.close();

      const hasSessions = tables.includes('chat_sessions');
      const hasMessages = tables.includes('chat_messages');
      const hasSessionCols = ['id', 'title', 'document_filter_ids', 'created_at', 'updated_at'].every(c => sessionCols.includes(c));
      const hasMessageCols = ['id', 'session_id', 'role', 'content', 'sources', 'insufficient_evidence', 'created_at'].every(c => messageCols.includes(c));
      const hasMessageIndex = indices.includes('idx_messages_session');

      console.log('  Tables present:', { hasSessions, hasMessages });
      console.log('  chat_sessions columns:', sessionCols);
      console.log('  chat_messages columns:', messageCols);
      console.log('  idx_messages_session index:', hasMessageIndex);

      if (hasSessions && hasMessages && hasSessionCols && hasMessageCols && hasMessageIndex) {
        results['1. SQLite Schema & Indices'] = 'PASS';
      } else {
        results['1. SQLite Schema & Indices'] = 'FAIL: Missing tables, columns, or indices';
      }
    } catch (err) {
      results['1. SQLite Schema & Indices'] = `FAIL: ${err.message}`;
    }

    // ---------------------------------------------------------------
    // 2. Start Express Backend Server for HTTP Endpoints
    // ---------------------------------------------------------------
    console.log('\nTest 2: Starting Express Backend Server...');
    serverProcess = spawn('node', ['server/dist/index.js'], {
      cwd: __dirname,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    serverProcess.stdout.on('data', (d) => {
      // console.log(`[server stdout]: ${d.toString().trim()}`);
    });
    serverProcess.stderr.on('data', (d) => {
      // console.error(`[server stderr]: ${d.toString().trim()}`);
    });

    // Wait for server to become responsive
    let serverReady = false;
    for (let i = 0; i < 30; i++) {
      await sleep(500);
      try {
        const res = await fetch(`${BASE_URL}/health`);
        if (res.ok) {
          const healthData = await res.json();
          console.log('  Server online on port 5000, status:', healthData.status);
          serverReady = true;
          break;
        }
      } catch (e) {
        // Retry
      }
    }

    if (serverReady) {
      results['2. Server Launch & Health'] = 'PASS';
    } else {
      throw new Error('Express server failed to start within 15 seconds.');
    }

    // ---------------------------------------------------------------
    // 3. Validation Test: Empty Question
    // ---------------------------------------------------------------
    console.log('\nTest 3: Testing empty question validation (POST /api/chat/ask)...');
    try {
      const res = await fetch(`${BASE_URL}/chat/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: '   ' }),
      });
      const data = await res.json();
      console.log('  Status with whitespace question:', res.status);
      console.log('  Response:', data);

      if (res.status === 400 && data.error && data.error.includes('empty')) {
        results['3. Empty Question Validation'] = 'PASS';
      } else {
        results['3. Empty Question Validation'] = `FAIL: Expected 400, got ${res.status}`;
      }
    } catch (err) {
      results['3. Empty Question Validation'] = `FAIL: ${err.message}`;
    }

    // ---------------------------------------------------------------
    // 4. Ollama Offline Graceful Degradation Test (HTTP Endpoint)
    // ---------------------------------------------------------------
    console.log('\nTest 4: Testing Ollama offline degradation on live HTTP API...');
    try {
      const res = await fetch(`${BASE_URL}/chat/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: 'Explain cellular respiration.' }),
      });
      const data = await res.json();
      console.log('  Status with offline Ollama:', res.status);
      console.log('  Code:', data.code);
      console.log('  Instructions:', data.instructions);

      const handledGracefully = 
        (res.status === 503 && data.code === 'OLLAMA_UNREACHABLE') ||
        (res.status === 200 && typeof data.answer === 'string');

      if (handledGracefully) {
        results['4. Ollama Offline Degradation'] = 'PASS';
      } else {
        results['4. Ollama Offline Degradation'] = `FAIL: Unexpected response (status=${res.status}, code=${data.code})`;
      }
    } catch (err) {
      results['4. Ollama Offline Degradation'] = `FAIL: ${err.message}`;
    }

    // ---------------------------------------------------------------
    // 5. Grounded Q&A with Replaceable AI Provider (Deterministic Verification)
    // ---------------------------------------------------------------
    console.log('\nTest 5: Testing Grounded Q&A, Citations & Source Attribution with Controlled Provider...');
    try {
      // Ingest test documents and embeddings directly into SQLite for deterministic testing
      const db = new Database(DB_PATH);
      const testDocA = 'test-doc-bio-01';
      const testDocB = 'test-doc-phys-02';

      // Clean up previous test documents
      db.prepare(`DELETE FROM documents WHERE id IN (?, ?) OR filename IN ('neuroscience_notes.txt', 'quantum_physics.txt', 'biology_mitochondria.txt', 'physics_thermodynamics.txt')`).run(testDocA, testDocB);

      db.prepare(`
        INSERT INTO documents (id, filename, stored_filename, file_type, file_size, status, chunk_count, character_count, embedding_status, embedding_model)
        VALUES (?, ?, ?, 'txt', 500, 'ready', 2, 500, 'completed', 'nomic-embed-text')
      `).run(testDocA, 'biology_mitochondria.txt', 'stored_bio_01.txt');

      db.prepare(`
        INSERT INTO documents (id, filename, stored_filename, file_type, file_size, status, chunk_count, character_count, embedding_status, embedding_model)
        VALUES (?, ?, ?, 'txt', 500, 'ready', 1, 300, 'completed', 'nomic-embed-text')
      `).run(testDocB, 'physics_thermodynamics.txt', 'stored_phys_02.txt');

      // Controlled embedding vectors (dim = 4)
      // Vector A1: Strongly matches biology query [1.0, 0.0, 0.0, 0.0]
      // Vector A2: Partially matches biology query [0.7, 0.7, 0.0, 0.0]
      // Vector B1: Orthogonal / unrelated [0.0, 0.0, 1.0, 0.0]
      const floatA1 = new Float32Array([1.0, 0.0, 0.0, 0.0]);
      const floatA2 = new Float32Array([0.7071, 0.7071, 0.0, 0.0]);
      const floatB1 = new Float32Array([0.0, 0.0, 1.0, 0.0]);

      const chunkA1Content = "Mitochondria generate most of the chemical energy needed to power cellular reactions. Energy produced is stored in adenosine triphosphate (ATP).";
      const chunkA2Content = "The inner membrane of mitochondria contains electron transport chains where oxidative phosphorylation synthesizes ATP.";
      const chunkB1Content = "The second law of thermodynamics states that the total entropy of an isolated system always increases over time.";

      db.prepare(`
        INSERT INTO document_chunks (id, document_id, chunk_index, content, page_number, char_start, char_end, token_count, embedding, embedding_model, embedding_dim)
        VALUES 
          ('chunk-bio-1', ?, 0, ?, 1, 0, ?, 25, ?, 'nomic-embed-text', 4),
          ('chunk-bio-2', ?, 1, ?, 2, 160, ?, 22, ?, 'nomic-embed-text', 4),
          ('chunk-phys-1', ?, 0, ?, 1, 0, ?, 20, ?, 'nomic-embed-text', 4)
      `).run(
        testDocA, chunkA1Content, chunkA1Content.length, Buffer.from(floatA1.buffer),
        testDocA, chunkA2Content, 160 + chunkA2Content.length, Buffer.from(floatA2.buffer),
        testDocB, chunkB1Content, chunkB1Content.length, Buffer.from(floatB1.buffer)
      );

      db.close();

      // Instantiate TutorService with a mock embedding provider matching our vectors and mock LLM
      const { TutorService } = require('./server/dist/services/rag/tutorService');
      const { RetrievalService } = require('./server/dist/services/rag/retrievalService');

      // Controlled Embedding Provider
      class MockEmbeddingProvider {
        getModelName() { return 'nomic-embed-text'; }
        async isAvailable() { return { available: true }; }
        async embed(text) {
          if (text.toLowerCase().includes('atp') || text.toLowerCase().includes('mitochondria')) {
            return [1.0, 0.0, 0.0, 0.0]; // Biology vector
          }
          if (text.toLowerCase().includes('entropy')) {
            return [0.0, 0.0, 1.0, 0.0]; // Physics vector
          }
          return [0.0, 0.0, 0.0, 1.0]; // Unrelated vector (cosine = 0 with all notes)
        }
        async embedBatch(texts) {
          return Promise.all(texts.map(t => this.embed(t)));
        }
      }

      // Controlled LLM Provider verifying grounding prompt structure
      class MockLlmProvider {
        constructor() {
          this.lastPrompt = '';
          this.lastSystemPrompt = '';
        }
        getModelName() { return 'llama3.2:3b'; }
        async isAvailable() { return { available: true }; }
        async generate(prompt, options) {
          this.lastPrompt = prompt;
          this.lastSystemPrompt = options.systemPrompt || '';

          // If prompt contains mitochondria context, produce grounded answer with source citations
          if (prompt.includes('biology_mitochondria.txt')) {
            return 'Mitochondria produce cellular chemical energy stored in adenosine triphosphate (ATP) [Source 1]. This process occurs through oxidative phosphorylation along the inner mitochondrial membrane [Source 2].';
          }
          if (prompt.includes('physics_thermodynamics.txt')) {
            return 'The total entropy of an isolated system always increases according to the second law of thermodynamics [Source 1].';
          }
          return 'The uploaded study notes do not contain enough information to answer this question.';
        }
      }

      const mockLlm = new MockLlmProvider();
      const mockRetrieval = new RetrievalService(new MockEmbeddingProvider());
      const customTutor = new TutorService(mockLlm, mockRetrieval);

      // Run Question 1: Answerable from notes
      const ans1 = await customTutor.answerQuestion({
        question: 'How do mitochondria produce ATP?',
        explanationMode: 'standard',
        documentIds: [testDocA, testDocB],
      });

      console.log('  Answerable question result:');
      console.log('    Answer:', ans1.answer);
      console.log('    Sources count:', ans1.sources.length);
      console.log('    Insufficient evidence:', ans1.insufficientEvidence);
      console.log('    Sources detail:', ans1.sources.map(s => ({ idx: s.citationIndex, doc: s.documentName, page: s.pageNumber, chunk: s.chunkIndex, score: s.score, snippet: s.snippet.slice(0, 30) })));

      const hasCitationsInAnswer = ans1.answer.includes('[Source 1]') && ans1.answer.includes('[Source 2]');
      const source1 = ans1.sources.find(s => s.citationIndex === 1);
      const source2 = ans1.sources.find(s => s.citationIndex === 2);

      const source1Valid = source1 && source1.documentName === 'biology_mitochondria.txt' && source1.pageNumber === 1 && source1.chunkIndex === 0 && source1.snippet === chunkA1Content;
      const source2Valid = source2 && source2.documentName === 'biology_mitochondria.txt' && source2.pageNumber === 2 && source2.chunkIndex === 1 && source2.snippet === chunkA2Content;

      console.log('    hasCitationsInAnswer:', hasCitationsInAnswer);
      console.log('    source1Valid:', source1Valid);
      console.log('    source2Valid:', source2Valid);

      if (hasCitationsInAnswer && source1Valid && source2Valid && !ans1.insufficientEvidence) {
        results['5. Grounded Q&A & Citations'] = 'PASS';
      } else {
        results['5. Grounded Q&A & Citations'] = `FAIL: Invalid citations or source attribution (cites=${hasCitationsInAnswer}, s1=${!!source1Valid}, s2=${!!source2Valid})`;
      }

      // ---------------------------------------------------------------
      // 6. Question Absent from Notes (Insufficient Evidence Detection)
      // ---------------------------------------------------------------
      console.log('\nTest 6: Testing question absent from uploaded notes (Refusal/Fallback)...');
      const ans2 = await customTutor.answerQuestion({
        question: 'What is quantum entanglement and bell inequality?',
        documentIds: [testDocA, testDocB],
      });

      console.log('  Absent question result:');
      console.log('    Answer:', ans2.answer);
      console.log('    Sources count:', ans2.sources.length);
      console.log('    Insufficient evidence flag:', ans2.insufficientEvidence);

      const refusesCorrectly = ans2.insufficientEvidence === true && ans2.sources.length === 0 && ans2.answer.includes('cannot find sufficient evidence');

      if (refusesCorrectly) {
        results['6. Insufficient Evidence Fallback'] = 'PASS';
      } else {
        results['6. Insufficient Evidence Fallback'] = 'FAIL: Did not refuse unsupported question';
      }

      // ---------------------------------------------------------------
      // 7. Multi-Document Retrieval Scoping & Isolation
      // ---------------------------------------------------------------
      console.log('\nTest 7: Testing multi-document retrieval scoping...');
      // Biology query scoped ONLY to testDocB (Physics)
      const ansScopedToPhysics = await customTutor.answerQuestion({
        question: 'How do mitochondria produce ATP?',
        documentIds: [testDocB], // Only look in physics!
      });

      console.log('  Scoped to physics notes when asking biology question:');
      console.log('    Sources count:', ansScopedToPhysics.sources.length);
      console.log('    Insufficient evidence:', ansScopedToPhysics.insufficientEvidence);

      const scopedIsolationWorks = ansScopedToPhysics.insufficientEvidence === true && ansScopedToPhysics.sources.length === 0;

      // Now query entropy across both documents
      const ansEntropy = await customTutor.answerQuestion({
        question: 'What is entropy and the second law?',
        documentIds: [testDocA, testDocB],
      });

      const entropyHasPhysicsSource = ansEntropy.sources.some(s => s.documentName === 'physics_thermodynamics.txt');

      if (scopedIsolationWorks && entropyHasPhysicsSource) {
        results['7. Multi-Document Scoping & Isolation'] = 'PASS';
      } else {
        results['7. Multi-Document Scoping & Isolation'] = 'FAIL: Scoping isolation did not filter correctly';
      }

      // ---------------------------------------------------------------
      // 8. Explanation Modes Verification (standard, concise, simple)
      // ---------------------------------------------------------------
      console.log('\nTest 8: Testing explanation modes (standard, concise, simple)...');
      await customTutor.answerQuestion({
        question: 'How do mitochondria produce ATP?',
        explanationMode: 'concise',
        documentIds: [testDocA, testDocB],
      });
      const concisePromptHasGuidance = mockLlm.lastSystemPrompt.includes('direct, high-yield summary in 2 to 4 sentences');

      await customTutor.answerQuestion({
        question: 'How do mitochondria produce ATP?',
        explanationMode: 'simple',
        documentIds: [testDocA, testDocB],
      });
      const simplePromptHasGuidance = mockLlm.lastSystemPrompt.includes('simple, beginner-friendly terms with intuitive analogies');

      console.log('  Concise mode guidance verified:', concisePromptHasGuidance);
      console.log('  Simple mode guidance verified:', simplePromptHasGuidance);

      if (concisePromptHasGuidance && simplePromptHasGuidance) {
        results['8. Explanation Modes Guidance'] = 'PASS';
      } else {
        results['8. Explanation Modes Guidance'] = 'FAIL: System prompt lacked mode instructions';
      }

      // ---------------------------------------------------------------
      // 9. Chat Sessions & Message History Persistence in SQLite
      // ---------------------------------------------------------------
      console.log('\nTest 9: Testing chat session and message history persistence in SQLite...');
      const { chatRepository } = require('./server/dist/db/repositories/chatRepository');

      const testSessionId = 'session-test-persist-01';
      chatRepository.deleteSession(testSessionId);

      const createdSession = chatRepository.createSession(testSessionId, 'Cell Biology Q&A', [testDocA]);
      const userMsg = chatRepository.addMessage('msg-u-01', testSessionId, 'user', 'What does ATP do?');
      const assistantMsg = chatRepository.addMessage(
        'msg-a-01', 
        testSessionId, 
        'assistant', 
        'ATP stores cellular energy [Source 1].',
        [{
          citationIndex: 1,
          chunkId: 'chunk-bio-1',
          documentId: testDocA,
          documentName: 'biology_mitochondria.txt',
          pageNumber: 1,
          chunkIndex: 0,
          score: 0.95,
          snippet: chunkA1Content,
          charStart: 0,
          charEnd: chunkA1Content.length
        }],
        false
      );

      const fetchedSession = chatRepository.getSessionWithMessages(testSessionId);

      console.log('  Fetched session title:', fetchedSession.title);
      console.log('  Message count in session:', fetchedSession.messages.length);
      console.log('  Assistant message sources:', fetchedSession.messages[1].sources ? fetchedSession.messages[1].sources.length : 0);

      const historyIntact = 
        fetchedSession &&
        fetchedSession.messages.length === 2 &&
        fetchedSession.messages[0].role === 'user' &&
        fetchedSession.messages[1].role === 'assistant' &&
        Array.isArray(fetchedSession.messages[1].sources) &&
        fetchedSession.messages[1].sources[0].citationIndex === 1 &&
        fetchedSession.messages[1].sources[0].chunkId === 'chunk-bio-1';

      // Test cascade delete
      chatRepository.deleteSession(testSessionId);
      const postDelete = chatRepository.getSessionWithMessages(testSessionId);
      const dbCheck = new Database(DB_PATH);
      const leftoverMsgs = dbCheck.prepare(`SELECT count(*) as count FROM chat_messages WHERE session_id = ?`).get(testSessionId).count;
      dbCheck.close();

      const cascadeWorked = postDelete === null && leftoverMsgs === 0;

      if (historyIntact && cascadeWorked) {
        results['9. Session & History Persistence'] = 'PASS';
      } else {
        results['9. Session & History Persistence'] = 'FAIL: Session persistence or cascade failed';
      }

    } catch (err) {
      results['5. Grounded Q&A & Citations'] = `FAIL: ${err.message}`;
    }

  } finally {
    // Clean up temporary test fixtures
    try {
      const dbClean = new Database(DB_PATH);
      dbClean.prepare(`DELETE FROM documents WHERE id IN ('test-doc-bio-01', 'test-doc-phys-02')`).run();
      dbClean.close();
    } catch (_) {}

    // Shutdown test server
    if (serverProcess) {
      console.log('\nShutting down test Express server...');
      serverProcess.kill('SIGTERM');
      await sleep(1000);
    }
  }

  // ---------------------------------------------------------------
  // Summary Report
  // ---------------------------------------------------------------
  console.log('\n=====================================================');
  console.log('       MILESTONE 4 TEST EXECUTION RESULTS');
  console.log('=====================================================');
  let allPassed = true;
  for (const [testName, result] of Object.entries(results)) {
    const isPass = result === 'PASS';
    if (!isPass) allPassed = false;
    console.log(`[${isPass ? 'PASS' : 'FAIL'}] ${testName}: ${result}`);
  }
  console.log('=====================================================');

  if (allPassed) {
    console.log('ALL MILESTONE 4 TESTS PASSED SUCCESSFULLY.');
    process.exit(0);
  } else {
    console.error('SOME TESTS FAILED.');
    process.exit(1);
  }
}

runMilestone4Tests().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
