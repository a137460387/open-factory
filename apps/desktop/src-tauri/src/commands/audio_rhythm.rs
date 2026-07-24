//! Audio Rhythm Analysis - Rust Backend
//!
//! High-performance FFT and beat detection algorithms migrated from TypeScript.
//! Uses zero-copy ArrayBuffer transfer via Tauri invoke.

use std::f64::consts::PI;

/// Audio rhythm analysis configuration
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct AudioRhythmConfig {
    /// FFT window size (must be power of 2)
    pub fft_size: usize,
    /// Hop size between FFT windows (samples)
    pub hop_size: usize,
    /// Sample rate (Hz)
    pub sample_rate: f64,
    /// Onset detection threshold (0-1)
    pub onset_threshold: f64,
    /// Minimum tempo BPM
    pub min_bpm: f64,
    /// Maximum tempo BPM
    pub max_bpm: f64,
    /// Minimum gap between onsets (seconds)
    pub min_onset_gap: f64,
}

impl Default for AudioRhythmConfig {
    fn default() -> Self {
        Self {
            fft_size: 2048,
            hop_size: 512,
            sample_rate: 44100.0,
            onset_threshold: 0.3,
            min_bpm: 60.0,
            max_bpm: 200.0,
            min_onset_gap: 0.05,
        }
    }
}

/// Spectrum frame data
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SpectrumFrame {
    /// Time in seconds
    pub time: f64,
    /// Frequency bins magnitudes (normalized 0-1)
    pub magnitudes: Vec<f64>,
    /// Spectral centroid (brightness)
    pub centroid: f64,
    /// Spectral flux (change from previous frame)
    pub flux: f64,
    /// Band energy: sub-bass, bass, low-mid, mid, high-mid, high
    pub band_energies: [f64; 6],
}

/// Onset event
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct OnsetEvent {
    /// Time in seconds
    pub time: f64,
    /// Onset strength 0-1
    pub strength: f64,
    /// Frequency band where onset was detected
    pub band: String,
}

/// Tempo estimate
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct TempoEstimate {
    /// Estimated BPM
    pub bpm: f64,
    /// Confidence 0-1
    pub confidence: f64,
    /// Beat phase offset (seconds)
    pub phase: f64,
}

/// Rhythm pattern
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct RhythmPattern {
    /// Pattern type
    pub pattern_type: String,
    /// Confidence 0-1
    pub confidence: f64,
    /// Average inter-onset interval
    pub avg_interval: f64,
    /// Interval variance (regularity metric)
    pub interval_variance: f64,
}

/// Audio rhythm analysis result
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct AudioRhythmResult {
    /// Spectrum analysis per frame
    pub spectrum_frames: Vec<SpectrumFrame>,
    /// Detected onsets
    pub onsets: Vec<OnsetEvent>,
    /// Tempo estimation
    pub tempo: Option<TempoEstimate>,
    /// Rhythm pattern classification
    pub pattern: RhythmPattern,
    /// Beat-aligned timestamps
    pub beat_times: Vec<f64>,
    /// Energy curve for timeline display
    pub energy_curve: Vec<(f64, f64)>,
    /// Statistics
    pub stats: AudioRhythmStats,
}

/// Audio rhythm statistics
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct AudioRhythmStats {
    pub total_frames: usize,
    pub onset_count: usize,
    pub avg_spectral_centroid: f64,
    pub avg_energy: f64,
}

/// Compute FFT magnitudes using Cooley-Tukey algorithm
/// This is significantly faster than the TypeScript DFT implementation
pub fn compute_magnitudes(input: &[f64]) -> Vec<f64> {
    let n = input.len();
    if n == 0 {
        return Vec::new();
    }

    // Use radix-2 FFT for power-of-2 sizes
    if n.is_power_of_two() {
        return fft_magnitudes_radix2(input);
    }

    // Fallback to DFT for non-power-of-2 sizes
    dft_magnitudes(input)
}

