import React, { useState } from 'react';
import { flushSync } from 'react-dom';
import { Toaster, toast } from 'sonner';
import { Header } from './components/Header';
import { UrlInput } from './components/UrlInput';
import { ProcessStepper } from './components/ProcessStepper';
import { PdfSummaryCard } from './components/PdfSummaryCard';
import { ParticleCanvas } from './components/ParticleCanvas';
import { DocMetadata, ProcessStatus } from './types';
import { processScribdContent, validateUrl } from './lib/pdf-generator';
import { FileText, Eye, Maximize2 } from 'lucide-react';

export const App: React.FC = () => {
  const [darkMode, setDarkMode] = useState(true);
  const [status, setStatus] = useState<ProcessStatus>({
    step: 'idle',
    progress: 0,
    message: 'Ready to convert Scribd document',
    currentStepIndex: 0,
  });
  const [docMetadata, setDocMetadata] = useState<DocMetadata | null>(null);

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
    const maxRadius = Math.hypot(
      Math.max(left, right),
      Math.max(top, bottom),
    );

    document.documentElement.animate(
      {
        clipPath: [
          `circle(0px at ${x}px ${y}px)`,
          `circle(${maxRadius}px at ${x}px ${y}px)`,
        ],
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
      toast.dismiss('scribd-process-start');
      toast.success('1:1 PDF Generated!', {
        id: 'scribd-process-success',
        description: `${metadata.title} (${metadata.pageCount} pages, ${metadata.formattedSize}) ready.`,
      });
    } catch (err: any) {
      console.error(err);
      setStatus({
        step: 'error',
        progress: 0,
        message: err.message || 'Failed to process document',
        error: err.message,
        currentStepIndex: 0,
      });
      toast.dismiss('scribd-process-start');
      toast.error('Processing Failed', {
        id: 'scribd-process-error',
        description: err.message || 'Check your URL and try again.',
      });
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
      description: 'Parsing pages & image layers...',
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
    toast.dismiss();
  };

  const handleOpenNativePreview = () => {
    if (docMetadata?.pdfUrl) {
      window.open(docMetadata.pdfUrl, '_blank');
    }
  };

  return (
    <div className={`min-h-screen w-screen overflow-y-auto lg:h-screen lg:overflow-hidden flex flex-col relative transition-colors duration-300 ${
      darkMode ? 'bg-black text-neutral-100' : 'bg-neutral-50 text-neutral-900'
    }`}>
      {/* Bottom-Right Expanded Non-Overlapping Toaster */}
      <Toaster position="bottom-right" theme={darkMode ? 'dark' : 'light'} richColors expand={true} />

      {/* Monochrome Canvas Particle Background */}
      <ParticleCanvas darkMode={darkMode} />

      {/* Header & Floating Logo / Borderless Theme Toggle */}
      <Header
        darkMode={darkMode}
        onToggleTheme={toggleTheme}
      />

      {/* Main Container: Starting cleanly from top without header gap */}
      <main className="flex-1 overflow-y-auto lg:overflow-hidden p-3 sm:p-4 pt-3 flex flex-col max-w-7xl w-full mx-auto z-10">
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-4 h-auto lg:h-full pb-6 lg:pb-0">
          
          {/* Left Column (5/12 width): Link Input, PDF Summary Card, and Vertical Stepper */}
          <div className="lg:col-span-5 flex flex-col gap-3 overflow-visible lg:overflow-hidden h-auto lg:h-full justify-between">
            
            {/* Input Card */}
            <div className={`p-4 rounded-2xl border backdrop-blur-md shadow-2xl ${
              darkMode ? 'bg-neutral-950/25 border-neutral-800/40' : 'bg-white/40 border-neutral-200/60'
            }`}>
              <UrlInput
                onSubmitUrl={handleUrlSubmit}
                onFileUpload={handleFileUpload}
                isProcessing={['validating', 'extracting', 'compiling'].includes(status.step)}
                darkMode={darkMode}
              />
            </div>

            {/* Left Side PDF Summary Card (Empty Placeholder when idle, Populated when ready) */}
            <PdfSummaryCard
              metadata={docMetadata}
              onOpenPreview={handleOpenNativePreview}
              onReset={handleReset}
              darkMode={darkMode}
            />

            {/* Vertical Process Stepper filling top-to-bottom height */}
            <ProcessStepper status={status} darkMode={darkMode} />
          </div>

          {/* Right Column (7/12 wider width): Live PDF Preview Viewport */}
          <div className="lg:col-span-7 flex flex-col overflow-visible lg:overflow-hidden h-[550px] lg:h-full">
            <div className={`flex-1 border rounded-2xl backdrop-blur-md p-3 flex flex-col overflow-hidden relative shadow-2xl h-full ${
              darkMode ? 'bg-neutral-950/35 border-neutral-800/40' : 'bg-white/40 border-neutral-200/60'
            }`}>
              <div className={`flex items-center justify-between px-2 pb-2 border-b text-xs shrink-0 ${
                darkMode ? 'border-neutral-800/40 text-neutral-400' : 'border-neutral-200/60 text-neutral-600'
              }`}>
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

              <div className={`flex-1 rounded-xl overflow-hidden mt-2 relative border ${
                darkMode ? 'bg-black border-neutral-800/60' : 'bg-white border-neutral-300/80'
              }`}>
                {docMetadata ? (
                  <iframe
                    src={`${docMetadata.pdfUrl}#toolbar=0`}
                    className="w-full h-full border-none"
                    title="PDF Preview"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-center gap-3 p-6">
                    <div className={`h-14 w-14 rounded-2xl border flex items-center justify-center ${
                      darkMode ? 'bg-neutral-900/60 border-neutral-700/60 text-neutral-200' : 'bg-white/80 border-neutral-300 text-neutral-800'
                    }`}>
                      <FileText className="h-7 w-7" />
                    </div>
                    <div>
                      <h3 className={`text-sm font-bold ${darkMode ? 'text-neutral-200' : 'text-neutral-800'}`}>Document Preview</h3>
                      <p className={`text-xs max-w-xs mt-1 ${darkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>
                        Paste a Scribd link to process your document.
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
