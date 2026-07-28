import {useEffect, useState} from 'react';
import type {Clip, Project} from '@open-factory/editor-core';
import {AddSubtitleClipCommand, AddTrackCommand, UpdateSubtitleStyleCommand, BUILTIN_SUBTITLE_STYLE_TEMPLATES, createId, createTrack, type SubtitleStyleTemplate} from '@open-factory/editor-core';
import {zhCN} from '../../i18n/strings';
import {commandManager, timelineAccessor} from '../../store/commandManager';
import {bridgeConfirm} from '../../lib/tauri-bridge';
import {acceptTranslationTOS, subtitleClipsToTranslationItems, translateSubtitleItems} from '../../lib/subtitleTranslation';
import {deleteCustomSubtitleStyleTemplate, loadSubtitleStyleTemplates, saveCustomSubtitleStyleTemplate} from '../../lib/subtitleStyleTemplates';
import {addSharedLibraryResource, loadSharedSubtitleStyleTemplates, subtitleStyleTemplateToSharedResource} from '../../shared-library/sharedLibrary';
import {showToast} from '../../lib/toast';
import {mergeSubtitleStyleTemplateViews, getSubtitleStyleTemplateLabel} from './InspectorEditors';
import type {TranslationProvider} from '../../store/translationSettingsStore';
import {isTranslationConfigured} from '../../store/translationSettingsStore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseSubtitleStylesStateParams {
  clip: Clip;
  project: Project;
  translationSettings: { provider: TranslationProvider; apiKey: string; targetLanguage: string };
  setSelectedClipIds: (ids: string[]) => void;
}