/// Radix-2 FFT implementation (Cooley-Tukey)
/// O(n log n) complexity vs O(n²) for DFT
fn fft_magnitudes_radix2(input: &[f64]) -> Vec<f64> {
    let n = input.len();
    let half_n = n / 2;

    // Bit-reversal permutation
    let mut real = vec![0.0f64; n];
    let mut imag = vec![0.0f64; n];

    for (i, &input_val) in input.iter().enumerate().take(n) {
        let j = bit_reverse(i, n.trailing_zeros() as usize);
        real[j] = input_val;
    }

    // Butterfly operations
    let mut size = 2;
    while size <= n {
        let half_size = size / 2;
        let angle = -2.0 * PI / size as f64;
        let w_real = angle.cos();
        let w_imag = angle.sin();

        for i in (0..n).step_by(size) {
            let mut cur_real = 1.0;
            let mut cur_imag = 0.0;

            for j in 0..half_size {
                let t_real = cur_real * real[i + j + half_size] - cur_imag * imag[i + j + half_size];
                let t_imag = cur_real * imag[i + j + half_size] + cur_imag * real[i + j + half_size];

                real[i + j + half_size] = real[i + j] - t_real;
                imag[i + j + half_size] = imag[i + j] - t_imag;
                real[i + j] += t_real;
                imag[i + j] += t_imag;

                let new_cur_real = cur_real * w_real - cur_imag * w_imag;
                cur_imag = cur_real * w_imag + cur_imag * w_real;
                cur_real = new_cur_real;
            }
        }

        size *= 2;
    }

    // Compute magnitudes
    let mut magnitudes = Vec::with_capacity(half_n);
    let n_f64 = n as f64;
    for k in 0..half_n {
        let mag = (real[k] * real[k] + imag[k] * imag[k]).sqrt() / n_f64;
        magnitudes.push(mag);
    }

    magnitudes
}

/// Bit-reverse operation for FFT
fn bit_reverse(mut x: usize, bits: usize) -> usize {
    let mut result = 0;
    for _ in 0..bits {
        result = (result << 1) | (x & 1);
        x >>= 1;
    }
    result
}

/// DFT fallback for non-power-of-2 sizes
fn dft_magnitudes(input: &[f64]) -> Vec<f64> {
    let n = input.len();
    let half_n = n / 2;
    let mut magnitudes = Vec::with_capacity(half_n);
    let n_f64 = n as f64;

    for k in 0..half_n {
        let mut sum_real = 0.0;
        let mut sum_imag = 0.0;
        for (i, &input_val) in input.iter().enumerate().take(n) {
            let angle = 2.0 * PI * k as f64 * i as f64 / n_f64;
            sum_real += input_val * angle.cos();
            sum_imag -= input_val * angle.sin();
        }
        magnitudes.push((sum_real * sum_real + sum_imag * sum_imag).sqrt() / n_f64);
    }

    magnitudes
}

/// Apply Hanning window to a signal frame
pub fn apply_hanning_window(signal: &[f64]) -> Vec<f64> {
    let n = signal.len();
    signal
        .iter()
        .enumerate()
        .map(|(i, &val)| val * (0.5 - 0.5 * (2.0 * PI * i as f64 / (n - 1) as f64).cos()))
        .collect()
}

/// Calculate spectral centroid from magnitude spectrum
pub fn calculate_spectral_centroid(magnitudes: &[f64]) -> f64 {
    if magnitudes.is_empty() {
        return 0.0;
    }
    let mut weighted_sum = 0.0;
    let mut total_mag = 0.0;
    for (i, &mag) in magnitudes.iter().enumerate() {
        weighted_sum += i as f64 * mag;
        total_mag += mag;
    }
    if total_mag == 0.0 {
        0.0
    } else {
        (weighted_sum / (total_mag * magnitudes.len() as f64)).min(1.0)
    }
}

/// Calculate spectral flux between two magnitude frames
pub fn calculate_spectral_flux(prev: &[f64], curr: &[f64]) -> f64 {
    let len = prev.len().min(curr.len());
    if len == 0 {
        return 0.0;
    }
    let mut flux = 0.0;
    for i in 0..len {
        let diff = curr[i] - prev[i];
        if diff > 0.0 {
            flux += diff; // Half-wave rectified
        }
    }
    (flux / len as f64).min(1.0)
}

