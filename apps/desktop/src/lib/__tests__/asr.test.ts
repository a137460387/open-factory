import { describe, it, expect } from 'vitest';
import { createAsrEngine, WhisperRsEngine } from '../asr';
describe('ASR', () => { it('creates engine', () => { expect(createAsrEngine()).toBeDefined(); expect(new WhisperRsEngine()).toBeDefined(); }); });
