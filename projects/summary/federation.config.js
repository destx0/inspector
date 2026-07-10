const {
  withNativeFederation,
  shareAll,
} = require('@angular-architects/native-federation/config');

module.exports = withNativeFederation({
  name: 'summary',

  exposes: {
    './Routes': './projects/summary/src/app/routes.ts',
    './CheckpointAdapters':
      './projects/summary/src/app/checkpoint-adapters.ts',
    './Component': './projects/summary/src/app/app.component.ts',
  },

  shared: {
    ...shareAll({
      singleton: true,
      strictVersion: true,
      requiredVersion: 'auto',
    }),
    'inspector-ng': {
      singleton: true,
      strictVersion: true,
      requiredVersion: 'auto',
    },
  },

  sharedMappings: ['inspector-ng', '@inspector-ng/checkpoints'],

  skip: [
    'rxjs/ajax',
    'rxjs/fetch',
    'rxjs/testing',
    'rxjs/webSocket',
  ],
});
