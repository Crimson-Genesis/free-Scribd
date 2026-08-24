import React from 'react';
import { ProcessStatus, ProcessingStepDetail } from '../types';
import { CheckCircle2, Loader2, AlertCircle, Layers, FileCheck, Search, Cpu } from 'lucide-react';

interface ProcessStepperProps {
  status: ProcessStatus;
  darkMode: boolean;
}

const STEPS: ProcessingStepDetail[] = [
  {
    id: 'validating',
    title: '1. Validation & Metadata',
    description: 'Validating input URL, HTML tokens & page bounds',
  },
  {
    id: 'extracting',
    title: '2. Asset & Text Extraction',
    description: 'Extracting page JSONPs, images & vector font layers',
  },
  {
    id: 'compiling',
    title: '3. PDF Compilation',
    description: 'Rendering 1:1 canvas layout & Noto font typography',
  },
  {
    id: 'completed',
    title: '4. Download Ready',
    description: 'Standalone PDF file generated & verified',
  },
];

export const ProcessStepper: React.FC<ProcessStepperProps> = ({ status, darkMode }) => {
  const getStageProgress = (index: number): number => {
    if (status.step === 'idle') return 0;
    if (status.step === 'completed') return 100;
    if (status.step === 'error') {
      if (index < status.currentStepIndex) return 100;
      if (index === status.currentStepIndex) return Math.min(100, Math.round(status.progress));
      return 0;
    }

    if (index < status.currentStepIndex) return 100;
    if (index > status.currentStepIndex) return 0;

    // Active stage interpolation
    if (index === 0) return Math.min(100, Math.max(5, Math.round((status.progress / 25) * 100)));
    if (index === 1) return Math.min(100, Math.max(5, Math.round(((status.progress - 25) / 30) * 100)));
    if (index === 2) return Math.min(100, Math.max(5, Math.round(((status.progress - 55) / 40) * 100)));
    if (index === 3) return status.progress === 100 ? 100 : 0;
    return 0;
  };

  const getStepIcon = (index: number) => {
    if (status.step === 'error' && status.currentStepIndex === index) {
      return <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />;
    }
    if (status.currentStepIndex > index || status.step === 'completed') {
      return <CheckCircle2 className={`h-4 w-4 shrink-0 ${darkMode ? 'text-white' : 'text-black'}`} />;
    }
    if (status.currentStepIndex === index && status.step !== 'idle') {
      return <Loader2 className={`h-4 w-4 animate-spin shrink-0 ${darkMode ? 'text-white' : 'text-black'}`} />;
    }
    switch (index) {
      case 0:
        return <Search className="h-4 w-4 shrink-0 opacity-60" />;
      case 1:
        return <Layers className="h-4 w-4 shrink-0 opacity-60" />;
      case 2:
        return <Cpu className="h-4 w-4 shrink-0 opacity-60" />;
      case 3:
        return <FileCheck className="h-4 w-4 shrink-0 opacity-60" />;
      default:
        return null;
    }
  };

  return (
    <div className={`w-full flex-1 flex flex-col justify-between gap-3 p-4 rounded-2xl border backdrop-blur-md shadow-2xl ${
      darkMode ? 'bg-neutral-950/25 border-neutral-800/40' : 'bg-white/40 border-neutral-200/60'
    }`}>
      {/* Header status bar */}
      <div className="flex items-center justify-between pb-2 border-b border-neutral-800/40">
        <div className="flex items-center gap-2">
          <Layers className={`h-4 w-4 ${darkMode ? 'text-neutral-200' : 'text-neutral-800'}`} />
          <h3 className={`text-sm font-semibold ${darkMode ? 'text-neutral-200' : 'text-neutral-800'}`}>Pipeline Status</h3>
        </div>
        <span className={`px-2.5 py-0.5 text-[11px] font-semibold rounded-full border ${
          status.step === 'idle'
            ? darkMode ? 'bg-neutral-800 text-neutral-400 border-neutral-700' : 'bg-neutral-200 text-neutral-600 border-neutral-300'
            : status.step === 'completed'
            ? darkMode ? 'bg-white text-black border-white' : 'bg-black text-white border-black'
            : darkMode ? 'bg-neutral-800 text-white border-neutral-600 animate-pulse' : 'bg-neutral-200 text-black border-neutral-400 animate-pulse'
        }`}>
          {status.step === 'idle' && 'Idle'}
          {status.step === 'validating' && 'Validating Link'}
          {status.step === 'extracting' && 'Extracting Assets'}
          {status.step === 'compiling' && 'Compiling PDF'}
          {status.step === 'completed' && 'Completed'}
          {status.step === 'error' && 'Error'}
        </span>
      </div>

      {/* Vertical List of 4 Processing Stages */}
      <div className="flex-1 flex flex-col justify-around gap-2.5 my-1">
        {STEPS.map((step, idx) => {
          const isDone = status.currentStepIndex > idx || status.step === 'completed';
          const isCurrent = status.currentStepIndex === idx && status.step !== 'completed' && status.step !== 'idle';
          const stageProg = getStageProgress(idx);

          return (
            <div
              key={step.id}
              className={`p-3 rounded-xl border transition-all flex flex-col gap-2 ${
                isDone
                  ? darkMode
                    ? 'bg-neutral-900/90 border-neutral-600 text-neutral-100 shadow-sm'
                    : 'bg-white/90 border-neutral-400 text-neutral-900 shadow-sm'
                  : isCurrent
                  ? darkMode
                    ? 'bg-neutral-800 border-neutral-400 text-white shadow-lg ring-1 ring-neutral-500'
                    : 'bg-neutral-100 border-neutral-500 text-black shadow-md ring-1 ring-neutral-400'
                  : darkMode
                    ? 'bg-neutral-950/40 border-neutral-800/80 text-neutral-500 opacity-60'
                    : 'bg-neutral-100/50 border-neutral-300/80 text-neutral-400 opacity-60'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getStepIcon(idx)}
                  <span className="text-xs font-semibold tracking-tight">{step.title}</span>
                </div>
                <span className={`font-mono text-xs font-bold ${
                  isCurrent || isDone ? (darkMode ? 'text-white' : 'text-black') : (darkMode ? 'text-neutral-500' : 'text-neutral-400')
                }`}>{stageProg}%</span>
              </div>

              <p className={`text-[11px] leading-tight ${darkMode ? 'text-neutral-300' : 'text-neutral-600'}`}>
                {step.description}
              </p>

              {/* Per-Stage Highlighted 100% Loading Bar */}
              <div className={`w-full h-2 rounded-full overflow-hidden p-0.5 border transition-all ${
                darkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-neutral-200 border-neutral-300'
              }`}>
                <div
                  className={`h-full rounded-full transition-all duration-300 ease-out ${
                    isDone || isCurrent
                      ? darkMode
                        ? 'bg-white shadow-[0_0_10px_rgba(255,255,255,0.9)]'
                        : 'bg-black shadow-[0_0_8px_rgba(0,0,0,0.5)]'
                      : 'bg-transparent'
                  }`}
                  style={{ width: `${stageProg}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Overall Progress Bar Out of 100% */}
      <div className={`pt-2 border-t flex flex-col gap-1.5 ${darkMode ? 'border-neutral-800/60' : 'border-neutral-200/80'}`}>
        <div className={`flex items-center justify-between text-xs ${darkMode ? 'text-neutral-300' : 'text-neutral-700'}`}>
          <span className="font-semibold text-[11px]">{status.message}</span>
          <span className="font-mono font-extrabold text-xs">{status.progress}% Total</span>
        </div>
        <div className={`w-full h-2.5 rounded-full overflow-hidden p-0.5 border ${
          darkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-neutral-200 border-neutral-300'
        }`}>
          <div
            className={`h-full rounded-full transition-all duration-300 ease-out ${
              darkMode
                ? 'bg-white shadow-[0_0_12px_rgba(255,255,255,0.9)]'
                : 'bg-black shadow-[0_0_8px_rgba(0,0,0,0.6)]'
            }`}
            style={{ width: `${status.progress}%` }}
          />
        </div>
      </div>
    </div>
  );
};
