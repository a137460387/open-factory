import type { TimelineAccessor, ProjectAccessor } from "./index";
import { Project, replaceProjectActiveTimeline } from '../../model';
import type { Clip } from '../../model';
import { MulticamClip, MulticamClipAngle, MulticamSyncMode, SwitchPoint } from '../../model-types';
import { deleteSwitchPoint, updateSwitchPoint } from '../../multicam';
import { replaceClip } from '../../timeline';
import { Command } from '../command';
import { ProjectAccessor, findClip, touchProject } from './utils';

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

/**
 * 更新切换点命令
 */

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

/**
 * 同步多机位片段命令（更新同步模式和机位偏移量）
 */

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

/**
 * 更新多机位角度属性命令
 */

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

// === 调色节点图命令 ===
