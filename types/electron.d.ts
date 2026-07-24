export {};

declare global {
  interface Window {
    harborPressDesktop?: {
      loadIssues: () => Promise<unknown>;
      saveIssues: (issues: unknown) => Promise<boolean>;
      getDataDirectory: () => Promise<string>;
      openDataDirectory: () => Promise<string>;
      generatePdf: (suggestedName: string) => Promise<{ canceled: boolean; filePath?: string }>;
    };
  }
}
