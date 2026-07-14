import { lazy, Suspense } from 'react';
import type { Project, MediaAsset } from '@open-factory/editor-core';
import type { ExportPreset } from '../../export/export-presets';
import { useEditorUIStore } from '../../store/editorUIStore';
import { useEditorFeatureStore } from '../../store/editorFeatureStore';
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
  const professionalNleExportOpen = useEditorUIStore((s) => s.professionalNleExportOpen);
  const setProfessionalNleExportOpen = useEditorUIStore((s) => s.setProfessionalNleExportOpen);
  const batchTranscodeOpen = useEditorUIStore((s) => s.batchTranscodeOpen);
  const setBatchTranscodeOpen = useEditorUIStore((s) => s.setBatchTranscodeOpen);
  const batchWatermarkOpen = useEditorUIStore((s) => s.batchWatermarkOpen);
  const setBatchWatermarkOpen = useEditorUIStore((s) => s.setBatchWatermarkOpen);
  const batchProjectProcessingOpen = useEditorUIStore((s) => s.batchProjectProcessingOpen);
  const setBatchProjectProcessingOpen = useEditorUIStore((s) => s.setBatchProjectProcessingOpen);
  const batchTranscodeInitialPaths = useEditorFeatureStore((s) => s.batchTranscodeInitialPaths);
  const setBatchTranscodeInitialPaths = useEditorFeatureStore((s) => s.setBatchTranscodeInitialPaths);
  const gifExportAsset = useEditorFeatureStore((s) => s.gifExportAsset);
  const setGifExportAsset = useEditorFeatureStore((s) => s.setGifExportAsset);

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
