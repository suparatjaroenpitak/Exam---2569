declare module "mammoth" {
  interface ExtractResult {
    value: string;
    messages: Array<{ type: string; message: string }>;
  }

  interface Options {
    buffer?: Buffer;
    path?: string;
  }

  export function extractRawText(options: { buffer: Buffer }): Promise<ExtractResult>;
  export function extractRawText(options: { path: string }): Promise<ExtractResult>;
}
