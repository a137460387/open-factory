# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [v4.25.0] - 2026-07-14

### Added
- Smart media library with metadata extraction, list view with codec/frame rate/bit rate columns, and enhanced sorting options
- AI auto subtitle generation workflow panel (ASR → Polish → Style → Export)
- AI noise reduction for audio (local and cloud providers)
- Hardware accelerated encoding with GPU encoder selection
- Multi-camera editing MVP with sync and angle switching
- AI smart montage with beat-aware clip arrangement
- Performance optimization: timeline virtualization and caching for large projects (1000+ clips)

### Fixed
- E2E test reliability: restored 13 previously failing/skipped tests (performance, smart-media-library, smart-subtitles)
- Rust compilation: replaced unmaintained rnnoise-rs with nnnoiseless, fixed escaped references in ffmpeg.rs
- CI pipeline: restored buildHardwareEncoderArgs signature, added list_hardware_encoders command
- MediaBin list view: added data-testid attributes for codec and frame rate cells
- ASRStage component: consistent test ID naming convention with other workflow stages

### Changed
- Timeline heatmap now uses deferred values for smoother scrolling
- Track virtualization limits rendered tracks to visible area
- Sort dropdown in media library now includes frame rate and codec options

## [v3.10.0] - 2026-06-23

### Added
- Timeline performance monitoring and alerting
- Multimedia format conversion center
- Subtitle sentiment color annotation
- Project export history smart categorization
- Timeline virtual environment simulation testing tool

### Changed
- Test coverage boosted to 96.1%

## [v3.9.0] - 2026-06-23

### Added
- Export batch processing script interface
- Project archive encrypted export

## [v3.8.0] - 2026-06-23

### Added
- Subtitle auto-sync offset detection
- Media proxy batch verification and repair
- Export error diagnosis knowledge base
- Sequence side-by-side comparison

## [v3.7.0] - 2026-06-23

### Added
- Media library batch tag suggestion with learning upgrade
- Project template community sharing

## [v3.6.0] - 2026-06-23

### Added
- Subtitle auto line-break optimization
- Media import conflict resolution wizard

## [v3.5.0] - 2026-06-22

### Added
- E2E test suite and touch optimization toggle UI integration
- Export preview real-time estimation
- Touch multi-point gestures
- Media library smart grouping
- Collaboration permission management

## [v3.4.0] - 2026-06-22

### Added
- i18n strings for template, multicam, preset-diff, and annotation-sync features
- Project template smart pre-fill
- Multi-cam audio sync enhancement
- Export preset diff comparison
- Timeline annotation cloud sync

### Fixed
- Motion-graphic fixture fontconfig compatibility (explicit fontfile + FONTCONFIG_FILE fallback)

## [v3.3.0] - 2026-06-22

### Added
- Subtitle style quick switch bar
- Export failure smart retry strategy
- Media replacement batch pre-check
- Timeline multi-level zoom memory

### Testing
- Added P0-1, P0-2, P1-3, P1-4 E2E tests

## [v3.2.0] - 2026-06-22

### Added
- Batch crop ratio conversion
- Timeline quick action panel
- Export file naming rules
- Media library duplicate content merge

## [v3.1.0] - 2026-06-21

### Added
- Export preset smart recommendation
- Timeline thumbnail pre-rendering
- Audio fade in/out curve editing
- Media library tag cloud

### Fixed
- Gesture zoom handler reads scale/detail from Safari-compatible events

## [v3.0.1] - 2026-06-21

### Fixed
- Timeline.tsx module-level hook call causing render crash

## [v3.0.0] - 2026-06-21

### Added
- Subtitle spell checking
- Export queue notification center
- Media import pre-check: file header sniffing, three-state determination, batch pre-check, force import
- Timeline zoom and navigation gesture optimization

### Fixed
- Corrected `read_file_header_bytes` position in `generate_handler`

[v4.25.0]: https://github.com/a137460387/open-factory/compare/v3.10.0...v4.25.0
[v3.10.0]: https://github.com/a137460387/open-factory/compare/v3.9.0...v3.10.0
[v3.9.0]: https://github.com/a137460387/open-factory/compare/v3.8.0...v3.9.0
[v3.8.0]: https://github.com/a137460387/open-factory/compare/v3.7.0...v3.8.0
[v3.7.0]: https://github.com/a137460387/open-factory/compare/v3.6.0...v3.7.0
[v3.6.0]: https://github.com/a137460387/open-factory/compare/v3.5.0...v3.6.0
[v3.5.0]: https://github.com/a137460387/open-factory/compare/v3.4.0...v3.5.0
[v3.4.0]: https://github.com/a137460387/open-factory/compare/v3.3.0...v3.4.0
[v3.3.0]: https://github.com/a137460387/open-factory/compare/v3.2.0...v3.3.0
[v3.2.0]: https://github.com/a137460387/open-factory/compare/v3.1.0...v3.2.0
[v3.1.0]: https://github.com/a137460387/open-factory/compare/v3.0.1...v3.1.0
[v3.0.1]: https://github.com/a137460387/open-factory/compare/v3.0.0...v3.0.1
[v3.0.0]: https://github.com/a137460387/open-factory/releases/tag/v3.0.0
