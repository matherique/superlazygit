import type { GitViewerApi } from '../../shared/types';

declare global {
  interface Window {
    gitViewer: GitViewerApi;
  }
}

export {};
