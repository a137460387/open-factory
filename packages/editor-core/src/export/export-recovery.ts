import type {
  ExportRecoveryAction,
  ExportRecoveryErrorKind,
  ExportRecoveryLogEntry,
  ExportRecoveryReport,
  FfmpegExportPlan,
} from './export-types';

export const MAX_EXPORT_RECOVERY_ATTEMPTS = 3;

export interface ExportRecoveryDecision {
  errorKind: ExportRecoveryErrorKind;
  action: ExportRecoveryAction;
  canRetry: boolean;
  message: string;
  plan?: FfmpegExportPlan;
}

export function classifyExportError(error: string): ExportRecoveryErrorKind {
  const normalized = error.toLowerCase();
  if (/no space left|not enough space|disk full|enospc/.test(normalized)) {
    return 'disk-space';
  }
  if (/cannot allocate memory|out of memory|std::bad_alloc|memory allocation|ENOMEM/i.test(error)) {
    return 'out-of-memory';
  }
  if (
    /unknown encoder|encoder .* not found|codec .* not supported|unsupported codec|invalid encoder|experimental codec/.test(
      normalized,
    )
  ) {
    return 'unsupported-codec';
  }
  if (/fontconfig|font file|cannot find font|failed to load font|drawtext.*font/.test(normalized)) {
    return 'missing-font';
  }
  if (
    /segmentation fault|access violation|exit code\s*:? ?(1|255)|process failed|ffmpeg failed|aborted|crash/.test(
      normalized,
    )
  ) {
    return 'ffmpeg-crash';
  }
  return 'unknown';
}

export function buildExportRecoveryDecision(
  plan: FfmpegExportPlan,
  error: string,
  attempts: number,
): ExportRecoveryDecision {
  if (attempts >= MAX_EXPORT_RECOVERY_ATTEMPTS) {
    return {
      errorKind: classifyExportError(error),
      action: 'none',
      canRetry: false,
      message: 'Export recovery limit reached.',
    };
  }
  const errorKind = classifyExportError(error);
  if (errorKind === 'ffmpeg-crash') {
    if (attempts > 0) {
      return {
        errorKind,
        action: 'none',
        canRetry: false,
        message: 'FFmpeg crash recovery has already been attempted.',
      };
    }
    return {
      errorKind,
      action: 'retry-same',
      canRetry: true,
      message: 'Retrying once with the same FFmpeg arguments.',
      plan,
    };
  }
  if (errorKind === 'unsupported-codec') {
    return {
      errorKind,
      action: 'fallback-codec',
      canRetry: true,
      message: 'Falling back to a software H.264/H.265 encoder.',
      plan: fallbackExportCodecPlan(plan),
    };
  }
  if (errorKind === 'out-of-memory') {
    return {
      errorKind,
      action: 'reduce-concurrency',
      canRetry: true,
      message: 'Reducing export concurrency to 1 and retrying.',
      plan,
    };
  }
  if (errorKind === 'missing-font') {
    return {
      errorKind,
      action: 'skip-drawtext',
      canRetry: true,
      message: 'Skipping drawtext filters and retrying.',
      plan: stripDrawtextFromExportPlan(plan),
    };
  }
  if (errorKind === 'disk-space') {
    return {
      errorKind,
      action: 'prompt-disk-cleanup',
      canRetry: false,
      message: 'Disk space is insufficient; user cleanup is required.',
    };
  }
  return {
    errorKind,
    action: 'none',
    canRetry: false,
    message: 'No automatic export recovery is available for this error.',
  };
}

export function appendExportRecoveryLog(
  entries: ExportRecoveryLogEntry[],
  decision: ExportRecoveryDecision,
  originalError: string,
  result: ExportRecoveryLogEntry['result'] = 'pending',
): ExportRecoveryLogEntry[] {
  return [
    ...entries,
    {
      attempt: entries.length + 1,
      errorKind: decision.errorKind,
      action: decision.action,
      originalError,
      result,
      message: decision.message,
    },
  ];
}

export function finalizeExportRecoveryLog(
  entries: ExportRecoveryLogEntry[],
  result: ExportRecoveryLogEntry['result'],
): ExportRecoveryLogEntry[] {
  if (entries.length === 0) {
    return [];
  }
  return entries.map((entry, index) => (index === entries.length - 1 ? { ...entry, result } : entry));
}

export function buildExportRecoveryReport(
  entries: ExportRecoveryLogEntry[],
  healed: boolean,
): ExportRecoveryReport | undefined {
  if (entries.length === 0) {
    return undefined;
  }
  return {
    healed,
    attempts: entries.length,
    entries,
  };
}

export function hasEnoughDiskSpace(
  availableBytes: number,
  expectedBytes: number,
  reserveBytes = 512 * 1024 * 1024,
): boolean {
  if (!Number.isFinite(availableBytes) || availableBytes < 0) {
    return false;
  }
  const expected = Math.max(0, Number.isFinite(expectedBytes) ? expectedBytes : 0);
  const reserve = Math.max(0, Number.isFinite(reserveBytes) ? reserveBytes : 0);
  return availableBytes >= expected + reserve;
}

export function fallbackExportCodecPlan(plan: FfmpegExportPlan): FfmpegExportPlan {
  const currentCodec = plan.settings?.videoCodec?.toLowerCase() ?? '';
  const fallbackCodec = currentCodec.includes('265') || currentCodec.includes('hevc') ? 'libx265' : 'libx264';
  return mapExportPlanArgs(plan, (args) => replaceCodecArg(args, fallbackCodec), {
    videoCodec: fallbackCodec,
    hardwareEncoding: false,
  });
}

export function stripDrawtextFromExportPlan(plan: FfmpegExportPlan): FfmpegExportPlan {
  const recovered = mapExportPlanArgs(
    plan,
    (args) => args.map((arg) => stripDrawtextFilters(arg)),
    undefined,
    (filterComplex) => stripDrawtextFilters(filterComplex),
  );
  return {
    ...recovered,
    warnings: [...recovered.warnings, 'Skipped drawtext filters because a required font was missing.'],
  };
}

function mapExportPlanArgs(
  plan: FfmpegExportPlan,
  mapArgs: (args: string[]) => string[],
  settingsPatch?: Partial<NonNullable<FfmpegExportPlan['settings']>>,
  mapFilterComplex: (filterComplex: string) => string = (filterComplex) => filterComplex,
): FfmpegExportPlan {
  const nextSettings = plan.settings ? { ...plan.settings, ...settingsPatch } : plan.settings;
  return {
    ...plan,
    settings: nextSettings,
    filterComplex: mapFilterComplex(plan.filterComplex),
    outputArgs: mapArgs(plan.outputArgs),
    fullArgs: mapArgs(plan.fullArgs),
    passes: plan.passes?.map((pass) => ({ ...pass, fullArgs: mapArgs(pass.fullArgs) })),
    nestedPlans: plan.nestedPlans.map((nested) => ({
      ...nested,
      plan: mapExportPlanArgs(nested.plan, mapArgs, settingsPatch, mapFilterComplex),
    })),
  };
}

function replaceCodecArg(args: string[], fallbackCodec: string): string[] {
  const next = [...args];
  for (let index = 0; index < next.length - 1; index += 1) {
    if (next[index] === '-c:v' || next[index] === '-codec:v') {
      next[index + 1] = fallbackCodec;
    }
  }
  return next;
}

function stripDrawtextFilters(value: string): string {
  return value
    .split(',')
    .filter((part) => !part.trim().startsWith('drawtext='))
    .join(',');
}
