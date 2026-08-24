import React, { useState, ChangeEvent } from 'react';
import { Link, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { validateUrl } from '../lib/pdf-generator';

interface UrlInputProps {
  onSubmitUrl: (url: string) => void;
  onFileUpload?: (file: File) => void;
  isProcessing: boolean;
  darkMode: boolean;
}

export const UrlInput: React.FC<UrlInputProps> = ({
  onSubmitUrl,
  isProcessing,
  darkMode,
}) => {
  const [url, setUrl] = useState('');

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) {
      toast.warning('Empty Link Field', {
        id: 'scribd-url-empty',
        description: 'Please paste a valid Scribd document URL.',
        duration: 4000,
      });
      return;
    }
    const check = validateUrl(url);
    if (!check.valid) {
      toast.warning('Invalid Scribd Link', {
        id: 'scribd-url-invalid',
        description: check.message || 'Please check your URL format.',
        duration: 4000,
      });
      return;
    }
    onSubmitUrl(url.trim());
  };

  return (
    <div className="w-full flex flex-col gap-3">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <label className={`text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 ${
            darkMode ? 'text-neutral-400' : 'text-neutral-600'
          }`}>
            <Link className="h-3.5 w-3.5" />
            <span>Target Scribd Document Link</span>
          </label>
        </div>

        {/* Input box + Button */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <div className={`absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none ${
              darkMode ? 'text-neutral-500' : 'text-neutral-400'
            }`}>
              <Link className="h-4 w-4" />
            </div>
            <input
              type="text"
              value={url}
              onChange={handleInputChange}
              placeholder="Paste Scribd document URL (e.g., https://www.scribd.com/document/...)..."
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
      </form>
    </div>
  );
};
