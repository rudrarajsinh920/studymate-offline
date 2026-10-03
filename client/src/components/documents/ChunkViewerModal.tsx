import { X, Layers, Hash, Bookmark } from 'lucide-react';
import { DocumentDetailResponse } from '../../api/documents';

interface ChunkViewerModalProps {
  data: DocumentDetailResponse | null;
  loading: boolean;
  onClose: () => void;
}

export const ChunkViewerModal: React.FC<ChunkViewerModalProps> = ({ data, loading, onClose }) => {
  if (!data && !loading) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-600/10 text-indigo-400 border border-indigo-500/20">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-base">
                {data?.document.filename || 'Loading Document...'}
              </h3>
              <p className="text-xs text-slate-400">
                {data ? `${data.chunks.length} chunks generated • ${data.document.character_count.toLocaleString()} characters` : 'Extracting chunks...'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400 space-y-3">
              <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs">Loading chunk records from local SQLite...</p>
            </div>
          ) : data?.chunks.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">
              No chunks found for this document.
            </div>
          ) : (
            data?.chunks.map((chunk) => (
              <div
                key={chunk.id}
                className="bg-slate-950 border border-slate-800/80 rounded-xl p-4 hover:border-slate-700 transition"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-800/60 text-xs">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 font-semibold text-indigo-400">
                      <Hash className="w-3.5 h-3.5" /> Chunk #{chunk.chunk_index + 1}
                    </span>
                    {chunk.page_number && (
                      <span className="flex items-center gap-1 text-slate-300 bg-slate-800 px-2 py-0.5 rounded font-medium">
                        <Bookmark className="w-3 h-3 text-indigo-400" /> Page {chunk.page_number}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-slate-400">
                    <span>{chunk.content.length} chars</span>
                    <span>&bull;</span>
                    <span>~{chunk.token_count} tokens</span>
                    <span>&bull;</span>
                    <span className="font-mono text-[11px] text-slate-500">
                      [{chunk.char_start} - {chunk.char_end}]
                    </span>
                  </div>
                </div>
                <p className="text-xs text-slate-200 leading-relaxed font-mono whitespace-pre-wrap bg-slate-900/60 p-3 rounded-lg border border-slate-800/40">
                  {chunk.content}
                </p>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-900/80 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
