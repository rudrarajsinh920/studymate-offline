import React from 'react';
import { 
  FileText, 
  Trash2, 
  Layers, 
  Calendar, 
  HardDrive, 
  AlertCircle, 
  CheckCircle2, 
  Clock,
  Sparkles
} from 'lucide-react';
import { DocumentSummary } from '../../api/documents';

interface DocumentListProps {
  documents: DocumentSummary[];
  loading: boolean;
  onViewChunks: (id: string) => void;
  onDelete: (id: string, filename: string) => void;
  onEmbedDocument?: (id: string) => void;
  embeddingDocId?: string | null;
  deletingId: string | null;
}

export const DocumentList: React.FC<DocumentListProps> = ({
  documents,
  loading,
  onViewChunks,
  onDelete,
  onEmbedDocument,
  embeddingDocId,
  deletingId,
}) => {
  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateStr: string): string => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-indigo-400" />
          <h3 className="font-semibold text-white text-base">Your Study Notes Library</h3>
        </div>
        <span className="text-xs font-medium text-slate-400 bg-slate-800 px-2.5 py-1 rounded-full">
          {documents.length} {documents.length === 1 ? 'Document' : 'Documents'}
        </span>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 text-slate-400 space-y-3">
          <div className="w-7 h-7 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs">Loading documents...</p>
        </div>
      ) : documents.length === 0 ? (
        <div className="text-center py-12 border border-slate-800/80 rounded-xl bg-slate-950/40">
          <FileText className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h4 className="text-sm font-medium text-slate-300">No notes uploaded yet</h4>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Upload your lecture notes, textbook chapters, or revision summaries above to prepare for local AI studying.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-800/80">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 group"
            >
              <div className="flex items-start gap-3">
                <div className={`p-2.5 rounded-xl border mt-0.5 ${
                  doc.file_type === 'pdf'
                    ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                    : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                }`}>
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-semibold text-sm text-slate-200 group-hover:text-indigo-400 transition">
                      {doc.filename}
                    </h4>
                    <span className="uppercase text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700/60">
                      {doc.file_type}
                    </span>
                    {doc.status === 'ready' && (
                      <span className="flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 font-medium">
                        <CheckCircle2 className="w-3 h-3" /> Ready
                      </span>
                    )}
                    {doc.embedding_status === 'completed' && (
                      <span className="flex items-center gap-1 text-[11px] text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/20 font-medium">
                        <Sparkles className="w-3 h-3" /> Embedded
                      </span>
                    )}
                    {doc.status === 'ready' && doc.embedding_status === 'pending' && (
                      <span className="flex items-center gap-1 text-[11px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 font-medium">
                        <Clock className="w-3 h-3" /> No Embeddings
                      </span>
                    )}
                    {doc.status === 'failed' && (
                      <span className="flex items-center gap-1 text-[11px] text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20 font-medium">
                        <AlertCircle className="w-3 h-3" /> Failed
                      </span>
                    )}
                    {doc.status === 'processing' && (
                      <span className="flex items-center gap-1 text-[11px] text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20 font-medium">
                        <Clock className="w-3 h-3 animate-spin" /> Processing
                      </span>
                    )}
                  </div>

                  {doc.error_message ? (
                    <p className="text-xs text-rose-400 mt-1">{doc.error_message}</p>
                  ) : (
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-1.5">
                      <span className="flex items-center gap-1">
                        <HardDrive className="w-3 h-3 text-slate-500" />
                        {formatSize(doc.file_size)}
                      </span>
                      <span>&bull;</span>
                      <span className="flex items-center gap-1 text-indigo-300">
                        <Layers className="w-3 h-3 text-indigo-400" />
                        {doc.chunk_count} chunks
                      </span>
                      <span>&bull;</span>
                      <span>{doc.character_count.toLocaleString()} chars</span>
                      <span>&bull;</span>
                      <span className="flex items-center gap-1 text-slate-500">
                        <Calendar className="w-3 h-3" />
                        {formatDate(doc.created_at)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center">
                {onEmbedDocument && doc.status === 'ready' && doc.embedding_status !== 'completed' && (
                  <button
                    onClick={() => onEmbedDocument(doc.id)}
                    disabled={embeddingDocId === doc.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-xs font-medium border border-indigo-500/30 transition disabled:opacity-40"
                    title="Generate Vector Embeddings"
                  >
                    <Sparkles className={`w-3.5 h-3.5 ${embeddingDocId === doc.id ? 'animate-spin' : ''}`} />
                    <span>Embed</span>
                  </button>
                )}
                <button
                  onClick={() => onViewChunks(doc.id)}
                  disabled={doc.status !== 'ready'}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>View Chunks</span>
                </button>
                <button
                  onClick={() => onDelete(doc.id, doc.filename)}
                  disabled={deletingId === doc.id}
                  className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-slate-700/60 hover:border-rose-500/30 transition disabled:opacity-50"
                  title="Delete Document & Chunks"
                >
                  <Trash2 className={`w-4 h-4 ${deletingId === doc.id ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
