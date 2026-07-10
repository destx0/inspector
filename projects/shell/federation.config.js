const {
  withNativeFederation,
  shareAll,
} = require('@angular-architects/native-federation/config');

module.exports = withNativeFederation({
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

  // Share path-mapped demo checkpoint API + inspector-ng so remotes get one instance.
  sharedMappings: ['inspector-ng', '@inspector-ng/checkpoints'],

  skip: [
    'rxjs/ajax',
    'rxjs/fetch',
    'rxjs/testing',
    'rxjs/webSocket',
  ],
});
