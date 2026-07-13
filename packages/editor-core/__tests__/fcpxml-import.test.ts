// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { applyFcpXmlImport, buildFcpXmlImport, parseFcpXml } from '../src';
import { makeProject } from './test-utils';

const SIMPLE_FCPXML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE xmeml>
<xmeml version="4">
  <sequence>
    <name>Test Sequence</name>
    <rate>
      <timebase>30</timebase>
      <ntsc>FALSE</ntsc>
    </rate>
    <duration>180</duration>
    <media>
      <video>
        <track>
          <clipitem id="clipitem-1">
            <name>Hero Shot</name>
            <rate><timebase>30</timebase><ntsc>FALSE</ntsc></rate>
            <start>0</start>
            <end>90</end>
            <in>0</in>
            <out>90</out>
            <file id="file-1">
              <name>Hero Shot.mp4</name>
              <pathurl>file://localhost/C:/Videos/Hero%20Shot.mp4</pathurl>
            </file>
          </clipitem>
          <clipitem id="clipitem-2">
            <name>B Roll</name>
            <rate><timebase>30</timebase><ntsc>FALSE</ntsc></rate>
            <start>90</start>
            <end>180</end>
            <in>30</in>
            <out>120</out>
            <file id="file-2">
              <name>B Roll Wide.mp4</name>
              <pathurl>file://localhost/C:/Videos/B%20Roll%20Wide.mp4</pathurl>
            </file>
          </clipitem>
        </track>
      </video>
      <audio>
        <track>
          <clipitem id="clipitem-3">
            <name>Dialogue</name>
            <rate><timebase>30</timebase><ntsc>FALSE</ntsc></rate>
            <start>0</start>
            <end>180</end>
            <in>0</in>
            <out>180</out>
            <file id="file-3">
              <name>Dialogue.wav</name>
              <pathurl>file://localhost/C:/Videos/Dialogue.wav</pathurl>
            </file>
          </clipitem>
        </track>
      </audio>
    </media>
  </sequence>
