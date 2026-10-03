import React from 'react';
import { X, FileText, CheckCircle2, Bookmark, Hash } from 'lucide-react';
import { CitationSource } from '../../api/chat';

interface CitationModalProps {
  citation: CitationSource | null;
  onClose: () => void;
}

export const CitationModal: React.FC<CitationModalProps> = ({ citation, onClose }) => {
  if (!citation) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center font-bold font-mono">
              #{citation.citationIndex}
            </div>
            <div>
              <h3 className="font-semibold text-white text-base flex items-center gap-2">
                <span>Verified Source Reference</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                  {Math.round(citation.score * 100)}% match
                </span>
              </h3>
              <p className="text-xs text-slate-400">Traceable excerpt from local SQLite store</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            title="Close Citation"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                <FileText className="w-3 h-3 text-indigo-400" /> Document
              </span>
              <p className="text-xs font-semibold text-white mt-1 truncate" title={citation.documentName}>
                {citation.documentName}
              </p>
            </div>

            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                <Bookmark className="w-3 h-3 text-amber-400" /> Page
              </span>
              <p className="text-xs font-semibold text-white mt-1 font-mono">
                {citation.pageNumber !== null ? `Page ${citation.pageNumber}` : 'N/A (txt)'}
              </p>
            </div>

            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                <Hash className="w-3 h-3 text-cyan-400" /> Chunk Index
              </span>
              <p className="text-xs font-semibold text-white mt-1 font-mono">
                #{citation.chunkIndex}
              </p>
            </div>

            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Char Range
              </span>
              <p className="text-xs font-semibold text-white mt-1 font-mono">
                {citation.charStart} - {citation.charEnd}
              </p>
            </div>
          </div>

          {/* Snippet / Context Box */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Retrieved Evidence Passage
            </label>
            <div className="p-4 bg-slate-950 border border-slate-800/80 rounded-xl text-slate-200 text-sm font-sans leading-relaxed whitespace-pre-wrap selection:bg-indigo-500/30">
              {citation.snippet}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-950/60 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>Chunk ID: <span className="font-mono text-slate-300">{citation.chunkId}</span></span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
