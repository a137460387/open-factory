module.exports = {
  manifest: {
    id: 'open-factory.market.export-note',
    name: 'Export Note',
    version: '1.0.0',
    description: 'Adds a local export note before rendering.',
    permissions: ['export-hook']
  },
  hooks: {
    onExportBefore(payload) {
      return { outputPath: payload.outputPath };
    }
  }
};
