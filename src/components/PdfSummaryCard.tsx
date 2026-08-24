import React from 'react';
import { DocMetadata } from '../types';
import { FileDown, Maximize2, CheckCircle2, FileText, Calendar, HardDrive, Layers, RefreshCw } from 'lucide-react';

interface PdfSummaryCardProps {
  metadata: DocMetadata | null;
  onOpenPreview: () => void;
  onReset: () => void;
  darkMode: boolean;
}

export const PdfSummaryCard: React.FC<PdfSummaryCardProps> = ({
  metadata,
  onOpenPreview,
  onReset,
  darkMode,
}) => {
  if (!metadata) {
    // Empty Placeholder Card when idle
    return (
      <div className={`w-full rounded-2xl p-4 border backdrop-blur-md shadow-2xl relative overflow-hidden flex flex-col gap-3 ${
        darkMode ? 'bg-neutral-950/25 border-neutral-800/40' : 'bg-white/40 border-neutral-200/60'
      }`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`h-9 w-9 rounded-xl border flex items-center justify-center shrink-0 ${
              darkMode ? 'bg-neutral-900 border-neutral-800 text-neutral-500' : 'bg-neutral-100 border-neutral-200 text-neutral-400'
            }`}>
              <FileText className="h-4 w-4" />
            </div>
            <div>
              <h3 className={`text-sm font-bold ${darkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>No Document Loaded</h3>
              <p className={`text-xs ${darkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>Paste Scribd link to compile 1:1 PDF</p>
            </div>
          </div>
        </div>

        {/* Empty Metadata Grid */}
        <div className={`grid grid-cols-3 gap-2 py-2 px-3 rounded-xl border ${
          darkMode ? 'bg-black/40 border-neutral-800/60' : 'bg-neutral-100/50 border-neutral-200/60'
        }`}>
          <div className="flex items-center gap-2">
            <Layers className={`h-4 w-4 shrink-0 ${darkMode ? 'text-neutral-600' : 'text-neutral-400'}`} />
            <div>
              <div className={`text-[10px] uppercase font-semibold ${darkMode ? 'text-neutral-600' : 'text-neutral-400'}`}>Pages</div>
              <div className={`text-xs font-bold ${darkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>-- Pages</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <HardDrive className={`h-4 w-4 shrink-0 ${darkMode ? 'text-neutral-600' : 'text-neutral-400'}`} />
            <div>
              <div className={`text-[10px] uppercase font-semibold ${darkMode ? 'text-neutral-600' : 'text-neutral-400'}`}>Size</div>
              <div className={`text-xs font-bold ${darkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>-- MB</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Calendar className={`h-4 w-4 shrink-0 ${darkMode ? 'text-neutral-600' : 'text-neutral-400'}`} />
            <div>
              <div className={`text-[10px] uppercase font-semibold ${darkMode ? 'text-neutral-600' : 'text-neutral-400'}`}>Status</div>
              <div className={`text-xs font-bold ${darkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>Idle</div>
            </div>
          </div>
        </div>

        {/* Disabled Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-2 pt-1 opacity-50 pointer-events-none">
          <button className={`flex-1 px-4 py-2.5 font-semibold text-sm rounded-xl flex items-center justify-center gap-2 ${
            darkMode ? 'bg-neutral-800 text-neutral-400' : 'bg-neutral-200 text-neutral-500'
          }`}>
            <FileDown className="h-4 w-4" />
            <span>Download PDF</span>
          </button>
          <button className={`px-4 py-2.5 font-medium text-sm rounded-xl border flex items-center justify-center gap-2 ${
            darkMode ? 'bg-neutral-900 border-neutral-800 text-neutral-500' : 'bg-neutral-100 border-neutral-200 text-neutral-500'
          }`}>
            <Maximize2 className="h-4 w-4" />
            <span>View</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full rounded-2xl p-4 border backdrop-blur-md shadow-2xl relative overflow-hidden flex flex-col gap-3 ${
      darkMode ? 'bg-neutral-900/90 border-neutral-700' : 'bg-white/90 border-neutral-300'
    }`}>
      {/* Title & Badge */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`h-9 w-9 rounded-xl border flex items-center justify-center shrink-0 ${
            darkMode ? 'bg-neutral-800 border-neutral-700 text-neutral-200' : 'bg-neutral-100 border-neutral-300 text-neutral-800'
          }`}>
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className={`text-sm font-bold line-clamp-1 ${darkMode ? 'text-neutral-100' : 'text-neutral-900'}`}>{metadata.title}</h3>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                darkMode ? 'bg-neutral-800 text-neutral-200 border-neutral-700' : 'bg-neutral-200 text-neutral-800 border-neutral-300'
              }`}>
                <CheckCircle2 className="h-3 w-3" /> Ready
              </span>
            </div>
            <p className={`text-xs ${darkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>PDF Document Compiled & Ready</p>
          </div>
        </div>

        <button
          onClick={onReset}
          className={`p-1.5 rounded-lg transition-colors ${
            darkMode ? 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800' : 'text-neutral-500 hover:text-neutral-800 hover:bg-neutral-200'
          }`}
          title="Convert another document"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Metadata Badges & Specs Grid */}
      <div className={`grid grid-cols-3 gap-2 py-2 px-3 rounded-xl border ${
        darkMode ? 'bg-black/60 border-neutral-800' : 'bg-neutral-100/80 border-neutral-200'
      }`}>
        <div className="flex items-center gap-2">
          <Layers className={`h-4 w-4 shrink-0 ${darkMode ? 'text-neutral-400' : 'text-neutral-600'}`} />
          <div>
            <div className={`text-[10px] uppercase font-semibold ${darkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>Pages</div>
            <div className={`text-xs font-bold ${darkMode ? 'text-neutral-200' : 'text-neutral-800'}`}>{metadata.pageCount} Pages</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <HardDrive className={`h-4 w-4 shrink-0 ${darkMode ? 'text-neutral-400' : 'text-neutral-600'}`} />
          <div>
            <div className={`text-[10px] uppercase font-semibold ${darkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>File Size</div>
            <div className={`text-xs font-bold ${darkMode ? 'text-neutral-200' : 'text-neutral-800'}`}>{metadata.formattedSize}</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Calendar className={`h-4 w-4 shrink-0 ${darkMode ? 'text-neutral-400' : 'text-neutral-600'}`} />
          <div>
            <div className={`text-[10px] uppercase font-semibold ${darkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>Created</div>
            <div className={`text-xs font-bold ${darkMode ? 'text-neutral-200' : 'text-neutral-800'}`}>{metadata.createdAt}</div>
          </div>
        </div>
      </div>

      {/* Action Buttons: Direct Download + Open Native PDF View */}
      <div className="flex flex-col sm:flex-row gap-2 pt-1">
        <a
          href={metadata.pdfUrl}
          download={`${metadata.title.replace(/\s+/g, '_')}.pdf`}
          className={`flex-1 px-4 py-2.5 font-semibold text-sm rounded-xl shadow-md flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${
            darkMode
              ? 'bg-neutral-100 hover:bg-white text-black'
              : 'bg-neutral-900 hover:bg-black text-white'
          }`}
        >
          <FileDown className="h-4 w-4" />
          <span>Download PDF</span>
        </a>

        <button
          onClick={onOpenPreview}
          className={`px-4 py-2.5 font-medium text-sm rounded-xl border flex items-center justify-center gap-2 transition-colors active:scale-[0.98] ${
            darkMode
              ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border-neutral-700'
              : 'bg-white hover:bg-neutral-100 text-neutral-800 border-neutral-300'
          }`}
        >
          <Maximize2 className="h-4 w-4" />
          <span>View</span>
        </button>
      </div>
    </div>
  );
};
