import { logError } from '../lib/error-handlers';
import { useEffect } from 'react';
import { normalizeTutorialProgressSettings } from '../tutorial/tutorialState';
import { readCustomKeybindings } from '../shortcuts/keybindings';
import { zhCN } from '../i18n/strings';
import {
  readBackupSettings,
  readCollaborationIdentitySettings,
  readCustomSplitLayouts,
  readLayoutSettings,
  readLocalCoeditingSettings,
  readPreviewPerformanceSettings,
  readTutorialProgressSettings,
  readTimelineInteractionSettings,
  readTimelineGridSettings,
  readViewSettings,
} from '../settings/appSettings';
import { applyLocalCoeditingSettings } from '../collaboration/settings';
import { readClipMacros, readMacroHistory } from '../macros/clip-macros';
import { findStartupAutosaveRecovery } from '../lib/projectFiles';
import { getPreviewWindowState } from '../lib/tauri-bridge';
import { useEditorUIStore } from '../store/editorUIStore';
import { useEditorSettingsStore } from '../store/editorSettingsStore';
import { useEditorFeatureStore } from '../store/editorFeatureStore';

/**
 * 从 EditorShell 中提取的挂载时设置加载 effects。
 * 涵盖约 15 个无依赖的 mount-time useEffect，减少组件体积约 200 行。
 */
export function useEditorShellSettings(): void {
  useEffect(() => {
    let canceled = false;
    void readPreviewPerformanceSettings()
      .then((settings) => {
        if (!canceled) {
          useEditorSettingsStore.getState().setPreviewPerformance(settings);
        }
      })
      .catch((error) => {
        console.warn('Unable to load preview performance settings', error);
      });
    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    let canceled = false;
    void Promise.all([readLocalCoeditingSettings(), readCollaborationIdentitySettings()])
      .then(([settings, identity]) => {
        if (!canceled) {
          useEditorSettingsStore.getState().setCollaborationIdentity(identity);
          void applyLocalCoeditingSettings(settings, identity);
        }
      })
      .catch((error) => {
        console.warn('Unable to load local co-editing settings', error);
      });
    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    let canceled = false;
    void getPreviewWindowState()
      .then((state) => {
        if (!canceled) {
          useEditorUIStore.getState().setPreviewWindowOpen(state.open);
          useEditorSettingsStore.getState().setPreviewWindowResolutionScale(state.resolutionScale);
        }
      })
      .catch(logError('useEditorShellSettings'));
    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    let canceled = false;
    void readTimelineGridSettings()
      .then((settings) => {
        if (!canceled) {
          useEditorSettingsStore.getState().setTimelineGridSettings(settings);
        }
      })
      .catch((error) => {
        console.warn('Unable to load timeline grid settings', error);
      });
    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    let canceled = false;
    void readTimelineInteractionSettings()
      .then((settings) => {
        if (!canceled) {
          useEditorSettingsStore.getState().setTimelineInteractionSettings(settings);
        }
      })
      .catch((error) => {
        console.warn('Unable to load timeline interaction settings', error);
      });
    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    let canceled = false;
    void readTutorialProgressSettings()
      .then((progress) => {
        if (!canceled) {
          useEditorSettingsStore.getState().setTutorialProgress(progress);
        }
      })
      .catch((error) => {
        console.warn('Unable to load tutorial progress settings', error);
        if (!canceled) {
          useEditorSettingsStore.getState().setTutorialProgress(normalizeTutorialProgressSettings(undefined));
        }
      });
    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    let canceled = false;
    void readViewSettings()
      .then((view) => {
        if (!canceled) {
          useEditorSettingsStore.getState().setSafeFrameGuides(view.safeFrameGuides);
          useEditorSettingsStore.getState().setThumbnailTrackVisible(view.thumbnailTrackVisible);
          useEditorSettingsStore.getState().setTimelineMinimapVisible(view.timelineMinimapVisible);
          useEditorSettingsStore.getState().setTimelineHeatmap(view.timelineHeatmap);
        }
      })
      .catch((error) => {
        console.warn('Unable to load view settings', error);
      });
    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    let canceled = false;
    void findStartupAutosaveRecovery()
      .then((candidate) => {
        if (!canceled && candidate) {
          useEditorFeatureStore.getState().setRecoveryCandidate(candidate);
        }
      })
      .catch((error) => {
        console.warn(zhCN.editorToasts.autosaveCheckFailed, error);
      });
    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    let canceled = false;
    void readCustomKeybindings()
      .then((bindings) => {
        if (!canceled) {
          useEditorSettingsStore.getState().setShortcutBindings(bindings);
        }
      })
      .catch((error) => {
        console.warn(zhCN.settings.shortcuts.loadFailed, error);
      });
    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    let canceled = false;
    void readClipMacros()
      .then((entries) => {
        if (!canceled) {
          useEditorSettingsStore.getState().setMacros(entries);
        }
      })
      .catch((error) => {
        console.warn(zhCN.settings.macros.saveFailed, error);
      });
    void readMacroHistory()
      .then((entries) => {
        if (!canceled) {
          useEditorFeatureStore.getState().setMacroHistory(entries);
        }
      })
      .catch((error) => {
        console.warn(zhCN.macros.history.title, error);
      });
    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    let canceled = false;
    void readBackupSettings()
      .then((settings) => {
        if (!canceled) {
          useEditorSettingsStore.getState().setLastBackupAt(settings.lastBackupAt);
        }
      })
      .catch((error) => {
        console.warn(zhCN.settings.backup.statusSaveFailed, error);
      });
    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    let canceled = false;
    void readLayoutSettings()
      .then((settings) => {
        if (!canceled) {
          useEditorUIStore.getState().setLayoutSettings(settings);
        }
      })
      .catch((error) => {
        console.warn('Unable to load layout settings', error);
      });
    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    let canceled = false;
    void readCustomSplitLayouts()
      .then((layouts) => {
        if (!canceled) {
          useEditorSettingsStore.getState().setCustomSplitLayouts(layouts);
        }
      })
      .catch((error) => {
        console.warn('Unable to load custom split layouts', error);
      });
    return () => {
      canceled = true;
    };
  }, []);
}
