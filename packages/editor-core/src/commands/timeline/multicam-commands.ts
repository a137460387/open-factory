import type { TimelineAccessor, ProjectAccessor } from "./index";
import { DEFAULT_NESTED_SEQUENCE_NAME, Project, createId, createMulticamClip, normalizeMulticamSequence, replaceProjectActiveTimeline } from '../../model';
import type { Clip } from '../../model';
import { MulticamClip, MulticamClipAngle, MulticamSyncMode, SwitchPoint, SwitchTransition } from '../../model-types';
import { addSwitchPoint, createMulticamSequenceProject } from '../../multicam';
import { round } from '../../time';
import { replaceClip } from '../../timeline';
import { Command } from '../command';
import { ProjectAccessor, findClip, insertClip, touchProject } from './utils';
import { cutMulticamClip, trimMulticamClip } from './utils-nested';

export class CreateMulticamSequenceCommand implements Command {
  readonly description = 'Create multicam sequence';
  private before?: Project;
  private after?: Project;
  private resultClipId?: string;
  private resultSequenceId?: string;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly clipIds: string[],
    private readonly sequenceName = DEFAULT_NESTED_SEQUENCE_NAME,
  ) {}

  get multicamClipId(): string | undefined {
    return this.resultClipId;
  }

  get sequenceId(): string | undefined {
    return this.resultSequenceId;
  }

  execute(): void {
    this.before ??= this.accessor.getProject();
    if (!this.after) {
      const result = createMulticamSequenceProject(this.before, this.clipIds, { sequenceName: this.sequenceName });
      this.after = result.project;
      this.resultClipId = result.multicamClipId;
      this.resultSequenceId = result.sequenceId;
    }
    this.accessor.setProject(this.after);
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }
}

export class CutMulticamClipCommand implements Command {
  readonly description = 'Cut multicam clip';
  private before?: Project;
  private after?: Project;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly clipId: string,
    private readonly sceneTime: number,
    private readonly angleId: string,
  ) {}

  execute(): void {
    this.before ??= this.accessor.getProject();
    this.after ??= cutMulticamClip(this.before, this.clipId, this.sceneTime, this.angleId);
    this.accessor.setProject(this.after);
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }
}

export interface MulticamAngleCut {
  sceneTime: number;
  angleId: string;
}

export class RecordAngleCutCommand implements Command {
  readonly description = 'Record multicam angle cuts';
  private before?: Project;
  private after?: Project;
  private readonly cuts: MulticamAngleCut[];

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly clipId: string,
    cuts: MulticamAngleCut[] = [],
  ) {
    this.cuts = cuts.map((cut) => ({ sceneTime: cut.sceneTime, angleId: cut.angleId }));
  }

  get cutCount(): number {
    return this.cuts.length;
  }

  record(sceneTime: number, angleId: string): void {
    this.cuts.push({ sceneTime, angleId });
    this.applyCuts();
  }

  execute(): void {
    this.applyCuts();
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }

  private applyCuts(): void {
    this.before ??= this.accessor.getProject();
    this.after = this.cuts.reduce(
      (project, cut) => cutMulticamClip(project, this.clipId, cut.sceneTime, cut.angleId),
      this.before,
    );
    this.accessor.setProject(this.after);
  }
}

export class TrimMulticamSwitchCommand implements Command {
  readonly description = 'Trim multicam switch';
  private before?: Project;
  private after?: Project;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly clipId: string,
    private readonly switchId: string,
    private readonly frameDelta: number,
    private readonly fps: number,
  ) {}

  execute(): void {
    this.before ??= this.accessor.getProject();
    this.after ??= trimMulticamClip(this.before, this.clipId, this.switchId, this.frameDelta, this.fps);
    this.accessor.setProject(this.after);
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }
}

