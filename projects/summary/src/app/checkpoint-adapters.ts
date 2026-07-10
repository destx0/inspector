import {
  createBehaviorSubjectCheckpointAdapter,
  InspectorCheckpointRegistry,
} from 'inspector-ng';
import {
  WORKFLOW_APPLICATION_CHECKPOINT_ID,
  workflowApplicationSubject,
} from '@inspector-ng/checkpoints';

/**
 * Called by the shell with the host's InspectorCheckpointRegistry instance.
 * Remotes must not create their own provider or registry.
 */
export function registerInspectorCheckpointAdapters(
  registry: InspectorCheckpointRegistry
): void {
  registry.register(
    createBehaviorSubjectCheckpointAdapter(
      WORKFLOW_APPLICATION_CHECKPOINT_ID,
      workflowApplicationSubject
    )
  );
}
