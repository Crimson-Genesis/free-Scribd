import React, { useState, useRef, ChangeEvent, DragEvent } from 'react';
import { Link, Loader2, Sparkles, Upload, FileCode, FileText, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { validateUrl, sanitizeUrl } from '../lib/pdf-generator';

interface UrlInputProps {
  onSubmitUrl: (url: string) => void;
  onFileUpload?: (file: File) => void;
  isProcessing: boolean;
  darkMode: boolean;
}

type InputTab = 'url' | 'upload' | 'paste';

export const UrlInput: React.FC<UrlInputProps> = ({
  onSubmitUrl,
  onFileUpload,
  isProcessing,
  darkMode,
}) => {
  const [activeTab, setActiveTab] = useState<InputTab>('url');
  const [url, setUrl] = useState('');
  const [pastedHtml, setPastedHtml] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setUrl(value);

    if (value.trim() === '') {
      toast.dismiss('scribd-url-valid');
      toast.dismiss('scribd-url-invalid');
      return;
    }

    const check = validateUrl(value);
    if (check.valid) {
      toast.dismiss('scribd-url-invalid');
      toast.success('Valid Link Detected', {
        id: 'scribd-url-valid',
        description: 'Scribd document link verified.',
        duration: 3000,
      });
    } else {
      toast.dismiss('scribd-url-valid');
      toast.warning('Check Link Syntax', {
        id: 'scribd-url-invalid',
        description: check.message || 'Please enter a valid Scribd document URL.',
        duration: 4000,
      });
    }
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) {
      toast.warning('Empty Link Field', {
        id: 'scribd-url-empty',
        description: 'Please paste a valid Scribd document URL.',
        duration: 4000,
      });
      return;
    }
    const cleanUrl = sanitizeUrl(url);
    const check = validateUrl(cleanUrl);
    if (!check.valid) {
      toast.warning('Invalid Scribd Link', {
        id: 'scribd-url-invalid',
        description: check.message || 'Please check your URL format.',
        duration: 4000,
      });
      return;
    }
    onSubmitUrl(cleanUrl);
  };

  const handlePasteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pastedHtml.trim()) {
      toast.warning('Empty HTML Field', {
        id: 'scribd-html-empty',
        description: 'Please paste the Scribd HTML code or DOM source.',
      });
      return;
    }
    onSubmitUrl(pastedHtml.trim());
  };

  const handleFileDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (isProcessing) return;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      handleProcessFile(file);
    }
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      handleProcessFile(file);
    }
  };

  const handleProcessFile = (file: File) => {
    setSelectedFile(file);
    if (onFileUpload) {
      toast.success('File Loaded', {
        id: 'scribd-file-loaded',
        description: `Processing ${file.name} (${(file.size / 1024).toFixed(1)} KB)...`,
      });
      onFileUpload(file);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleFileDrop}
      className={`w-full flex flex-col gap-3 relative transition-all rounded-xl ${
        isDragging
          ? darkMode
            ? 'ring-2 ring-white/80 bg-neutral-900/60'
            : 'ring-2 ring-black/80 bg-neutral-100/60'
          : ''
      }`}
    >
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept=".html,.htm,.txt"
        className="hidden"
      />

      {/* Tabs / Mode Selector */}
      <div className="flex items-center justify-between border-b pb-2 gap-2 text-xs">
        <div className="flex items-center gap-1.5 p-0.5 rounded-lg border">
          <button
            type="button"
            onClick={() => setActiveTab('url')}
            className={`px-3 py-1 rounded-md font-medium transition-colors flex items-center gap-1.5 ${
              activeTab === 'url'
                ? darkMode
                  ? 'bg-neutral-800 text-white shadow-sm'
                  : 'bg-white text-black shadow-sm'
                : darkMode
                ? 'text-neutral-400 hover:text-neutral-200'
                : 'text-neutral-600 hover:text-black'
            }`}
          >
            <Link className="h-3 w-3" />
            <span>Scribd URL</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`px-3 py-1 rounded-md font-medium transition-colors flex items-center gap-1.5 ${
              activeTab === 'upload'
                ? darkMode
                  ? 'bg-neutral-800 text-white shadow-sm'
                  : 'bg-white text-black shadow-sm'
                : darkMode
                ? 'text-neutral-400 hover:text-neutral-200'
                : 'text-neutral-600 hover:text-black'
            }`}
          >
            <Upload className="h-3 w-3" />
            <span>Upload HTML</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('paste')}
            className={`px-3 py-1 rounded-md font-medium transition-colors flex items-center gap-1.5 ${
              activeTab === 'paste'
                ? darkMode
                  ? 'bg-neutral-800 text-white shadow-sm'
                  : 'bg-white text-black shadow-sm'
                : darkMode
                ? 'text-neutral-400 hover:text-neutral-200'
                : 'text-neutral-600 hover:text-black'
            }`}
          >
            <FileCode className="h-3 w-3" />
            <span>Paste Code</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className={`text-[11px] font-semibold hover:underline flex items-center gap-1 ${
            darkMode ? 'text-neutral-400 hover:text-neutral-200' : 'text-neutral-600 hover:text-black'
          }`}
        >
          <Upload className="h-3 w-3" />
          <span>Upload File</span>
        </button>
      </div>

      {/* Tab 1: URL Input */}
      {activeTab === 'url' && (
        <form onSubmit={handleUrlSubmit} className="flex flex-col gap-2.5">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <div
                className={`absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none ${
                  darkMode ? 'text-neutral-500' : 'text-neutral-400'
                }`}
              >
                <Link className="h-4 w-4" />
              </div>
              <input
                type="text"
                value={url}
                onChange={handleInputChange}
                placeholder="Paste Scribd URL (e.g., https://www.scribd.com/document/876667391/...)..."
                disabled={isProcessing}
                className={`w-full pl-10 pr-4 py-3 text-sm border rounded-xl focus:outline-none transition-all ${
                  darkMode
                    ? 'bg-neutral-900/90 text-neutral-100 placeholder-neutral-500 border-neutral-800 focus:border-neutral-500'
                    : 'bg-white text-neutral-900 placeholder-neutral-400 border-neutral-300 focus:border-neutral-600 shadow-sm'
                }`}
              />
            </div>

            <button
              type="submit"
              disabled={isProcessing}
              className={`px-6 py-3 text-sm font-semibold rounded-xl shadow-md flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shrink-0 ${
                darkMode
                  ? 'bg-neutral-100 hover:bg-white text-black'
                  : 'bg-neutral-900 hover:bg-black text-white'
              }`}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Converting...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>Generate PDF</span>
                </>
              )}
            </button>
          </div>

          <div className="flex items-center justify-between text-[11px] px-1 text-neutral-500">
            <span>Tip: Drag & drop any saved Scribd HTML file directly onto this card!</span>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="hover:underline font-medium text-neutral-400 hover:text-neutral-200"
            >
              Browse file
            </button>
          </div>
        </form>
      )}

      {/* Tab 2: Upload HTML File Dropzone */}
      {activeTab === 'upload' && (
        <div
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center gap-2.5 cursor-pointer transition-colors ${
            darkMode
              ? 'border-neutral-800 hover:border-neutral-600 bg-neutral-900/40 hover:bg-neutral-900/70'
              : 'border-neutral-300 hover:border-neutral-400 bg-neutral-50/50 hover:bg-neutral-100/70'
          }`}
        >
          <div
            className={`h-11 w-11 rounded-xl flex items-center justify-center border ${
              darkMode ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-white border-neutral-300 text-black shadow-sm'
            }`}
          >
            {selectedFile ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <Upload className="h-5 w-5" />}
          </div>

          <div className="text-center">
            <p className="text-xs font-semibold">
              {selectedFile ? selectedFile.name : 'Click to select or drag & drop Scribd HTML file'}
            </p>
            <p className={`text-[11px] mt-0.5 ${darkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
              Accepts .html, .htm, or .txt saved from Scribd
            </p>
          </div>
        </div>
      )}

      {/* Tab 3: Paste Raw HTML Code */}
      {activeTab === 'paste' && (
        <form onSubmit={handlePasteSubmit} className="flex flex-col gap-2.5">
          <textarea
            value={pastedHtml}
            onChange={(e) => setPastedHtml(e.target.value)}
            placeholder="Paste raw Scribd page HTML source (Ctrl+U / View Page Source)..."
            rows={4}
            disabled={isProcessing}
            className={`w-full p-3 text-xs font-mono border rounded-xl focus:outline-none transition-all resize-none ${
              darkMode
                ? 'bg-neutral-900/90 text-neutral-100 placeholder-neutral-500 border-neutral-800 focus:border-neutral-500'
                : 'bg-white text-neutral-900 placeholder-neutral-400 border-neutral-300 focus:border-neutral-600 shadow-sm'
            }`}
          />

          <button
            type="submit"
            disabled={isProcessing || !pastedHtml.trim()}
            className={`w-full py-2.5 text-xs font-semibold rounded-xl shadow-md flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${
              darkMode
                ? 'bg-neutral-100 hover:bg-white text-black'
                : 'bg-neutral-900 hover:bg-black text-white'
            }`}
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Processing HTML...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                <span>Compile PDF from HTML</span>
              </>
            )}
          </button>
        </form>
      )}
    </div>
  );
};
