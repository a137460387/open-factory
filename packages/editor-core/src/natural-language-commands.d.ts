/**
 * Natural Language Command System
 *
 * Parses natural language text commands into structured editor actions.
 * Supports both typed text and speech-to-text input.
 *
 * Command categories:
 * - Clip operations (cut, delete, duplicate, split)
 * - Timeline navigation (go to, skip, jump)
 * - Effect application (add effect, color grade)
 * - Playback control (play, pause, seek)
 * - Export operations
 */
export type CommandType = 'cut' | 'delete' | 'duplicate' | 'split' | 'trim' | 'speed' | 'go-to' | 'skip-forward' | 'skip-backward' | 'play' | 'pause' | 'seek' | 'add-effect' | 'remove-effect' | 'color-grade' | 'add-transition' | 'volume' | 'mute' | 'unmute' | 'export' | 'undo' | 'redo' | 'select' | 'deselect' | 'zoom-in' | 'zoom-out' | 'unknown';
export interface ParsedCommand {
    /** Command type */
    type: CommandType;
    /** Extracted parameters */
    params: Record<string, string | number | undefined>;
    /** Confidence 0-1 */
    confidence: number;
    /** Original text */
    rawText: string;
    /** Time reference if any (seconds) */
    timeRef?: number;
    /** Clip reference if any */
    clipRef?: string;
}
export interface CommandPattern {
    /** Command type to match */
    type: CommandType;
    /** Regex patterns (any match triggers this command) */
    patterns: RegExp[];
    /** Parameter extractors (match, fullText) */
    extractors?: Array<(match: RegExpMatchArray, fullText: string) => Partial<Record<string, string | number>>>;
    /** Base confidence */
    confidence: number;
}
export interface CommandParserConfig {
    /** Language for parsing */
    language: 'zh' | 'en';
    /** Minimum confidence to accept */
    minConfidence: number;
    /** Default time unit interpretation */
    defaultTimeUnit: 'seconds' | 'frames';
}
export declare const DEFAULT_COMMAND_PARSER_CONFIG: CommandParserConfig;
/**
 * Parse a natural language command text into structured commands.
 */
export declare function parseCommand(text: string, config?: Partial<CommandParserConfig>): ParsedCommand;
/**
 * Parse multiple commands from a single text (split by common delimiters).
 */
export declare function parseMultipleCommands(text: string, config?: Partial<CommandParserConfig>): ParsedCommand[];
/**
 * Build a speech recognition grammar hint for the command palette.
 */
export declare function buildSpeechGrammarHints(language: 'zh' | 'en'): string[];
/**
 * Check if a command needs a target (clip, time, etc.)
 */
export declare function commandNeedsTarget(type: CommandType): boolean;
//# sourceMappingURL=natural-language-commands.d.ts.map