import React, { useState, useEffect, useCallback } from 'react';
import { 
  Server, 
  Cpu, 
  ShieldCheck, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  BookOpen, 
  Terminal, 
  Clock,
  Sparkles,
  Activity,
  FolderOpen,
  Bot,
  Calendar,
  HelpCircle
} from 'lucide-react';
import { HealthResponse } from './types/health';
import { 
  getDocuments, 
  deleteDocument, 
  getDocumentDetails, 
  DocumentSummary, 
  DocumentDetailResponse 
} from './api/documents';
import { embedSingleDocument } from './api/retrieval';
import { DocumentUpload } from './components/documents/DocumentUpload';
import { DocumentList } from './components/documents/DocumentList';
import { ChunkViewerModal } from './components/documents/ChunkViewerModal';
import { SemanticSearch } from './components/retrieval/SemanticSearch';
import { ChatInterface } from './components/chat/ChatInterface';
import { StudyPlanner } from './components/planner/StudyPlanner';
import { QuizManager } from './components/quiz/QuizManager';

export default function App(): React.JSX.Element {
  // Navigation tab state: 'tutor' | 'planner' | 'quiz' | 'documents' | 'search' | 'health'
  const [activeTab, setActiveTab] = useState<'tutor' | 'planner' | 'quiz' | 'documents' | 'search' | 'health'>('tutor');

  // Health State
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthLoading, setHealthLoading] = useState<boolean>(true);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  // Documents State
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [docsLoading, setDocsLoading] = useState<boolean>(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [embeddingDocId, setEmbeddingDocId] = useState<string | null>(null);

  // Chunk Viewer Modal State
  const [selectedDocDetails, setSelectedDocDetails] = useState<DocumentDetailResponse | null>(null);
  const [modalLoading, setModalLoading] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const fetchHealth = useCallback(async () => {
    setHealthLoading(true);
    setHealthError(null);
    try {
      const response = await fetch('/api/health');
      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`);
      }
      const data: HealthResponse = await response.json();
      setHealth(data);
      setLastChecked(new Date());
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to connect to backend server';
      setHealthError(message);
      setHealth(null);
    } finally {
      setHealthLoading(false);
    }
  }, []);

  const fetchDocs = useCallback(async () => {
    setDocsLoading(true);
    try {
      const data = await getDocuments();
      setDocuments(data);
    } catch (err) {
      console.error('Error fetching documents:', err);
    } finally {
      setDocsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    fetchDocs();
  }, [fetchHealth, fetchDocs]);

  const handleDocumentUploaded = (newDoc: DocumentSummary) => {
    setDocuments((prev) => [newDoc, ...prev.filter((d) => d.id !== newDoc.id)]);
  };

  const handleDeleteDocument = async (id: string, filename: string) => {
    if (!window.confirm(`Are you sure you want to delete '${filename}' and all its extracted chunks?`)) {
      return;
    }

    setDeletingId(id);
    try {
      await deleteDocument(id);
      setDocuments((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete document');
    } finally {
      setDeletingId(null);
    }
  };

  const handleEmbedDoc = async (id: string) => {
    setEmbeddingDocId(id);
    try {
      await embedSingleDocument(id);
      await fetchDocs();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to embed document';
      const inst = (err as any)?.instructions;
      alert(`${msg}${inst ? `\n\n${inst}` : ''}`);
    } finally {
      setEmbeddingDocId(null);
    }
  };

  const handleViewChunks = async (id: string) => {
    setIsModalOpen(true);
    setModalLoading(true);
    try {
      const details = await getDocumentDetails(id);
      setSelectedDocDetails(details);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to load chunks');
      setIsModalOpen(false);
    } finally {
      setModalLoading(false);
    }
  };

  const isServerOnline = !!health && health.status === 'ok';
  const isOllamaOnline = !!health?.ollama?.connected;
  const hasLlm = !!health?.ollama?.hasConfiguredLlm;
  const hasEmbed = !!health?.ollama?.hasConfiguredEmbed;

  const totalChunks = documents.reduce((acc, doc) => acc + (doc.chunk_count || 0), 0);
  const totalCharacters = documents.reduce((acc, doc) => acc + (doc.character_count || 0), 0);
  const embeddedDocsCount = documents.filter((d) => d.embedding_status === 'completed').length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navigation / Brand Header */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur px-6 py-4 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-white">StudyMate Offline</h1>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  Milestone 5 Planner &amp; Quizzes
                </span>
              </div>
              <p className="text-xs text-slate-400">Privacy-first, self-hosted AI study companion</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Nav Tabs */}
            <div className="flex items-center bg-slate-800/80 p-1 rounded-xl border border-slate-700/60 text-xs font-medium">
              <button
                onClick={() => setActiveTab('tutor')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                  activeTab === 'tutor'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Bot className="w-3.5 h-3.5" />
                <span>AI Tutor</span>
              </button>
              <button
                onClick={() => setActiveTab('planner')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                  activeTab === 'planner'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Calendar className="w-3.5 h-3.5 text-indigo-300" />
                <span>Planner</span>
              </button>
              <button
                onClick={() => setActiveTab('quiz')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                  activeTab === 'quiz'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <HelpCircle className="w-3.5 h-3.5 text-amber-300" />
                <span>Quizzes</span>
              </button>
              <button
                onClick={() => setActiveTab('documents')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                  activeTab === 'documents'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <FolderOpen className="w-3.5 h-3.5" />
                <span>Notes &amp; Chunks</span>
              </button>
              <button
                onClick={() => setActiveTab('search')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                  activeTab === 'search'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Semantic Search</span>
              </button>
              <button
                onClick={() => setActiveTab('health')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                  activeTab === 'health'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Diagnostics</span>
              </button>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-medium">
              <ShieldCheck className="w-4 h-4" />
              <span className="hidden sm:inline">100% Offline</span>
            </div>

            <button
              onClick={() => {
                fetchHealth();
                fetchDocs();
              }}
              disabled={healthLoading || docsLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition disabled:opacity-50"
              title="Refresh Health and Documents"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${healthLoading || docsLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-6 space-y-6">
        {activeTab === 'tutor' && (
          <ChatInterface documents={documents} />
        )}

        {activeTab === 'planner' && (
          <StudyPlanner documents={documents} />
        )}

        {activeTab === 'quiz' && (
          <QuizManager documents={documents} />
        )}

        {activeTab === 'documents' && (
          <>
            {/* Ingestion Stats Header */}
            <section className="bg-gradient-to-r from-indigo-950/40 via-slate-900 to-slate-900 border border-indigo-900/40 rounded-2xl p-6 shadow-sm">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
                    Document Ingestion &amp; Chunking
                  </span>
                  <h2 className="text-2xl font-bold text-white mt-1">Study Material Ingestion Hub</h2>
                  <p className="text-sm text-slate-400 mt-1 max-w-2xl">
                    Upload course notes. Chunks and embeddings are preserved in your local SQLite database for instant semantic search.
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full md:w-auto text-center">
                  <div className="bg-slate-950/80 border border-slate-800 px-4 py-2.5 rounded-xl">
                    <span className="text-xs text-slate-400 block">Documents</span>
                    <span className="text-lg font-bold text-white font-mono">{documents.length}</span>
                  </div>
                  <div className="bg-slate-950/80 border border-slate-800 px-4 py-2.5 rounded-xl">
                    <span className="text-xs text-slate-400 block">Chunks</span>
                    <span className="text-lg font-bold text-indigo-400 font-mono">{totalChunks}</span>
                  </div>
                  <div className="bg-slate-950/80 border border-slate-800 px-4 py-2.5 rounded-xl">
                    <span className="text-xs text-slate-400 block">Characters</span>
                    <span className="text-lg font-bold text-emerald-400 font-mono">
                      {totalCharacters > 1000 ? `${(totalCharacters / 1000).toFixed(1)}k` : totalCharacters}
                    </span>
                  </div>
                  <div className="bg-slate-950/80 border border-slate-800 px-4 py-2.5 rounded-xl">
                    <span className="text-xs text-slate-400 block">Embedded</span>
                    <span className="text-lg font-bold text-purple-400 font-mono">{embeddedDocsCount} / {documents.length}</span>
                  </div>
                </div>
              </div>
            </section>

            {/* Document Ingestion Zone */}
            <DocumentUpload onSuccess={handleDocumentUploaded} />

            {/* Document Library Table/List */}
            <DocumentList
              documents={documents}
              loading={docsLoading}
              onViewChunks={handleViewChunks}
              onDelete={handleDeleteDocument}
              onEmbedDocument={handleEmbedDoc}
              embeddingDocId={embeddingDocId}
              deletingId={deletingId}
            />
          </>
        )}

        {activeTab === 'search' && (
          <SemanticSearch documents={documents} onEmbedSuccess={fetchDocs} />
        )}

        {activeTab === 'health' && (
          <>
            {/* System Health View */}
            <section className="bg-gradient-to-r from-indigo-950/40 via-slate-900 to-slate-900 border border-indigo-900/40 rounded-2xl p-6 shadow-sm">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
                    System Health &amp; Diagnostics
                  </span>
                  <h2 className="text-2xl font-bold text-white mt-1">Environment Readiness</h2>
                  <p className="text-sm text-slate-400 mt-1 max-w-2xl">
                    Verifies connection to the local Express backend and local Ollama inference service.
                  </p>
                </div>
                {lastChecked && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-800/60 px-3 py-1.5 rounded-lg border border-slate-700/50">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Checked at {lastChecked.toLocaleTimeString()}</span>
                  </div>
                )}
              </div>
            </section>

            {/* Global Connection Alert if Backend is Offline */}
            {healthError && (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-start gap-3">
                <XCircle className="w-5 h-5 mt-0.5 flex-shrink-0 text-rose-400" />
                <div>
                  <h4 className="font-semibold text-sm">Backend API Unreachable</h4>
                  <p className="text-xs text-rose-200/80 mt-1">{healthError}</p>
                </div>
              </div>
            )}

            {/* Service Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Express Backend Status */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-slate-800 text-indigo-400 border border-slate-700/60">
                        <Server className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-white">Node.js Express API</h3>
                        <p className="text-xs text-slate-400">Core application service</p>
                      </div>
                    </div>
                    {isServerOnline ? (
                      <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Online
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
                        <XCircle className="w-3.5 h-3.5" /> Offline
                      </span>
                    )}
                  </div>

                  <div className="mt-6 space-y-3">
                    <div className="flex justify-between items-center text-xs py-2 border-b border-slate-800/80">
                      <span className="text-slate-400">Endpoint</span>
                      <span className="font-mono text-slate-200">http://localhost:5000/api/health</span>
                    </div>
                    <div className="flex justify-between items-center text-xs py-2 border-b border-slate-800/80">
                      <span className="text-slate-400">Node Runtime</span>
                      <span className="font-mono text-slate-200">{health?.server?.nodeVersion || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs py-2 border-b border-slate-800/80">
                      <span className="text-slate-400">Environment</span>
                      <span className="font-mono text-slate-200 uppercase">{health?.environment || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs py-2 border-b border-slate-800/80">
                      <span className="text-slate-400">Uptime</span>
                      <span className="font-mono text-slate-200">
                        {health ? `${health.uptimeSeconds} seconds` : 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-800/80 text-xs text-slate-400">
                  <span className={isServerOnline ? 'text-emerald-400' : 'text-rose-400'}>
                    {isServerOnline ? 'Express service operational.' : 'Awaiting server launch'}
                  </span>
                </div>
              </div>

              {/* Ollama Status */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-slate-800 text-indigo-400 border border-slate-700/60">
                        <Cpu className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-white">Ollama Local AI Engine</h3>
                        <p className="text-xs text-slate-400">On-device inference &amp; embeddings</p>
                      </div>
                    </div>
                    {isOllamaOnline ? (
                      <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Connected
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        <AlertTriangle className="w-3.5 h-3.5" /> Unreachable
                      </span>
                    )}
                  </div>

                  <div className="mt-6 space-y-3">
                    <div className="flex justify-between items-center text-xs py-2 border-b border-slate-800/80">
                      <span className="text-slate-400">Base URL</span>
                      <span className="font-mono text-slate-200">{health?.ollama?.baseUrl || 'http://127.0.0.1:11434'}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs py-2 border-b border-slate-800/80">
                      <span className="text-slate-400">Configured LLM</span>
                      <div className="flex items-center gap-1.5 font-mono text-slate-200">
                        <span>{health?.ollama?.configuredModels?.llm || 'llama3.2:3b'}</span>
                        {health && (
                          hasLlm ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <span className="text-[10px] px-1.5 py-0.2 bg-amber-500/20 text-amber-400 rounded">Missing</span>
                          )
                        )}
                      </div>
                    </div>
                    <div className="flex justify-between items-center text-xs py-2 border-b border-slate-800/80">
                      <span className="text-slate-400">Configured Embeddings</span>
                      <div className="flex items-center gap-1.5 font-mono text-slate-200">
                        <span>{health?.ollama?.configuredModels?.embed || 'nomic-embed-text'}</span>
                        {health && (
                          hasEmbed ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <span className="text-[10px] px-1.5 py-0.2 bg-amber-500/20 text-amber-400 rounded">Missing</span>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-800/80 text-xs">
                  {health?.ollama?.message && !isOllamaOnline && (
                    <p className="text-amber-300/90 text-xs">{health.ollama.message}</p>
                  )}
                  {isOllamaOnline && (
                    <p className="text-emerald-400 text-xs">Ollama is ready for local AI queries.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Offline AI Instructions */}
            {!isOllamaOnline && (
              <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-3">
                <div className="flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-indigo-400" />
                  <h3 className="text-base font-semibold text-white">Local AI Instructions</h3>
                </div>
                <p className="text-xs text-slate-400">
                  To enable vector embeddings and offline semantic search, run Ollama and pull the embedding model:
                </p>
                <div className="flex flex-wrap gap-2 text-xs font-mono">
                  <code className="bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-slate-300">
                    ollama pull nomic-embed-text
                  </code>
                  <code className="bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-slate-300">
                    ollama pull llama3.2:3b
                  </code>
                </div>
              </section>
            )}
          </>
        )}
      </main>

      {/* Chunk Viewer Modal */}
      {isModalOpen && (
        <ChunkViewerModal
          data={selectedDocDetails}
          loading={modalLoading}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedDocDetails(null);
          }}
        />
      )}

      {/* Footer */}
      <footer className="border-t border-slate-800 py-4 px-6 text-center text-xs text-slate-500">
        StudyMate Offline &bull; Milestone 5: Personalized Study Planner &amp; Quiz Generation &bull; Privacy-First Local AI
      </footer>
    </div>
  );
}
