
export const updater = {
  updater: {
    toastTitle: (version: string) => `v${version} is available, click to update`,
    toastMessage: 'The background version check completed.',
    viewReleaseNotes: 'View Update',
    dialogTitle: (version: string) => `Version v${version} is available`,
    releaseNotes: 'Release Notes',
    noReleaseNotes: 'No release notes are available.',
    installAndRestart: 'Install and Restart',
    installing: 'Installing update...',
    installFailed: 'Update install failed',
    installFailedMessage: 'Try again later or download from the release page.',
    sourceEndpoint: 'Update endpoint',
    sourceNative: 'Built-in updater',
  },
  timelineExport: {
    title: 'Export Timeline',
    description: 'Export the main sequence as an interchange format.',
    format: 'Format',
    export: 'Export',
    exporting: 'Exporting...',
    importEdl: 'Import EDL',
    importFcpXml: 'Import FCPXML',
    importing: 'Importing...',
    success: 'Timeline exported',
    failed: 'Timeline export failed',
    failedMessage: 'Unable to export the timeline.',
    importSuccess: 'EDL imported',
    importFcpXmlSuccess: 'FCPXML imported',
    importFailed: 'EDL import failed',
    importFcpXmlFailed: 'FCPXML import failed',
    importFailedMessage: 'Unable to import EDL.',
    importFcpXmlFailedMessage: 'Unable to import FCPXML file.',
    importSummary: (matched: number, missing: number) => `${matched} clips matched, ${missing} clips missing.`,
    filterName: (format: string) => (format === 'fcp-xml' ? 'Final Cut Pro XML' : 'CMX3600 EDL'),
    formats: {
      edl: 'CMX3600 EDL',
      fcpXml: 'Final Cut Pro 7 XML',
    },
  },
  professionalNleExport: {
    title: 'Export to Professional NLE',
    description: 'Export AAF, OMF, or extended FCP XML for Avid, Premiere, and legacy interchange workflows.',
    format: 'Format',
    mediaMode: 'Media Handling',
    mediaModes: {
      link: 'Link original media only',
      copy: 'Copy media to export folder',
    },
    export: 'Export',
    exporting: 'Exporting...',
    success: 'Professional NLE file exported',
    failed: 'Professional NLE export failed',
    failedMessage: 'Unable to export the professional interchange file.',
    filterName: (format: string) => {
      if (format === 'aaf') return 'Advanced Authoring Format';
      if (format === 'omf') return 'Open Media Framework';
      return 'Final Cut Pro XML';
    },
    formats: {
      aaf: 'AAF',
      omf: 'OMF 2.0',
      fcpXml: 'Final Cut Pro XML',
    },
  },
};