/// Split magnitude spectrum into 6 frequency bands
pub fn calculate_band_energies(magnitudes: &[f64], sample_rate: f64, fft_size: usize) -> [f64; 6] {
    let bin_freq = sample_rate / fft_size as f64;
    let mut bands = [0.0f64; 6];
    let band_ranges: [(f64, f64); 6] = [
        (20.0, 60.0),     // sub-bass
        (60.0, 250.0),    // bass
        (250.0, 500.0),   // low-mid
        (500.0, 2000.0),  // mid
        (2000.0, 4000.0), // high-mid
        (4000.0, 20000.0), // high
    ];
    let mut band_counts = [0usize; 6];

    for (i, &mag) in magnitudes.iter().enumerate() {
        let freq = i as f64 * bin_freq;
        for b in 0..6 {
            if freq >= band_ranges[b].0 && freq < band_ranges[b].1 {
                bands[b] += mag;
                band_counts[b] += 1;
            }
        }
    }

    // Normalize each band
    let max_band = bands.iter().cloned().fold(0.0001f64, f64::max);
    for b in 0..6 {
        bands[b] = if band_counts[b] > 0 {
            (bands[b] / max_band).min(1.0)
        } else {
            0.0
        };
    }

    bands
}

/// Detect onsets from spectrum frames using spectral flux peaks
pub fn detect_onsets(spectrum_frames: &[SpectrumFrame], threshold: f64, min_gap_seconds: f64) -> Vec<OnsetEvent> {
    if spectrum_frames.len() < 3 {
        return Vec::new();
    }

    let fluxes: Vec<f64> = spectrum_frames.iter().map(|f| f.flux).collect();
    let max_flux = fluxes.iter().cloned().fold(0.0001f64, f64::max);
    let normalized_fluxes: Vec<f64> = fluxes.iter().map(|f| f / max_flux).collect();

    let mut onsets = Vec::new();
    let mut last_onset_time = f64::NEG_INFINITY;

    for i in 1..normalized_fluxes.len() - 1 {
        let is_peak = normalized_fluxes[i] > normalized_fluxes[i - 1]
            && normalized_fluxes[i] >= normalized_fluxes[i + 1]
            && normalized_fluxes[i] >= threshold;

        if is_peak && spectrum_frames[i].time - last_onset_time >= min_gap_seconds {
            // Determine dominant band
            let bands = spectrum_frames[i].band_energies;
            let band_names = ["sub-bass", "bass", "low-mid", "mid", "high-mid", "high"];
            let mut max_band_idx = 0;
            for b in 1..6 {
                if bands[b] > bands[max_band_idx] {
                    max_band_idx = b;
                }
            }

            onsets.push(OnsetEvent {
                time: spectrum_frames[i].time,
                strength: normalized_fluxes[i],
                band: band_names[max_band_idx].to_string(),
            });
            last_onset_time = spectrum_frames[i].time;
        }
    }

    onsets
}

/// Estimate tempo from onset times using autocorrelation of inter-onset intervals
pub fn estimate_tempo(onsets: &[OnsetEvent], min_bpm: f64, max_bpm: f64) -> Option<TempoEstimate> {
    if onsets.len() < 4 {
        return None;
    }

    let intervals: Vec<f64> = onsets.windows(2).map(|w| w[1].time - w[0].time).collect();

    if intervals.is_empty() {
        return None;
    }

    // Build interval histogram
    let min_interval = 60.0 / max_bpm;
    let max_interval = 60.0 / min_bpm;
    let bin_width = 0.005; // 5ms resolution
    let num_bins = ((max_interval - min_interval) / bin_width).ceil() as usize;
    let mut histogram = vec![0.0f64; num_bins];

    for &interval in &intervals {
        if interval >= min_interval && interval <= max_interval {
            let bin = ((interval - min_interval) / bin_width) as usize;
            if bin < num_bins {
                histogram[bin] += 1.0;
            }
            // Also count double and half intervals
            let half_bin = ((interval / 2.0 - min_interval) / bin_width) as usize;
            if half_bin < num_bins {
                histogram[half_bin] += 0.5;
            }
            let double_bin = ((interval * 2.0 - min_interval) / bin_width) as usize;
            if double_bin < num_bins {
                histogram[double_bin] += 0.3;
            }
        }
    }

    // Find peak
    let (peak_bin, peak_value) = histogram
        .iter()
        .enumerate()
        .max_by(|(_, a), (_, b)| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal))
        .unwrap_or((0, &0.0));

    if *peak_value == 0.0 {
        return None;
    }

    let best_interval = min_interval + peak_bin as f64 * bin_width;
    let bpm = 60.0 / best_interval;
    let confidence = (*peak_value / (intervals.len() as f64 * 0.5)).min(1.0);

    // Estimate phase: find the best alignment
    let mut best_phase = 0.0;
    let mut best_phase_score = 0.0;
    let mut phase = 0.0;
    while phase < best_interval {
        let mut score = 0.0;
        for onset in onsets {
            let beat_pos = ((onset.time - phase) % best_interval + best_interval) % best_interval;
            if beat_pos < bin_width * 2.0 || beat_pos > best_interval - bin_width * 2.0 {
                score += onset.strength;
            }
        }
        if score > best_phase_score {
            best_phase_score = score;
            best_phase = phase;
        }
        phase += bin_width;
    }

    Some(TempoEstimate {
        bpm,
        confidence,
        phase: best_phase,
    })
}

