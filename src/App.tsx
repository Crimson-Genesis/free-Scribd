import React, { useState, useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import { Toaster, toast } from 'sonner';
import { Header } from './components/Header';
import { UrlInput } from './components/UrlInput';
import { ProcessStepper } from './components/ProcessStepper';
import { PdfSummaryCard } from './components/PdfSummaryCard';
import { ParticleCanvas } from './components/ParticleCanvas';
import { DocMetadata, ProcessStatus, BotChallengeInfo } from './types';
import { processScribdContent, validateUrl, ScribdBotChallengeError } from './lib/pdf-generator';
import { FileText, Eye, Maximize2, ShieldAlert, ExternalLink, Upload, CheckCircle2, ArrowRight } from 'lucide-react';

export const App: React.FC = () => {
  const [darkMode, setDarkMode] = useState(true);
  const [status, setStatus] = useState<ProcessStatus>({
    step: 'idle',
    progress: 0,
    message: 'Ready to convert Scribd document',
    currentStepIndex: 0,
  });
  const [docMetadata, setDocMetadata] = useState<DocMetadata | null>(null);
  const [botChallenge, setBotChallenge] = useState<BotChallengeInfo | null>(null);
  const guidanceFileInputRef = useRef<HTMLInputElement | null>(null);

  // Prevent browser from navigating to dropped files (fixes "Security Error: may not load or link to file:///")
  useEffect(() => {
    const preventFileDropNavigation = (e: DragEvent) => {
      e.preventDefault();
    };
    window.addEventListener('dragover', preventFileDropNavigation);
    window.addEventListener('drop', preventFileDropNavigation);
    return () => {
      window.removeEventListener('dragover', preventFileDropNavigation);
      window.removeEventListener('drop', preventFileDropNavigation);
    };
  }, []);

  const toggleTheme = async (buttonRef?: React.RefObject<HTMLButtonElement | null>) => {
    const nextMode = !darkMode;

    if (
      !buttonRef?.current ||
      !(document as any).startViewTransition ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      setDarkMode(nextMode);
      document.documentElement.classList.toggle('dark', nextMode);
      return;
    }

    const transition = (document as any).startViewTransition(() => {
      flushSync(() => {
        setDarkMode(nextMode);
        document.documentElement.classList.toggle('dark', nextMode);
      });
    });

    await transition.ready;

    const { top, left, width, height } = buttonRef.current.getBoundingClientRect();
    const x = left + width / 2;
    const y = top + height / 2;
    const right = window.innerWidth - left;
    const bottom = window.innerHeight - top;
    const maxRadius = Math.hypot(Math.max(left, right), Math.max(top, bottom));

    document.documentElement.animate(
      {
        clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${maxRadius}px at ${x}px ${y}px)`],
      },
      {
        duration: 500,
        easing: 'ease-in-out',
        pseudoElement: '::view-transition-new(root)',
      }
    );
  };

  const startProcessing = async (input: string | File) => {
    setDocMetadata(null);
    setBotChallenge(null);
    setStatus({
      step: 'validating',
      progress: 5,
      message: 'Initializing 1:1 engine...',
      currentStepIndex: 0,
    });

    try {
      const metadata = await processScribdContent(input, (step, progress, message) => {
        let stepIdx = 0;
        if (step === 'extracting') stepIdx = 1;
        if (step === 'compiling') stepIdx = 2;
        if (step === 'completed') stepIdx = 3;

        setStatus({
          step,
          progress,
          message,
          currentStepIndex: stepIdx,
        });
      });

      setDocMetadata(metadata);
      setBotChallenge(null);
      toast.dismiss('scribd-process-start');
      toast.success('1:1 PDF Generated!', {
        id: 'scribd-process-success',
        description: `${metadata.title} (${metadata.pageCount} pages, ${metadata.formattedSize}) ready.`,
      });
    } catch (err: any) {
      console.error(err);
      toast.dismiss('scribd-process-start');

      if (err instanceof ScribdBotChallengeError || err.name === 'ScribdBotChallengeError') {
        const info = err.info;
        setBotChallenge(info);
        setStatus({
          step: 'error',
          progress: 0,
          message: 'Scribd active bot protection detected for this document.',
          error: 'Bot Protection Active',
          currentStepIndex: 0,
        });
        toast.info('Scribd Session Required', {
          id: 'scribd-bot-challenge',
          description: 'Save the document page from your browser and drop it here to convert instantly.',
          duration: 6000,
        });
      } else {
        setStatus({
          step: 'error',
          progress: 0,
          message: err.message || 'Failed to process document',
          error: err.message,
          currentStepIndex: 0,
        });
        toast.error('Processing Failed', {
          id: 'scribd-process-error',
          description: err.message || 'Check your URL or upload the HTML file directly.',
        });
      }
    }
  };

  const handleUrlSubmit = (url: string) => {
    const check = validateUrl(url);
    if (!check.valid) {
      toast.warning('Invalid Input', {
        id: 'scribd-url-invalid',
        description: check.message,
      });
      return;
    }
    toast.info('Starting Extraction', {
      id: 'scribd-process-start',
      description: 'Parsing pages & vector assets...',
    });
    startProcessing(url);
  };

  const handleFileUpload = (file: File) => {
    toast.info('Processing File', {
      id: 'scribd-process-start',
      description: `Reading ${file.name}...`,
    });
    startProcessing(file);
  };

  const handleReset = () => {
    setStatus({
      step: 'idle',
      progress: 0,
      message: 'Ready to convert Scribd document',
      currentStepIndex: 0,
    });
    setDocMetadata(null);
    setBotChallenge(null);
    toast.dismiss();
  };

  const handleOpenNativePreview = () => {
    if (docMetadata?.pdfUrl) {
      window.open(docMetadata.pdfUrl, '_blank');
    }
  };

  return (
    <div
      className={`min-h-screen w-screen overflow-y-auto lg:h-screen lg:overflow-hidden flex flex-col relative transition-colors duration-300 ${
        darkMode ? 'bg-black text-neutral-100' : 'bg-neutral-50 text-neutral-900'
      }`}
    >
      {/* Bottom-Right Toaster */}
      <Toaster position="bottom-right" theme={darkMode ? 'dark' : 'light'} richColors expand={true} />

      {/* Monochrome Canvas Particle Background */}
      <ParticleCanvas darkMode={darkMode} />

      {/* Header & Brand Logo / Theme Toggle */}
      <Header darkMode={darkMode} onToggleTheme={toggleTheme} />

      {/* Hidden file input for bot challenge card */}
      <input
        type="file"
        ref={guidanceFileInputRef}
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleFileUpload(e.target.files[0]);
          }
        }}
        accept=".html,.htm,.txt"
        className="hidden"
      />

      {/* Main Container */}
      <main className="flex-1 overflow-y-auto lg:overflow-hidden p-3 sm:p-4 pt-3 flex flex-col max-w-7xl w-full mx-auto z-10">
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-4 h-auto lg:h-full pb-6 lg:pb-0">
          {/* Left Column (5/12 width): Input, Guidance Alert, PDF Summary Card, and Vertical Stepper */}
          <div className="lg:col-span-5 flex flex-col gap-3 overflow-visible lg:overflow-hidden h-auto lg:h-full justify-between">
            {/* Input Card */}
            <div
              className={`p-4 rounded-2xl border backdrop-blur-md shadow-2xl ${
                darkMode ? 'bg-neutral-950/25 border-neutral-800/40' : 'bg-white/40 border-neutral-200/60'
              }`}
            >
              <UrlInput
                onSubmitUrl={handleUrlSubmit}
                onFileUpload={handleFileUpload}
                isProcessing={['validating', 'extracting', 'compiling'].includes(status.step)}
                darkMode={darkMode}
              />
            </div>

            {/* Scribd Bot Protection Guidance Card (shown when direct scraping is restricted) */}
            {botChallenge && (
              <div
                className={`p-4 rounded-2xl border backdrop-blur-md shadow-2xl flex flex-col gap-3 animate-in fade-in slide-in-from-top-2 duration-300 ${
                  darkMode
                    ? 'bg-amber-950/20 border-amber-800/40 text-amber-200'
                    : 'bg-amber-50/80 border-amber-300 text-amber-900 shadow-sm'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 border ${
                      darkMode ? 'bg-amber-900/40 border-amber-700/50 text-amber-300' : 'bg-amber-100 border-amber-300 text-amber-800'
                    }`}
                  >
                    <ShieldAlert className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <span>Scribd Bot Protection Detected</span>
                    </div>
                    <p className={`text-xs mt-0.5 line-clamp-1 font-semibold ${darkMode ? 'text-amber-100' : 'text-amber-950'}`}>
                      {botChallenge.title}
                    </p>
                    <p className={`text-[11px] mt-0.5 ${darkMode ? 'text-amber-300/80' : 'text-amber-700'}`}>
                      Scribd blocks automated servers for this {botChallenge.pageCount || 37}-page document. You can convert it directly from your browser session in 3 steps:
                    </p>
                  </div>
                </div>

                {/* 3 Step Guidance List */}
                <div className={`p-3 rounded-xl border flex flex-col gap-2 text-xs ${
                  darkMode ? 'bg-black/40 border-amber-800/30' : 'bg-white/70 border-amber-200'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-medium">
                      <span className="font-bold">1.</span> Open document in your browser
                    </span>
                    <a
                      href={botChallenge.scribdUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`px-2.5 py-1 rounded-lg font-semibold text-[11px] border flex items-center gap-1 transition-all ${
                        darkMode
                          ? 'bg-amber-900/30 hover:bg-amber-800/50 border-amber-700 text-amber-200'
                          : 'bg-amber-100 hover:bg-amber-200 border-amber-300 text-amber-900'
                      }`}
                    >
                      <span>Open on Scribd</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>

                  <div className="flex items-center gap-1.5 font-medium">
                    <span className="font-bold">2.</span> Press <kbd className="px-1.5 py-0.5 rounded border text-[10px] font-mono">Ctrl+S</kbd> (or <kbd className="px-1.5 py-0.5 rounded border text-[10px] font-mono">Cmd+S</kbd>) to save webpage as HTML
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-amber-700/20">
                    <span className="flex items-center gap-1.5 font-medium">
                      <span className="font-bold">3.</span> Drop or select the saved HTML file
                    </span>
                    <button
                      type="button"
                      onClick={() => guidanceFileInputRef.current?.click()}
                      className={`px-3 py-1.5 rounded-lg font-bold text-[11px] flex items-center gap-1.5 shadow-sm transition-all active:scale-95 ${
                        darkMode
                          ? 'bg-amber-200 hover:bg-white text-black'
                          : 'bg-amber-900 hover:bg-black text-white'
                      }`}
                    >
                      <Upload className="h-3.5 w-3.5" />
                      <span>Select HTML File</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Left Side PDF Summary Card */}
            <PdfSummaryCard
              metadata={docMetadata}
              onOpenPreview={handleOpenNativePreview}
              onReset={handleReset}
              darkMode={darkMode}
            />

            {/* Vertical Process Stepper */}
            <ProcessStepper status={status} darkMode={darkMode} />
          </div>

          {/* Right Column (7/12 wider width): Live PDF Preview Viewport */}
          <div className="lg:col-span-7 flex flex-col overflow-visible lg:overflow-hidden h-[550px] lg:h-full">
            <div
              className={`flex-1 border rounded-2xl backdrop-blur-md p-3 flex flex-col overflow-hidden relative shadow-2xl h-full ${
                darkMode ? 'bg-neutral-950/35 border-neutral-800/40' : 'bg-white/40 border-neutral-200/60'
              }`}
            >
              <div
                className={`flex items-center justify-between px-2 pb-2 border-b text-xs shrink-0 ${
                  darkMode ? 'border-neutral-800/40 text-neutral-400' : 'border-neutral-200/60 text-neutral-600'
                }`}
              >
                <span className="font-semibold flex items-center gap-1.5">
                  <Eye className="h-3.5 w-3.5" /> Live PDF Viewport
                </span>
                {docMetadata && (
                  <button
                    onClick={handleOpenNativePreview}
                    className="hover:underline font-medium text-[11px] flex items-center gap-1.5"
                  >
                    <Maximize2 className="h-3 w-3" />
                    <span>View</span>
                  </button>
                )}
              </div>

              <div
                className={`flex-1 rounded-xl overflow-hidden mt-2 relative border ${
                  darkMode ? 'bg-black border-neutral-800/60' : 'bg-white border-neutral-300/80'
                }`}
              >
                {docMetadata ? (
                  <iframe
                    src={`${docMetadata.pdfUrl}#toolbar=0`}
                    className="w-full h-full border-none"
                    title="PDF Preview"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-center gap-3 p-6">
                    <div
                      className={`h-14 w-14 rounded-2xl border flex items-center justify-center ${
                        darkMode ? 'bg-neutral-900/60 border-neutral-700/60 text-neutral-200' : 'bg-white/80 border-neutral-300 text-neutral-800'
                      }`}
                    >
                      <FileText className="h-7 w-7" />
                    </div>
                    <div>
                      <h3 className={`text-sm font-bold ${darkMode ? 'text-neutral-200' : 'text-neutral-800'}`}>
                        Document Preview
                      </h3>
                      <p className={`text-xs max-w-xs mt-1 ${darkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>
                        Paste a Scribd link or drop a saved HTML file to compile your 1:1 PDF.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
