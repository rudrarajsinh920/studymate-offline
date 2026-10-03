import React, { useState } from 'react';
import { 
  Search, 
  Sparkles, 
  FileText, 
  Bookmark, 
  AlertCircle, 
  Terminal, 
  CheckCircle2, 
  Filter
} from 'lucide-react';
import { DocumentSummary } from '../../api/documents';
import { searchSimilarChunks, SearchResponse, embedAllPending } from '../../api/retrieval';

interface SemanticSearchProps {
  documents: DocumentSummary[];
  onEmbedSuccess?: () => void;
}

export const SemanticSearch: React.FC<SemanticSearchProps> = ({ documents, onEmbedSuccess }) => {
  const [query, setQuery] = useState('');
  const [selectedDocId, setSelectedDocId] = useState<string>('all');
  const [topK, setTopK] = useState<number>(5);
  const [minScore, setMinScore] = useState<number>(0.0);

  const [loading, setLoading] = useState<boolean>(false);
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<{ instructions?: string; code?: string } | null>(null);

  const [embeddingAll, setEmbeddingAll] = useState<boolean>(false);
  const [embedMessage, setEmbedMessage] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setErrorDetails(null);

    try {
      const response = await searchSimilarChunks({
        query: query.trim(),
        documentIds: selectedDocId === 'all' ? undefined : [selectedDocId],
        topK,
        minScore,
      });
      setResults(response);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Search failed';
      setError(msg);
      setErrorDetails({
        instructions: (err as any)?.instructions,
        code: (err as any)?.code,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEmbedAll = async () => {
    setEmbeddingAll(true);
    setEmbedMessage(null);
    setError(null);
    try {
      const res = await embedAllPending();
      setEmbedMessage(res.message);
      if (onEmbedSuccess) onEmbedSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Embedding backfill failed');
      setErrorDetails({
        instructions: (err as any)?.instructions,
      });
    } finally {
      setEmbeddingAll(false);
    }
  };

  const formatScore = (score: number) => {
    const pct = Math.round(score * 100);
    return `${pct}% Match`;
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.75) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    if (score >= 0.5) return 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20';
    return 'text-slate-400 bg-slate-800 border-slate-700';
  };

  return (
    <div className="space-y-6">
      {/* Search Header Banner */}
      <section className="bg-gradient-to-r from-indigo-950/40 via-slate-900 to-slate-900 border border-indigo-900/40 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
                Milestone 3: Local Semantic Retrieval
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                Cosine Similarity
              </span>
            </div>
            <h2 className="text-2xl font-bold text-white mt-1">Semantic Knowledge Search</h2>
            <p className="text-sm text-slate-400 mt-1 max-w-2xl">
              Query your study notes by concept, meaning, or topic. Embeddings are generated and matched locally without external AI APIs.
            </p>
          </div>

          <button
            onClick={handleEmbedAll}
            disabled={embeddingAll}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 transition disabled:opacity-50"
          >
            <Sparkles className={`w-4 h-4 ${embeddingAll ? 'animate-spin' : ''}`} />
            <span>{embeddingAll ? 'Embedding Chunks...' : 'Generate Missing Embeddings'}</span>
          </button>
        </div>

        {embedMessage && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>{embedMessage}</span>
          </div>
        )}
      </section>

      {/* Search Query Form */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="relative">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="E.g., What is synaptic plasticity and how does it relate to learning?"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 pl-11 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
            />
            <Search className="w-5 h-5 text-slate-500 absolute left-3.5 top-3.5" />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-800/80 text-xs">
            <div className="flex flex-wrap items-center gap-4">
              {/* Document Filter */}
              <div className="flex items-center gap-2">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-400">Scope:</span>
                <select
                  value={selectedDocId}
                  onChange={(e) => setSelectedDocId(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="all">All Documents ({documents.length})</option>
                  {documents.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.filename}
                    </option>
                  ))}
                </select>
              </div>

              {/* Top K */}
              <div className="flex items-center gap-2">
                <span className="text-slate-400">Top Results:</span>
                <select
                  value={topK}
                  onChange={(e) => setTopK(parseInt(e.target.value, 10))}
                  className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="3">3</option>
                  <option value="5">5</option>
                  <option value="10">10</option>
                </select>
              </div>

              {/* Min Score Threshold */}
              <div className="flex items-center gap-2">
                <span className="text-slate-400">Min Similarity:</span>
                <select
                  value={minScore}
                  onChange={(e) => setMinScore(parseFloat(e.target.value))}
                  className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="0.0">None (0.0)</option>
                  <option value="0.4">40% (0.4)</option>
                  <option value="0.6">60% (0.6)</option>
                  <option value="0.75">75% (0.75)</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Searching...</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span>Retrieve Relevant Notes</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Error Alert with Instructions */}
        {error && (
          <div className="mt-4 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs space-y-2">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-rose-200">{error}</p>
                {errorDetails?.instructions && (
                  <p className="text-rose-300/90 mt-1">{errorDetails.instructions}</p>
                )}
              </div>
            </div>
            {errorDetails?.code === 'OLLAMA_UNREACHABLE' && (
              <div className="pt-2 border-t border-rose-500/20 flex items-center gap-2 font-mono text-[11px] text-slate-300">
                <Terminal className="w-3.5 h-3.5 text-indigo-400" />
                <span>Make sure Ollama is running: <code>ollama serve</code></span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Results View */}
      {results && (
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-4 border-b border-slate-800">
            <div>
              <h3 className="font-semibold text-white text-base">Retrieval Results</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Found {results.results.length} relevant excerpts from {results.totalCandidates} evaluated chunks
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono text-slate-400 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
              <span>Model: {results.model}</span>
              <span>&bull;</span>
              <span>Dim: {results.dimension}</span>
            </div>
          </div>

          {results.results.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">
              <Search className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p>No chunks matched your query with the current threshold ({Math.round(minScore * 100)}%).</p>
              <p className="text-xs text-slate-500 mt-1">
                Try lowering the minimum similarity threshold or generating embeddings for your notes.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {results.results.map((item, index) => (
                <div
                  key={item.chunkId}
                  className="bg-slate-950 border border-slate-800/80 rounded-xl p-5 hover:border-slate-700 transition space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-500 font-mono">#{index + 1}</span>
                      <span className="flex items-center gap-1.5 font-semibold text-slate-200 bg-slate-800 px-2.5 py-0.5 rounded-lg border border-slate-700/60">
                        <FileText className="w-3.5 h-3.5 text-indigo-400" />
                        {item.documentName}
                      </span>
                      {item.pageNumber && (
                        <span className="flex items-center gap-1 text-slate-300 bg-slate-800/80 px-2 py-0.5 rounded font-medium">
                          <Bookmark className="w-3 h-3 text-indigo-400" /> Page {item.pageNumber}
                        </span>
                      )}
                      <span className="text-slate-400 font-mono text-[11px]">
                        Chunk {item.chunkIndex + 1}
                      </span>
                    </div>

                    <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${getScoreColor(item.score)}`}>
                      {formatScore(item.score)}
                    </span>
                  </div>

                  <p className="text-xs text-slate-200 font-mono leading-relaxed bg-slate-900/80 p-3.5 rounded-lg border border-slate-800/60 whitespace-pre-wrap">
                    {item.content}
                  </p>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono pt-1">
                    <span>Offsets: [{item.charStart} - {item.charEnd}]</span>
                    <span>~{item.tokenCount} tokens</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
};
