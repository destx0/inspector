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

  sharedMappings: ['inspector-ng', '@inspector-ng/federation-demo-state'],

  skip: [
    'rxjs/ajax',
    'rxjs/fetch',
    'rxjs/testing',
    'rxjs/webSocket',
  ],
});
