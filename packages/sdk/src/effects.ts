import type { Result, Effect } from './types.js';
import { EventEmitter, ok, err } from './events.js';

/**
 * Effects management API
 */
export class EffectsAPI extends EventEmitter {
  private effects: Effect[] = [];
  private effectCounter = 0;

  /**
   * Apply an effect
   */
  apply(
    name: string,
    type: string,
    params: Record<string, unknown>,
    timeRange?: { startTime: number; endTime: number },
  ): Result<Effect> {
    if (!name.trim()) {
      return err(new Error('Effect name is required'));
    }
    const effect: Effect = {
      id: `fx-${++this.effectCounter}-${Date.now()}`,
      name,
      type,
      params: { ...params },
      ...timeRange,
    };
    this.effects.push(effect);
    this.emit('effect:applied', effect);
    return ok(effect);
  }

  /**
   * Remove an effect
   */
  remove(effectId: string): Result<void> {
    const index = this.effects.findIndex((e) => e.id === effectId);
    if (index === -1) {
      return err(new Error(`Effect ${effectId} not found`));
    }
    this.effects.splice(index, 1);
    return ok(undefined);
  }

  /**
   * Update effect parameters
   */
  updateParams(
    effectId: string,
    params: Record<string, unknown>,
  ): Result<Effect> {
    const effect = this.effects.find((e) => e.id === effectId);
    if (!effect) {
      return err(new Error(`Effect ${effectId} not found`));
    }
    effect.params = { ...effect.params, ...params };
    return ok({ ...effect });
  }

  /**
   * Get all effects
   */
  getAll(): Effect[] {
    return this.effects.map((e) => ({ ...e, params: { ...e.params } }));
  }

  /**
   * Get effects by type
   */
  getByType(type: string): Effect[] {
    return this.effects
      .filter((e) => e.type === type)
      .map((e) => ({ ...e, params: { ...e.params } }));
  }

  /**
   * Clear all effects
   */
  clear(): void {
    this.effects = [];
  }
}
