/**
 * Demo stand-in for the future inspector-ng checkpoint API.
 *
 * Production apps will import these symbols from `inspector-ng` once the
 * feature lands. This package exists only so the Native Federation demo is
 * runnable without modifying `projects/inspector-ng`.
 */

export {
  createBehaviorSubjectCheckpointAdapter,
} from './lib/behavior-subject-adapter';
export {
  DEFAULT_CHECKPOINT_STORAGE_KEY,
  INSPECTOR_CHECKPOINT_STORAGE_KEY,
  InspectorCheckpointService,
  scopesFromAdapterIds,
  scopesFromUrl,
  type CheckpointRestoreHooks,
} from './lib/checkpoint.service';
export { InspectorOverlayComponent } from './lib/overlay.component';
export { provideInspectorCheckpoints } from './lib/provide-inspector-checkpoints';
export { InspectorCheckpointRegistry } from './lib/registry';
export type {
  CheckpointAdapter,
  CheckpointSnapshot,
  ProvideInspectorCheckpointsConfig,
  RegisterAdapterOptions,
} from './lib/types';
export {
  EMPTY_WORKFLOW_APPLICATION,
  WORKFLOW_APPLICATION_CHECKPOINT_ID,
  isWorkflowApplicationEmpty,
  workflowApplicationSubject,
  type WorkflowApplicationState,
} from './lib/workflow-application.state';
