const fs = require('fs');
const path = require('path');

const dir = path.resolve(__dirname);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

// 1. Valid TXT
const txtContent = `# Introduction to Neuroscience
Neuroscience is the multidisciplinary scientific study of the nervous system.
Neurons are the fundamental units of the brain and nervous system, responsible for receiving sensory input from the external world, sending motor commands to muscles, and transforming and relaying electrical signals at every step in between.

## Synaptic Transmission
A synapse is a small gap at the end of a neuron that allows a signal to pass from one neuron to the next.
Neurotransmitters are chemical messengers released by synaptic vesicles across the synaptic cleft. Examples include dopamine, serotonin, acetylcholine, and glutamate.

## Neural Plasticity
Synaptic plasticity is the biological process by which specific patterns of synaptic activity result in changes in synaptic strength and structure over time. It is believed to be the cellular basis for learning and memory formation in animal brains.
`;
fs.writeFileSync(path.join(dir, 'valid_notes.txt'), txtContent);

// 2. Valid PDF
const pdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 120 >>
stream
BT
/F1 14 Tf
70 700 Td
(Quantum Mechanics Lecture Notes) Tj
/F1 11 Tf
0 -30 Td
(Wave-particle duality posits that all quantum entities exhibit wave and particle properties.) Tj
ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000244 00000 n 
0000000414 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
495
%%EOF
`;
fs.writeFileSync(path.join(dir, 'valid_doc.pdf'), pdfContent);

// 3. Unsupported file type (.png)
fs.writeFileSync(path.join(dir, 'image_note.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));

// 4. Empty TXT (0 bytes)
fs.writeFileSync(path.join(dir, 'empty_notes.txt'), '');

// 5. Empty/whitespace only TXT
fs.writeFileSync(path.join(dir, 'whitespace_notes.txt'), '   \n\n\t  \n  ');

// 6. Oversized TXT (26 MB)
const largeBuffer = Buffer.alloc(26 * 1024 * 1024, 'A');
fs.writeFileSync(path.join(dir, 'oversized_document.txt'), largeBuffer);

console.log('Fixtures created successfully!');
