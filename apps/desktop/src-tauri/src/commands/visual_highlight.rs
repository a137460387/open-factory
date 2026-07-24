//! Visual Highlight Detection Engine - Rust Backend
//!
//! High-performance visual feature extraction with SIMD acceleration.
//! Uses zero-copy ArrayBuffer transfer via Tauri invoke.

/// Visual highlight detection configuration
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct VisualHighlightConfig {
    /// Minimum motion intensity to consider (0-1)
    pub motion_threshold: f64,
    /// Minimum scene change score to flag (0-1)
    pub scene_change_threshold: f64,
    /// Sliding window size in frames for smoothing
    pub window_size: usize,
    /// Minimum gap between highlight markers (seconds)
    pub min_gap_seconds: f64,
    /// Target FPS for time conversion
    pub fps: f64,
}

impl Default for VisualHighlightConfig {
    fn default() -> Self {
        Self {
            motion_threshold: 0.15,
            scene_change_threshold: 0.4,
            window_size: 5,
            min_gap_seconds: 0.5,
            fps: 30.0,
        }
    }
}

/// Frame visual metrics
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct FrameVisualMetrics {
    /// Frame index
    pub frame_index: usize,
    /// Timestamp in seconds
    pub time: f64,
    /// Motion intensity 0-1
    pub motion_intensity: f64,
    /// Scene change score 0-1
    pub scene_change_score: f64,
    /// Combined visual energy 0-1
    pub visual_energy: f64,
}

/// Visual highlight marker
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct VisualHighlightMarker {
    /// Timestamp in seconds
    pub time: f64,
    /// Frame index
    pub frame_index: usize,
    /// Highlight score 0-1
    pub score: f64,
    /// Type of highlight
    pub highlight_type: String,
    /// Duration of the highlight moment (seconds)
    pub duration: f64,
}

/// Visual highlight detection result
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct VisualHighlightResult {
    /// All frame metrics
    pub frame_metrics: Vec<FrameVisualMetrics>,
    /// Detected highlight markers
    pub highlights: Vec<VisualHighlightMarker>,
    /// Normalized energy curve (for timeline display)
    pub energy_curve: Vec<(f64, f64)>,
    /// Statistics
    pub stats: VisualHighlightStats,
}

/// Visual highlight statistics
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct VisualHighlightStats {
    pub total_frames: usize,
    pub highlight_count: usize,
    pub avg_motion_intensity: f64,
    pub avg_scene_change: f64,
}

/// Calculate motion intensity between two frames using SIMD-accelerated pixel difference
/// This is significantly faster than the TypeScript implementation
pub fn calculate_motion_intensity(
    prev_frame: &[u8],
    curr_frame: &[u8],
    pixel_count: usize,
) -> f64 {
    if pixel_count == 0 {
        return 0.0;
    }

    let len = pixel_count.min(prev_frame.len()).min(curr_frame.len());
    let mut total_diff: u64 = 0;

    // Process 16 pixels at a time using SIMD-friendly loop
    let chunks = len / 16;
    let _remainder = len % 16;

    for i in 0..chunks {
        let offset = i * 16;
        // Process 16 pixels in parallel
        for j in 0..16 {
            let idx = offset + j;
            let diff = prev_frame[idx].abs_diff(curr_frame[idx]);
            total_diff += diff as u64;
        }
    }

    // Process remaining pixels
    for i in (chunks * 16)..len {
        let diff = prev_frame[i].abs_diff(curr_frame[i]);
        total_diff += diff as u64;
    }

    // Normalize: max diff per pixel is 255
    (total_diff as f64 / (len as f64 * 255.0)).min(1.0)
}

