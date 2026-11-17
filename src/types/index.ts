export type ProcessingStep = 'idle' | 'validating' | 'extracting' | 'compiling' | 'completed' | 'error';

export interface ProcessStatus {
  step: ProcessingStep;
  progress: number; // 0 to 100
  message: string;
  error?: string;
  currentStepIndex: number; // 0 to 4
}

export interface TextItem {
  left: number;
  top: number;
  fontSize: number;
  text: string;
}

export interface ImageSpec {
  url: string;
  left: number;
  top: number;
  width: number;
  height: number;
  clip: { left: number; top: number; right: number; bottom: number } | null;
}

export interface PageAsset {
  pageNum: number;
  width: number;
  height: number;
  imgSpecs: ImageSpec[];
  textItems: TextItem[];
}

export interface DocMetadata {
  title: string;
  docId: string;
  pageCount: number;
  sizeBytes: number;
  formattedSize: string;
  pdfUrl?: string;
  pdfBlob?: Blob;
  pages: PageAsset[];
  createdAt: string;
  thumbnailUrl?: string;
}

export interface ProcessingStepDetail {
  id: ProcessingStep;
  title: string;
  description: string;
}

export interface BotChallengeInfo {
  docId: string;
  title: string;
  scribdUrl: string;
  thumbnailUrl?: string;
  pageCount?: number;
  message?: string;
}
