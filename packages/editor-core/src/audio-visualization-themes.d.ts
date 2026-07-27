export type BuiltinAudioVisualizationThemeId = 'neon-cyberpunk' | 'minimal-white' | 'retro-vu' | 'nature' | 'flame';
export type AudioVisualizationThemeBackground = {
    type: 'solid';
    color: string;
} | {
    type: 'gradient';
    color: string;
    color2: string;
};
export interface AudioVisualizationThemeDefinition {
    id: string;
    name: string;
    colorStart: string;
    colorEnd: string;
    background: AudioVisualizationThemeBackground;
    glow: boolean;
    glowColor: string;
    glowStrength: number;
    particles: boolean;
    particleColor: string;
    border: boolean;
    borderColor: string;
    borderWidth: number;
}
export type CustomAudioVisualizationTheme = AudioVisualizationThemeDefinition;
export interface AudioVisualizationThemeSource {
    themeId?: string;
    theme?: Partial<AudioVisualizationThemeDefinition>;
    color?: string;
    colorStart?: string;
    colorEnd?: string;
    background?: Partial<AudioVisualizationThemeBackground>;
}
export interface ExpandedAudioVisualizationTheme {
    themeId: string;
    colorStart: string;
    colorEnd: string;
    background: AudioVisualizationThemeBackground;
    glow: boolean;
    glowColor: string;
    glowStrength: number;
    particles: boolean;
    particleColor: string;
    border: boolean;
    borderColor: string;
    borderWidth: number;
}
export declare const MANUAL_AUDIO_VISUALIZATION_THEME_ID = "manual";
export declare const BUILTIN_AUDIO_VISUALIZATION_THEMES: readonly AudioVisualizationThemeDefinition[];
export declare const BUILTIN_AUDIO_VISUALIZATION_THEME_IDS: BuiltinAudioVisualizationThemeId[];
export declare function isBuiltinAudioVisualizationThemeId(value: string | undefined): value is BuiltinAudioVisualizationThemeId;
export declare function getBuiltinAudioVisualizationTheme(id: string | undefined): AudioVisualizationThemeDefinition | undefined;
export declare function resolveAudioVisualizationTheme(themeId: string | undefined, customThemes?: readonly AudioVisualizationThemeDefinition[], inlineTheme?: Partial<AudioVisualizationThemeDefinition>): AudioVisualizationThemeDefinition | undefined;
export declare function expandAudioVisualizationTheme(source?: AudioVisualizationThemeSource, customThemes?: readonly AudioVisualizationThemeDefinition[]): ExpandedAudioVisualizationTheme;
export declare function normalizeAudioVisualizationTheme(input: Partial<AudioVisualizationThemeDefinition> | undefined): AudioVisualizationThemeDefinition;
export declare function normalizeCustomAudioVisualizationThemes(input: unknown): CustomAudioVisualizationTheme[];
export declare function upsertCustomAudioVisualizationTheme(themes: readonly CustomAudioVisualizationTheme[], theme: Partial<AudioVisualizationThemeDefinition>): CustomAudioVisualizationTheme[];
export declare function removeCustomAudioVisualizationTheme(themes: readonly CustomAudioVisualizationTheme[], id: string): CustomAudioVisualizationTheme[];
//# sourceMappingURL=audio-visualization-themes.d.ts.map