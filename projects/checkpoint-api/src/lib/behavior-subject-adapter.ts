import { BehaviorSubject } from 'rxjs';
import { CheckpointAdapter } from './types';

/**
 * Creates a checkpoint adapter that captures/restores a BehaviorSubject's value.
 * Adapter ids should be namespaced (e.g. `workflow:application`).
 */
export function createBehaviorSubjectCheckpointAdapter<T>(
  id: string,
  subject: BehaviorSubject<T>
): CheckpointAdapter<T> {
  return {
    id,
    capture(): T {
      return structuredClone(subject.getValue()) as T;
    },
    restore(state: T): void {
      subject.next(structuredClone(state) as T);
    },
  };
}
