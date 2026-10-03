const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:5000/api';

async function main() {
  console.log('=== STARTING MILESTONE 2 AUTOMATED TEST SUITE ===\n');
  const results = {};

  // Helper for multipart/form-data upload using native fetch & FormData
  async function uploadFile(fileName) {
    const filePath = path.resolve('test-fixtures', fileName);
    const fileBuffer = fs.readFileSync(filePath);
    const blob = new Blob([fileBuffer], {
      type: fileName.endsWith('.pdf') ? 'application/pdf' : (fileName.endsWith('.txt') ? 'text/plain' : 'image/png')
    });
    const formData = new FormData();
    formData.append('file', blob, fileName);

    const res = await fetch(`${BASE_URL}/documents/upload`, {
      method: 'POST',
      body: formData,
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  }

  let validTxtId = null;
  let validPdfId = null;

  // TEST 1: Valid TXT Upload
  try {
    console.log('Test 1: Valid TXT upload...');
    const res = await uploadFile('valid_notes.txt');
    console.log('  Status:', res.status);
    console.log('  Response:', JSON.stringify(res.data));
    if (res.status === 201 && res.data.document && res.data.document.chunk_count > 0) {
      validTxtId = res.data.document.id;
      results['1. Valid TXT upload'] = 'PASS';
    } else {
      results['1. Valid TXT upload'] = `FAIL (Status: ${res.status})`;
    }
  } catch (err) {
    console.error('  Error:', err.message);
    results['1. Valid TXT upload'] = `FAIL: ${err.message}`;
  }

  // TEST 2: Valid PDF Upload
  try {
    console.log('\nTest 2: Valid PDF upload...');
    const res = await uploadFile('valid_doc.pdf');
    console.log('  Status:', res.status);
    console.log('  Response:', JSON.stringify(res.data));
    if (res.status === 201 && res.data.document && res.data.document.chunk_count > 0) {
      validPdfId = res.data.document.id;
      results['2. Valid PDF upload'] = 'PASS';
    } else {
      results['2. Valid PDF upload'] = `FAIL (Status: ${res.status})`;
    }
  } catch (err) {
    console.error('  Error:', err.message);
    results['2. Valid PDF upload'] = `FAIL: ${err.message}`;
  }

  // TEST 3: Unsupported File Type (.png)
  try {
    console.log('\nTest 3: Unsupported file type upload...');
    const res = await uploadFile('image_note.png');
    console.log('  Status:', res.status);
    console.log('  Response:', JSON.stringify(res.data));
    if (res.status === 400 && res.data.error && res.data.error.includes('Unsupported file type')) {
      results['3. Unsupported file type'] = 'PASS';
    } else {
      results['3. Unsupported file type'] = `FAIL (Status: ${res.status})`;
    }
  } catch (err) {
    console.error('  Error:', err.message);
    results['3. Unsupported file type'] = `FAIL: ${err.message}`;
  }

  // TEST 4: Empty Document (0 bytes & whitespace)
  try {
    console.log('\nTest 4: Empty document upload (0 bytes)...');
    const res0 = await uploadFile('empty_notes.txt');
    console.log('  Status:', res0.status, 'Response:', JSON.stringify(res0.data));

    console.log('  Testing whitespace-only document...');
    const resWs = await uploadFile('whitespace_notes.txt');
    console.log('  Status:', resWs.status, 'Response:', JSON.stringify(resWs.data));

    if (res0.status === 400 && resWs.status === 400) {
      results['4. Empty document'] = 'PASS';
    } else {
      results['4. Empty document'] = `FAIL (0-byte status: ${res0.status}, whitespace status: ${resWs.status})`;
    }
  } catch (err) {
    console.error('  Error:', err.message);
    results['4. Empty document'] = `FAIL: ${err.message}`;
  }

  // TEST 5: Oversized Upload (> 25MB)
  try {
    console.log('\nTest 5: Oversized upload (26 MB)...');
    const res = await uploadFile('oversized_document.txt');
    console.log('  Status:', res.status);
    console.log('  Response:', JSON.stringify(res.data));
    if (res.status === 400 && res.data.error && res.data.error.includes('exceeds')) {
      results['5. Oversized upload'] = 'PASS';
    } else {
      results['5. Oversized upload'] = `FAIL (Status: ${res.status})`;
    }
  } catch (err) {
    console.error('  Error:', err.message);
    results['5. Oversized upload'] = `FAIL: ${err.message}`;
  }

  // TEST 6: Document Listing (GET /api/documents)
  try {
    console.log('\nTest 6: Document listing...');
    const res = await fetch(`${BASE_URL}/documents`);
    const data = await res.json();
    console.log('  Status:', res.status);
    console.log('  Found documents:', data.documents.length);
    const hasTxt = data.documents.some(d => d.id === validTxtId);
    const hasPdf = data.documents.some(d => d.id === validPdfId);
    const pathsExposed = JSON.stringify(data).includes('stored_filename') || JSON.stringify(data).includes('file_path');

    if (res.status === 200 && hasTxt && hasPdf && !pathsExposed) {
      results['6. Document listing'] = 'PASS';
    } else {
      results['6. Document listing'] = `FAIL (hasTxt: ${hasTxt}, hasPdf: ${hasPdf}, pathsExposed: ${pathsExposed})`;
    }
  } catch (err) {
    console.error('  Error:', err.message);
    results['6. Document listing'] = `FAIL: ${err.message}`;
  }

  // TEST 7: Document Deletion (DELETE /api/documents/:id)
  try {
    console.log('\nTest 7: Document deletion (deleting TXT document)...');
    const delRes = await fetch(`${BASE_URL}/documents/${validTxtId}`, { method: 'DELETE' });
    const delData = await delRes.json();
    console.log('  Delete status:', delRes.status, 'Response:', JSON.stringify(delData));

    // Verify it is gone from GET
    const checkRes = await fetch(`${BASE_URL}/documents/${validTxtId}`);
    console.log('  Verify GET after delete status:', checkRes.status);

    if (delRes.status === 200 && checkRes.status === 404) {
      results['7. Document deletion'] = 'PASS';
    } else {
      results['7. Document deletion'] = `FAIL (delete status: ${delRes.status}, get status: ${checkRes.status})`;
    }
  } catch (err) {
    console.error('  Error:', err.message);
    results['7. Document deletion'] = `FAIL: ${err.message}`;
  }

  console.log('\n=== PRE-RESTART TEST RESULTS ===');
  console.table(results);

  // Return PDF document id for persistence testing after restart
  console.log(`\nPersisting Document ID for Restart Test: ${validPdfId}`);
  fs.writeFileSync('test-fixtures/persisted_id.txt', validPdfId || '');
}

main().catch(console.error);
