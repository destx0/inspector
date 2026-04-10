import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  Inject,
  Input,
  PLATFORM_ID,
  computed,
  effect,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  GUIDE_HITBOX_SIZE,
  GUIDE_SNAP_DISTANCE,
  INSPENCTOR_STATE_VERSION,
  INSPENCTOR_STORAGE_KEY,
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
  InspenctorPersistedState,
  Rect,
  TextBlockAnnotation,
  ToolMode,
} from './types';
import { createId, formatValue } from './utils';

@Component({
  selector: 'inspenctor-overlay',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="inspenctor-root" #overlayRoot>
      <div class="inspenctor-toolbar" [class.is-open]="toolbarOpen()">
        <div class="inspenctor-toolbar__rail">
          <button
            type="button"
            class="inspenctor-icon-button"
            [class.is-active]="enabled()"
            (click)="toggleEnabled()"
            title="Toggle inspector"
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M3 3h10v10H3zM5 5h6v6H5z" />
            </svg>
          </button>

          <button
            type="button"
            class="inspenctor-icon-button"
            [class.is-active]="toolMode() === 'select'"
            (click)="setToolMode('select')"
            title="Select mode"
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M3 2l8 8-3 .7L6.7 13 6 10 3 2z" />
            </svg>
          </button>

          <button
            type="button"
            class="inspenctor-icon-button"
            [class.is-active]="toolMode() === 'guides'"
            (click)="setToolMode('guides')"
            title="Guides mode"
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M4 2h1v12H4zM11 2h1v12h-1zM2 4h12v1H2zM2 11h12v1H2z" />
            </svg>
          </button>

          <button
            type="button"
            class="inspenctor-icon-button"
            [class.is-active]="showTypography()"
            (click)="toggleTypography()"
            title="Typography mode"
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M3 4V2h10v2h-4v10H7V4z" />
            </svg>
          </button>

          <button
            type="button"
            class="inspenctor-icon-button inspenctor-icon-button--ghost"
            [class.is-active]="toolbarOpen()"
            (click)="toggleToolbarOpen()"
            title="More tools"
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M3 8a1.2 1.2 0 110-2.4A1.2 1.2 0 013 8zm5 0a1.2 1.2 0 110-2.4A1.2 1.2 0 018 8zm5 0A1.2 1.2 0 1113 5.6 1.2 1.2 0 0113 8z" />
            </svg>
          </button>
        </div>

        <div *ngIf="toolbarOpen()" class="inspenctor-toolbar__panel">
          <button
            type="button"
            class="inspenctor-segment"
            [class.is-active]="guideOrientation() === 'vertical'"
            (click)="setGuideOrientation('vertical')"
          >
            Vertical
          </button>
          <button
            type="button"
            class="inspenctor-segment"
            [class.is-active]="guideOrientation() === 'horizontal'"
            (click)="setGuideOrientation('horizontal')"
          >
            Horizontal
          </button>
          <button type="button" class="inspenctor-segment inspenctor-segment--danger" (click)="clearGuides()">
            Clear
          </button>
        </div>
      </div>

      <ng-container *ngIf="enabled() && toolMode() === 'select'">
        <div
          *ngIf="hoverRect() && hoverHighlightEnabled"
          class="inspenctor-box inspenctor-box--hover"
          [style.left.px]="hoverRect()!.left"
          [style.top.px]="hoverRect()!.top"
          [style.width.px]="hoverRect()!.width"
          [style.height.px]="hoverRect()!.height"
          [style.--inspenctor-accent]="highlightColor"
        ></div>

        <div
          *ngIf="selectedMeasurement()"
          class="inspenctor-box inspenctor-box--margin"
          [style.left.px]="selectedMeasurement()!.marginRect.left"
          [style.top.px]="selectedMeasurement()!.marginRect.top"
          [style.width.px]="selectedMeasurement()!.marginRect.width"
          [style.height.px]="selectedMeasurement()!.marginRect.height"
        ></div>

        <div
          *ngIf="selectedMeasurement()"
          class="inspenctor-box inspenctor-box--selected"
          [style.left.px]="selectedMeasurement()!.rect.left"
          [style.top.px]="selectedMeasurement()!.rect.top"
          [style.width.px]="selectedMeasurement()!.rect.width"
          [style.height.px]="selectedMeasurement()!.rect.height"
          [style.--inspenctor-accent]="highlightColor"
        >
          <div class="inspenctor-label">
            <span class="inspenctor-label__title">{{ selectedMeasurement()!.label }}</span>
            <span class="inspenctor-label__meta">
              {{ selectedMeasurement()!.styles.fontSize }} / {{ selectedMeasurement()!.styles.lineHeight }} / {{ selectedMeasurement()!.styles.color }}
            </span>
          </div>
        </div>

        <div
          *ngIf="selectedMeasurement()"
          class="inspenctor-box inspenctor-box--padding"
          [style.left.px]="selectedMeasurement()!.paddingRect.left"
          [style.top.px]="selectedMeasurement()!.paddingRect.top"
          [style.width.px]="selectedMeasurement()!.paddingRect.width"
          [style.height.px]="selectedMeasurement()!.paddingRect.height"
        ></div>
      </ng-container>

      <ng-container *ngIf="enabled() && showTypography()">
        <div
          *ngFor="let block of textBlocks(); trackBy: trackTextBlock"
          class="inspenctor-text-chip"
          [style.left.px]="block.rect.left"
          [style.top.px]="block.rect.top - 8"
        >
          <span class="inspenctor-text-chip__swatch" [style.background]="block.styles.color"></span>
          <span>{{ block.styles.fontSize }}</span>
          <span>{{ block.styles.lineHeight }}</span>
          <span>{{ block.styles.color }}</span>
        </div>
      </ng-container>

      <ng-container *ngIf="enabled() && altPressed() && distanceOverlay()">
        <div
          class="inspenctor-box inspenctor-box--distance"
          [style.left.px]="distanceOverlay()!.rectA.left"
          [style.top.px]="distanceOverlay()!.rectA.top"
          [style.width.px]="distanceOverlay()!.rectA.width"
          [style.height.px]="distanceOverlay()!.rectA.height"
        ></div>
        <div
          class="inspenctor-box inspenctor-box--distance"
          [style.left.px]="distanceOverlay()!.rectB.left"
          [style.top.px]="distanceOverlay()!.rectB.top"
          [style.width.px]="distanceOverlay()!.rectB.width"
          [style.height.px]="distanceOverlay()!.rectB.height"
        ></div>
        <div
          *ngFor="let connector of distanceOverlay()!.connectors; trackBy: trackConnector"
          class="inspenctor-connector"
          [class.inspenctor-connector--vertical]="connector.x1 === connector.x2"
          [class.inspenctor-connector--horizontal]="connector.y1 === connector.y2"
          [style.left.px]="Math.min(connector.x1, connector.x2)"
          [style.top.px]="Math.min(connector.y1, connector.y2)"
          [style.width.px]="Math.max(1, Math.abs(connector.x2 - connector.x1))"
          [style.height.px]="Math.max(1, Math.abs(connector.y2 - connector.y1))"
        ></div>
        <ng-container *ngIf="distanceOverlay()!.horizontal && distanceOverlay()!.horizontal!.value > 0">
          <div
            class="inspenctor-distance-line inspenctor-distance-line--horizontal"
            [style.left.px]="Math.min(distanceOverlay()!.horizontal!.x1!, distanceOverlay()!.horizontal!.x2!)"
            [style.top.px]="distanceOverlay()!.horizontal!.y!"
            [style.width.px]="Math.abs(distanceOverlay()!.horizontal!.x2! - distanceOverlay()!.horizontal!.x1!)"
          ></div>
          <div
            class="inspenctor-distance-tag"
            [style.left.px]="(distanceOverlay()!.horizontal!.x1! + distanceOverlay()!.horizontal!.x2!) / 2"
            [style.top.px]="distanceOverlay()!.horizontal!.y! + 10"
          >{{ formatValue(distanceOverlay()!.horizontal!.value) }}</div>
        </ng-container>
        <ng-container *ngIf="distanceOverlay()!.vertical && distanceOverlay()!.vertical!.value > 0">
          <div
            class="inspenctor-distance-line inspenctor-distance-line--vertical"
            [style.left.px]="distanceOverlay()!.vertical!.x!"
            [style.top.px]="Math.min(distanceOverlay()!.vertical!.y1!, distanceOverlay()!.vertical!.y2!)"
            [style.height.px]="Math.abs(distanceOverlay()!.vertical!.y2! - distanceOverlay()!.vertical!.y1!)"
          ></div>
          <div
            class="inspenctor-distance-tag inspenctor-distance-tag--vertical"
            [style.left.px]="distanceOverlay()!.vertical!.x! + 10"
            [style.top.px]="(distanceOverlay()!.vertical!.y1! + distanceOverlay()!.vertical!.y2!) / 2"
          >{{ formatValue(distanceOverlay()!.vertical!.value) }}</div>
        </ng-container>
      </ng-container>

      <ng-container *ngIf="enabled()">
        <button
          *ngFor="let guide of guides(); trackBy: trackGuide"
          type="button"
          class="inspenctor-guide"
          [class.inspenctor-guide--vertical]="guide.orientation === 'vertical'"
          [class.inspenctor-guide--horizontal]="guide.orientation === 'horizontal'"
          [class.inspenctor-guide--selected]="selectedGuideId() === guide.id"
          [style.left.px]="guide.orientation === 'vertical' ? guide.position : null"
          [style.top.px]="guide.orientation === 'horizontal' ? guide.position : null"
          [style.--inspenctor-guide]="guideColor"
          (pointerdown)="startGuideDrag($event, guide)"
        >
          <span class="inspenctor-guide-line"></span>
        </button>
      </ng-container>
    </div>
  `,
  styles: `
    :host {
      --inspenctor-panel: rgba(27, 29, 36, 0.94);
      --inspenctor-panel-edge: rgba(255, 255, 255, 0.08);
      --inspenctor-text: #f3f4f6;
      --inspenctor-muted: #9ca3af;
      --inspenctor-blue: #4f8cff;
      --inspenctor-orange: #f59e0b;
      --inspenctor-green: #22c55e;
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      pointer-events: none;
      font-family: "SF Pro Display", "Segoe UI", sans-serif;
    }

    .inspenctor-root {
      position: fixed;
      inset: 0;
      pointer-events: none;
    }

    .inspenctor-toolbar {
      position: fixed;
      top: 18px;
      right: 18px;
      display: flex;
      gap: 8px;
      align-items: flex-start;
      pointer-events: auto;
    }

    .inspenctor-toolbar__rail,
    .inspenctor-toolbar__panel {
      display: flex;
      gap: 6px;
      padding: 6px;
      border: 1px solid var(--inspenctor-panel-edge);
      background: var(--inspenctor-panel);
      box-shadow: 0 18px 40px rgba(0, 0, 0, 0.32);
      backdrop-filter: blur(18px);
    }

    .inspenctor-toolbar__panel {
      min-width: 0;
    }

    .inspenctor-icon-button,
    .inspenctor-segment {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      height: 28px;
      border: 0;
      background: transparent;
      color: var(--inspenctor-muted);
      cursor: pointer;
      transition: background 120ms ease, color 120ms ease;
      font: inherit;
      font-size: 11px;
      letter-spacing: 0.02em;
    }

    .inspenctor-icon-button {
      width: 28px;
    }

    .inspenctor-icon-button svg {
      width: 14px;
      height: 14px;
      fill: currentColor;
    }

    .inspenctor-icon-button:hover,
    .inspenctor-segment:hover {
      background: rgba(255, 255, 255, 0.08);
      color: var(--inspenctor-text);
    }

    .inspenctor-icon-button.is-active,
    .inspenctor-segment.is-active {
      background: rgba(79, 140, 255, 0.18);
      color: #dbeafe;
    }

    .inspenctor-icon-button--ghost.is-active {
      background: rgba(255, 255, 255, 0.08);
      color: var(--inspenctor-text);
    }

    .inspenctor-segment {
      padding: 0 10px;
      white-space: nowrap;
    }

    .inspenctor-segment--danger:hover {
      background: rgba(239, 68, 68, 0.16);
      color: #fecaca;
    }

    .inspenctor-box {
      position: fixed;
      box-sizing: border-box;
      pointer-events: none;
      border: 1px solid var(--inspenctor-accent, var(--inspenctor-blue));
      background: color-mix(in srgb, var(--inspenctor-accent, var(--inspenctor-blue)) 8%, transparent);
    }

    .inspenctor-box--hover {
      opacity: 0.55;
    }

    .inspenctor-box--selected {
      border-width: 1.5px;
    }

    .inspenctor-box--margin {
      border-color: rgba(245, 158, 11, 0.82);
      background: rgba(245, 158, 11, 0.08);
    }

    .inspenctor-box--padding {
      border-color: rgba(34, 197, 94, 0.82);
      background: rgba(34, 197, 94, 0.08);
    }

    .inspenctor-box--distance {
      border-style: dashed;
      border-color: rgba(79, 140, 255, 0.7);
      background: transparent;
    }

    .inspenctor-label {
      position: absolute;
      left: 0;
      top: 0;
      transform: translateY(calc(-100% - 8px));
      display: grid;
      gap: 3px;
      max-width: min(320px, calc(100vw - 24px));
      padding: 7px 9px;
      border: 1px solid var(--inspenctor-panel-edge);
      background: var(--inspenctor-panel);
      color: var(--inspenctor-text);
      box-shadow: 0 18px 40px rgba(0, 0, 0, 0.26);
      font-size: 11px;
      line-height: 1.1;
      white-space: nowrap;
    }

    .inspenctor-label__title {
      font-weight: 600;
    }

    .inspenctor-label__meta {
      color: #cbd5e1;
      font-variant-numeric: tabular-nums;
    }

    .inspenctor-text-chip {
      position: fixed;
      transform: translateY(-100%);
      display: inline-flex;
      gap: 6px;
      align-items: center;
      padding: 4px 6px;
      border: 1px solid var(--inspenctor-panel-edge);
      background: rgba(17, 24, 39, 0.94);
      color: #e5e7eb;
      box-shadow: 0 12px 24px rgba(0, 0, 0, 0.22);
      font-size: 10px;
      line-height: 1;
      white-space: nowrap;
      pointer-events: none;
      font-variant-numeric: tabular-nums;
    }

    .inspenctor-text-chip__swatch {
      width: 8px;
      height: 8px;
      border: 1px solid rgba(255, 255, 255, 0.18);
      flex: 0 0 auto;
    }

    .inspenctor-connector {
      position: fixed;
      border-color: rgba(79, 140, 255, 0.72);
      border-style: dashed;
      pointer-events: none;
    }

    .inspenctor-connector--vertical {
      border-left-width: 1px;
      width: 0;
    }

    .inspenctor-connector--horizontal {
      border-top-width: 1px;
      height: 0;
    }

    .inspenctor-distance-line {
      position: fixed;
      background: var(--inspenctor-blue);
      pointer-events: none;
    }

    .inspenctor-distance-line--horizontal {
      height: 1px;
    }

    .inspenctor-distance-line--vertical {
      width: 1px;
    }

    .inspenctor-distance-tag {
      position: fixed;
      transform: translateX(-50%);
      padding: 5px 7px;
      border: 1px solid var(--inspenctor-panel-edge);
      background: rgba(17, 24, 39, 0.95);
      color: var(--inspenctor-text);
      font-size: 10px;
      line-height: 1;
      pointer-events: none;
      font-variant-numeric: tabular-nums;
    }

    .inspenctor-distance-tag--vertical {
      transform: translateY(-50%);
    }

    .inspenctor-guide {
      position: fixed;
      margin: 0;
      padding: 0;
      border: 0;
      background: transparent;
      pointer-events: auto;
      cursor: grab;
    }

    .inspenctor-guide--vertical {
      top: 0;
      width: ${GUIDE_HITBOX_SIZE}px;
      height: 100vh;
      transform: translateX(-50%);
    }

    .inspenctor-guide--horizontal {
      left: 0;
      width: 100vw;
      height: ${GUIDE_HITBOX_SIZE}px;
      transform: translateY(-50%);
    }

    .inspenctor-guide-line {
      position: absolute;
      inset: 0;
      pointer-events: none;
    }

    .inspenctor-guide--vertical .inspenctor-guide-line {
      left: calc(50% - 0.5px);
      width: 1px;
      height: 100%;
      background: var(--inspenctor-guide, #ff7a00);
    }

    .inspenctor-guide--horizontal .inspenctor-guide-line {
      top: calc(50% - 0.5px);
      width: 100%;
      height: 1px;
      background: var(--inspenctor-guide, #ff7a00);
    }

    .inspenctor-guide--selected .inspenctor-guide-line {
      box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.5);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InspenctorComponent {
  readonly Math = Math;
  readonly formatValue = formatValue;
  readonly overlayRoot = viewChild<ElementRef<HTMLElement>>('overlayRoot');

  @Input() highlightColor = '#4f8cff';
  @Input() guideColor = '#ff7a00';
  @Input() hoverHighlightEnabled = true;
  @Input() persistOnReload = false;

  readonly enabled = signal(false);
  readonly toolMode = signal<ToolMode>('none');
  readonly guideOrientation = signal<GuideOrientation>('vertical');
  readonly guides = signal<Guide[]>([]);
  readonly hoverRect = signal<Rect | null>(null);
  readonly selectedGuideId = signal<string | null>(null);
  readonly selectedMeasurement = signal<InspectMeasurement | null>(null);
  readonly showTypography = signal(true);
  readonly altPressed = signal(false);
  readonly distanceOverlay = signal<DistanceOverlay | null>(null);
  readonly textBlocks = signal<TextBlockAnnotation[]>([]);
  readonly toolbarOpen = signal(false);

  private readonly isBrowser: boolean;
  private readonly hydrated = signal(false);
  private readonly history = signal<Guide[][]>([]);
  private readonly historyIndex = signal(-1);
  private draggingGuideId: string | null = null;
  private selectedElement: HTMLElement | null = null;
  private hoverElement: HTMLElement | null = null;

  readonly canUndo = computed(() => this.historyIndex() > 0);
  readonly canRedo = computed(() => this.historyIndex() >= 0 && this.historyIndex() < this.history().length - 1);

  constructor(@Inject(PLATFORM_ID) platformId: object) {
    this.isBrowser = isPlatformBrowser(platformId);

    effect(() => {
      if (!this.persistOnReload || !this.isBrowser || !this.hydrated()) {
        return;
      }
      const payload: InspenctorPersistedState = {
        version: INSPENCTOR_STATE_VERSION,
        enabled: this.enabled(),
        toolMode: this.toolMode(),
        guideOrientation: this.guideOrientation(),
        guides: this.guides(),
        showTypography: this.showTypography(),
      };
      window.localStorage.setItem(INSPENCTOR_STORAGE_KEY, JSON.stringify(payload));
    });
  }

  ngOnInit() {
    if (!this.isBrowser || !this.persistOnReload) {
      this.hydrated.set(true);
      return;
    }
    const stored = window.localStorage.getItem(INSPENCTOR_STORAGE_KEY);
    if (!stored) {
      this.hydrated.set(true);
      return;
    }
    try {
      const parsed = JSON.parse(stored) as InspenctorPersistedState;
      if (parsed.version === INSPENCTOR_STATE_VERSION) {
        this.enabled.set(parsed.enabled);
        this.toolMode.set(parsed.toolMode);
        this.guideOrientation.set(parsed.guideOrientation);
        this.guides.set(parsed.guides ?? []);
        this.showTypography.set(parsed.showTypography ?? true);
        this.recordHistory(parsed.guides ?? []);
      }
    } catch {
      // ignore malformed state
    }
    this.hydrated.set(true);
    this.refreshTypographyBlocks();
  }

  toggleEnabled() {
    this.enabled.update((value) => !value);
    if (!this.enabled()) {
      this.toolMode.set('none');
      this.hoverRect.set(null);
      this.selectedGuideId.set(null);
      this.distanceOverlay.set(null);
      this.textBlocks.set([]);
    }
    this.refreshTypographyBlocks();
  }

  setToolMode(mode: ToolMode) {
    if (!this.enabled()) {
      this.enabled.set(true);
    }
    this.toolMode.set(this.toolMode() === mode ? 'none' : mode);
    this.hoverRect.set(null);
    this.distanceOverlay.set(null);
    this.refreshTypographyBlocks();
  }

  setGuideOrientation(orientation: GuideOrientation) {
    this.guideOrientation.set(orientation);
  }

  toggleTypography() {
    this.showTypography.update((value) => !value);
    this.refreshTypographyBlocks();
  }

  toggleToolbarOpen() {
    this.toolbarOpen.update((value) => !value);
  }

  clearGuides() {
    this.guides.set([]);
    this.selectedGuideId.set(null);
    this.recordHistory([]);
  }

  trackGuide = (_index: number, guide: Guide) => guide.id;
  trackTextBlock = (_index: number, block: TextBlockAnnotation) => block.id;
  trackConnector = (_index: number, connector: DistanceOverlay['connectors'][number]) =>
    `${connector.x1}:${connector.y1}:${connector.x2}:${connector.y2}`;

  startGuideDrag(event: PointerEvent, guide: Guide) {
    event.preventDefault();
    event.stopPropagation();
    this.draggingGuideId = guide.id;
    this.selectedGuideId.set(guide.id);
  }

  @HostListener('window:keydown', ['$event'])
  handleKeydown(event: KeyboardEvent) {
    const key = event.key.toLowerCase();
    if (key === 'm') {
      event.preventDefault();
      this.toggleEnabled();
      return;
    }
    if (!this.enabled()) {
      return;
    }
    if ((event.metaKey || event.ctrlKey) && key === 'z') {
      event.preventDefault();
      event.shiftKey ? this.redo() : this.undo();
      return;
    }
    if (key === 's') {
      event.preventDefault();
      this.setToolMode('select');
      return;
    }
    if (key === 'g') {
      event.preventDefault();
      this.setToolMode('guides');
      return;
    }
    if (key === 'h') {
      event.preventDefault();
      this.setGuideOrientation('horizontal');
      return;
    }
    if (key === 'v') {
      event.preventDefault();
      this.setGuideOrientation('vertical');
      return;
    }
    if (event.key === 'Alt') {
      this.altPressed.set(true);
      this.updateDistanceOverlay();
      return;
    }
    if (key === 'escape') {
      event.preventDefault();
      this.selectedMeasurement.set(null);
      this.selectedGuideId.set(null);
      this.hoverRect.set(null);
      this.distanceOverlay.set(null);
      this.selectedElement = null;
      this.hoverElement = null;
      this.clearGuides();
      this.refreshTypographyBlocks();
      return;
    }
    if ((key === 'backspace' || key === 'delete') && this.selectedGuideId()) {
      event.preventDefault();
      const nextGuides = this.guides().filter((guide) => guide.id !== this.selectedGuideId());
      this.guides.set(nextGuides);
      this.selectedGuideId.set(null);
      this.recordHistory(nextGuides);
    }
  }

  @HostListener('window:keyup', ['$event'])
  handleKeyup(event: KeyboardEvent) {
    if (event.key === 'Alt') {
      this.altPressed.set(false);
      this.distanceOverlay.set(null);
    }
  }

  @HostListener('window:pointermove', ['$event'])
  handlePointerMove(event: PointerEvent) {
    if (!this.enabled() || !this.isBrowser) {
      return;
    }
    if (this.draggingGuideId) {
      const viewport = getViewportSize();
      this.guides.set(
        this.guides().map((guide) => {
          if (guide.id !== this.draggingGuideId) {
            return guide;
          }
          const rawPosition = guide.orientation === 'vertical' ? event.clientX : event.clientY;
          const max = guide.orientation === 'vertical' ? viewport.width : viewport.height;
          return { ...guide, position: clamp(rawPosition, 0, max) };
        }),
      );
      return;
    }
    if (this.toolMode() !== 'select' || !this.hoverHighlightEnabled) {
      this.hoverRect.set(null);
      this.hoverElement = null;
      if (!this.altPressed()) {
        return;
      }
    }
    const target = getTargetElement({ x: event.clientX, y: event.clientY }, this.overlayRoot()?.nativeElement ?? null);
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
      this.addGuide({
        id: createId(),
        orientation: this.guideOrientation(),
        position: this.guideOrientation() === 'vertical' ? this.snapGuide(event.clientX) : this.snapGuide(event.clientY),
      });
      return;
    }
    if (this.toolMode() !== 'select') {
      return;
    }
    const target = getTargetElement({ x: event.clientX, y: event.clientY }, overlay);
    if (!target) {
      this.selectedMeasurement.set(null);
      this.selectedElement = null;
      this.distanceOverlay.set(null);
      this.refreshTypographyBlocks();
      return;
    }
    this.selectedMeasurement.set(getInspectMeasurement(target));
    this.selectedElement = target;
    this.selectedGuideId.set(this.findGuideAtPoint(event.clientX, event.clientY));
    this.updateDistanceOverlay();
    this.refreshTypographyBlocks();
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
    this.distanceOverlay.set(getDistanceOverlay(getRectFromDom(this.selectedElement), getRectFromDom(this.hoverElement)));
  }

  private refreshTypographyBlocks() {
    if (!this.isBrowser || !this.enabled() || !this.showTypography()) {
      this.textBlocks.set([]);
      return;
    }
    const viewport = getViewportSize();
    this.textBlocks.set(
      getVisibleTextBlocks(this.overlayRoot()?.nativeElement ?? null).map((block) => ({
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
      if (guide.orientation === 'vertical' && Math.abs(guide.position - x) <= GUIDE_HITBOX_SIZE) {
        return guide.id;
      }
      if (guide.orientation === 'horizontal' && Math.abs(guide.position - y) <= GUIDE_HITBOX_SIZE) {
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
}
