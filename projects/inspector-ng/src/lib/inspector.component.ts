import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  Inject,
  Input,
  OnDestroy,
  PLATFORM_ID,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  GUIDE_HITBOX_SIZE,
  GUIDE_SNAP_DISTANCE,
  inspector_STATE_VERSION,
  inspector_STORAGE_KEY,
} from './constants';
import {
  getInspectMeasurement,
  getRectFromDom,
  getTargetElement,
  getVisibleTextBlocks,
} from './dom';
import { getDistanceOverlay } from './distances';
import { clamp, getViewportSize, rectsEqual } from './geometry';
import {
  DistanceOverlay,
  Guide,
  GuideOrientation,
  InspectMeasurement,
  inspectorLegacyPersistedState,
  inspectorPersistedState,
  Rect,
  TextBlockAnnotation,
  ToolMode,
} from './types';
import {
  checkpointActivityAt,
  InspectorCheckpointRecord,
  InspectorCheckpointService,
} from './checkpoints';
import { fuzzyCheckpoints } from './checkpoint-search';
import { createId, formatRelativeTime, formatValue } from './utils';

type InspectorCommandActionId = 'select' | 'type' | 'save' | 'vertical' | 'horizontal' | 'off';

interface InspectorCommandAction {
  readonly id: InspectorCommandActionId;
  readonly label: string;
  readonly ariaLabel: string;
  readonly keywords: string;
}

const INSPECTOR_COMMAND_ACTIONS: readonly InspectorCommandAction[] = [
  { id: 'save', label: 'Save', ariaLabel: 'Save checkpoint', keywords: 'save checkpoint capture state' },
  { id: 'select', label: 'Select', ariaLabel: 'Select mode', keywords: 'select inspect pointer element' },
  { id: 'type', label: 'Type', ariaLabel: 'Toggle typography overlay', keywords: 'type typography text overlay' },
  { id: 'vertical', label: 'V', ariaLabel: 'Vertical guides', keywords: 'vertical v guide guides' },
  { id: 'horizontal', label: 'H', ariaLabel: 'Horizontal guides', keywords: 'horizontal h guide guides' },
  { id: 'off', label: 'Off', ariaLabel: 'Disable inspector', keywords: 'off disable inspector power' },
];

