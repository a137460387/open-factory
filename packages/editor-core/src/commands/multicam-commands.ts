import { createId, createMulticamClip, normalizeMulticamSequence, replaceProjectActiveTimeline, type Clip, type Project } from '../model';
import type { MulticamClip, MulticamClipAngle, MulticamSyncMode, SwitchPoint, SwitchTransition } from '../model-types';
import { createMulticamSequenceProject, setMulticamSwitch, trimMulticamSwitch, addSwitchPoint, deleteSwitchPoint, updateSwitchPoint } from '../multicam';
import { replaceClip } from '../timeline';
import { round } from '../time';
import type { Command } from './command';
import { type ProjectAccessor, findClip, touchProject, insertClip } from './helpers';

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

function cutMulticamClip(project: Project, clipId: string, sceneTime: number, angleId: string): Project {
  const syncedProject = replaceProjectActiveTimeline(project, project.timeline);
  const timeline = syncedProject.timeline;
  const clip = findClip(timeline, clipId);
  if (clip.type !== 'nested-sequence' || !clip.multicam) {
    throw new Error('Clip is not a multicam sequence');
  }
  if (sceneTime < clip.start - 0.000001 || sceneTime > clip.start + clip.duration + 0.000001) {
    throw new Error('Multicam cut time must be inside the clip bounds');
  }
  const localTime = round(Math.min(clip.duration, Math.max(0, sceneTime - clip.start + clip.trimStart)));
  const switches = setMulticamSwitch(clip.multicam, localTime, angleId, clip.duration);
  return replaceProjectActiveTimeline(
    syncedProject,
    replaceClip(timeline, {
      ...clip,
      multicam: {
        ...clip.multicam,
        switches,
      },
    }),
  );
}

function trimMulticamClip(
  project: Project,
  clipId: string,
  switchId: string,
  frameDelta: number,
  fps: number,
): Project {
  const syncedProject = replaceProjectActiveTimeline(project, project.timeline);
  const timeline = syncedProject.timeline;
  const clip = findClip(timeline, clipId);
  if (clip.type !== 'nested-sequence' || !clip.multicam) {
    throw new Error('Clip is not a multicam sequence');
  }
  const switches = trimMulticamSwitch(clip.multicam, switchId, frameDelta, fps, clip.duration);
  return replaceProjectActiveTimeline(
    syncedProject,
    replaceClip(timeline, {
      ...clip,
      multicam: {
        ...clip.multicam,
        switches,
      },
    }),
  );
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

export class DeleteSwitchPointCommand implements Command {
  readonly description = 'Delete switch point';
  private before?: Project;
  private after?: Project;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly clipId: string,
    private readonly switchPointIndex: number,
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
      const updatedClip: MulticamClip = {
        ...clip,
        switchPoints: deleteSwitchPoint(clip.switchPoints, this.switchPointIndex),
      };
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

export class UpdateSwitchPointCommand implements Command {
  readonly description = 'Update switch point';
  private before?: Project;
  private after?: Project;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly clipId: string,
    private readonly switchPointIndex: number,
    private readonly updates: Partial<SwitchPoint>,
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
      const updatedClip: MulticamClip = {
        ...clip,
        switchPoints: updateSwitchPoint(clip.switchPoints, this.switchPointIndex, this.updates),
      };
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

export class SyncMulticamClipCommand implements Command {
  readonly description = 'Sync multicam clip';
  private before?: Project;
  private after?: Project;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly clipId: string,
    private readonly syncMode: MulticamSyncMode,
    private readonly offsets: Map<string, number>,
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
      const updatedAngles = clip.angles.map((angle) => {
        const newOffset = this.offsets.get(angle.id);
        return newOffset !== undefined ? { ...angle, offset: newOffset } : angle;
      });
      const updatedClip: MulticamClip = { ...clip, angles: updatedAngles, syncMode: this.syncMode };
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

export class UpdateMulticamAngleCommand implements Command {
  readonly description = 'Update multicam angle';
  private before?: Project;
  private after?: Project;

  constructor(
    private readonly accessor: ProjectAccessor,
    private readonly clipId: string,
    private readonly angleIndex: number,
    private readonly updates: Partial<MulticamClipAngle>,
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
      if (this.angleIndex < 0 || this.angleIndex >= clip.angles.length) {
        throw new Error('Angle index out of range');
      }
      const updatedAngles = clip.angles.map((angle, index) =>
        index === this.angleIndex ? { ...angle, ...this.updates } : angle,
      );
      const updatedClip: MulticamClip = { ...clip, angles: updatedAngles };
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