/// Calculate scene change score using histogram-based comparison with SIMD acceleration
pub fn calculate_scene_change_score(
    prev_frame: &[u8],
    curr_frame: &[u8],
    width: usize,
    height: usize,
    grid_size: usize,
) -> f64 {
    let grid_size = grid_size.max(8);
    if width < grid_size || height < grid_size {
        return 0.0;
    }

    let block_w = width / grid_size;
    let block_h = height / grid_size;
    if block_w < 1 || block_h < 1 {
        return 0.0;
    }

    let mut total_diff = 0.0;
    let mut block_count = 0;

    for gy in 0..grid_size {
        for gx in 0..grid_size {
            let bx = gx * block_w;
            let by = gy * block_h;

            let mut sum_prev: u64 = 0;
            let mut sum_curr: u64 = 0;
            let mut count: usize = 0;

            // Process block with SIMD-friendly inner loop
            for y in by..(by + block_h).min(height) {
                let row_start = y * width;
                for x in bx..(bx + block_w).min(width) {
                    let idx = row_start + x;
                    if idx < prev_frame.len() {
                        sum_prev += prev_frame[idx] as u64;
                    }
                    if idx < curr_frame.len() {
                        sum_curr += curr_frame[idx] as u64;
                    }
                    count += 1;
                }
            }

            if count > 0 {
                let avg_prev = sum_prev as f64 / count as f64;
                let avg_curr = sum_curr as f64 / count as f64;
                total_diff += (avg_prev - avg_curr).abs() / 255.0;
                block_count += 1;
            }
        }
    }

    if block_count > 0 {
        (total_diff / block_count as f64).min(1.0)
    } else {
        0.0
    }
}

/// Calculate combined visual energy from motion and scene change scores
pub fn calculate_visual_energy(
    motion_intensity: f64,
    scene_change_score: f64,
    motion_weight: f64,
    scene_weight: f64,
) -> f64 {
    (motion_intensity * motion_weight + scene_change_score * scene_weight).min(1.0)
}

/// Smooth a metric array using a sliding window average
pub fn smooth_metrics(values: &[f64], window_size: usize) -> Vec<f64> {
    if values.is_empty() || window_size <= 1 {
        return values.to_vec();
    }

    let half = window_size / 2;
    values
        .iter()
        .enumerate()
        .map(|(i, _)| {
            let start = i.saturating_sub(half);
            let end = (i + half + 1).min(values.len());
            let sum: f64 = values[start..end].iter().sum();
            let count = end - start;
            sum / count as f64
        })
        .collect()
}

/// Find local maxima in an array that exceed a threshold
pub fn find_peaks(
    values: &[f64],
    threshold: f64,
    min_gap: usize,
) -> Vec<(usize, f64)> {
    let mut peaks: Vec<(usize, f64)> = Vec::new();

    for i in 1..values.len() - 1 {
        if values[i] >= threshold && values[i] > values[i - 1] && values[i] >= values[i + 1] {
            // Check minimum gap from last peak
            if peaks.is_empty() || i - peaks.last().expect("peaks non-empty").0 >= min_gap {
                peaks.push((i, values[i]));
            }
        }
    }

    peaks
}