export interface UseSubtitleStylesStateReturn {
  subtitleTranslationProgress: { completed: number; total: number } | undefined;
  setSubtitleTranslationProgress: React.Dispatch<
    React.SetStateAction<{ completed: number; total: number } | undefined>
  >;
  subtitleStyleTemplates: SubtitleStyleTemplate[];
  setSubtitleStyleTemplates: React.Dispatch<React.SetStateAction<SubtitleStyleTemplate[]>>;
  translateSubtitleTrack: () => Promise<void>;
  applySubtitleStyleTemplate: (template: SubtitleStyleTemplate) => void;
  saveCurrentSubtitleStyleTemplate: () => Promise<void>;
  deleteSubtitleStyleTemplate: (templateId: string) => Promise<void>;
  addSubtitleStyleTemplateToSharedLibrary: (template: SubtitleStyleTemplate) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSubtitleStylesState({
  clip,
  project,
  translationSettings,
  setSelectedClipIds,
}: UseSubtitleStylesStateParams): UseSubtitleStylesStateReturn {
  const [subtitleTranslationProgress, setSubtitleTranslationProgress] = useState<{
    completed: number;
    total: number;
  }>();
  const [subtitleStyleTemplates, setSubtitleStyleTemplates] = useState<SubtitleStyleTemplate[]>(
    BUILTIN_SUBTITLE_STYLE_TEMPLATES,
  );

  useEffect(() => {
    let canceled = false;
    if (clip.type !== 'subtitle') {
      setSubtitleStyleTemplates([]);
      return () => {
        canceled = true;
      };
    }
    Promise.all([loadSubtitleStyleTemplates(), loadSharedSubtitleStyleTemplates()])
      .then(([templates, sharedTemplates]) => {
        if (!canceled) {
          setSubtitleStyleTemplates(mergeSubtitleStyleTemplateViews(templates, sharedTemplates));
        }
      })
      .catch((error) => {
        if (!canceled) {
          setSubtitleStyleTemplates(BUILTIN_SUBTITLE_STYLE_TEMPLATES);
          showToast({
            kind: 'warning',
            title: zhCN.inspector.subtitleStyleTemplates.loadFailed,
            message: error instanceof Error ? error.message : zhCN.inspector.propertyRejectedMessage,
          });
        }
      });
    return () => {
      canceled = true;
    };
  }, [clip.type]);

  const translateSubtitleTrack = async () => {
    if (clip.type !== 'subtitle' || !isTranslationConfigured(translationSettings)) {
      return;
    }
    const sourceTrack = project.timeline.tracks.find((track) => track.id === clip.trackId);
    if (!sourceTrack || sourceTrack.type !== 'subtitle') {
      return;
    }
    const sourceClips = sourceTrack.clips.filter(
      (item): item is Extract<Clip, { type: 'subtitle' }> => item.type === 'subtitle',
    );
    try {
      setSubtitleTranslationProgress({ completed: 0, total: sourceClips.length });
      const requestTranslation = () =>
        translateSubtitleItems(
          subtitleClipsToTranslationItems(sourceClips),
          translationSettings,
          fetch,
          (completed, total) => {
            setSubtitleTranslationProgress({ completed, total });
          },
        );
      let translated: Awaited<ReturnType<typeof translateSubtitleItems>>;
      try {
        translated = await requestTranslation();
      } catch (error) {
        if (!(error instanceof Error) || error.message !== 'TRANSLATION_TOS_NOT_ACCEPTED') {
          throw error;
        }
        const accepted = await bridgeConfirm(zhCN.inspector.translation.tosMessage, {
          title: zhCN.inspector.translation.tosTitle,
          kind: 'warning',
        });
        if (!accepted) {
          return;
        }
        acceptTranslationTOS();
        translated = await requestTranslation();
      }
      const translatedById = new Map(translated.map((item) => [item.id, item.translatedText]));
      const track = createTrack({
        id: createId('track'),
        type: 'subtitle',
        language: translationSettings.targetLanguage,
        name: zhCN.inspector.translation.trackName(sourceTrack.name, translationSettings.targetLanguage),
        clips: [],
      });
      commandManager.execute(new AddTrackCommand(timelineAccessor, track));
      const addedClipIds: string[] = [];
      for (const sourceClip of sourceClips) {
        const translatedText = translatedById.get(sourceClip.id) ?? sourceClip.text;
        const translatedClip: Extract<Clip, { type: 'subtitle' }> = {
          ...sourceClip,
          id: createId('subtitle'),
          trackId: track.id,
          name: zhCN.inspector.translation.clipName(sourceClip.name, translationSettings.targetLanguage),
          text: translatedText,
          style: { ...sourceClip.style },
          transform: { ...sourceClip.transform },
          colorCorrection: { ...sourceClip.colorCorrection },
        };
        commandManager.execute(new AddSubtitleClipCommand(timelineAccessor, translatedClip));
        addedClipIds.push(translatedClip.id);
      }
      if (addedClipIds[0]) {
        setSelectedClipIds([addedClipIds[0]]);
      }
      showToast({
        kind: 'success',
        title: zhCN.inspector.translation.completeTitle,
        message: zhCN.inspector.translation.completeMessage(addedClipIds.length),
      });
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.inspector.translation.failedTitle,
        message: error instanceof Error ? error.message : zhCN.inspector.translation.failedMessage,
      });
    } finally {
      setSubtitleTranslationProgress(undefined);
    }
  };

  const applySubtitleStyleTemplate = (template: SubtitleStyleTemplate) => {
    if (clip.type !== 'subtitle') {
      return;
    }
    try {
      commandManager.execute(new UpdateSubtitleStyleCommand(timelineAccessor, clip.id, template.style));
      showToast({
        kind: 'success',
        title: zhCN.inspector.subtitleStyleTemplates.title,
        message: zhCN.inspector.subtitleStyleTemplates.applied(getSubtitleStyleTemplateLabel(template)),
      });
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.inspector.propertyRejectedTitle,
        message: error instanceof Error ? error.message : zhCN.inspector.propertyRejectedMessage,
      });
    }
  };

  const saveCurrentSubtitleStyleTemplate = async () => {
    if (clip.type !== 'subtitle') {
      return;
    }
    const name = window.prompt(zhCN.inspector.subtitleStyleTemplates.savePrompt, clip.name);
    if (name === null) {
      return;
    }
    try {
      const templates = await saveCustomSubtitleStyleTemplate(name, clip.style);
      setSubtitleStyleTemplates(templates);
      showToast({
        kind: 'success',
        title: zhCN.inspector.subtitleStyleTemplates.title,
        message: zhCN.inspector.subtitleStyleTemplates.saved(name.trim()),
      });
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.inspector.subtitleStyleTemplates.saveFailed,
        message: error instanceof Error ? error.message : zhCN.inspector.propertyRejectedMessage,
      });
    }
  };

  const deleteSubtitleStyleTemplate = async (templateId: string) => {
    try {
      const templates = await deleteCustomSubtitleStyleTemplate(templateId);
      setSubtitleStyleTemplates(templates);
      showToast({
        kind: 'info',
        title: zhCN.inspector.subtitleStyleTemplates.title,
        message: zhCN.inspector.subtitleStyleTemplates.deleted,
      });
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.inspector.subtitleStyleTemplates.deleteFailed,
        message: error instanceof Error ? error.message : zhCN.inspector.propertyRejectedMessage,
      });
    }
  };

  const addSubtitleStyleTemplateToSharedLibrary = async (template: SubtitleStyleTemplate) => {
    try {
      await addSharedLibraryResource(subtitleStyleTemplateToSharedResource(template), 'overwrite');
      window.dispatchEvent(new CustomEvent('open-factory:shared-library-updated'));
      showToast({
        kind: 'success',
        title: zhCN.inspector.subtitleStyleTemplates.title,
        message: zhCN.inspector.subtitleStyleTemplates.addedToShared(getSubtitleStyleTemplateLabel(template)),
      });
    } catch (error) {
      showToast({
        kind: 'warning',
        title: zhCN.inspector.subtitleStyleTemplates.addToSharedFailed,
        message: error instanceof Error ? error.message : zhCN.inspector.propertyRejectedMessage,
      });
    }
  };

  return {
    subtitleTranslationProgress,
    setSubtitleTranslationProgress,
    subtitleStyleTemplates,
    setSubtitleStyleTemplates,
    translateSubtitleTrack,
    applySubtitleStyleTemplate,
    saveCurrentSubtitleStyleTemplate,
    deleteSubtitleStyleTemplate,
    addSubtitleStyleTemplateToSharedLibrary,
  };
}
