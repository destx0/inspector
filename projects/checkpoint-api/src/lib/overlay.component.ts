import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { InspectorCheckpointService } from './checkpoint.service';
import { CheckpointSnapshot } from './types';

/**
 * Demo stand-in for the future inspector-overlay checkpoint toolbar.
 * Provides save / list / restore UI. When `persistOnReload` is true,
 * snapshots are stored in localStorage (handled by InspectorCheckpointService).
 */
@Component({
  selector: 'inspector-overlay',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="inspector-checkpoint-toolbar" data-testid="checkpoint-toolbar">
      <strong class="title">Inspector checkpoints</strong>

      <label class="field">
        <span>Name</span>
        <input
          type="text"
          [(ngModel)]="checkpointName"
          placeholder="Optional label"
          data-testid="checkpoint-name"
        />
      </label>

      <button type="button" data-testid="checkpoint-save" (click)="onSave()">
        Save
      </button>

      <button
        type="button"
        data-testid="checkpoint-toggle-list"
        (click)="listOpen.set(!listOpen())"
      >
        {{ listOpen() ? 'Hide list' : 'List' }}
      </button>

      @if (listOpen()) {
        <div class="list" data-testid="checkpoint-list">
          @if (snapshots().length === 0) {
            <p class="empty">No checkpoints saved yet.</p>
          } @else {
            <ul>
              @for (item of snapshots(); track item.id) {
                <li>
                  <div class="meta">
                    <span class="name">{{ item.name }}</span>
                    <span class="url">{{ item.url }}</span>
                    <span class="time">{{ item.createdAt }}</span>
                  </div>
                  <div class="actions">
                    <button
                      type="button"
                      [attr.data-testid]="'checkpoint-restore-' + item.id"
                      (click)="onRestore(item)"
                    >
                      Restore
                    </button>
                    <button type="button" (click)="onDelete(item.id)">
                      Delete
                    </button>
                  </div>
                </li>
              }
            </ul>
          }
        </div>
      }

      @if (status()) {
        <p class="status" data-testid="checkpoint-status">{{ status() }}</p>
      }
    </div>
  `,
  styles: [
    `
      .inspector-checkpoint-toolbar {
        position: fixed;
        right: 12px;
        bottom: 12px;
        z-index: 10000;
        width: min(360px, calc(100vw - 24px));
        padding: 12px;
        border: 1px solid #ccc;
        border-radius: 8px;
        background: #fff;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
        font: 13px/1.4 system-ui, sans-serif;
        color: #222;
        display: grid;
        gap: 8px;
      }
      .title {
        font-size: 13px;
      }
      .field {
        display: grid;
        gap: 4px;
      }
      .field input {
        padding: 6px 8px;
        border: 1px solid #bbb;
        border-radius: 4px;
      }
      button {
        padding: 6px 10px;
        border: 1px solid #888;
        border-radius: 4px;
        background: #f5f5f5;
        cursor: pointer;
      }
      button:hover {
        background: #eee;
      }
      .list {
        max-height: 220px;
        overflow: auto;
        border-top: 1px solid #ddd;
        padding-top: 8px;
      }
      .list ul {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 8px;
      }
      .list li {
        display: grid;
        gap: 6px;
        padding: 8px;
        border: 1px solid #e5e5e5;
        border-radius: 4px;
      }
      .meta {
        display: grid;
        gap: 2px;
      }
      .name {
        font-weight: 600;
      }
      .url,
      .time {
        color: #666;
        font-size: 12px;
      }
      .actions {
        display: flex;
        gap: 6px;
      }
      .empty,
      .status {
        margin: 0;
        color: #555;
      }
    `,
  ],
})
export class InspectorOverlayComponent implements OnInit {
  /**
   * When true, checkpoints are persisted to localStorage (default service behavior).
   * Kept for API compatibility with the assumed future inspector-overlay contract.
   */
  @Input() persistOnReload = false;

  /** Emitted when the user requests a save; shell supplies current URL. */
  @Output() readonly saveRequested = new EventEmitter<string>();

  /** Emitted when the user requests restore of a snapshot. */
  @Output() readonly restoreRequested = new EventEmitter<CheckpointSnapshot>();

  private readonly checkpointService = inject(InspectorCheckpointService);

  checkpointName = '';
  readonly listOpen = signal(false);
  readonly snapshots = signal<CheckpointSnapshot[]>([]);
  readonly status = signal<string | null>(null);

  ngOnInit(): void {
    this.refreshList();
  }

  refreshList(): void {
    this.snapshots.set(this.checkpointService.list());
  }

  onSave(): void {
    this.saveRequested.emit(this.checkpointName);
    this.checkpointName = '';
    this.refreshList();
    this.status.set('Checkpoint save requested.');
  }

  onRestore(snapshot: CheckpointSnapshot): void {
    this.restoreRequested.emit(snapshot);
    this.status.set(`Restoring “${snapshot.name}”…`);
  }

  onDelete(id: string): void {
    this.checkpointService.delete(id);
    this.refreshList();
  }

  /** Called by the shell after a successful save so the list updates. */
  notifySaved(name: string): void {
    this.refreshList();
    this.status.set(`Saved “${name}”.`);
  }

  notifyRestored(name: string): void {
    this.refreshList();
    this.status.set(`Restored “${name}”.`);
  }

  notifyError(message: string): void {
    this.status.set(message);
  }
}