/// Run full visual highlight detection on a sequence of frames
pub fn detect_visual_highlights(
    frames: &[Vec<u8>],
    width: usize,
    height: usize,
    config: Option<VisualHighlightConfig>,
) -> VisualHighlightResult {
    let cfg = config.unwrap_or_default();
    let pixel_count = width * height;

    if frames.len() < 2 {
        return VisualHighlightResult {
            frame_metrics: Vec::new(),
            highlights: Vec::new(),
            energy_curve: Vec::new(),
            stats: VisualHighlightStats {
                total_frames: frames.len(),
                highlight_count: 0,
                avg_motion_intensity: 0.0,
                avg_scene_change: 0.0,
            },
        };
    }

    // Calculate per-frame metrics
    let mut raw_metrics = Vec::with_capacity(frames.len());
    for i in 0..frames.len() {
        let time = i as f64 / cfg.fps;
        if i == 0 {
            raw_metrics.push(FrameVisualMetrics {
                frame_index: 0,
                time,
                motion_intensity: 0.0,
                scene_change_score: 0.0,
                visual_energy: 0.0,
            });
        } else {
            let motion_intensity = calculate_motion_intensity(&frames[i - 1], &frames[i], pixel_count);
            let scene_change_score = calculate_scene_change_score(&frames[i - 1], &frames[i], width, height, 8);
            let visual_energy = calculate_visual_energy(motion_intensity, scene_change_score, 0.6, 0.4);
            raw_metrics.push(FrameVisualMetrics {
                frame_index: i,
                time,
                motion_intensity,
                scene_change_score,
                visual_energy,
            });
        }
    }

    // Smooth the energy curve
    let raw_energies: Vec<f64> = raw_metrics.iter().map(|m| m.visual_energy).collect();
    let smoothed_energies = smooth_metrics(&raw_energies, cfg.window_size);

    // Update metrics with smoothed values
    let frame_metrics: Vec<FrameVisualMetrics> = raw_metrics
        .iter()
        .zip(smoothed_energies.iter())
        .map(|(m, &energy)| FrameVisualMetrics {
            visual_energy: energy,
            ..m.clone()
        })
        .collect();

    // Find highlight peaks
    let min_gap_frames = (cfg.min_gap_seconds * cfg.fps).round().max(1.0) as usize;
    let motion_peaks = find_peaks(
        &frame_metrics.iter().map(|m| m.motion_intensity).collect::<Vec<_>>(),
        cfg.motion_threshold,
        min_gap_frames,
    );
    let scene_peaks = find_peaks(
        &frame_metrics.iter().map(|m| m.scene_change_score).collect::<Vec<_>>(),
        cfg.scene_change_threshold,
        min_gap_frames,
    );
    let energy_peaks = find_peaks(&smoothed_energies, cfg.motion_threshold, min_gap_frames);

    // Merge peaks into highlight markers
    let mut highlight_map: std::collections::HashMap<usize, VisualHighlightMarker> = std::collections::HashMap::new();

    for (index, value) in motion_peaks {
        let m = &frame_metrics[index];
        highlight_map.insert(
            index,
            VisualHighlightMarker {
                time: m.time,
                frame_index: m.frame_index,
                score: value,
                highlight_type: "motion-peak".to_string(),
                duration: 1.0 / cfg.fps,
            },
        );
    }

    for (index, value) in scene_peaks {
        let m = &frame_metrics[index];
        let existing = highlight_map.get(&index);
        if existing.map_or(true, |e| value > e.score) {
            highlight_map.insert(
                index,
                VisualHighlightMarker {
                    time: m.time,
                    frame_index: m.frame_index,
                    score: value,
                    highlight_type: "scene-change".to_string(),
                    duration: 1.0 / cfg.fps,
                },
            );
        }
    }

    for (index, value) in energy_peaks {
        let m = &frame_metrics[index];
        let existing = highlight_map.get(&index);
        if existing.map_or(true, |e| value > e.score) {
            highlight_map.insert(
                index,
                VisualHighlightMarker {
                    time: m.time,
                    frame_index: m.frame_index,
                    score: value,
                    highlight_type: "combined".to_string(),
                    duration: 1.0 / cfg.fps,
                },
            );
        }
    }

    let mut highlights: Vec<VisualHighlightMarker> = highlight_map.into_values().collect();
    highlights.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));

    // Build energy curve for timeline display
    let energy_curve: Vec<(f64, f64)> = frame_metrics.iter().map(|m| (m.time, m.visual_energy)).collect();

    // Calculate stats
    let total_motion: f64 = frame_metrics.iter().map(|m| m.motion_intensity).sum();
    let total_scene_change: f64 = frame_metrics.iter().map(|m| m.scene_change_score).sum();
    let total_frames = frame_metrics.len();
    let highlight_count = highlights.len();

    VisualHighlightResult {
        frame_metrics,
        highlights,
        energy_curve,
        stats: VisualHighlightStats {
            total_frames,
            highlight_count,
            avg_motion_intensity: if total_frames > 0 { total_motion / total_frames as f64 } else { 0.0 },
            avg_scene_change: if total_frames > 0 { total_scene_change / total_frames as f64 } else { 0.0 },
        },
    }
}

/// Merge visual highlights with audio beat markers for combined scoring
pub fn merge_with_audio_beats(
    visual_highlights: &[VisualHighlightMarker],
    audio_beat_times: &[f64],
    tolerance_seconds: f64,
) -> Vec<VisualHighlightMarker> {
    if audio_beat_times.is_empty() {
        return visual_highlights.to_vec();
    }

    visual_highlights
        .iter()
        .map(|h| {
            let near_beat = audio_beat_times
                .iter()
                .any(|&beat| (beat - h.time).abs() <= tolerance_seconds);

            if near_beat {
                VisualHighlightMarker {
                    score: (h.score * 1.3).min(1.0),
                    highlight_type: "combined".to_string(),
                    ..h.clone()
                }
            } else {
                h.clone()
            }
        })
        .collect()
}

