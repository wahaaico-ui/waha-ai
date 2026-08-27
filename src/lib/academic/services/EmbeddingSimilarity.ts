const GEMINI_EMBED_MODEL = 'gemini-embedding-001';
const GEMINI_EMBED_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_EMBED_MODEL}:batchEmbedContents`;
const NVIDIA_EMBED_MODEL = 'nvidia/nemotron-3-embed-1b';
const NVIDIA_EMBED_URL = 'https://integrate.api.nvidia.com/v1/embeddings';
const EMBEDDING_TIMEOUT_MS = 12_000;

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function toIndexValue(similarity: number): number {
  return Math.round(Math.max(0, Math.min(1, similarity)) * 100);
}

async function embedWithGemini(
  apiKey: string,
  texts: string[],
  taskType: 'RETRIEVAL_QUERY' | 'RETRIEVAL_DOCUMENT'
): Promise<number[][]> {
  const requests = texts.map((text) => ({
    model: `models/${GEMINI_EMBED_MODEL}`,
    content: { parts: [{ text: text || ' ' }] },
    taskType,
  }));

  const response = await fetch(`${GEMINI_EMBED_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests }),
    signal: AbortSignal.timeout(EMBEDDING_TIMEOUT_MS),
  });

  if (!response.ok) throw new Error(`Gemini embedding error: ${response.status} - ${await response.text()}`);

  const data = (await response.json()) as { embeddings: { values: number[] }[] };
  return data.embeddings.map((item) => item.values);
}

async function embedWithNvidia(
  apiKey: string,
  texts: string[],
  inputType: 'query' | 'passage'
): Promise<number[][]> {
  const response = await fetch(NVIDIA_EMBED_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: NVIDIA_EMBED_MODEL,
      input: texts.map((text) => text || ' '),
      input_type: inputType,
      truncate: 'END',
    }),
    signal: AbortSignal.timeout(EMBEDDING_TIMEOUT_MS),
  });

  if (!response.ok) throw new Error(`NVIDIA embedding error: ${response.status} - ${await response.text()}`);

  const data = (await response.json()) as { data: { embedding: number[] }[] };
  return data.data.map((item) => item.embedding);
}

/**
 * Computes a semantic similarity index (0-100) between the query and each
 * document, using whichever embedding providers have a configured API key.
 * This is raw cosine similarity between embedding vectors — a signal of
 * topical closeness, NOT a calibrated academic-relevance or evidence-quality
 * score. Treat it as one input among several, not a verdict.
 *
 * When both NVIDIA and Gemini are available, their scores are averaged for
 * a steadier signal. Returns `null` for a document if no provider could
 * score it (missing keys, timeout, or every provider call failed) —
 * callers must treat a null entry as "no index available", never as zero
 * relevance.
 */
export async function scoreSemanticRelevance(
  query: string,
  documents: string[]
): Promise<(number | null)[]> {
  if (documents.length === 0) return [];

  const geminiKey = process.env.GEMINI_API_KEY;
  const nvidiaKey = process.env.NVIDIA_API_KEY;

  const [geminiResult, nvidiaResult] = await Promise.allSettled([
    geminiKey
      ? Promise.all([
          embedWithGemini(geminiKey, [query], 'RETRIEVAL_QUERY'),
          embedWithGemini(geminiKey, documents, 'RETRIEVAL_DOCUMENT'),
        ])
      : Promise.reject(new Error('GEMINI_API_KEY not set')),
    nvidiaKey
      ? Promise.all([
          embedWithNvidia(nvidiaKey, [query], 'query'),
          embedWithNvidia(nvidiaKey, documents, 'passage'),
        ])
      : Promise.reject(new Error('NVIDIA_API_KEY not set')),
  ]);

  const perDocumentValues: number[][] = documents.map(() => []);

  if (geminiResult.status === 'fulfilled') {
    const [[queryVector], documentVectors] = geminiResult.value;
    documentVectors.forEach((vector, index) => {
      perDocumentValues[index].push(toIndexValue(cosineSimilarity(queryVector, vector)));
    });
  } else {
    console.error('Gemini semantic similarity failed:', geminiResult.reason);
  }

  if (nvidiaResult.status === 'fulfilled') {
    const [[queryVector], documentVectors] = nvidiaResult.value;
    documentVectors.forEach((vector, index) => {
      perDocumentValues[index].push(toIndexValue(cosineSimilarity(queryVector, vector)));
    });
  } else {
    console.error('NVIDIA semantic similarity failed:', nvidiaResult.reason);
  }

  return perDocumentValues.map((values) =>
    values.length > 0 ? Math.round(values.reduce((sum, v) => sum + v, 0) / values.length) : null
  );
}
