const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://localhost:5000/api';

async function runMilestone3Tests() {
  console.log('=== STARTING MILESTONE 3 AUTOMATED TEST SUITE ===\n');
  const results = {};

  // 1. Database Migration Inspection
  try {
    console.log('Test 1: Inspecting SQLite schema migrations for embeddings...');
    const db = new Database('./server/data/studymate.db');
    const chunkCols = db.pragma('table_info(document_chunks)').map(c => c.name);
    const docCols = db.pragma('table_info(documents)').map(c => c.name);
    db.close();

    const hasChunkEmbedding = chunkCols.includes('embedding');
    const hasChunkModel = chunkCols.includes('embedding_model');
    const hasChunkDim = chunkCols.includes('embedding_dim');
    const hasDocEmbedStatus = docCols.includes('embedding_status');

    if (hasChunkEmbedding && hasChunkModel && hasChunkDim && hasDocEmbedStatus) {
      console.log('  Columns verified:', { hasChunkEmbedding, hasChunkModel, hasChunkDim, hasDocEmbedStatus });
      results['1. SQLite Schema Migration'] = 'PASS';
    } else {
      results['1. SQLite Schema Migration'] = `FAIL: missing columns (chunk: ${chunkCols.join(',')})`;
    }
  } catch (err) {
    results['1. SQLite Schema Migration'] = `FAIL: ${err.message}`;
  }

  // 2. Character Offset Precision Test
  try {
    console.log('\nTest 2: Verifying true character offset tracking...');
    const sampleText = 'Alpha paragraph.\n\nBeta paragraph with detailed notes on biological systems.\n\nGamma concluding paragraph.';
    const textPath = path.resolve('test-fixtures/offset_test.txt');
    fs.writeFileSync(textPath, sampleText);

    const formData = new FormData();
    formData.append('file', new Blob([sampleText], { type: 'text/plain' }), 'offset_test.txt');

    const res = await fetch(`${BASE_URL}/documents/upload`, {
      method: 'POST',
      body: formData,
    });
    const data = await res.json();

    if (res.status === 201 && data.document) {
      const docDetailsRes = await fetch(`${BASE_URL}/documents/${data.document.id}`);
      const details = await docDetailsRes.json();
      const firstChunk = details.chunks[0];
      const sliceMatches = sampleText.substring(firstChunk.char_start, firstChunk.char_end).trim() === firstChunk.content.trim();

      console.log('  Document chunk char_start:', firstChunk.char_start, 'char_end:', firstChunk.char_end);
      console.log('  Substring matches raw source:', sliceMatches);

      if (sliceMatches) {
        results['2. True Character Offsets'] = 'PASS';
      } else {
        results['2. True Character Offsets'] = 'FAIL: offset substring mismatch';
      }
    } else {
      results['2. True Character Offsets'] = `FAIL (Status ${res.status})`;
    }
  } catch (err) {
    results['2. True Character Offsets'] = `FAIL: ${err.message}`;
  }

  // 3. Graceful Ollama Degradation Test (when Ollama is offline)
  try {
    console.log('\nTest 3: Testing graceful handling when Ollama is offline...');
    const searchRes = await fetch(`${BASE_URL}/retrieval/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'Explain neuroplasticity' }),
    });
    const searchData = await searchRes.json();
    console.log('  Search status with offline Ollama:', searchRes.status);
    console.log('  Response:', JSON.stringify(searchData));

    if (searchRes.status === 503 && searchData.code === 'OLLAMA_UNREACHABLE' && searchData.instructions) {
      results['3. Ollama Offline Degradation'] = 'PASS';
    } else {
      results['3. Ollama Offline Degradation'] = `FAIL: expected 503 OLLAMA_UNREACHABLE, got ${searchRes.status}`;
    }
  } catch (err) {
    results['3. Ollama Offline Degradation'] = `FAIL: ${err.message}`;
  }

  // 4. Mathematical Similarity Ranking & Dimension Validation (Direct Vector Pipeline)
  let testDoc1Id = 'doc-neuro-001';
  let testDoc2Id = 'doc-quantum-002';
  try {
    console.log('\nTest 4: Mathematical Cosine Similarity Ranking & Dimension Validation...');
    const db = new Database('./server/data/studymate.db');

    // Clean up any previous test docs
    db.prepare(`DELETE FROM documents WHERE id IN (?, ?)`).run(testDoc1Id, testDoc2Id);

    // Create 2 documents
    db.prepare(`
      INSERT INTO documents (id, filename, stored_filename, file_type, file_size, status, embedding_status, embedding_model)
      VALUES (?, ?, ?, 'txt', 500, 'ready', 'completed', 'nomic-embed-text')
    `).run(testDoc1Id, 'neuroscience_notes.txt', 'neuro.txt');

    db.prepare(`
      INSERT INTO documents (id, filename, stored_filename, file_type, file_size, status, embedding_status, embedding_model)
      VALUES (?, ?, ?, 'txt', 500, 'ready', 'completed', 'nomic-embed-text')
    `).run(testDoc2Id, 'quantum_physics.txt', 'quantum.txt');

    // Create chunks with deterministic 4D vectors for rigorous mathematical verification:
    // Vector A (Neuroscience): [1.0, 0.0, 0.0, 0.0]
    // Vector B (Quantum):      [0.0, 1.0, 0.0, 0.0]
    const vecA = new Float32Array([1.0, 0.0, 0.0, 0.0]);
    const vecB = new Float32Array([0.0, 1.0, 0.0, 0.0]);

    const toBlob = (f32) => Buffer.from(f32.buffer, f32.byteOffset, f32.byteLength);

    db.prepare(`
      INSERT INTO document_chunks (id, document_id, chunk_index, content, char_start, char_end, token_count, embedding, embedding_model, embedding_dim)
      VALUES (?, ?, 0, 'Synapses transmit chemical neurotransmitters across neurons.', 0, 60, 15, ?, 'nomic-embed-text', 4)
    `).run('chunk-neuro-1', testDoc1Id, toBlob(vecA));

    db.prepare(`
      INSERT INTO document_chunks (id, document_id, chunk_index, content, char_start, char_end, token_count, embedding, embedding_model, embedding_dim)
      VALUES (?, ?, 0, 'Quantum entanglement exhibits wave function collapse.', 0, 54, 14, ?, 'nomic-embed-text', 4)
    `).run('chunk-quantum-1', testDoc2Id, toBlob(vecB));

    db.close();

    // Now test retrieval with a mock embedding provider or direct vector math test
    const { cosineSimilarity, DimensionMismatchError } = require('./server/dist/services/rag/vectorMath');
    
    // Query vector close to neuroscience: [0.95, 0.05, 0.0, 0.0]
    const queryVec = new Float32Array([0.95, 0.05, 0.0, 0.0]);
    const simA = cosineSimilarity(queryVec, vecA);
    const simB = cosineSimilarity(queryVec, vecB);

    console.log('  Cosine Similarity to Neuro Chunk:', simA.toFixed(4));
    console.log('  Cosine Similarity to Quantum Chunk:', simB.toFixed(4));

    // Verify dimension mismatch throws
    let dimMismatchCaught = false;
    try {
      cosineSimilarity(queryVec, new Float32Array([1.0, 0.0, 0.0])); // 3D vs 4D
    } catch (e) {
      if (e instanceof DimensionMismatchError) dimMismatchCaught = true;
    }
    console.log('  Dimension mismatch error thrown and caught:', dimMismatchCaught);

    if (simA > 0.99 && simB < 0.1 && dimMismatchCaught) {
      results['4. Similarity Ranking & Dim Check'] = 'PASS';
    } else {
      results['4. Similarity Ranking & Dim Check'] = `FAIL: simA=${simA}, simB=${simB}, dimCheck=${dimMismatchCaught}`;
    }
  } catch (err) {
    results['4. Similarity Ranking & Dim Check'] = `FAIL: ${err.message}`;
  }

  // 5. Document Isolation Test
  try {
    console.log('\nTest 5: Testing Document Isolation in Retrieval Service...');
    const { RetrievalService } = require('./server/dist/services/rag/retrievalService');

    // Create a deterministic in-memory provider returning query vector [0.95, 0.05, 0.0, 0.0]
    const testProvider = {
      getModelName: () => 'nomic-embed-text',
      isAvailable: async () => ({ available: true }),
      embed: async () => [0.95, 0.05, 0.0, 0.0],
      embedBatch: async (texts) => texts.map(() => [0.95, 0.05, 0.0, 0.0]),
    };

    const service = new RetrievalService(testProvider);

    // Search scoped ONLY to testDoc2Id (Quantum doc)
    const isolatedSearch = await service.searchSimilar({
      query: 'synaptic plasticity neurotransmitters',
      documentIds: [testDoc2Id],
      topK: 5,
    });

    console.log('  Scoped search results count:', isolatedSearch.results.length);
    const allAreQuantum = isolatedSearch.results.every(r => r.documentId === testDoc2Id);
    console.log('  All results strictly belong to isolated document:', allAreQuantum);

    // Search with no filter (both docs eligible)
    const globalSearch = await service.searchSimilar({
      query: 'synaptic plasticity neurotransmitters',
      topK: 5,
    });
    console.log('  Global search results count:', globalSearch.results.length);
    console.log('  Top ranked result doc:', globalSearch.results[0]?.documentName);

    if (allAreQuantum && globalSearch.results[0]?.documentId === testDoc1Id) {
      results['5. Document Isolation'] = 'PASS';
    } else {
      results['5. Document Isolation'] = 'FAIL: isolation breached or wrong rank';
    }
  } catch (err) {
    results['5. Document Isolation'] = `FAIL: ${err.message}`;
  }

  // 6. Missing Embeddings Handling
  try {
    console.log('\nTest 6: Testing missing embeddings handling...');
    const db = new Database('./server/data/studymate.db');
    const unembeddedDocId = 'doc-no-embed-003';
    db.prepare(`DELETE FROM documents WHERE id = ?`).run(unembeddedDocId);
    db.prepare(`
      INSERT INTO documents (id, filename, stored_filename, file_type, file_size, status, embedding_status)
      VALUES (?, 'empty_embeddings.txt', 'empty.txt', 'txt', 100, 'ready', 'pending')
    `).run(unembeddedDocId);
    db.prepare(`
      INSERT INTO document_chunks (id, document_id, chunk_index, content, char_start, char_end, token_count)
      VALUES ('chunk-unembedded-1', ?, 0, 'No embeddings generated yet.', 0, 27, 7)
    `).run(unembeddedDocId);
    db.close();

    const testProvider = {
      getModelName: () => 'nomic-embed-text',
      isAvailable: async () => ({ available: true }),
      embed: async () => [0.95, 0.05, 0.0, 0.0],
      embedBatch: async (texts) => texts.map(() => [0.95, 0.05, 0.0, 0.0]),
    };
    const { RetrievalService } = require('./server/dist/services/rag/retrievalService');
    const service = new RetrievalService(testProvider);

    const emptyRes = await service.searchSimilar({
      query: 'anything',
      documentIds: [unembeddedDocId],
    });

    console.log('  Candidates for unembedded doc:', emptyRes.totalCandidates);
    console.log('  Results length:', emptyRes.results.length);

    if (emptyRes.totalCandidates === 0 && emptyRes.results.length === 0) {
      results['6. Missing Embeddings Handling'] = 'PASS';
    } else {
      results['6. Missing Embeddings Handling'] = 'FAIL: expected 0 candidates';
    }
  } catch (err) {
    results['6. Missing Embeddings Handling'] = `FAIL: ${err.message}`;
  }

  // 7. Binary BLOB Vector Persistence Verification
  try {
    console.log('\nTest 7: Verifying Float32Array binary BLOB precision after SQLite reload...');
    const db = new Database('./server/data/studymate.db');
    const row = db.prepare(`SELECT embedding, embedding_dim FROM document_chunks WHERE id = 'chunk-neuro-1'`).get();
    db.close();

    const { blobToVector } = require('./server/dist/db/repositories/documentRepository');
    const decoded = blobToVector(row.embedding);

    console.log('  Original vector:', [1.0, 0.0, 0.0, 0.0]);
    console.log('  Decoded vector from BLOB:', Array.from(decoded));

    const precisionMatch = decoded[0] === 1.0 && decoded[1] === 0.0 && decoded.length === 4;
    if (precisionMatch) {
      results['7. Binary Vector BLOB Precision'] = 'PASS';
    } else {
      results['7. Binary Vector BLOB Precision'] = 'FAIL: binary precision mismatch';
    }
  } catch (err) {
    results['7. Binary Vector BLOB Precision'] = `FAIL: ${err.message}`;
  }

  console.log('\n=== MILESTONE 3 TEST RESULTS SUMMARY ===');
  console.table(results);

  const allPassed = Object.values(results).every(r => r === 'PASS');
  if (allPassed) {
    console.log('\n>>> ALL MILESTONE 3 TESTS PASSED <<<');
  } else {
    console.log('\n>>> SOME TESTS FAILED <<<');
    process.exit(1);
  }
}

runMilestone3Tests().catch(err => {
  console.error(err);
  process.exit(1);
});
