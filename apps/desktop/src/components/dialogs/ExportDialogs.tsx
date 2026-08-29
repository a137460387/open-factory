import { lazy, Suspense, useEffect } from 'react';
import type { Project, MediaAsset } from '@open-factory/editor-core';
import type { ExportPreset } from '../../export/export-presets';
import { useDialogStore } from '../../store/dialogStore';
import { useExportFeatureStore } from '../../store/exportFeatureStore';
import type { TimelineImportSummary } from '../../timeline-export/TimelineExportDialog';
import { PanelLoading } from '../PanelLoading';

const ExportDialog = lazy(() => import('../../export/ExportDialog').then((m) => ({ default: m.ExportDialog })));
const TimelineExportDialog = lazy(() =>
  import('../../timeline-export/TimelineExportDialog').then((m) => ({ default: m.TimelineExportDialog })),
);
const ProfessionalNleExportDialog = lazy(() =>
  import('../../professional-nle/ProfessionalNleExportDialog').then((m) => ({
    default: m.ProfessionalNleExportDialog,
  })),
);
const BatchTranscodeDialog = lazy(() =>
  import('../../media/BatchTranscodeDialog').then((m) => ({ default: m.BatchTranscodeDialog })),
);
const BatchWatermarkDialog = lazy(() =>
  import('../../media/BatchWatermarkDialog').then((m) => ({ default: m.BatchWatermarkDialog })),
);
const BatchProjectProcessingDialog = lazy(() =>
  import('../../projectBatch/BatchProjectProcessingDialog').then((m) => ({
    default: m.BatchProjectProcessingDialog,
  })),
);
const GifExportDialog = lazy(() => import('../../media/GifExportDialog'));

export interface ExportDialogsProps {
  project: Project;
  selectedClipIds: string[];
  inPoint?: number;
  outPoint?: number;
  templateExportPreset: ExportPreset | undefined;
  // exportDialogOpen / timelineExportDialogOpen 来自 useExportQueue 的本地 state
  exportDialogOpen: boolean;
  setExportDialogOpen: (open: boolean) => void;
  timelineExportDialogOpen: boolean;
  setTimelineExportDialogOpen: (open: boolean) => void;
  onExportCompleted: (path: string) => void;
  onRelinkMissing: () => void;
  onImportEdl: (contents: string, path: string) => TimelineImportSummary;
  onImportFcpXml: (contents: string, path: string) => TimelineImportSummary;
  onAddMedia: (media: MediaAsset[]) => void;
}

export function ExportDialogs({
  project,
  selectedClipIds,
  inPoint,
  outPoint,
  templateExportPreset,
  exportDialogOpen,
  setExportDialogOpen,
  timelineExportDialogOpen,
  setTimelineExportDialogOpen,
  onExportCompleted,
  onRelinkMissing,
  onImportEdl,
  onImportFcpXml,
  onAddMedia,
}: ExportDialogsProps) {
  const professionalNleExportOpen = useDialogStore((s) => s.professionalNleExportOpen);
  const setProfessionalNleExportOpen = useDialogStore((s) => s.setProfessionalNleExportOpen);
  const batchTranscodeOpen = useDialogStore((s) => s.batchTranscodeOpen);
  const setBatchTranscodeOpen = useDialogStore((s) => s.setBatchTranscodeOpen);
  const batchWatermarkOpen = useDialogStore((s) => s.batchWatermarkOpen);
  const setBatchWatermarkOpen = useDialogStore((s) => s.setBatchWatermarkOpen);
  const batchProjectProcessingOpen = useDialogStore((s) => s.batchProjectProcessingOpen);
  const setBatchProjectProcessingOpen = useDialogStore((s) => s.setBatchProjectProcessingOpen);
  const batchTranscodeInitialPaths = useExportFeatureStore((s) => s.batchTranscodeInitialPaths);
  const setBatchTranscodeInitialPaths = useExportFeatureStore((s) => s.setBatchTranscodeInitialPaths);
  const gifExportAsset = useExportFeatureStore((s) => s.gifExportAsset);
  const setGifExportAsset = useExportFeatureStore((s) => s.setGifExportAsset);

  // 内层对话框 chunk 首次打开才 import，dev ESM 瀑布在慢机/CI 上可令
  // export-dialog 挂载超过 10s（HANDOFF 2.9 勘察）。启动后空闲时预热
  // ExportDialog，点击时命中模块缓存；idle 回调不阻塞首屏，不可用时回退 setTimeout。
  useEffect(() => {
    const warm = () => {
      void import('../../export/ExportDialog');
    };
    if (typeof window.requestIdleCallback === 'function') {
      const idleId = window.requestIdleCallback(warm);
      return () => window.cancelIdleCallback(idleId);
    }
    const timer = window.setTimeout(warm, 2_000);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <Suspense fallback={<PanelLoading label="导出" />}>
      {exportDialogOpen ? (
        <ExportDialog
          project={project}
          initialPreset={templateExportPreset}
          selectedClipIds={selectedClipIds}
          inPoint={inPoint}
          outPoint={outPoint}
          onClose={() => setExportDialogOpen(false)}
          onCompleted={onExportCompleted}
          onRelinkMissing={onRelinkMissing}
        />
      ) : null}
      {timelineExportDialogOpen ? (
        <TimelineExportDialog
          project={project}
          onClose={() => setTimelineExportDialogOpen(false)}
          onImportEdl={onImportEdl}
          onImportFcpXml={onImportFcpXml}
        />
      ) : null}
      {professionalNleExportOpen ? (
        <ProfessionalNleExportDialog project={project} onClose={() => setProfessionalNleExportOpen(false)} />
      ) : null}
      {batchTranscodeOpen ? (
        <BatchTranscodeDialog
          initialPaths={batchTranscodeInitialPaths}
          existingMedia={project.media}
          onImport={onAddMedia}
          onClose={() => {
            setBatchTranscodeOpen(false);
            setBatchTranscodeInitialPaths([]);
          }}
        />
      ) : null}
      {batchWatermarkOpen ? (
        <BatchWatermarkDialog project={project} onClose={() => setBatchWatermarkOpen(false)} />
      ) : null}
      {batchProjectProcessingOpen ? (
        <BatchProjectProcessingDialog onClose={() => setBatchProjectProcessingOpen(false)} />
      ) : null}
      {gifExportAsset ? <GifExportDialog asset={gifExportAsset} onClose={() => setGifExportAsset(undefined)} /> : null}
    </Suspense>
  );
}
