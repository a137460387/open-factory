import {useState, useCallback, useMemo} from 'react';
import {zhCN} from '../i18n/strings';
import {bridgeConfirm} from '../lib/tauri-bridge';
import {showToast} from '../lib/toast';
import {loadExportPresets, serializeExportPresetPackage} from '../export/export-presets';
import {filterPresetMarketCards, installPresetMarketCard, loadPresetMarket, presetMarketCardHasCustomConflict, readPresetMarketRatings, writePresetMarketRating, type PresetMarketCard, type PresetMarketFilters, type PresetMarketLoadResult} from '../export/preset-market';
import {filterEffectPresetCommunityCards, installEffectPresetCommunityCard, loadEffectPresetCommunityLibrary, type EffectPresetCommunityCard, type EffectPresetCommunityLoadResult} from '../effects/effect-preset-library';
import {createEffectPresetFromClip, serializeEffectPresetFile, type Clip, type EffectPresetFilters} from '@open-factory/editor-core';

export function usePresetMarketSettings(selectedClip?: Clip) {
  const [presetMarketCards, setPresetMarketCards] = useState<PresetMarketCard[]>([]);
  const [presetMarketRatings, setPresetMarketRatings] = useState<Record<string, number>>({});
  const [presetMarketFilters, setPresetMarketFilters] = useState<PresetMarketFilters>({platform: 'all', quality: 'all'});
  const [presetMarketLoading, setPresetMarketLoading] = useState(false);
  const [presetMarketSource, setPresetMarketSource] = useState<PresetMarketLoadResult['source']>('empty');
  const [presetMarketWarning, setPresetMarketWarning] = useState<string>();
  const [installingPresetMarketCardId, setInstallingPresetMarketCardId] = useState<string>();

  const [effectPresetCards, setEffectPresetCards] = useState<EffectPresetCommunityCard[]>([]);
  const [effectPresetFilters, setEffectPresetFilters] = useState<EffectPresetFilters>({style: 'all', use: 'all'});
  const [effectPresetLoading, setEffectPresetLoading] = useState(false);
  const [effectPresetSource, setEffectPresetSource] = useState<EffectPresetCommunityLoadResult['source']>('empty');
  const [effectPresetWarning, setEffectPresetWarning] = useState<string>();
  const [installingEffectPresetCardId, setInstallingEffectPresetCardId] = useState<string>();

  const filteredPresetMarketCards = useMemo(
    () => filterPresetMarketCards(presetMarketCards, presetMarketFilters),
    [presetMarketCards, presetMarketFilters],
  );
  const filteredEffectPresetCards = useMemo(
    () => filterEffectPresetCommunityCards(effectPresetCards, effectPresetFilters),
    [effectPresetCards, effectPresetFilters],
  );

  const loadPresetMarketPanel = useCallback(async () => {
    try {
      setPresetMarketLoading(true);
      setPresetMarketWarning(undefined);
      const [market, ratings] = await Promise.all([loadPresetMarket(), readPresetMarketRatings()]);
      setPresetMarketCards(market.cards);
      setPresetMarketRatings(ratings);
      setPresetMarketSource(market.source);
      setPresetMarketWarning(market.warning);
      if (market.source === 'empty' && market.warning) {
        showToast({kind: 'warning', title: zhCN.presetMarket.loadFailed, message: market.warning});
      }
    } catch (marketError) {
      const message = marketError instanceof Error ? marketError.message : zhCN.presetMarket.loadFailedMessage;
      setPresetMarketCards([]);
      setPresetMarketSource('empty');
      setPresetMarketWarning(message);
      showToast({kind: 'warning', title: zhCN.presetMarket.loadFailed, message});
    } finally {
      setPresetMarketLoading(false);
    }
  }, []);

  const loadEffectPresetLibraryPanel = useCallback(async () => {
    try {
      setEffectPresetLoading(true);
      setEffectPresetWarning(undefined);
      const library = await loadEffectPresetCommunityLibrary();
      setEffectPresetCards(library.cards);
      setEffectPresetSource(library.source);
      setEffectPresetWarning(library.warning);
      if (library.source === 'empty' && library.warning) {
        showToast({kind: 'warning', title: zhCN.effectPresetLibrary.loadFailed, message: library.warning});
      }
    } catch (libraryError) {
      const message = libraryError instanceof Error ? libraryError.message : zhCN.effectPresetLibrary.loadFailedMessage;
      setEffectPresetCards([]);
      setEffectPresetSource('empty');
      setEffectPresetWarning(message);
      showToast({kind: 'warning', title: zhCN.effectPresetLibrary.loadFailed, message});
    } finally {
      setEffectPresetLoading(false);
    }
  }, []);

  const installMarketPreset = useCallback(async (card: PresetMarketCard) => {
    try {
      setInstallingPresetMarketCardId(card.id);
      const existingPresets = await loadExportPresets();
      let conflictMode: 'rename' | 'overwrite' = 'rename';
      if (presetMarketCardHasCustomConflict(card, existingPresets)) {
        const overwrite = await bridgeConfirm(zhCN.presetMarket.overwriteConfirm(card.name));
        if (!overwrite) return;
        conflictMode = 'overwrite';
      }
      const result = await installPresetMarketCard(card, conflictMode);
      showToast({
        kind: 'success',
        title: zhCN.presetMarket.installed,
        message: zhCN.presetMarket.installedMessage(result.imported, result.overwritten),
      });
    } catch (installError) {
      showToast({
        kind: 'warning',
        title: zhCN.presetMarket.installFailed,
        message: installError instanceof Error ? installError.message : zhCN.presetMarket.installFailedMessage,
      });
    } finally {
      setInstallingPresetMarketCardId(undefined);
    }
  }, []);

  const installEffectPreset = useCallback(async (card: EffectPresetCommunityCard) => {
    try {
      setInstallingEffectPresetCardId(card.id);
      const path = await installEffectPresetCommunityCard(card);
      showToast({kind: 'success', title: zhCN.effectPresetLibrary.installed, message: path});
    } catch (installError) {
      showToast({
        kind: 'warning',
        title: zhCN.effectPresetLibrary.installFailed,
        message: installError instanceof Error ? installError.message : zhCN.effectPresetLibrary.installFailedMessage,
      });
    } finally {
      setInstallingEffectPresetCardId(undefined);
    }
  }, []);

  const ratePresetMarketCard = useCallback(async (cardId: string, rating: number) => {
    try {
      setPresetMarketRatings(await writePresetMarketRating(cardId, rating));
    } catch (ratingError) {
      showToast({
        kind: 'warning',
        title: zhCN.presetMarket.ratingFailed,
        message: ratingError instanceof Error ? ratingError.message : zhCN.presetMarket.ratingFailedMessage,
      });
    }
  }, []);

  const shareCustomExportPresets = useCallback(async () => {
    try {
      const presets = (await loadExportPresets()).filter((preset) => !preset.builtin);
      if (presets.length === 0) {
        showToast({kind: 'info', title: zhCN.presetMarket.shareEmpty});
        return;
      }
      await navigator.clipboard.writeText(
        serializeExportPresetPackage(presets, {creator: zhCN.presetMarket.localAuthor}),
      );
      showToast({
        kind: 'success',
        title: zhCN.presetMarket.shared,
        message: zhCN.presetMarket.sharedMessage(presets.length),
      });
    } catch (shareError) {
      showToast({
        kind: 'warning',
        title: zhCN.presetMarket.shareFailed,
        message: shareError instanceof Error ? shareError.message : zhCN.presetMarket.shareFailedMessage,
      });
    }
  }, []);

  const shareSelectedEffectPreset = useCallback(async () => {
    try {
      if (!selectedClip) {
        showToast({
          kind: 'info',
          title: zhCN.effectPresetLibrary.noClipSelected,
          message: zhCN.effectPresetLibrary.noClipSelectedMessage,
        });
        return;
      }
      const preset = createEffectPresetFromClip(selectedClip, {
        id: `${selectedClip.id}-effect-preset`,
        name: selectedClip.name || zhCN.effectPresetLibrary.defaultPresetName,
        author: zhCN.effectPresetLibrary.localAuthor,
        tags: [],
      });
      await navigator.clipboard.writeText(serializeEffectPresetFile(preset));
      showToast({
        kind: 'success',
        title: zhCN.effectPresetLibrary.shared,
        message: zhCN.effectPresetLibrary.sharedMessage,
      });
    } catch (shareError) {
      showToast({
        kind: 'warning',
        title: zhCN.effectPresetLibrary.shareFailed,
        message: shareError instanceof Error ? shareError.message : zhCN.effectPresetLibrary.shareFailedMessage,
      });
    }
  }, [selectedClip]);

  return {
    presetMarketCards,
    presetMarketRatings,
    presetMarketFilters,
    setPresetMarketFilters,
    presetMarketLoading,
    presetMarketSource,
    presetMarketWarning,
    installingPresetMarketCardId,
    filteredPresetMarketCards,
    effectPresetCards,
    effectPresetFilters,
    setEffectPresetFilters,
    effectPresetLoading,
    effectPresetSource,
    effectPresetWarning,
    installingEffectPresetCardId,
    filteredEffectPresetCards,
    loadPresetMarketPanel,
    loadEffectPresetLibraryPanel,
    installMarketPreset,
    installEffectPreset,
    ratePresetMarketCard,
    shareCustomExportPresets,
    shareSelectedEffectPreset,
  };
}