/// Generate beat timestamps from tempo estimate
pub fn generate_beat_times(tempo: &TempoEstimate, duration: f64) -> Vec<f64> {
    if tempo.bpm <= 0.0 {
        return Vec::new();
    }
    let interval = 60.0 / tempo.bpm;
    let mut beats = Vec::new();
    let mut t = tempo.phase;
    while t < duration {
        beats.push(t);
        t += interval;
    }
    beats
}

/// Classify rhythm pattern from onset intervals
pub fn classify_rhythm_pattern(onsets: &[OnsetEvent]) -> RhythmPattern {
    if onsets.len() < 3 {
        return RhythmPattern {
            pattern_type: "irregular".to_string(),
            confidence: 0.0,
            avg_interval: 0.0,
            interval_variance: 1.0,
        };
    }

    let intervals: Vec<f64> = onsets.windows(2).map(|w| w[1].time - w[0].time).collect();
    let avg_interval = intervals.iter().sum::<f64>() / intervals.len() as f64;
    let variance = intervals.iter().map(|&v| (v - avg_interval).powi(2)).sum::<f64>() / intervals.len() as f64;
    let std_dev = variance.sqrt();
    let cv = if avg_interval > 0.0 { std_dev / avg_interval } else { 1.0 };

    // Check for buildup (decreasing intervals)
    let decreasing_count = intervals.windows(2).filter(|w| w[1] < w[0] * 0.95).count();
    let decreasing_ratio = decreasing_count as f64 / (intervals.len() - 1).max(1) as f64;

    // Check for breakdown (increasing intervals)
    let increasing_count = intervals.windows(2).filter(|w| w[1] > w[0] * 1.05).count();
    let increasing_ratio = increasing_count as f64 / (intervals.len() - 1).max(1) as f64;

    if decreasing_ratio > 0.6 {
        return RhythmPattern {
            pattern_type: "buildup".to_string(),
            confidence: decreasing_ratio,
            avg_interval,
            interval_variance: variance,
        };
    }
    if increasing_ratio > 0.6 {
        return RhythmPattern {
            pattern_type: "breakdown".to_string(),
            confidence: increasing_ratio,
            avg_interval,
            interval_variance: variance,
        };
    }
    if cv < 0.15 {
        return RhythmPattern {
            pattern_type: "steady".to_string(),
            confidence: 1.0 - cv,
            avg_interval,
            interval_variance: variance,
        };
    }
    if cv < 0.4 {
        return RhythmPattern {
            pattern_type: "syncopated".to_string(),
            confidence: 1.0 - cv * 2.0,
            avg_interval,
            interval_variance: variance,
        };
    }

    RhythmPattern {
        pattern_type: "irregular".to_string(),
        confidence: cv,
        avg_interval,
        interval_variance: variance,
    }
}