@Component({
  selector: 'inspector-overlay',
  standalone: true,
  imports: [],
  templateUrl: './inspector.component.html',
  styleUrl: './inspector.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class inspectorComponent implements OnDestroy {
  readonly Math = Math;
  readonly checkpointActivityAt = checkpointActivityAt;
  readonly formatValue = formatValue;
  readonly formatRelativeTime = formatRelativeTime;
  readonly guideHitboxSize = GUIDE_HITBOX_SIZE;
  readonly overlayRoot = viewChild<ElementRef<HTMLElement>>('overlayRoot');
  readonly checkpointDialog = viewChild<ElementRef<HTMLDialogElement>>('checkpointDialog');
  readonly checkpointSearch = viewChild<ElementRef<HTMLInputElement>>('checkpointSearch');

  @Input() highlightColor = '#4f8cff';
  @Input() guideColor = '#ff7a00';
  @Input() hoverHighlightEnabled = true;
  @Input() persistOnReload = false;

  readonly checkpointService = inject(InspectorCheckpointService, { optional: true });
  readonly commandBarOpen = signal(false);
  readonly checkpointQuery = signal('');
  readonly activeCommandIndex = signal(0);
  readonly editingCheckpointId = signal<string | null>(null);
  readonly deletingCheckpointId = signal<string | null>(null);
  readonly renameDraft = signal('');
  readonly checkpointToast = signal<string | null>(null);
  readonly checkpointToastIsError = signal(false);
  readonly filteredCheckpoints = computed(() =>
    fuzzyCheckpoints(
      this.checkpointService?.checkpoints() ?? [],
      this.checkpointQuery(),
    ),
  );
  readonly filteredInspectorActions = computed(() => {
    const terms = this.checkpointQuery().trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return INSPECTOR_COMMAND_ACTIONS;
    return INSPECTOR_COMMAND_ACTIONS.filter((action) => {
      const searchableText = `${action.label} ${action.ariaLabel} ${action.keywords}`.toLocaleLowerCase();
      return terms.every((term) => searchableText.includes(term));
    });
  });
  readonly commandResultCount = computed(
    () => this.filteredCheckpoints().length + this.filteredInspectorActions().length,
  );
  readonly activeCommandResultId = computed(() => {
    const checkpoint = this.filteredCheckpoints()[this.activeCommandIndex()];
    if (checkpoint) return `inspector-checkpoint-${checkpoint.id}`;
    const actionIndex = this.activeCommandIndex() - this.filteredCheckpoints().length;
    const action = this.filteredInspectorActions()[actionIndex];
    return action ? `inspector-action-${action.id}` : null;
  });

  readonly enabled = signal(true);
  readonly toolMode = signal<ToolMode>('none');
  readonly guideOrientation = signal<GuideOrientation>('vertical');
  readonly guides = signal<Guide[]>([]);
  readonly hoverRect = signal<Rect | null>(null);
  readonly selectedGuideId = signal<string | null>(null);
  readonly selectedMeasurement = signal<InspectMeasurement | null>(null);
  readonly showTypography = signal(false);
  readonly altPressed = signal(false);
  readonly distanceOverlay = signal<DistanceOverlay | null>(null);
  readonly textBlocks = signal<TextBlockAnnotation[]>([]);
  readonly guidePreview = signal<Guide | null>(null);

  readonly selectedMetaLine = computed(() => {
    const selected = this.selectedMeasurement();
    if (!selected) {
      return '';
    }
    return `${selected.label} · ${formatValue(selected.rect.width)} x ${formatValue(selected.rect.height)} · ${selected.styles.fontSize} / ${selected.styles.lineHeight} / ${selected.styles.color}`;
  });

  private readonly isBrowser: boolean;
  private readonly hydrated = signal(false);
  private readonly history = signal<Guide[][]>([]);
  private readonly historyIndex = signal(-1);
  private readonly handleCapturedClick = (event: MouseEvent) => {
    if (
      !event.shiftKey ||
      !this.canInspectClick(event) ||
      !this.selectElementAtPoint(event)
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  };
  private draggingGuideId: string | null = null;
  private selectedElement: HTMLElement | null = null;
  private hoverElement: HTMLElement | null = null;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  readonly canUndo = computed(() => this.historyIndex() > 0);
  readonly canRedo = computed(
    () =>
      this.historyIndex() >= 0 &&
      this.historyIndex() < this.history().length - 1,
  );

  constructor(@Inject(PLATFORM_ID) platformId: object) {
    this.isBrowser = isPlatformBrowser(platformId);

    effect(() => {
      if (!this.persistOnReload || !this.isBrowser || !this.hydrated()) {
        return;
      }

      const payload: inspectorPersistedState = {
        version: inspector_STATE_VERSION,
        enabled: this.enabled(),
        toolMode: this.toolMode(),
        guideOrientation: this.guideOrientation(),
        guides: this.guides(),
        showTypography: this.showTypography(),
      };

      window.localStorage.setItem(
        inspector_STORAGE_KEY,
        JSON.stringify(payload),
      );
    });
  }

  ngOnInit() {
    if (!this.isBrowser) {
      this.hydrated.set(true);
      return;
    }

    window.addEventListener('click', this.handleCapturedClick, {
      capture: true,
    });

    if (!this.persistOnReload) {
      this.hydrated.set(true);
      return;
    }

    const stored = window.localStorage.getItem(inspector_STORAGE_KEY);
    if (!stored) {
      this.hydrated.set(true);
      return;
    }

    try {
      const parsed = JSON.parse(stored) as
        | inspectorPersistedState
        | inspectorLegacyPersistedState;
      if (parsed.version === inspector_STATE_VERSION || parsed.version === 1) {
        this.enabled.set(true);
        this.toolMode.set(parsed.toolMode);
        this.guideOrientation.set(parsed.guideOrientation);
        this.guides.set(parsed.guides ?? []);
        this.showTypography.set(
          parsed.version === 1 ? false : (parsed.showTypography ?? false),
        );
        this.recordHistory(parsed.guides ?? []);
      }
    } catch {
      // ignore malformed state
    }

    this.hydrated.set(true);
    this.refreshTypographyBlocks();
  }

  ngOnDestroy() {
    if (!this.isBrowser) {
      return;
    }

    window.removeEventListener('click', this.handleCapturedClick, {
      capture: true,
    });
    if (this.toastTimer) clearTimeout(this.toastTimer);
  }

  setToolMode(mode: ToolMode) {
    if (!this.enabled()) {
      this.enabled.set(true);
    }

    this.toolMode.set(this.toolMode() === mode ? 'none' : mode);
    this.hoverRect.set(null);
    this.guidePreview.set(null);
    this.distanceOverlay.set(null);
    this.refreshTypographyBlocks();
  }

  setGuideOrientation(orientation: GuideOrientation) {
    this.guideOrientation.set(orientation);
    this.guidePreview.set(null);
  }

  activateGuideOrientation(orientation: GuideOrientation) {
    const isActive = this.toolMode() === 'guides' && this.guideOrientation() === orientation;
    this.setGuideOrientation(orientation);
    if (isActive || this.toolMode() !== 'guides') {
      this.setToolMode('guides');
    }
  }

  toggleTypography() {
    this.showTypography.update((value) => !value);
    this.refreshTypographyBlocks();
  }

  disableInspector() {
    this.setInspectorEnabled(false);
  }

  async saveCheckpoint() {
    const checkpoint = await this.checkpointService?.save();
    if (checkpoint) {
      this.showCheckpointToast(`Saved “${checkpoint.name}”.`);
    } else if (this.checkpointService?.error()) {
      this.showCheckpointToast(this.checkpointService.error()!, true);
    }
  }

  async openCheckpointCommandBar() {
    if (!this.checkpointService || !this.isBrowser || this.commandBarOpen()) return;
    this.commandBarOpen.set(true);
    this.checkpointQuery.set('');
    this.activeCommandIndex.set(0);
    this.editingCheckpointId.set(null);
    this.deletingCheckpointId.set(null);
    this.checkpointService.clearError();
    this.checkpointDialog()?.nativeElement.showModal();
    queueMicrotask(() => this.checkpointSearch()?.nativeElement.focus());
    await this.checkpointService.load();
    this.clampActiveCommand();
  }

  closeCheckpointCommandBar() {
    if (this.checkpointService?.busy()) return;
    this.checkpointDialog()?.nativeElement.close();
    this.commandBarOpen.set(false);
    this.editingCheckpointId.set(null);
    this.deletingCheckpointId.set(null);
  }

  updateCheckpointQuery(event: Event) {
    this.checkpointQuery.set((event.target as HTMLInputElement).value);
    this.activeCommandIndex.set(0);
    this.editingCheckpointId.set(null);
    this.deletingCheckpointId.set(null);
    this.checkpointService?.clearError();
  }

  setActiveCheckpoint(index: number) {
    this.activeCommandIndex.set(index);
  }

  shouldShowCheckpointRoute(checkpoint: InspectorCheckpointRecord) {
    if (!checkpoint.route.trim()) return false;
    return this.normalizeCheckpointLabel(checkpoint.name) !== this.normalizeCheckpointLabel(checkpoint.route);
  }

  setActiveInspectorAction(index: number) {
    this.activeCommandIndex.set(this.filteredCheckpoints().length + index);
  }

  async executeInspectorAction(action: InspectorCommandAction) {
    if (this.checkpointService?.busy()) return;
    switch (action.id) {
      case 'select':
        this.setToolMode('select');
        this.closeCheckpointCommandBar();
        break;
      case 'type':
        this.toggleTypography();
        this.closeCheckpointCommandBar();
        break;
      case 'save':
        await this.saveCheckpoint();
        if (this.commandBarOpen()) {
          const index = this.filteredInspectorActions().findIndex(({ id }) => id === action.id);
          if (index >= 0) this.setActiveInspectorAction(index);
        }
        break;
      case 'vertical':
        this.activateGuideOrientation('vertical');
        this.closeCheckpointCommandBar();
        break;
      case 'horizontal':
        this.activateGuideOrientation('horizontal');
        this.closeCheckpointCommandBar();
        break;
      case 'off':
        this.closeCheckpointCommandBar();
        this.disableInspector();
        break;
    }
  }

  async restoreCheckpoint(checkpoint: InspectorCheckpointRecord) {
    if (!this.checkpointService || this.checkpointService.busy()) return;
    const restored = await this.checkpointService.restore(checkpoint.id);
    if (!restored) return;
    this.checkpointDialog()?.nativeElement.close();
    this.commandBarOpen.set(false);
    this.showCheckpointToast(`Restored “${checkpoint.name}”.`);
  }

  beginRename(checkpoint: InspectorCheckpointRecord, event?: Event) {
    event?.stopPropagation();
    if (this.checkpointService?.busy()) return;
    this.editingCheckpointId.set(checkpoint.id);
    this.deletingCheckpointId.set(null);
    this.renameDraft.set(checkpoint.name);
    queueMicrotask(() => {
      const input = this.checkpointDialog()?.nativeElement.querySelector<HTMLInputElement>(
        '.inspector-command-row__rename',
      );
      input?.focus();
      input?.select();
    });
  }

  updateRenameDraft(event: Event) {
    this.renameDraft.set((event.target as HTMLInputElement).value);
    this.checkpointService?.clearError();
  }

  async finishRename(checkpoint: InspectorCheckpointRecord) {
    if (await this.checkpointService?.rename(checkpoint.id, this.renameDraft())) {
      this.editingCheckpointId.set(null);
      this.checkpointSearch()?.nativeElement.focus();
    }
  }

  cancelRename() {
    this.editingCheckpointId.set(null);
    this.checkpointService?.clearError();
    this.checkpointSearch()?.nativeElement.focus();
  }

  beginDelete(checkpoint: InspectorCheckpointRecord, event?: Event) {
    event?.stopPropagation();
    if (this.checkpointService?.busy()) return;
    this.deletingCheckpointId.set(checkpoint.id);
    this.editingCheckpointId.set(null);
  }

  cancelDelete(event?: Event) {
    event?.stopPropagation();
    this.deletingCheckpointId.set(null);
    this.checkpointSearch()?.nativeElement.focus();
  }

  async confirmDelete(checkpoint: InspectorCheckpointRecord, event?: Event) {
    event?.stopPropagation();
    if (!await this.checkpointService?.delete(checkpoint.id)) return;
    this.deletingCheckpointId.set(null);
    this.clampActiveCommand();
    this.checkpointSearch()?.nativeElement.focus();
  }

  handleCheckpointDialogClick(event: MouseEvent) {
    if (
      event.target === this.checkpointDialog()?.nativeElement &&
      !this.checkpointService?.busy() &&
      !this.deletingCheckpointId()
    ) {
      this.closeCheckpointCommandBar();
    }
  }

  clearGuides() {
    this.guides.set([]);
    this.selectedGuideId.set(null);
    this.recordHistory([]);
  }

  trackGuide = (_index: number, guide: Guide) => guide.id;
  trackTextBlock = (_index: number, block: TextBlockAnnotation) => block.id;
  trackConnector = (
    _index: number,
    connector: DistanceOverlay['connectors'][number],
  ) => `${connector.x1}:${connector.y1}:${connector.x2}:${connector.y2}`;

  startGuideDrag(event: PointerEvent, guide: Guide) {
    event.preventDefault();
    event.stopPropagation();
    this.draggingGuideId = guide.id;
    this.selectedGuideId.set(guide.id);
  }

  formatEdges(edges: InspectMeasurement['padding']) {
    return `${formatValue(edges.top)} ${formatValue(edges.right)} ${formatValue(edges.bottom)} ${formatValue(edges.left)}`;
  }

  formatGap(selected: InspectMeasurement) {
    return `${formatValue(selected.gap.row)} / ${formatValue(selected.gap.column)}`;
  }

  @HostListener('window:keydown', ['$event'])
  handleKeydown(event: KeyboardEvent) {
    const key = event.key.toLowerCase();

    if (
      this.checkpointService &&
      !event.repeat &&
      (event.metaKey || event.ctrlKey) &&
      event.shiftKey &&
      key === 'p'
    ) {
      event.preventDefault();
      this.commandBarOpen() ? this.closeCheckpointCommandBar() : void this.openCheckpointCommandBar();
      return;
    }

    if (this.commandBarOpen()) {
      this.handleCommandBarKeydown(event, key);
      return;
    }

    if (key === 'escape') {
      event.preventDefault();
      this.clearInspectorCanvas();
    }
  }

  private clearInspectorCanvas() {
    this.selectedMeasurement.set(null);
    this.selectedGuideId.set(null);
    this.hoverRect.set(null);
    this.distanceOverlay.set(null);
    this.altPressed.set(false);
    this.selectedElement = null;
    this.hoverElement = null;
    this.guidePreview.set(null);
    this.draggingGuideId = null;
    this.clearGuides();
    this.refreshTypographyBlocks();
  }

  private normalizeCheckpointLabel(value: string) {
    return value
      .trim()
      .toLocaleLowerCase()
      .replace(/^\/+|\/+$/g, '');
  }

  @HostListener('window:pointermove', ['$event'])
  handlePointerMove(event: PointerEvent) {
    if (!this.enabled() || !this.isBrowser) {
      return;
    }

    if (this.draggingGuideId) {
      this.guidePreview.set(null);
      const viewport = getViewportSize();
      this.guides.set(
        this.guides().map((guide) => {
          if (guide.id !== this.draggingGuideId) {
            return guide;
          }
          const rawPosition =
            guide.orientation === 'vertical' ? event.clientX : event.clientY;
          const max =
            guide.orientation === 'vertical' ? viewport.width : viewport.height;
          return { ...guide, position: clamp(rawPosition, 0, max) };
        }),
      );
      return;
    }

    if (this.toolMode() === 'guides') {
      this.hoverRect.set(null);
      this.hoverElement = null;
      this.distanceOverlay.set(null);

      if (
        this.overlayRoot()?.nativeElement.contains(event.target as Node) ??
        false
      ) {
        this.guidePreview.set(null);
        return;
      }

      this.guidePreview.set(this.getGuidePreview(event));
      return;
    }

    this.guidePreview.set(null);

    if (this.toolMode() !== 'select' || !this.hoverHighlightEnabled) {
      this.hoverRect.set(null);
      this.hoverElement = null;
      if (!this.altPressed()) {
        return;
      }
    }

    const target = getTargetElement(
      { x: event.clientX, y: event.clientY },
      this.overlayRoot()?.nativeElement ?? null,
    );
    if (!target) {
      this.hoverRect.set(null);
      this.hoverElement = null;
      this.distanceOverlay.set(null);
      return;
    }

    const rect = getRectFromDom(target);
    this.hoverElement = target;
    if (!rectsEqual(rect, this.hoverRect())) {
      this.hoverRect.set(rect);
    }
    this.updateDistanceOverlay();
    this.refreshTypographyBlocks();
  }

  @HostListener('window:pointerup')
  handlePointerUp() {
    if (!this.draggingGuideId) {
      return;
    }
    this.recordHistory(this.guides());
    this.draggingGuideId = null;
  }

  @HostListener('window:click', ['$event'])
  handleClick(event: MouseEvent) {
    if (!this.enabled() || !this.isBrowser) {
      return;
    }

    const overlay = this.overlayRoot()?.nativeElement ?? null;

    if (this.toolMode() === 'guides') {
      if (overlay && overlay.contains(event.target as Node)) {
        return;
      }
      const guide = this.getGuidePreview(event);
      this.addGuide({ ...guide, id: createId() });
      this.guidePreview.set(guide);
      return;
    }

    if (!this.canInspectClick(event)) {
      return;
    }

    this.selectElementAtPoint(event);
  }

  @HostListener('window:resize')
  @HostListener('window:scroll')
  handleViewportChange() {
    if (this.selectedElement && document.contains(this.selectedElement)) {
      this.selectedMeasurement.set(getInspectMeasurement(this.selectedElement));
    }
    this.updateDistanceOverlay();
    this.refreshTypographyBlocks();
  }

  private canInspectClick(event: MouseEvent) {
    if (!this.enabled() || !this.isBrowser || this.toolMode() !== 'select') {
      return false;
    }

    const overlay = this.overlayRoot()?.nativeElement ?? null;
    return !(overlay && overlay.contains(event.target as Node));
  }

  private setInspectorEnabled(enabled: boolean) {
    this.enabled.set(enabled);
    if (!enabled) {
      this.toolMode.set('none');
      this.hoverRect.set(null);
      this.selectedGuideId.set(null);
      this.selectedMeasurement.set(null);
      this.distanceOverlay.set(null);
      this.textBlocks.set([]);
      this.guidePreview.set(null);
      this.altPressed.set(false);
      this.selectedElement = null;
      this.hoverElement = null;
      this.draggingGuideId = null;
    }
    this.refreshTypographyBlocks();
  }

  private handleCommandBarKeydown(event: KeyboardEvent, key: string) {
    const checkpoints = this.filteredCheckpoints();
    const actions = this.filteredInspectorActions();
    const activeCheckpoint = checkpoints[this.activeCommandIndex()];
    const activeActionIndex = this.activeCommandIndex() - checkpoints.length;
    const activeAction = actions[activeActionIndex];
    const target = event.target as HTMLElement | null;
    const isRenameInput = target?.classList?.contains('inspector-command-row__rename') ?? false;

    if (key === 'escape') {
      event.preventDefault();
      if (this.editingCheckpointId()) this.cancelRename();
      else if (this.deletingCheckpointId()) this.cancelDelete();
      else this.closeCheckpointCommandBar();
      return;
    }
    if (this.checkpointService?.busy()) return;
    const editingCheckpoint = checkpoints.find(({ id }) => id === this.editingCheckpointId());
    if (isRenameInput && key === 'enter' && editingCheckpoint) {
      event.preventDefault();
      void this.finishRename(editingCheckpoint);
      return;
    }
    if (isRenameInput) return;
    if (key === 'arrowdown') {
      event.preventDefault();
      if (activeCheckpoint) {
        const nextIndex = this.activeCommandIndex() < checkpoints.length - 1
          ? this.activeCommandIndex() + 1
          : actions.length ? checkpoints.length : this.activeCommandIndex();
        this.activeCommandIndex.set(nextIndex);
      }
      this.scrollActiveCommandIntoView();
      return;
    }
    if (key === 'arrowup') {
      event.preventDefault();
      if (activeAction && checkpoints.length) {
        this.activeCommandIndex.set(checkpoints.length - 1);
      } else if (activeCheckpoint) {
        this.activeCommandIndex.set(Math.max(0, this.activeCommandIndex() - 1));
      }
      this.scrollActiveCommandIntoView();
      return;
    }
    if (key === 'arrowright' && (activeCheckpoint || activeAction) && actions.length) {
      event.preventDefault();
      const nextActionIndex = activeAction
        ? Math.min(activeActionIndex + 1, actions.length - 1)
        : 0;
      this.activeCommandIndex.set(checkpoints.length + nextActionIndex);
      this.scrollActiveCommandIntoView();
      return;
    }
    if (key === 'arrowleft' && activeAction) {
      event.preventDefault();
      this.activeCommandIndex.set(checkpoints.length + Math.max(0, activeActionIndex - 1));
      this.scrollActiveCommandIntoView();
      return;
    }
    if (key === 'enter' && activeCheckpoint && !this.deletingCheckpointId()) {
      event.preventDefault();
      void this.restoreCheckpoint(activeCheckpoint);
      return;
    }
    if (key === 'enter' && activeAction) {
      event.preventDefault();
      void this.executeInspectorAction(activeAction);
      return;
    }
  }

  private clampActiveCommand() {
    this.activeCommandIndex.set(
      Math.min(this.activeCommandIndex(), Math.max(0, this.commandResultCount() - 1)),
    );
  }

  private scrollActiveCommandIntoView() {
    queueMicrotask(() => {
      const row = this.checkpointDialog()?.nativeElement.querySelector<HTMLElement>(
        `[data-command-index="${this.activeCommandIndex()}"]`,
      );
      row?.scrollIntoView({ block: 'nearest' });
    });
  }

  private showCheckpointToast(message: string, isError = false) {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.checkpointToastIsError.set(isError);
    this.checkpointToast.set(message);
    this.toastTimer = setTimeout(() => {
      this.checkpointToast.set(null);
      this.checkpointToastIsError.set(false);
    }, 2500);
  }

  private selectElementAtPoint(event: MouseEvent) {
    const overlay = this.overlayRoot()?.nativeElement ?? null;
    const target = getTargetElement(
      { x: event.clientX, y: event.clientY },
      overlay,
    );
    if (!target) {
      this.selectedMeasurement.set(null);
      this.selectedElement = null;
      this.distanceOverlay.set(null);
      this.refreshTypographyBlocks();
      return false;
    }

    // Ctrl+click: select the minimum common parent of current selection and clicked element
    if ((event.ctrlKey || event.metaKey) && this.selectedElement) {
      const commonParent = this.findMinimumCommonParent(
        this.selectedElement,
        target,
      );
      if (
        commonParent &&
        commonParent !== document.body &&
        commonParent !== document.documentElement
      ) {
        this.selectedMeasurement.set(getInspectMeasurement(commonParent));
        this.selectedElement = commonParent;
        this.updateDistanceOverlay();
        this.refreshTypographyBlocks();
        return true;
      }
    }

    this.selectedMeasurement.set(getInspectMeasurement(target));
    this.selectedElement = target;
    this.selectedGuideId.set(
      this.findGuideAtPoint(event.clientX, event.clientY),
    );
    this.updateDistanceOverlay();
    this.refreshTypographyBlocks();
    return true;
  }

  private updateDistanceOverlay() {
    if (
      !this.altPressed() ||
      !this.selectedElement ||
      !this.hoverElement ||
      this.selectedElement === this.hoverElement ||
      this.selectedElement.contains(this.hoverElement) ||
      this.hoverElement.contains(this.selectedElement)
    ) {
      this.distanceOverlay.set(null);
      return;
    }

    this.distanceOverlay.set(
      getDistanceOverlay(
        getRectFromDom(this.selectedElement),
        getRectFromDom(this.hoverElement),
      ),
    );
  }

  private refreshTypographyBlocks() {
    if (!this.isBrowser || !this.enabled() || !this.showTypography()) {
      this.textBlocks.set([]);
      return;
    }

    const viewport = getViewportSize();
    this.textBlocks.set(
      getVisibleTextBlocks(this.overlayRoot()?.nativeElement ?? null)
        .filter(
          (block) =>
            block.rect.top >= 0 &&
            block.rect.top <= viewport.height &&
            block.rect.left >= 0 &&
            block.rect.left <= viewport.width,
        )
        .map((block) => ({
          ...block,
          rect: {
            ...block.rect,
            left: clamp(block.rect.left, 0, viewport.width - 12),
            top: clamp(block.rect.top, 14, viewport.height),
          },
        })),
    );
  }

  private addGuide(guide: Guide) {
    const nextGuides = [...this.guides(), guide];
    this.guides.set(nextGuides);
    this.selectedGuideId.set(guide.id);
    this.recordHistory(nextGuides);
  }

  private getGuidePreview(event: PointerEvent | MouseEvent): Guide {
    const viewport = getViewportSize();
    const orientation = this.guideOrientation();
    const rawPosition =
      orientation === 'vertical' ? event.clientX : event.clientY;
    const max = orientation === 'vertical' ? viewport.width : viewport.height;

    return {
      id: 'preview',
      orientation,
      position: this.snapGuide(clamp(rawPosition, 0, max)),
    };
  }

  private snapGuide(position: number) {
    for (const guide of this.guides()) {
      if (Math.abs(guide.position - position) <= GUIDE_SNAP_DISTANCE) {
        return guide.position;
      }
    }
    return position;
  }

  private findGuideAtPoint(x: number, y: number) {
    for (const guide of this.guides()) {
      if (
        guide.orientation === 'vertical' &&
        Math.abs(guide.position - x) <= GUIDE_HITBOX_SIZE
      ) {
        return guide.id;
      }
      if (
        guide.orientation === 'horizontal' &&
        Math.abs(guide.position - y) <= GUIDE_HITBOX_SIZE
      ) {
        return guide.id;
      }
    }
    return null;
  }

  private undo() {
    if (!this.canUndo()) {
      return;
    }
    const nextIndex = this.historyIndex() - 1;
    this.historyIndex.set(nextIndex);
    this.guides.set(this.cloneGuides(this.history()[nextIndex]));
  }

  private redo() {
    if (!this.canRedo()) {
      return;
    }
    const nextIndex = this.historyIndex() + 1;
    this.historyIndex.set(nextIndex);
    this.guides.set(this.cloneGuides(this.history()[nextIndex]));
  }

  private recordHistory(guides: Guide[]) {
    const base = this.history().slice(0, this.historyIndex() + 1);
    base.push(this.cloneGuides(guides));
    this.history.set(base);
    this.historyIndex.set(base.length - 1);
  }

  private cloneGuides(guides: Guide[]) {
    return guides.map((guide) => ({ ...guide }));
  }

  private findMinimumCommonParent(
    elementA: HTMLElement,
    elementB: HTMLElement,
  ): HTMLElement | null {
    // Build ancestor chain for element A
    const ancestorsA = new Set<Element>();
    let current: Element | null = elementA;
    while (current) {
      ancestorsA.add(current);
      current = current.parentElement;
    }

    // Walk up from elementB until we find a common ancestor
    current = elementB;
    while (current) {
      if (ancestorsA.has(current)) {
        return current as HTMLElement;
      }
      current = current.parentElement;
    }

    return null;
  }
}
