import { describe, expect, it } from 'vitest';
import {
  createMulticamAudioGroup,
  updateGroupActiveAngle,
  setGroupFollowMode,
  updateChannelVolume,
  toggleChannelMute,
  toggleChannelSolo,
  updateChannelPan,
  setGroupMasterVolume,
  toggleGroupMasterMute,
  calculateGroupMixParams,
  hasAnySolo,
  getActiveChannel,
  resetAllChannels,
} from '../src/multi-camera/audio-grouping';
import type { MulticamAudioGroup } from '../src/multi-camera/audio-grouping';

describe('multi-camera audio-grouping', () => {
  const angles = [
    { id: 'angle-1', mediaId: 'media-1', name: 'Camera 1' },
    { id: 'angle-2', mediaId: 'media-2', name: 'Camera 2' },
    { id: 'angle-3', mediaId: 'media-3', name: 'Camera 3' },
  ];

  describe('createMulticamAudioGroup', () => {
    it('creates a group with correct structure', () => {
      const group = createMulticamAudioGroup('group-1', 'Test Group', angles);

      expect(group.id).toBe('group-1');
      expect(group.name).toBe('Test Group');
      expect(group.followMode).toBe('follow-video');
      expect(group.activeAngleIndex).toBe(0);
      expect(group.channels).toHaveLength(3);
      expect(group.masterVolume).toBe(1);
      expect(group.masterMuted).toBe(false);
    });

    it('creates channels for each angle', () => {
      const group = createMulticamAudioGroup('group-1', 'Test Group', angles);

      expect(group.channels[0].angleId).toBe('angle-1');
      expect(group.channels[0].name).toBe('Camera 1 Audio');
      expect(group.channels[0].volume).toBe(1);
      expect(group.channels[0].muted).toBe(false);
    });

    it('supports custom follow mode', () => {
      const group = createMulticamAudioGroup('group-1', 'Test Group', angles, 'independent');
      expect(group.followMode).toBe('independent');
    });
  });

  describe('updateGroupActiveAngle', () => {
    it('updates active angle index', () => {
      const group = createMulticamAudioGroup('group-1', 'Test Group', angles);
      const updated = updateGroupActiveAngle(group, 2);

      expect(updated.activeAngleIndex).toBe(2);
    });

    it('rejects out-of-range index', () => {
      const group = createMulticamAudioGroup('group-1', 'Test Group', angles);
      const updated = updateGroupActiveAngle(group, 99);

      expect(updated).toBe(group); // same reference = no change
    });

    it('rejects negative index', () => {
      const group = createMulticamAudioGroup('group-1', 'Test Group', angles);
      const updated = updateGroupActiveAngle(group, -1);

      expect(updated).toBe(group);
    });
  });

  describe('setGroupFollowMode', () => {
    it('changes follow mode', () => {
      const group = createMulticamAudioGroup('group-1', 'Test Group', angles);
      const updated = setGroupFollowMode(group, 'mixed');

      expect(updated.followMode).toBe('mixed');
    });
  });

  describe('updateChannelVolume', () => {
    it('updates volume for specified channel', () => {
      const group = createMulticamAudioGroup('group-1', 'Test Group', angles);
      const updated = updateChannelVolume(group, 'mc-audio-angle-2', 0.5);

      expect(updated.channels[1].volume).toBe(0.5);
    });

    it('clamps volume to 0-1', () => {
      const group = createMulticamAudioGroup('group-1', 'Test Group', angles);
      const updated = updateChannelVolume(group, 'mc-audio-angle-1', 1.5);

      expect(updated.channels[0].volume).toBe(1);
    });

    it('does not affect other channels', () => {
      const group = createMulticamAudioGroup('group-1', 'Test Group', angles);
      const updated = updateChannelVolume(group, 'mc-audio-angle-1', 0.5);

      expect(updated.channels[1].volume).toBe(1);
    });
  });

  describe('toggleChannelMute', () => {
    it('toggles mute state', () => {
      const group = createMulticamAudioGroup('group-1', 'Test Group', angles);
      const toggled = toggleChannelMute(group, 'mc-audio-angle-1');

      expect(toggled.channels[0].muted).toBe(true);

      const toggledBack = toggleChannelMute(toggled, 'mc-audio-angle-1');
      expect(toggledBack.channels[0].muted).toBe(false);
    });
  });

  describe('toggleChannelSolo', () => {
    it('toggles solo state', () => {
      const group = createMulticamAudioGroup('group-1', 'Test Group', angles);
      const toggled = toggleChannelSolo(group, 'mc-audio-angle-2');

      expect(toggled.channels[1].solo).toBe(true);
    });
  });

  describe('updateChannelPan', () => {
    it('updates pan value', () => {
      const group = createMulticamAudioGroup('group-1', 'Test Group', angles);
      const updated = updateChannelPan(group, 'mc-audio-angle-1', -0.5);

      expect(updated.channels[0].pan).toBe(-0.5);
    });

    it('clamps pan to -1 to 1', () => {
      const group = createMulticamAudioGroup('group-1', 'Test Group', angles);
      const updated = updateChannelPan(group, 'mc-audio-angle-1', 2);

      expect(updated.channels[0].pan).toBe(1);
    });
  });

  describe('setGroupMasterVolume', () => {
    it('sets master volume', () => {
      const group = createMulticamAudioGroup('group-1', 'Test Group', angles);
      const updated = setGroupMasterVolume(group, 0.7);

      expect(updated.masterVolume).toBe(0.7);
    });

    it('clamps to 0-1', () => {
      const group = createMulticamAudioGroup('group-1', 'Test Group', angles);
      expect(setGroupMasterVolume(group, -0.5).masterVolume).toBe(0);
      expect(setGroupMasterVolume(group, 1.5).masterVolume).toBe(1);
    });
  });

  describe('toggleGroupMasterMute', () => {
    it('toggles master mute', () => {
      const group = createMulticamAudioGroup('group-1', 'Test Group', angles);
      const toggled = toggleGroupMasterMute(group);

      expect(toggled.masterMuted).toBe(true);
    });
  });

  describe('calculateGroupMixParams', () => {
    it('follow-video mode: only active angle is audible', () => {
      const group = createMulticamAudioGroup('group-1', 'Test Group', angles, 'follow-video');
      const params = calculateGroupMixParams(group);

      expect(params[0].audible).toBe(true);  // angle-1 is active
      expect(params[1].audible).toBe(false);
      expect(params[2].audible).toBe(false);
    });

    it('independent mode: all unmuted channels are audible', () => {
      const group = createMulticamAudioGroup('group-1', 'Test Group', angles, 'independent');
      const params = calculateGroupMixParams(group);

      expect(params[0].audible).toBe(true);
      expect(params[1].audible).toBe(true);
      expect(params[2].audible).toBe(true);
    });

    it('mixed mode: all unmuted channels are audible', () => {
      const group = createMulticamAudioGroup('group-1', 'Test Group', angles, 'mixed');
      const params = calculateGroupMixParams(group);

      expect(params[0].audible).toBe(true);
      expect(params[1].audible).toBe(true);
      expect(params[2].audible).toBe(true);
    });

    it('muted channel is not audible', () => {
      const group = createMulticamAudioGroup('group-1', 'Test Group', angles, 'independent');
      const muted = toggleChannelMute(group, 'mc-audio-angle-1');
      const params = calculateGroupMixParams(muted);

      expect(params[0].audible).toBe(false);
      expect(params[1].audible).toBe(true);
    });

    it('master muted makes all channels inaudible', () => {
      const group = createMulticamAudioGroup('group-1', 'Test Group', angles, 'independent');
      const muted = toggleGroupMasterMute(group);
      const params = calculateGroupMixParams(muted);

      expect(params.every((p) => !p.audible)).toBe(true);
    });

    it('solo overrides other modes', () => {
      const group = createMulticamAudioGroup('group-1', 'Test Group', angles, 'independent');
      const withSolo = toggleChannelSolo(group, 'mc-audio-angle-2');
      const params = calculateGroupMixParams(withSolo);

      expect(params[0].audible).toBe(false);
      expect(params[1].audible).toBe(true);
      expect(params[2].audible).toBe(false);
    });

    it('effective volume includes master volume', () => {
      const group = createMulticamAudioGroup('group-1', 'Test Group', angles, 'independent');
      const adjusted = setGroupMasterVolume(group, 0.5);
      const params = calculateGroupMixParams(adjusted);

      expect(params[0].effectiveVolume).toBe(0.5);
    });
  });

  describe('hasAnySolo', () => {
    it('returns false when no solo', () => {
      const group = createMulticamAudioGroup('group-1', 'Test Group', angles);
      expect(hasAnySolo(group)).toBe(false);
    });

    it('returns true when any channel is solo', () => {
      const group = createMulticamAudioGroup('group-1', 'Test Group', angles);
      const withSolo = toggleChannelSolo(group, 'mc-audio-angle-1');
      expect(hasAnySolo(withSolo)).toBe(true);
    });
  });

  describe('getActiveChannel', () => {
    it('returns the active channel', () => {
      const group = createMulticamAudioGroup('group-1', 'Test Group', angles);
      const active = getActiveChannel(group);

      expect(active?.angleId).toBe('angle-1');
    });

    it('returns updated active channel after change', () => {
      const group = createMulticamAudioGroup('group-1', 'Test Group', angles);
      const updated = updateGroupActiveAngle(group, 2);
      const active = getActiveChannel(updated);

      expect(active?.angleId).toBe('angle-3');
    });
  });

  describe('resetAllChannels', () => {
    it('resets all channels to defaults', () => {
      let group = createMulticamAudioGroup('group-1', 'Test Group', angles);
      group = updateChannelVolume(group, 'mc-audio-angle-1', 0.3);
      group = toggleChannelMute(group, 'mc-audio-angle-2');
      group = toggleChannelSolo(group, 'mc-audio-angle-3');
      group = setGroupMasterVolume(group, 0.5);

      const reset = resetAllChannels(group);

      expect(reset.channels[0].volume).toBe(1);
      expect(reset.channels[1].muted).toBe(false);
      expect(reset.channels[2].solo).toBe(false);
      expect(reset.masterVolume).toBe(1);
      expect(reset.masterMuted).toBe(false);
    });
  });
});
