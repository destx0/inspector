import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Action, provideStore } from '@ngrx/store';

import {
  INSPECTOR_CHECKPOINT_REPOSITORY,
  InspectorCheckpointRecord,
  InspectorCheckpointRepository,
  InspectorCheckpointService,
  provideInspectorCheckpoints,
} from './checkpoints';
import { inspectorComponent } from './inspector.component';

class MemoryRepository extends InspectorCheckpointRepository {
  records: InspectorCheckpointRecord[] = [];
  async list() { return structuredClone(this.records); }
  async put(checkpoint: InspectorCheckpointRecord) {
    this.records = [checkpoint, ...this.records.filter(({ id }) => id !== checkpoint.id)];
  }
  async delete(id: string) {
    this.records = this.records.filter((checkpoint) => checkpoint.id !== id);
  }
}

function reducer(state = { value: 1 }, _action: Action) {
  return state;
}

function keydown(key: string, options: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...options });
  window.dispatchEvent(event);
  return event;
}

describe('inspectorComponent without checkpoints', () => {
  it('does not render checkpoint controls or steal Ctrl+Shift+P', async () => {
    await TestBed.configureTestingModule({ imports: [inspectorComponent] }).compileComponents();
    const fixture = TestBed.createComponent(inspectorComponent);
    fixture.detectChanges();

    const event = keydown('p', { ctrlKey: true, shiftKey: true });
    fixture.detectChanges();
    expect(event.defaultPrevented).toBeFalse();
    expect(fixture.nativeElement.querySelector('[aria-label="Save checkpoint"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('dialog')).toBeNull();
  });
});

describe('inspectorComponent checkpoint command bar', () => {
  let fixture: ComponentFixture<inspectorComponent>;
  let component: inspectorComponent;
  let repository: MemoryRepository;
  let service: InspectorCheckpointService;

  const records: InspectorCheckpointRecord[] = [
    { version: 1, id: 'new', name: 'Summary ready', route: '/summary', createdAt: '2026-01-02T00:00:00.000Z', state: { test: { value: 2 } } },
    { version: 1, id: 'old', name: 'Workflow start', route: '/workflow', createdAt: '2026-01-01T00:00:00.000Z', state: { test: { value: 1 } } },
  ];

  beforeEach(async () => {
    repository = new MemoryRepository();
    repository.records = structuredClone(records);
    await TestBed.configureTestingModule({
      imports: [inspectorComponent],
      providers: [
        provideStore({ test: reducer }),
        provideInspectorCheckpoints(),
        { provide: INSPECTOR_CHECKPOINT_REPOSITORY, useValue: repository },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(inspectorComponent);
    component = fixture.componentInstance;
    service = TestBed.inject(InspectorCheckpointService);
    fixture.detectChanges();
  });

  async function openCommandBar(metaKey = false) {
    const event = keydown('p', { ctrlKey: !metaKey, metaKey, shiftKey: true });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return event;
  }

  it('opens with Ctrl/Cmd+Shift+P, focuses search, and loads results', async () => {
    expect((await openCommandBar()).defaultPrevented).toBeTrue();
    expect(component.commandBarOpen()).toBeTrue();
    expect(document.activeElement?.id).toBe('inspector-checkpoint-search');
    expect(fixture.nativeElement.querySelectorAll('.inspector-command-row').length).toBe(2);
    expect(fixture.nativeElement.querySelector('.inspector-command__footer')).toBeNull();
    expect(fixture.nativeElement.querySelector('.inspector-command-row__activity')?.textContent).toContain('Saved');

    component.closeCheckpointCommandBar();
    fixture.detectChanges();
    expect((await openCommandBar(true)).defaultPrevented).toBeTrue();
  });

  it('opens while an application input is focused and while the rail is disabled', async () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    component.disableInspector();
    await openCommandBar();

    expect(component.enabled()).toBeFalse();
    expect(component.commandBarOpen()).toBeTrue();
    input.remove();
  });

  it('filters names and clamps arrow navigation', async () => {
    await openCommandBar();
    const input = fixture.nativeElement.querySelector('#inspector-checkpoint-search') as HTMLInputElement;
    input.value = 'work';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();

    expect(component.filteredCheckpoints().map(({ id }) => id)).toEqual(['old']);
    keydown('ArrowDown');
    keydown('ArrowDown');
    expect(component.activeCheckpointIndex()).toBe(0);
  });

  it('restores the active checkpoint with Enter and announces success', async () => {
    await openCommandBar();
    const restore = spyOn(service, 'restore').and.resolveTo(true);
    keydown('Enter');
    await Promise.resolve();
    fixture.detectChanges();

    expect(restore).toHaveBeenCalledWith('new');
    expect(component.commandBarOpen()).toBeFalse();
    expect(fixture.nativeElement.textContent).toContain('Restored “Summary ready”.');
  });

  it('supports F2 rename and inline Delete confirmation', async () => {
    await openCommandBar();
    keydown('F2');
    fixture.detectChanges();
    expect(component.editingCheckpointId()).toBe('new');

    keydown('Escape');
    keydown('Delete');
    fixture.detectChanges();
    expect(component.deletingCheckpointId()).toBe('new');
    expect(fixture.nativeElement.textContent).toContain('Delete “Summary ready”?');
  });

  it('saves immediately from the toolbar and shows a status toast', async () => {
    const saved = { ...records[0], id: 'saved', name: '/summary' };
    const save = spyOn(service, 'save').and.resolveTo(saved);
    (fixture.nativeElement.querySelector('[aria-label="Save checkpoint"]') as HTMLButtonElement).click();
    await Promise.resolve();
    fixture.detectChanges();

    expect(save).toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Saved “/summary”.');
  });

  it('announces save failures as alerts', async () => {
    const save = spyOn(service, 'save').and.callFake(async () => {
      service.error.set('Browser storage is full. Delete old checkpoints, then try saving again.');
      return null;
    });
    (fixture.nativeElement.querySelector('[aria-label="Save checkpoint"]') as HTMLButtonElement).click();
    await Promise.resolve();
    fixture.detectChanges();

    expect(save).toHaveBeenCalled();
    const alert = fixture.nativeElement.querySelector('.inspector-checkpoint-toast[role="alert"]');
    expect(alert?.textContent).toContain('Browser storage is full');
  });
});