</xmeml>`;

describe('FCPXML import', () => {
  describe('parseFcpXml', () => {
    it('parses a valid FCPXML document with video and audio tracks', () => {
      const result = parseFcpXml(SIMPLE_FCPXML);

      expect(result.sequenceName).toBe('Test Sequence');
      expect(result.fps).toBe(30);
      expect(result.duration).toBe(180);
      expect(result.clipItems).toHaveLength(3);
      expect(result.transitions).toHaveLength(0);
    });

    it('parses clip item metadata correctly', () => {
      const result = parseFcpXml(SIMPLE_FCPXML);
      const videoClips = result.clipItems.filter((c) => c.trackType === 'video');
      const audioClips = result.clipItems.filter((c) => c.trackType === 'audio');

      expect(videoClips).toHaveLength(2);
      expect(videoClips[0]).toMatchObject({
        name: 'Hero Shot',
        start: 0,
        end: 3, // 90 frames / 30 fps
        inPoint: 0,
        outPoint: 3,
        trackType: 'video'
      });
      expect(videoClips[0].filePath).toContain('Hero');
      expect(videoClips[0].filePath).toContain('Shot.mp4');

      expect(audioClips).toHaveLength(1);
      expect(audioClips[0]).toMatchObject({
        name: 'Dialogue',
        trackType: 'audio'
      });
    });

    it('throws on invalid XML', () => {
      expect(() => parseFcpXml('<not-valid>broken')).toThrow();
    });

    it('throws when missing xmeml root element', () => {
      expect(() => parseFcpXml('<?xml version="1.0"?><root></root>')).toThrow('缺少 <xmeml>');
    });

    it('throws when missing sequence element', () => {
      expect(() => parseFcpXml('<?xml version="1.0"?><xmeml version="4"></xmeml>')).toThrow('缺少 <sequence>');
    });

    it('uses default fps of 30 when rate is missing', () => {
      const xml = `<?xml version="1.0"?><xmeml version="4"><sequence><name>Test</name><duration>100</duration><media></media></sequence></xmeml>`;
      const result = parseFcpXml(xml);
      expect(result.fps).toBe(30);
    });

    it('parses transition items between clips', () => {
      const xml = `<?xml version="1.0"?><xmeml version="4">
        <sequence>
          <name>Transition Test</name>
          <rate><timebase>24</timebase><ntsc>FALSE</ntsc></rate>
          <duration>200</duration>
          <media>
            <video>
              <track>
                <clipitem id="c1"><name>A</name><rate><timebase>24</timebase></rate><start>0</start><end>100</end><in>0</in><out>100</out></clipitem>
                <transitionitem id="t1"><name>Cross Dissolve</name><start>90</start><end>110</end><effect><name>Cross Dissolve</name><effectid>dissolve</effectid></effect></transitionitem>
                <clipitem id="c2"><name>B</name><rate><timebase>24</timebase></rate><start>100</start><end>200</end><in>0</in><out>100</out></clipitem>
              </track>
            </video>
          </media>
        </sequence>
      </xmeml>`;
      const result = parseFcpXml(xml);
      expect(result.clipItems).toHaveLength(2);
      expect(result.transitions).toHaveLength(1);
      expect(result.transitions[0]).toMatchObject({
        name: 'Cross Dissolve',
        effectId: 'dissolve'
      });
    });
  });

  describe('buildFcpXmlImport', () => {
    it('builds an import result with matched media', () => {
      const project = makeProject();
      const result = buildFcpXmlImport(project, SIMPLE_FCPXML);

      expect(result.title).toBe('FCPXML Test Sequence');
      expect(result.sequence).toBeDefined();
      expect(result.sequence.name).toBe('FCPXML Test Sequence');
      expect(result.sequence.timeline.tracks.length).toBeGreaterThanOrEqual(2);
    });

    it('creates missing media placeholders for unmatched clips', () => {
      const project = makeProject();
      const result = buildFcpXmlImport(project, SIMPLE_FCPXML);

      // All clips should be missing since project only has 'sample.mp4'
      expect(result.missingCount).toBeGreaterThan(0);
      expect(result.media.length).toBeGreaterThan(0);
      expect(result.media.every((m) => m.missing)).toBe(true);
    });

    it('matches media by path when available', () => {
      const project = makeProject();
      // Add a matching asset
      project.media.push({
        id: 'asset-hero',
        type: 'video',
        name: 'Hero Shot.mp4',
        path: 'C:/Videos/Hero Shot.mp4',
        duration: 10,
        width: 1920,
        height: 1080
      });

      const result = buildFcpXmlImport(project, SIMPLE_FCPXML);
      const matchedClip = result.matches.find((m) => m.kind === 'exact');
      expect(matchedClip).toBeDefined();
      expect(matchedClip!.asset?.id).toBe('asset-hero');
    });

    it('uses custom sequence name from options', () => {
      const project = makeProject();
      const result = buildFcpXmlImport(project, SIMPLE_FCPXML, { sequenceName: 'My Import' });
      expect(result.title).toBe('FCPXML My Import');
      expect(result.sequence.name).toBe('FCPXML My Import');
    });

    it('respects custom fps option', () => {
      const project = makeProject();
      const result = buildFcpXmlImport(project, SIMPLE_FCPXML, { fps: 24 });
      // Clips should be converted using 24fps
      expect(result.sequence).toBeDefined();
    });
  });

  describe('applyFcpXmlImport', () => {
    it('adds the imported sequence to the project', () => {
      const project = makeProject();
      const result = buildFcpXmlImport(project, SIMPLE_FCPXML);
      const updated = applyFcpXmlImport(project, result);

      expect(updated.sequences).toContainEqual(result.sequence);
      expect(updated.activeSequenceId).toBe(result.sequence.id);
    });

    it('adds missing media assets to the project', () => {
      const project = makeProject();
      const result = buildFcpXmlImport(project, SIMPLE_FCPXML);
      const updated = applyFcpXmlImport(project, result);

      expect(updated.media.length).toBe(project.media.length + result.media.length);
    });

    it('sets the imported timeline as the active timeline', () => {
      const project = makeProject();
      const result = buildFcpXmlImport(project, SIMPLE_FCPXML);
      const updated = applyFcpXmlImport(project, result);

      expect(updated.timeline).toBe(result.sequence.timeline);
    });

    it('preserves existing project media', () => {
      const project = makeProject();
      const existingMedia = [...project.media];
      const result = buildFcpXmlImport(project, SIMPLE_FCPXML);
      const updated = applyFcpXmlImport(project, result);

      for (const asset of existingMedia) {
        expect(updated.media).toContainEqual(asset);
      }
    });
  });
});