export class ApplyMulticamAiCutSuggestionsCommand implements Command {
  readonly description = 'Apply AI multicam cut suggestions';
  private before?: Project;
  private after?: Project;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly clipId: string,
    private readonly suggestions: Array<{ time: number; angleId: string; confidence: number; reason: string }>,
  ) {}

  execute(): void {
    this.before ??= this.accessor.getProject();
    if (!this.after) {
      const project = this.before;
      const clip = findClip(project.timeline, this.clipId);
      if (clip.type !== 'nested-sequence' || !clip.multicam) {
        throw new Error('Clip is not a multicam sequence');
      }
      const normalized = normalizeMulticamSequence(clip.multicam, clip.duration);
      if (!normalized) {
        throw new Error('Invalid multicam sequence');
      }
      const switchMap = new Map<number, { time: number; angleId: string }>();
      for (const sw of normalized.switches) {
        switchMap.set(sw.time, { time: sw.time, angleId: sw.angleId });
      }
      for (const suggestion of this.suggestions) {
        const localTime = round(Math.min(clip.duration, Math.max(0, suggestion.time - clip.start + clip.trimStart)));
        switchMap.set(localTime, { time: localTime, angleId: suggestion.angleId });
      }
      const newSwitches = [...switchMap.values()]
        .sort((a, b) => a.time - b.time)
        .map((sw) => ({ id: createId('multicam-switch'), time: sw.time, angleId: sw.angleId }));
      const finalMc = normalizeMulticamSequence({ ...normalized, switches: newSwitches }, clip.duration);
      if (!finalMc) {
        throw new Error('Invalid multicam after merge');
      }
      const multicam = { ...clip.multicam, switches: finalMc.switches, aiCutSuggestions: this.suggestions };
      const updatedClip = { ...clip, multicam };
      this.after = replaceProjectActiveTimeline(project, replaceClip(project.timeline, updatedClip));
    }
    this.accessor.setProject(this.after);
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }
}

export class CreateMulticamClipCommand implements Command {
  readonly description = 'Create multicam clip';
  private before?: Project;
  private _result?: MulticamClip;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly trackId: string,
    private readonly angles: MulticamClipAngle[],
    private readonly syncMode: MulticamSyncMode,
    private readonly syncReferenceAngle: number,
    private readonly start = 0,
    private readonly duration = 10,
  ) {}

  get result(): MulticamClip {
    if (!this._result) {
      throw new Error('Command not executed');
    }
    return this._result;
  }

  execute(): void {
    this.before ??= this.accessor.getProject();
    if (!this._result) {
      const clip = createMulticamClip(this.angles, this.syncMode, this.syncReferenceAngle);
      this._result = { ...clip, trackId: this.trackId, start: this.start, duration: this.duration };
    }
    const project = this.accessor.getProject();
    const syncedProject = replaceProjectActiveTimeline(project, project.timeline);
    const timeline = syncedProject.timeline;
    const nextTimeline = insertClip(timeline, this._result as unknown as Clip);
    this.accessor.setProject(touchProject(replaceProjectActiveTimeline(syncedProject, nextTimeline)));
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }
}

/**
 * 切换多机位角度命令（添加切换点）
 */

export class SwitchMulticamAngleCommand implements Command {
  readonly description = 'Switch multicam angle';
  private before?: Project;
  private after?: Project;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly clipId: string,
    private readonly time: number,
    private readonly targetAngle: number,
    private readonly transition: SwitchTransition = 'cut',
  ) {}

  execute(): void {
    this.before ??= this.accessor.getProject();
    if (!this.after) {
      const project = this.accessor.getProject();
      const syncedProject = replaceProjectActiveTimeline(project, project.timeline);
      const timeline = syncedProject.timeline;
      const clip = findClip(timeline, this.clipId);
      if (clip.type !== 'multicam') {
        throw new Error('Clip is not a MulticamClip');
      }
      const newSwitchPoint: SwitchPoint = {
        time: this.time,
        targetAngle: this.targetAngle,
        transition: this.transition,
      };
      const updatedClip: MulticamClip = { ...clip, switchPoints: addSwitchPoint(clip.switchPoints, newSwitchPoint) };
      this.after = touchProject(
        replaceProjectActiveTimeline(syncedProject, replaceClip(timeline, updatedClip as unknown as Clip)),
      );
    }
    this.accessor.setProject(this.after);
  }

  undo(): void {
    if (this.before) {
      this.accessor.setProject(this.before);
    }
  }
}

/**
 * 删除切换点命令
 */