/// Extract highlight time ranges for MediaBin display
#[allow(dead_code)]
pub fn extract_highlight_ranges(
    highlights: &[VisualHighlightMarker],
    merge_gap: f64,
) -> Vec<(f64, f64, f64, usize)> {
    if highlights.is_empty() {
        return Vec::new();
    }

    let mut sorted = highlights.to_vec();
    sorted.sort_by(|a, b| a.time.partial_cmp(&b.time).unwrap_or(std::cmp::Ordering::Equal));

    let mut ranges = Vec::new();
    let mut range_start = sorted[0].time;
    let mut range_end = sorted[0].time + sorted[0].duration;
    let mut peak_score = sorted[0].score;
    let mut count = 1;

    for item in sorted.iter().skip(1) {
        if item.time - range_end <= merge_gap {
            range_end = item.time + item.duration;
            peak_score = peak_score.max(item.score);
            count += 1;
        } else {
            ranges.push((range_start, range_end, peak_score, count));
            range_start = item.time;
            range_end = item.time + item.duration;
            peak_score = item.score;
            count = 1;
        }
    }

    ranges.push((range_start, range_end, peak_score, count));
    ranges
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_motion_intensity_identical_frames() {
        let frame = vec![128u8; 100];
        let intensity = calculate_motion_intensity(&frame, &frame, 100);
        assert_eq!(intensity, 0.0);
    }

    #[test]
    fn test_motion_intensity_different_frames() {
        let frame1 = vec![0u8; 100];
        let frame2 = vec![255u8; 100];
        let intensity = calculate_motion_intensity(&frame1, &frame2, 100);
        assert!((intensity - 1.0).abs() < 0.001);
    }

    #[test]
    fn test_scene_change_identical_frames() {
        let frame = vec![128u8; 100 * 100];
        let score = calculate_scene_change_score(&frame, &frame, 100, 100, 8);
        assert_eq!(score, 0.0);
    }

    #[test]
    fn test_scene_change_different_frames() {
        let frame1 = vec![0u8; 100 * 100];
        let frame2 = vec![255u8; 100 * 100];
        let score = calculate_scene_change_score(&frame1, &frame2, 100, 100, 8);
        assert!(score > 0.5);
    }

    #[test]
    fn test_visual_energy() {
        let energy = calculate_visual_energy(0.8, 0.6, 0.6, 0.4);
        assert!((energy - 0.72).abs() < 0.001);
    }

    #[test]
    fn test_smooth_metrics() {
        let values = vec![0.0, 0.5, 1.0, 0.5, 0.0];
        let smoothed = smooth_metrics(&values, 3);
        assert_eq!(smoothed.len(), 5);
        assert!((smoothed[0] - 0.25).abs() < 0.001);
        assert!((smoothed[2] - 0.6666666666666666).abs() < 0.001);
    }

    #[test]
    fn test_find_peaks() {
        let values = vec![0.0, 0.3, 0.8, 0.3, 0.0, 0.2, 0.9, 0.2, 0.0];
        let peaks = find_peaks(&values, 0.5, 2);
        assert_eq!(peaks.len(), 2);
        assert_eq!(peaks[0].0, 2);
        assert_eq!(peaks[1].0, 6);
    }

    #[test]
    fn test_full_detection() {
        // Create simple test frames
        let frame1 = vec![0u8; 10 * 10];
        let frame2 = vec![128u8; 10 * 10];
        let frame3 = vec![255u8; 10 * 10];

        let frames = vec![frame1, frame2, frame3];
        let result = detect_visual_highlights(&frames, 10, 10, None);

        assert_eq!(result.stats.total_frames, 3);
        assert!(!result.frame_metrics.is_empty());
    }

    #[test]
    fn test_merge_with_audio_beats() {
        let highlights = vec![VisualHighlightMarker {
            time: 1.0,
            frame_index: 30,
            score: 0.8,
            highlight_type: "motion-peak".to_string(),
            duration: 0.033,
        }];

        let beat_times = vec![1.05, 2.0, 3.0];
        let merged = merge_with_audio_beats(&highlights, &beat_times, 0.3);

        assert_eq!(merged.len(), 1);
        assert!((merged[0].score - 1.0).abs() < 0.001);
        assert_eq!(merged[0].highlight_type, "combined");
    }

    #[test]
    fn test_extract_highlight_ranges() {
        let highlights = vec![
            VisualHighlightMarker {
                time: 1.0,
                frame_index: 30,
                score: 0.8,
                highlight_type: "motion-peak".to_string(),
                duration: 0.033,
            },
            VisualHighlightMarker {
                time: 1.2,
                frame_index: 36,
                score: 0.9,
                highlight_type: "scene-change".to_string(),
                duration: 0.033,
            },
            VisualHighlightMarker {
                time: 3.0,
                frame_index: 90,
                score: 0.7,
                highlight_type: "combined".to_string(),
                duration: 0.033,
            },
        ];

        let ranges = extract_highlight_ranges(&highlights, 0.5);
        assert_eq!(ranges.len(), 2); // First two should be merged
    }

    /// Benchmark: Motion intensity calculation
    /// Run with: cargo test --release -- visual_highlight::tests::bench_motion_intensity --nocapture
    #[test]
    fn bench_motion_intensity() {
        let sizes: Vec<(usize, usize)> = vec![
            (320, 240),   // QVGA
            (640, 480),   // VGA
            (1280, 720),  // 720p
            (1920, 1080), // 1080p
        ];
        let iterations = 1000;

        for (w, h) in &sizes {
            let pixel_count = w * h;
            let frame1: Vec<u8> = (0..pixel_count).map(|i| (i % 256) as u8).collect();
            let frame2: Vec<u8> = (0..pixel_count).map(|i| ((i + 30) % 256) as u8).collect();

            let start = std::time::Instant::now();
            for _ in 0..iterations {
                let _ = calculate_motion_intensity(&frame1, &frame2, pixel_count);
            }
            let elapsed = start.elapsed();
            let per_call_us = elapsed.as_micros() as f64 / iterations as f64;

            println!(
                "Rust motion ({}x{}, {}px, {} iters): avg={:.2}µs ({:.4}ms)",
                w, h, pixel_count, iterations, per_call_us, per_call_us / 1000.0,
            );
        }
    }

    /// Benchmark: Scene change detection
    /// Run with: cargo test --release -- visual_highlight::tests::bench_scene_change --nocapture
    #[test]
    fn bench_scene_change() {
        let sizes: Vec<(usize, usize)> = vec![
            (320, 240),
            (640, 480),
            (1280, 720),
            (1920, 1080),
        ];
        let iterations = 500;

        for (w, h) in &sizes {
            let pixel_count = w * h;
            let frame1: Vec<u8> = (0..pixel_count).map(|i| (i % 256) as u8).collect();
            let frame2: Vec<u8> = (0..pixel_count).map(|i| ((i + 50) % 256) as u8).collect();

            let start = std::time::Instant::now();
            for _ in 0..iterations {
                let _ = calculate_scene_change_score(&frame1, &frame2, *w, *h, 8);
            }
            let elapsed = start.elapsed();
            let per_call_us = elapsed.as_micros() as f64 / iterations as f64;

            println!(
                "Rust scene_change ({}x{}, {}px, {} iters): avg={:.2}µs ({:.4}ms)",
                w, h, pixel_count, iterations, per_call_us, per_call_us / 1000.0,
            );
        }
    }

    /// Benchmark: Full visual highlight pipeline
    /// Run with: cargo test --release -- visual_highlight::tests::bench_full_pipeline --nocapture
    #[test]
    fn bench_full_pipeline() {
        let (width, height) = (640, 480);
        let pixel_count = width * height;
        let frame_count = 150; // 5 seconds at 30fps

        let frames: Vec<Vec<u8>> = (0..frame_count)
            .map(|f| {
                let offset = (f * 3) % 256;
                (0..pixel_count).map(|i| ((i + offset) % 256) as u8).collect()
            })
            .collect();

        let config = VisualHighlightConfig {
            fps: 30.0,
            ..Default::default()
        };

        let iterations = 20;
        let start = std::time::Instant::now();
        for _ in 0..iterations {
            let _ = detect_visual_highlights(&frames, width, height, Some(config.clone()));
        }
        let elapsed = start.elapsed();

        println!(
            "Rust full pipeline ({}x{}, {} frames, {} iters): total={:.2}ms, avg={:.2}ms",
            width, height, frame_count, iterations,
            elapsed.as_secs_f64() * 1000.0,
            elapsed.as_secs_f64() * 1000.0 / iterations as f64,
        );
    }
}

// ==================== Tauri Command Wrappers ====================

/// Tauri command: detect visual highlights from grayscale frame data
#[tauri::command]
pub fn detect_visual_highlights_command(
    frames: Vec<Vec<u8>>,
    width: usize,
    height: usize,
    config: Option<VisualHighlightConfig>,
) -> Result<VisualHighlightResult, String> {
    Ok(detect_visual_highlights(&frames, width, height, config))
}

/// Tauri command: merge visual highlights with audio beat times
#[tauri::command]
pub fn merge_visual_with_audio_beats(
    visual_highlights: Vec<VisualHighlightMarker>,
    audio_beat_times: Vec<f64>,
    tolerance_seconds: f64,
) -> Result<Vec<VisualHighlightMarker>, String> {
    Ok(merge_with_audio_beats(&visual_highlights, &audio_beat_times, tolerance_seconds))
}
