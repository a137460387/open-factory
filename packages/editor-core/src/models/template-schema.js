/**
 * Template Schema - Vertical Scene Deep Templates
 *
 * Defines the data structure for reusable editing templates.
 * Templates capture timeline structure, clip properties, keyframes,
 * color grading nodes, and audio mixer parameters.
 *
 * .oft (Open Factory Template) file format is JSON-based.
 */
// ─── Template Version ────────────────────────────────────────────
export const TEMPLATE_SCHEMA_VERSION = '1.0';
export const TEMPLATE_FILE_EXTENSION = '.oft';
/**
 * Validate an EditingTemplate against the schema.
 */
export function validateTemplate(template) {
    const errors = [];
    const warnings = [];
    // Metadata validation
    if (!template.metadata.id)
        errors.push('metadata.id is required');
    if (!template.metadata.name)
        errors.push('metadata.name is required');
    if (!template.metadata.category)
        errors.push('metadata.category is required');
    if (template.metadata.resolutionWidth <= 0)
        errors.push('resolutionWidth must be positive');
    if (template.metadata.resolutionHeight <= 0)
        errors.push('resolutionHeight must be positive');
    if (template.metadata.frameRate <= 0)
        errors.push('frameRate must be positive');
    if (template.metadata.estimatedDurationSec <= 0)
        errors.push('estimatedDurationSec must be positive');
    // Track validation
    if (template.tracks.length === 0) {
        warnings.push('Template has no tracks');
    }
    for (const track of template.tracks) {
        if (track.clips.length === 0) {
            warnings.push(`Track "${track.name}" has no clips`);
        }
        for (const clip of track.clips) {
            if (clip.durationSec <= 0 && !clip.flexibleDuration) {
                errors.push(`Clip in track "${track.name}" has invalid duration`);
            }
            if (clip.opacity < 0 || clip.opacity > 1) {
                errors.push(`Clip opacity must be 0-1, got ${clip.opacity}`);
            }
            if (clip.speed <= 0) {
                errors.push(`Clip speed must be positive, got ${clip.speed}`);
            }
        }
    }
    // Audio layout validation
    if (template.audioLayout.masterLoudnessTarget > 0) {
        warnings.push('Master loudness target should be negative (LUFS)');
    }
    // Variable validation
    const varIds = new Set();
    for (const v of template.variables) {
        if (varIds.has(v.id)) {
            errors.push(`Duplicate variable ID: ${v.id}`);
        }
        varIds.add(v.id);
    }
    return {
        valid: errors.length === 0,
        errors,
        warnings,
    };
}
//# sourceMappingURL=template-schema.js.map