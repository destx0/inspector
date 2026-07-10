import {
  EnvironmentProviders,
  makeEnvironmentProviders,
} from '@angular/core';
import {
  DEFAULT_CHECKPOINT_STORAGE_KEY,
  INSPECTOR_CHECKPOINT_STORAGE_KEY,
  InspectorCheckpointService,
} from './checkpoint.service';
import { InspectorCheckpointRegistry } from './registry';
import { ProvideInspectorCheckpointsConfig } from './types';

/**
 * Shell-only provider. Remotes must not call this.
 * Supplies a single InspectorCheckpointRegistry + persistence service.
 */
export function provideInspectorCheckpoints(
  config?: ProvideInspectorCheckpointsConfig
): EnvironmentProviders {
  return makeEnvironmentProviders([
    InspectorCheckpointRegistry,
    InspectorCheckpointService,
    {
      provide: INSPECTOR_CHECKPOINT_STORAGE_KEY,
      useValue: config?.storageKey ?? DEFAULT_CHECKPOINT_STORAGE_KEY,
    },
  ]);
}
