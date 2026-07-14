export type ASRState = { text: string; segments: unknown[]; progress?: number };
export function runASR(_path: string, _opts?: unknown): Promise<ASRState> { return Promise.resolve({ text: '', segments: [] }); }
export function createAsrEngine() { return { run: runASR }; }
export class WhisperRsEngine { async run() { return { text: '', segments: [] }; } }
