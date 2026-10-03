export class DimensionMismatchError extends Error {
  constructor(expected: number, received: number) {
    super(`Vector dimension mismatch: expected ${expected}, but received ${received}`);
    this.name = 'DimensionMismatchError';
  }
}

/**
 * Computes cosine similarity between two vectors (Float32Array or number[]).
 * Returns a value between -1.0 and 1.0 (typically 0.0 to 1.0 for embeddings).
 */
export function cosineSimilarity(
  a: Float32Array | number[],
  b: Float32Array | number[]
): number {
  if (a.length !== b.length) {
    throw new DimensionMismatchError(a.length, b.length);
  }

  const len = a.length;
  if (len === 0) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < len; i++) {
    const valA = a[i];
    const valB = b[i];
    dotProduct += valA * valB;
    normA += valA * valA;
    normB += valB * valB;
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator <= 1e-10) {
    return 0;
  }

  return dotProduct / denominator;
}

/**
 * Computes L2 (Euclidean) norm of a vector.
 */
export function vectorNorm(v: Float32Array | number[]): number {
  let sum = 0;
  for (let i = 0; i < v.length; i++) {
    sum += v[i] * v[i];
  }
  return Math.sqrt(sum);
}