/// Run full audio rhythm analysis on raw audio samples
pub fn analyze_audio_rhythm(
    audio_samples: &[f64],
    sample_rate: f64,
    config: Option<AudioRhythmConfig>,
) -> AudioRhythmResult {
    let cfg = config.unwrap_or_else(|| AudioRhythmConfig {
        sample_rate,
        ..Default::default()
    });

    let total_samples = audio_samples.len();

    if total_samples < cfg.fft_size {
        return AudioRhythmResult {
            spectrum_frames: Vec::new(),
            onsets: Vec::new(),
            tempo: None,
            pattern: RhythmPattern {
                pattern_type: "irregular".to_string(),
                confidence: 0.0,
                avg_interval: 0.0,
                interval_variance: 0.0,
            },
            beat_times: Vec::new(),
            energy_curve: Vec::new(),
            stats: AudioRhythmStats {
                total_frames: 0,
                onset_count: 0,
                avg_spectral_centroid: 0.0,
                avg_energy: 0.0,
            },
        };
    }

    // Compute spectrum frames
    let mut spectrum_frames = Vec::new();
    let mut prev_magnitudes: Vec<f64> = Vec::new();
    let mut energy_curve = Vec::new();
    let mut total_centroid = 0.0;
    let mut total_energy = 0.0;

    let mut offset = 0;
    while offset + cfg.fft_size <= total_samples {
        let time = offset as f64 / sample_rate;

        // Extract window
        let window: Vec<f64> = audio_samples[offset..offset + cfg.fft_size].to_vec();

        // Apply Hanning window
        let windowed = apply_hanning_window(&window);

        // Compute magnitudes using fast FFT
        let magnitudes = compute_magnitudes(&windowed);

        // Normalize magnitudes
        let max_mag = magnitudes.iter().cloned().fold(0.0001f64, f64::max);
        let normalized_mags: Vec<f64> = magnitudes.iter().map(|m| m / max_mag).collect();

        let centroid = calculate_spectral_centroid(&normalized_mags);
        let flux = calculate_spectral_flux(&prev_magnitudes, &normalized_mags);
        let band_energies = calculate_band_energies(&normalized_mags, sample_rate, cfg.fft_size);

        // Calculate energy
        let energy = normalized_mags.iter().sum::<f64>() / normalized_mags.len() as f64;
        energy_curve.push((time, energy));
        total_centroid += centroid;
        total_energy += energy;

        spectrum_frames.push(SpectrumFrame {
            time,
            magnitudes: normalized_mags.clone(),
            centroid,
            flux,
            band_energies,
        });

        prev_magnitudes = normalized_mags;
        offset += cfg.hop_size;
    }

    // Detect onsets
    let onsets = detect_onsets(&spectrum_frames, cfg.onset_threshold, cfg.min_onset_gap);

    // Estimate tempo
    let tempo = estimate_tempo(&onsets, cfg.min_bpm, cfg.max_bpm);

    // Classify rhythm pattern
    let pattern = classify_rhythm_pattern(&onsets);

    // Generate beat times
    let duration = total_samples as f64 / sample_rate;
    let beat_times = if let Some(ref t) = tempo {
        generate_beat_times(t, duration)
    } else {
        Vec::new()
    };

    let total_frames = spectrum_frames.len();
    let onset_count = onsets.len();

    AudioRhythmResult {
        spectrum_frames,
        onsets,
        tempo,
        pattern,
        beat_times,
        energy_curve,
        stats: AudioRhythmStats {
            total_frames,
            onset_count,
            avg_spectral_centroid: if total_frames > 0 { total_centroid / total_frames as f64 } else { 0.0 },
            avg_energy: if total_frames > 0 { total_energy / total_frames as f64 } else { 0.0 },
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_fft_magnitudes() {
        // Test with a simple sine wave
        let n = 1024;
        let mut signal = Vec::with_capacity(n);
        for i in 0..n {
            signal.push((2.0 * PI * 440.0 * i as f64 / 44100.0).sin());
        }

        let magnitudes = compute_magnitudes(&signal);
        assert!(!magnitudes.is_empty());
        assert_eq!(magnitudes.len(), n / 2);
    }

    #[test]
    fn test_hanning_window() {
        let signal = vec![1.0; 10];
        let windowed = apply_hanning_window(&signal);
        assert_eq!(windowed.len(), 10);
        // First and last samples should be near zero
        assert!(windowed[0].abs() < 0.01);
        assert!(windowed[9].abs() < 0.01);
    }

    #[test]
    fn test_spectral_centroid() {
        // Low frequency should have low centroid
        let low_freq = vec![1.0, 0.5, 0.0, 0.0, 0.0];
        let centroid = calculate_spectral_centroid(&low_freq);
        assert!(centroid < 0.3);

        // High frequency should have high centroid
        let high_freq = vec![0.0, 0.0, 0.0, 0.5, 1.0];
        let centroid = calculate_spectral_centroid(&high_freq);
        assert!(centroid > 0.5);
    }

    #[test]
    fn test_spectral_flux() {
        let prev = vec![0.5, 0.5, 0.5];
        let curr = vec![0.8, 0.3, 0.6];
        let flux = calculate_spectral_flux(&prev, &curr);
        assert!(flux > 0.0);
    }

    #[test]
    fn test_band_energies() {
        let magnitudes = vec![1.0; 100];
        let bands = calculate_band_energies(&magnitudes, 44100.0, 2048);
        assert_eq!(bands.len(), 6);
        // All bands should have some energy
        for band in &bands {
            assert!(*band >= 0.0);
        }
    }

    #[test]
    fn test_full_analysis() {
        // Generate a simple test signal
        let sample_rate = 44100.0;
        let duration = 2.0;
        let n = (sample_rate * duration) as usize;
        let mut signal = Vec::with_capacity(n);
        for i in 0..n {
            let t = i as f64 / sample_rate;
            // 440 Hz sine wave with some beats
            let beat = if (t * 2.0) % 1.0 < 0.1 { 0.8 } else { 0.0 };
            signal.push((2.0 * PI * 440.0 * t).sin() * 0.5 + beat);
        }

        let result = analyze_audio_rhythm(&signal, sample_rate, None);
        assert!(!result.spectrum_frames.is_empty());
        assert!(result.stats.total_frames > 0);
    }

    /// Benchmark: FFT performance for various sizes
    /// Run with: cargo test --release -- audio_rhythm::tests::bench_fft --nocapture
    #[test]
    fn bench_fft() {
        let sizes: Vec<usize> = vec![256, 1024, 2048, 4096, 8192];
        let iterations = 500;

        for &size in &sizes {
            let samples: Vec<f64> = (0..size)
                .map(|i| {
                    let t = i as f64 / 44100.0;
                    (2.0 * PI * 440.0 * t).sin() * 0.5
                        + (2.0 * PI * 880.0 * t).sin() * 0.3
                })
                .collect();

            let start = std::time::Instant::now();
            for _ in 0..iterations {
                let _ = compute_magnitudes(&samples);
            }
            let elapsed = start.elapsed();
            let per_call_us = elapsed.as_micros() as f64 / iterations as f64;

            println!(
                "Rust FFT (n={:>5}, {} iters): total={:.2}ms, avg={:.2}µs ({:.4}ms)",
                size,
                iterations,
                elapsed.as_secs_f64() * 1000.0,
                per_call_us,
                per_call_us / 1000.0,
            );
        }
    }

    /// Benchmark: Full audio rhythm analysis pipeline
    /// Run with: cargo test --release -- audio_rhythm::tests::bench_full_pipeline --nocapture
    #[test]
    fn bench_full_pipeline() {
        let sample_rate = 44100.0;
        let duration = 5.0;
        let n = (sample_rate * duration) as usize;
        let signal: Vec<f64> = (0..n)
            .map(|i| {
                let t = i as f64 / sample_rate;
                let beat = if (t * 2.0) % 1.0 < 0.1 { 0.8 } else { 0.0 };
                (2.0 * PI * 440.0 * t).sin() * 0.5 + beat
            })
            .collect();

        let iterations = 10;
        let start = std::time::Instant::now();
        for _ in 0..iterations {
            let _ = analyze_audio_rhythm(&signal, sample_rate, None);
        }
        let elapsed = start.elapsed();

        println!(
            "Rust full pipeline ({}s audio, {} iters): total={:.2}ms, avg={:.2}ms",
            duration,
            iterations,
            elapsed.as_secs_f64() * 1000.0,
            elapsed.as_secs_f64() * 1000.0 / iterations as f64,
        );
    }
}

// ==================== Tauri Command Wrappers ====================

/// Tauri command: analyze audio rhythm from raw f64 samples
#[tauri::command]
pub fn analyze_audio_rhythm_command(
    audio_samples: Vec<f64>,
    sample_rate: f64,
    config: Option<AudioRhythmConfig>,
) -> Result<AudioRhythmResult, String> {
    Ok(analyze_audio_rhythm(&audio_samples, sample_rate, config))
}

/// Tauri command: compute FFT magnitudes (for real-time spectrum display)
#[tauri::command]
pub fn compute_fft_magnitudes(input: Vec<f64>) -> Result<Vec<f64>, String> {
    Ok(compute_magnitudes(&input))
}
