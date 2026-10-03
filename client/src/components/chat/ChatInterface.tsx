import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, 
  Bot, 
  User, 
  Sparkles, 
  AlertCircle, 
  Plus, 
  Trash2, 
  RefreshCw, 
  BookOpen, 
  FileText, 
  ShieldCheck, 
  ExternalLink
} from 'lucide-react';
import { 
  askQuestion, 
  getChatSessions, 
  getChatSession, 
  createChatSession, 
  deleteChatSession, 
  clearSessionMessages,
  ChatMessageRecord, 
  ChatSessionRecord, 
  CitationSource, 
  ExplanationMode,
  ChatApiError
} from '../../api/chat';
import { DocumentSummary } from '../../api/documents';
import { CitationModal } from './CitationModal';

interface ChatInterfaceProps {
  documents: DocumentSummary[];
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ documents }) => {
  // Session State
  const [sessions, setSessions] = useState<ChatSessionRecord[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);

  // Question & Query State
  const [inputQuestion, setInputQuestion] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [explanationMode, setExplanationMode] = useState<ExplanationMode>('standard');
  const [selectedDocId, setSelectedDocId] = useState<string>('all');
  const [errorBanner, setErrorBanner] = useState<{ message: string; instructions?: string } | null>(null);

  // Citation Inspection Modal State
  const [selectedCitation, setSelectedCitation] = useState<CitationSource | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load chat sessions on mount
  useEffect(() => {
    loadSessions();
  }, []);

  // When currentSessionId changes, load messages
  useEffect(() => {
    if (currentSessionId) {
      loadSessionMessages(currentSessionId);
    } else {
      setMessages([]);
    }
  }, [currentSessionId]);

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating]);

  const loadSessions = async () => {
    try {
      const list = await getChatSessions();
      setSessions(list);
      if (list.length > 0 && !currentSessionId) {
        setCurrentSessionId(list[0].id);
      }
    } catch (err) {
      console.error('Failed to load chat sessions:', err);
    }
  };

  const loadSessionMessages = async (id: string) => {
    setLoadingHistory(true);
    setErrorBanner(null);
    try {
      const sessionWithMsgs = await getChatSession(id);
      setMessages(sessionWithMsgs.messages || []);
    } catch (err) {
      console.error('Failed to load session messages:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleCreateNewSession = async () => {
    try {
      const newSession = await createChatSession({
        title: 'New Study Session',
        documentFilterIds: selectedDocId !== 'all' ? [selectedDocId] : undefined,
      });
      setSessions((prev) => [newSession, ...prev]);
      setCurrentSessionId(newSession.id);
      setMessages([]);
      setInputQuestion('');
      setErrorBanner(null);
    } catch (err) {
      alert('Failed to create new session');
    }
  };

  const handleDeleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Delete this study session and its history?')) return;

    try {
      await deleteChatSession(id);
      const remaining = sessions.filter((s) => s.id !== id);
      setSessions(remaining);
      if (currentSessionId === id) {
        setCurrentSessionId(remaining[0]?.id || null);
      }
    } catch (err) {
      alert('Failed to delete session');
    }
  };

  const handleClearCurrentSession = async () => {
    if (!currentSessionId) return;
    if (!window.confirm('Clear all messages in this session?')) return;

    try {
      await clearSessionMessages(currentSessionId);
      setMessages([]);
    } catch (err) {
      alert('Failed to clear messages');
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const q = inputQuestion.trim();
    if (!q || isGenerating) return;

    setErrorBanner(null);
    setIsGenerating(true);

    // Optimistically add student's message to view
    const optimisticUserMsg: ChatMessageRecord = {
      id: `temp-${Date.now()}`,
      session_id: currentSessionId || '',
      role: 'user',
      content: q,
      sources: null,
      insufficient_evidence: false,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticUserMsg]);
    setInputQuestion('');

    try {
      const docFilter = selectedDocId !== 'all' ? [selectedDocId] : undefined;
      const response = await askQuestion({
        question: q,
        sessionId: currentSessionId || undefined,
        documentIds: docFilter,
        explanationMode,
      });

      // Update current session if a new session was automatically created
      if (!currentSessionId || currentSessionId !== response.sessionId) {
        setCurrentSessionId(response.sessionId);
        await loadSessions();
      }

      const assistantMsg: ChatMessageRecord = {
        id: response.assistantMessageId,
        session_id: response.sessionId,
        role: 'assistant',
        content: response.answer,
        sources: response.sources,
        insufficient_evidence: response.insufficientEvidence,
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev.filter((m) => m.id !== optimisticUserMsg.id), optimisticUserMsg, assistantMsg]);
    } catch (err: unknown) {
      if (err instanceof ChatApiError) {
        setErrorBanner({
          message: err.message,
          instructions: err.instructions,
        });
      } else {
        const msg = err instanceof Error ? err.message : 'Unknown generation error';
        setErrorBanner({ message: msg });
      }
      // Revert optimistic message if generation failed
      setMessages((prev) => prev.filter((m) => m.id !== optimisticUserMsg.id));
      setInputQuestion(q);
    } finally {
      setIsGenerating(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Helper to render text with clickable citation links
  const renderMessageContent = (content: string, sources: CitationSource[] | null) => {
    if (!sources || sources.length === 0) {
      return <p className="whitespace-pre-wrap leading-relaxed">{content}</p>;
    }

    // Split text by [Source N] patterns
    const parts = content.split(/(\[Source\s*\d+\])/gi);

    return (
      <div className="whitespace-pre-wrap leading-relaxed">
        {parts.map((part, idx) => {
          const match = part.match(/\[Source\s*(\d+)\]/i);
          if (match) {
            const sourceIndex = parseInt(match[1], 10);
            const foundSource = sources.find((s) => s.citationIndex === sourceIndex);
            if (foundSource) {
              return (
                <button
                  key={idx}
                  onClick={() => setSelectedCitation(foundSource)}
                  className="inline-flex items-center gap-1 mx-1 px-2 py-0.5 rounded-md bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/40 text-xs font-mono font-semibold transition cursor-pointer"
                  title={`View evidence from ${foundSource.documentName}${foundSource.pageNumber ? ` (p. ${foundSource.pageNumber})` : ''}`}
                >
                  <span>[Source {sourceIndex}]</span>
                  <ExternalLink className="w-2.5 h-2.5 opacity-70" />
                </button>
              );
            }
          }
          return <span key={idx}>{part}</span>;
        })}
      </div>
    );
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-140px)] min-h-[600px]">
      {/* Left Sidebar: Study Sessions */}
      <div className="w-full lg:w-72 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col overflow-hidden shadow-sm flex-shrink-0">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-indigo-400" />
            <h3 className="font-semibold text-white text-sm">Study Sessions</h3>
          </div>
          <button
            onClick={handleCreateNewSession}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition shadow-sm"
            title="Start new conversation"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          {sessions.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-500">
              No sessions yet. Ask a question to start.
            </div>
          ) : (
            sessions.map((s) => (
              <div
                key={s.id}
                onClick={() => setCurrentSessionId(s.id)}
                className={`group flex items-center justify-between p-2.5 rounded-xl cursor-pointer text-xs transition border ${
                  currentSessionId === s.id
                    ? 'bg-indigo-600/15 border-indigo-500/30 text-white font-medium'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <span className={`w-1.5 h-1.5 rounded-full ${currentSessionId === s.id ? 'bg-indigo-400' : 'bg-slate-600'}`} />
                  <span className="truncate">{s.title || 'Untitled Session'}</span>
                </div>
                <button
                  onClick={(e) => handleDeleteSession(s.id, e)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-rose-400 rounded transition"
                  title="Delete session"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Scope and mode reminder in sidebar */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/40 text-[11px] text-slate-500 flex items-center justify-between">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            Strict Grounding
          </span>
          <span className="font-mono text-slate-400">{documents.length} docs indexed</span>
        </div>
      </div>

      {/* Main Chat Panel */}
      <div className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col overflow-hidden shadow-sm">
        {/* Top Chat Bar: Controls */}
        <div className="p-4 border-b border-slate-800 bg-slate-950/40 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/20">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <span>AI Grounded Tutor</span>
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  Zero Cloud Leaks
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">Answers backed exclusively by uploaded study excerpts</p>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2.5 text-xs">
            {/* Document Scope Filter */}
            <div className="flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1.5 rounded-xl border border-slate-700/60">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={selectedDocId}
                onChange={(e) => setSelectedDocId(e.target.value)}
                className="bg-transparent text-slate-200 text-xs focus:outline-none cursor-pointer"
              >
                <option value="all" className="bg-slate-900 text-slate-200">Scope: All Uploaded Notes</option>
                {documents.map((d) => (
                  <option key={d.id} value={d.id} className="bg-slate-900 text-slate-200">
                    Doc: {d.filename}
                  </option>
                ))}
              </select>
            </div>

            {/* Explanation Mode Selector */}
            <div className="flex items-center bg-slate-800/80 p-0.5 rounded-xl border border-slate-700/60 font-medium text-[11px]">
              <button
                type="button"
                onClick={() => setExplanationMode('standard')}
                className={`px-2.5 py-1 rounded-lg transition ${
                  explanationMode === 'standard'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Standard academic explanation"
              >
                Standard
              </button>
              <button
                type="button"
                onClick={() => setExplanationMode('concise')}
                className={`px-2.5 py-1 rounded-lg transition ${
                  explanationMode === 'concise'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Concise 2-4 sentences"
              >
                Concise
              </button>
              <button
                type="button"
                onClick={() => setExplanationMode('simple')}
                className={`px-2.5 py-1 rounded-lg transition ${
                  explanationMode === 'simple'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Simple beginner-friendly analogy"
              >
                Simple
              </button>
            </div>

            {messages.length > 0 && (
              <button
                onClick={handleClearCurrentSession}
                className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition"
                title="Clear current session messages"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Error Banner */}
        {errorBanner && (
          <div className="mx-4 mt-4 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold">{errorBanner.message}</p>
              {errorBanner.instructions && (
                <pre className="mt-1.5 p-2 bg-slate-950 rounded border border-rose-500/20 text-rose-200 font-mono text-[11px] whitespace-pre-wrap">
                  {errorBanner.instructions}
                </pre>
              )}
            </div>
            <button
              onClick={() => setErrorBanner(null)}
              className="text-rose-400 hover:text-white"
            >
              &times;
            </button>
          </div>
        )}

        {/* Messages Feed */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {loadingHistory ? (
            <div className="flex items-center justify-center h-full text-slate-500 gap-2 text-sm">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Loading session conversation...</span>
            </div>
          ) : messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 max-w-lg mx-auto">
              <div className="w-14 h-14 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mb-4">
                <Sparkles className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold text-white">Ask StudyMate Anything About Your Notes</h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                StudyMate will retrieve relevant passages from your uploaded documents and generate explanations with exact source citations. If the notes don't have enough facts, it will honestly decline to answer rather than hallucinating.
              </p>

              {documents.length === 0 ? (
                <div className="mt-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
                  Upload PDF or TXT course materials first in the <strong>Notes &amp; Chunks</strong> tab before asking questions.
                </div>
              ) : (
                <div className="mt-6 flex flex-wrap gap-2 justify-center">
                  <button
                    onClick={() => setInputQuestion('What are the key concepts explained in these notes?')}
                    className="text-xs px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 text-slate-300 transition"
                  >
                    &ldquo;What are the key concepts?&rdquo;
                  </button>
                  <button
                    onClick={() => setInputQuestion('Summarize the main definitions and mechanisms.')}
                    className="text-xs px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 text-slate-300 transition"
                  >
                    &ldquo;Summarize main definitions&rdquo;
                  </button>
                  <button
                    onClick={() => setInputQuestion('Can you explain the main process step-by-step?')}
                    className="text-xs px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 text-slate-300 transition"
                  >
                    &ldquo;Explain step-by-step&rdquo;
                  </button>
                </div>
              )}
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center flex-shrink-0 mt-1">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`max-w-2xl rounded-2xl p-4 sm:p-5 text-sm shadow-sm ${
                    msg.role === 'user'
                      ? 'bg-indigo-600 text-white rounded-tr-none'
                      : 'bg-slate-950/80 border border-slate-800/80 text-slate-200 rounded-tl-none'
                  }`}
                >
                  {/* Insufficient Evidence Warning Banner */}
                  {msg.role === 'assistant' && msg.insufficient_evidence && (
                    <div className="mb-3.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold block">Insufficient Evidence Detected</span>
                        <span className="text-[11px] text-amber-200/80">
                          The question cannot be answered purely from the uploaded notes. StudyMate avoids hallucination by refusing to invent answers.
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Message Text with Interactive Citations */}
                  {msg.role === 'assistant' ? (
                    renderMessageContent(msg.content, msg.sources)
                  ) : (
                    <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  )}

                  {/* Grounded Sources Pill Strip */}
                  {msg.role === 'assistant' && msg.sources && msg.sources.length > 0 && !msg.insufficient_evidence && (
                    <div className="mt-4 pt-3.5 border-t border-slate-800/80 space-y-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
                        Verified Sources ({msg.sources.length})
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {msg.sources.map((src) => (
                          <button
                            key={src.citationIndex}
                            onClick={() => setSelectedCitation(src)}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-indigo-500/40 text-slate-300 text-xs transition cursor-pointer"
                          >
                            <span className="w-4 h-4 rounded bg-indigo-600/30 text-indigo-400 flex items-center justify-center font-mono text-[10px] font-bold">
                              {src.citationIndex}
                            </span>
                            <span className="truncate max-w-[140px] font-medium" title={src.documentName}>
                              {src.documentName}
                            </span>
                            {src.pageNumber !== null && (
                              <span className="text-[10px] text-slate-500 font-mono">p.{src.pageNumber}</span>
                            )}
                            <span className="text-[10px] px-1 rounded bg-emerald-500/10 text-emerald-400 font-mono">
                              {Math.round(src.score * 100)}%
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div
                    className={`mt-2 text-[10px] ${
                      msg.role === 'user' ? 'text-indigo-200' : 'text-slate-500'
                    } text-right`}
                  >
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>

                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-xl bg-slate-800 text-slate-300 border border-slate-700/60 flex items-center justify-center flex-shrink-0 mt-1">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))
          )}

          {isGenerating && (
            <div className="flex gap-3.5 justify-start">
              <div className="w-8 h-8 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center flex-shrink-0 mt-1">
                <Bot className="w-4 h-4" />
              </div>
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 text-xs text-slate-400 flex items-center gap-3">
                <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
                <span>Searching local notes &amp; generating grounded explanation ({explanationMode} mode)...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-800 bg-slate-950/60">
          <div className="relative flex items-end gap-2 bg-slate-900 border border-slate-800 rounded-2xl p-2 focus-within:border-indigo-500/50 transition">
            <textarea
              ref={inputRef}
              rows={2}
              value={inputQuestion}
              onChange={(e) => setInputQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question about your study notes... (Press Enter to send, Shift+Enter for newline)"
              disabled={isGenerating}
              className="flex-1 bg-transparent px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none resize-none disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!inputQuestion.trim() || isGenerating}
              className="p-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-medium transition flex items-center justify-center shadow-lg shadow-indigo-600/20"
              title="Send question"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2 px-2">
            <span>Powered by local Ollama AI</span>
            <span>Responses strictly constrained to uploaded study notes</span>
          </div>
        </form>
      </div>

      {/* Citation Inspector Modal */}
      <CitationModal
        citation={selectedCitation}
        onClose={() => setSelectedCitation(null)}
      />
    </div>
  );
};
