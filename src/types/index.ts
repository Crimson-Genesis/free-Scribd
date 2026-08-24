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

export interface PageAsset {
  pageNum: number;
  imageUrl?: string;
  width: number;
  height: number;
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
}

export interface ProcessingStepDetail {
  id: ProcessingStep;
  title: string;
  description: string;
}
