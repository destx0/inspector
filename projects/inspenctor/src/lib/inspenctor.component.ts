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
} from "@angular/core";
import { CommonModule, isPlatformBrowser } from "@angular/common";
import {
  GUIDE_HITBOX_SIZE,
  GUIDE_SNAP_DISTANCE,
  INSPENCTOR_STATE_VERSION,
  INSPENCTOR_STORAGE_KEY,
} from "./constants";
import {
  getInspectMeasurement,
  getRectFromDom,
  getTargetElement,
  getVisibleTextBlocks,
} from "./dom";
import { getDistanceOverlay } from "./distances";
import { clamp, getViewportSize, rectsEqual } from "./geometry";
import {
  DistanceOverlay,
  Guide,
  GuideOrientation,
  InspectMeasurement,
  InspenctorPersistedState,
  Rect,
  TextBlockAnnotation,
  ToolMode,
} from "./types";
import { createId, formatValue } from "./utils";

@Component({
  selector: "inspenctor-overlay",
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="inspenctor-root" #overlayRoot>
      <div class="inspenctor-toolbar">
        <button
          type="button"
          [class.active]="enabled()"
          (click)="toggleEnabled()"
        >
          {{ enabled() ? "ON" : "OFF" }}
        </button>
        <button
          type="button"
          [class.active]="toolMode() === 'select'"
          (click)="setToolMode('select')"
        >
          SELECT
        </button>
        <button
          type="button"
          [class.active]="toolMode() === 'guides'"
          (click)="setToolMode('guides')"
        >
          GUIDES
        </button>
        <button
          type="button"
          [class.active]="guideOrientation() === 'vertical'"
          (click)="setGuideOrientation('vertical')"
        >
          V
        </button>
        <button
          type="button"
          [class.active]="guideOrientation() === 'horizontal'"
          (click)="setGuideOrientation('horizontal')"
        >
          H
        </button>
        <button
          type="button"
          [class.active]="showTypography()"
          (click)="toggleTypography()"
        >
          TYPE
        </button>
        <button type="button" (click)="clearGuides()">CLEAR</button>
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
            <span>{{ selectedMeasurement()!.label }}</span>
            <span>{{ formatRect(selectedMeasurement()!.rect) }}</span>
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

      //
      <aside
        *ngIf="enabled() && selectedMeasurement() && showTypography()"
        class="inspenctor-typography"
      >
        //
        <div class="inspenctor-typography__header">
          // <span>Typography</span> //
          <span
            class="inspenctor-typography__swatch"
            [style.background]="selectedMeasurement()!.styles.color"
          ></span>
          //
        </div>
        //
        <div class="inspenctor-typography__grid">
          // <span>Font</span
          ><strong>{{ selectedMeasurement()!.styles.fontFamily }}</strong> //
          <span>Size</span
          ><strong>{{ selectedMeasurement()!.styles.fontSize }}</strong>
          <span>Weight</span
          ><strong>{{ selectedMeasurement()!.styles.fontWeight }}</strong>
          <span>Line Height</span
          ><strong>{{ selectedMeasurement()!.styles.lineHeight }}</strong>
          <span>Letter Spacing</span
          ><strong>{{ selectedMeasurement()!.styles.letterSpacing }}</strong>
          <span>Color</span
          ><strong>{{ selectedMeasurement()!.styles.color }}</strong>
          <span>Padding</span
          ><strong>{{ formatEdges(selectedMeasurement()!.padding) }}</strong>
          <span>Margin</span
          ><strong>{{ formatEdges(selectedMeasurement()!.margin) }}</strong>
        </div>
        //
      </aside>

      <ng-container *ngIf="enabled() && showTypography()">
        <div
          *ngFor="let block of textBlocks(); trackBy: trackTextBlock"
          class="inspenctor-text-chip"
          [style.left.px]="block.rect.left"
          [style.top.px]="block.rect.top - 6"
        >
          <span
            class="inspenctor-text-chip__sample"
            [style.color]="block.styles.color"
            >Aa</span
          >
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
          *ngFor="
            let connector of distanceOverlay()!.connectors;
            trackBy: trackConnector
          "
          class="inspenctor-connector"
          [class.inspenctor-connector--vertical]="connector.x1 === connector.x2"
          [class.inspenctor-connector--horizontal]="
            connector.y1 === connector.y2
          "
          [style.left.px]="Math.min(connector.x1, connector.x2)"
          [style.top.px]="Math.min(connector.y1, connector.y2)"
          [style.width.px]="Math.max(1, Math.abs(connector.x2 - connector.x1))"
          [style.height.px]="Math.max(1, Math.abs(connector.y2 - connector.y1))"
        ></div>
        <ng-container
          *ngIf="
            distanceOverlay()!.horizontal &&
            distanceOverlay()!.horizontal!.value > 0
          "
        >
          <div
            class="inspenctor-distance-line inspenctor-distance-line--horizontal"
            [style.left.px]="
              Math.min(
                distanceOverlay()!.horizontal!.x1!,
                distanceOverlay()!.horizontal!.x2!
              )
            "
            [style.top.px]="distanceOverlay()!.horizontal!.y!"
            [style.width.px]="
              Math.abs(
                distanceOverlay()!.horizontal!.x2! -
                  distanceOverlay()!.horizontal!.x1!
              )
            "
          ></div>
          <div
            class="inspenctor-distance-tag"
            [style.left.px]="
              (distanceOverlay()!.horizontal!.x1! +
                distanceOverlay()!.horizontal!.x2!) /
              2
            "
            [style.top.px]="distanceOverlay()!.horizontal!.y! + 10"
          >
            {{ formatValue(distanceOverlay()!.horizontal!.value) }}
          </div>
        </ng-container>
        <ng-container
          *ngIf="
            distanceOverlay()!.vertical &&
            distanceOverlay()!.vertical!.value > 0
          "
        >
          <div
            class="inspenctor-distance-line inspenctor-distance-line--vertical"
            [style.left.px]="distanceOverlay()!.vertical!.x!"
            [style.top.px]="
              Math.min(
                distanceOverlay()!.vertical!.y1!,
                distanceOverlay()!.vertical!.y2!
              )
            "
            [style.height.px]="
              Math.abs(
                distanceOverlay()!.vertical!.y2! -
                  distanceOverlay()!.vertical!.y1!
              )
            "
          ></div>
          <div
            class="inspenctor-distance-tag inspenctor-distance-tag--vertical"
            [style.left.px]="distanceOverlay()!.vertical!.x! + 10"
            [style.top.px]="
              (distanceOverlay()!.vertical!.y1! +
                distanceOverlay()!.vertical!.y2!) /
              2
            "
          >
            {{ formatValue(distanceOverlay()!.vertical!.value) }}
          </div>
        </ng-container>
      </ng-container>

      <ng-container *ngIf="enabled()">
        <button
          *ngFor="let guide of guides(); trackBy: trackGuide"
          type="button"
          class="inspenctor-guide"
          [class.inspenctor-guide--vertical]="guide.orientation === 'vertical'"
          [class.inspenctor-guide--horizontal]="
            guide.orientation === 'horizontal'
          "
          [class.inspenctor-guide--selected]="selectedGuideId() === guide.id"
          [style.left.px]="
            guide.orientation === 'vertical' ? guide.position : null
          "
          [style.top.px]="
            guide.orientation === 'horizontal' ? guide.position : null
          "
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
      --inspenctor-ui: #0f172a;
      --inspenctor-ui-strong: #020617;
      --inspenctor-ui-text: #f8fafc;
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      pointer-events: none;
      font-family: "IBM Plex Sans", "Segoe UI", sans-serif;
    }
    .inspenctor-root {
      position: fixed;
      inset: 0;
      pointer-events: none;
    }
    .inspenctor-toolbar {
      position: fixed;
      top: 20px;
      right: 20px;
      display: flex;
      gap: 8px;
      padding: 8px;
      border: 1px solid rgba(15, 23, 42, 0.24);
      background: rgba(248, 250, 252, 0.96);
      box-shadow: 0 16px 48px rgba(15, 23, 42, 0.18);
      pointer-events: auto;
    }
    .inspenctor-toolbar button {
      border: 0;
      background: var(--inspenctor-ui);
      color: var(--inspenctor-ui-text);
      padding: 9px 12px;
      font: inherit;
      font-size: 11px;
      letter-spacing: 0.12em;
      cursor: pointer;
    }
    .inspenctor-toolbar button.active {
      background: #2563eb;
    }
    .inspenctor-box {
      position: fixed;
      box-sizing: border-box;
      pointer-events: none;
      border: 1px solid var(--inspenctor-accent, oklch(0.62 0.18 255));
      background: color-mix(
        in srgb,
        var(--inspenctor-accent, oklch(0.62 0.18 255)) 10%,
        transparent
      );
    }
    .inspenctor-box--hover {
      opacity: 0.75;
    }
    .inspenctor-box--selected {
      border-width: 2px;
    }
    .inspenctor-box--margin {
      border-color: rgba(249, 115, 22, 0.88);
      background: rgba(249, 115, 22, 0.1);
    }
    .inspenctor-box--padding {
      border-color: rgba(34, 197, 94, 0.88);
      background: rgba(34, 197, 94, 0.1);
    }
    .inspenctor-box--distance {
      border-style: dashed;
      border-color: rgba(37, 99, 235, 0.72);
      background: transparent;
    }
    .inspenctor-label {
      position: absolute;
      left: 0;
      top: 0;
      transform: translateY(calc(-100% - 8px));
      display: inline-flex;
      gap: 10px;
      max-width: min(420px, 100vw - 24px);
      padding: 8px 10px;
      background: var(--inspenctor-ui-strong);
      color: var(--inspenctor-ui-text);
      font-size: 12px;
      line-height: 1.2;
      white-space: nowrap;
    }
    .inspenctor-typography {
      position: fixed;
      left: 20px;
      bottom: 20px;
      width: min(360px, calc(100vw - 40px));
      padding: 16px;
      background: rgba(2, 6, 23, 0.94);
      color: #f8fafc;
      border: 1px solid rgba(148, 163, 184, 0.24);
      box-shadow: 0 24px 80px rgba(2, 6, 23, 0.45);
      pointer-events: auto;
    }
    .inspenctor-typography__header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 14px;
      font-size: 12px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }
    .inspenctor-typography__swatch {
      width: 18px;
      height: 18px;
      border: 1px solid rgba(255, 255, 255, 0.32);
    }
    .inspenctor-typography__grid {
      display: grid;
      grid-template-columns: 112px minmax(0, 1fr);
      gap: 8px 12px;
      font-size: 12px;
      line-height: 1.45;
    }
    .inspenctor-typography__grid span {
      color: #94a3b8;
    }
    .inspenctor-typography__grid strong {
      overflow-wrap: anywhere;
      font-weight: 600;
    }
    .inspenctor-text-chip {
      position: fixed;
      transform: translateY(-100%);
      display: inline-flex;
      gap: 6px;
      max-width: min(44ch, calc(100vw - 20px));
      padding: 4px 6px;
      background: rgba(2, 6, 23, 0.92);
      color: #e2e8f0;
      font-size: 10px;
      line-height: 1;
      white-space: nowrap;
      pointer-events: none;
    }
    .inspenctor-text-chip__sample {
      font-weight: 700;
    }
    .inspenctor-connector {
      position: fixed;
      border-color: rgba(37, 99, 235, 0.72);
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
      background: #2563eb;
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
      padding: 6px 8px;
      background: rgba(2, 6, 23, 0.92);
      color: #f8fafc;
      font-size: 11px;
      line-height: 1;
      pointer-events: none;
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
      background: var(--inspenctor-guide, oklch(0.63 0.26 29.23));
    }
    .inspenctor-guide--horizontal .inspenctor-guide-line {
      top: calc(50% - 0.5px);
      width: 100%;
      height: 1px;
      background: var(--inspenctor-guide, oklch(0.63 0.26 29.23));
    }
    .inspenctor-guide--selected .inspenctor-guide-line {
      box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.6);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InspenctorComponent {
  readonly Math = Math;
  readonly formatValue = formatValue;
  readonly overlayRoot = viewChild<ElementRef<HTMLElement>>("overlayRoot");

  @Input() highlightColor = "oklch(0.62 0.18 255)";
  @Input() guideColor = "oklch(0.63 0.26 29.23)";
  @Input() hoverHighlightEnabled = true;
  @Input() persistOnReload = false;

  readonly enabled = signal(false);
  readonly toolMode = signal<ToolMode>("none");
  readonly guideOrientation = signal<GuideOrientation>("vertical");
  readonly guides = signal<Guide[]>([]);
  readonly hoverRect = signal<Rect | null>(null);
  readonly selectedGuideId = signal<string | null>(null);
  readonly selectedMeasurement = signal<InspectMeasurement | null>(null);
  readonly showTypography = signal(true);
  readonly altPressed = signal(false);
  readonly distanceOverlay = signal<DistanceOverlay | null>(null);
  readonly textBlocks = signal<TextBlockAnnotation[]>([]);

  private readonly isBrowser: boolean;
  private readonly hydrated = signal(false);
  private readonly history = signal<Guide[][]>([]);
  private readonly historyIndex = signal(-1);
  private draggingGuideId: string | null = null;
  private selectedElement: HTMLElement | null = null;
  private hoverElement: HTMLElement | null = null;

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
      const payload: InspenctorPersistedState = {
        version: INSPENCTOR_STATE_VERSION,
        enabled: this.enabled(),
        toolMode: this.toolMode(),
        guideOrientation: this.guideOrientation(),
        guides: this.guides(),
        showTypography: this.showTypography(),
      };
      window.localStorage.setItem(
        INSPENCTOR_STORAGE_KEY,
        JSON.stringify(payload),
      );
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
      this.toolMode.set("none");
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
    this.toolMode.set(this.toolMode() === mode ? "none" : mode);
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

  clearGuides() {
    this.guides.set([]);
    this.selectedGuideId.set(null);
    this.recordHistory([]);
  }

  trackGuide = (_index: number, guide: Guide) => guide.id;
  trackTextBlock = (_index: number, block: TextBlockAnnotation) => block.id;
  trackConnector = (
    _index: number,
    connector: DistanceOverlay["connectors"][number],
  ) => `${connector.x1}:${connector.y1}:${connector.x2}:${connector.y2}`;

  formatRect(rect: Rect) {
    return `${formatValue(rect.width)} × ${formatValue(rect.height)} @ ${formatValue(rect.left)}, ${formatValue(rect.top)}`;
  }

  formatEdges(edges: InspectMeasurement["padding"]) {
    return `${formatValue(edges.top)} / ${formatValue(edges.right)} / ${formatValue(edges.bottom)} / ${formatValue(edges.left)}`;
  }

  startGuideDrag(event: PointerEvent, guide: Guide) {
    event.preventDefault();
    event.stopPropagation();
    this.draggingGuideId = guide.id;
    this.selectedGuideId.set(guide.id);
  }

  @HostListener("window:keydown", ["$event"])
  handleKeydown(event: KeyboardEvent) {
    const key = event.key.toLowerCase();
    if (key === "m") {
      event.preventDefault();
      this.toggleEnabled();
      return;
    }
    if (!this.enabled()) {
      return;
    }
    if ((event.metaKey || event.ctrlKey) && key === "z") {
      event.preventDefault();
      event.shiftKey ? this.redo() : this.undo();
      return;
    }
    if (key === "s") {
      event.preventDefault();
      this.setToolMode("select");
      return;
    }
    if (key === "g") {
      event.preventDefault();
      this.setToolMode("guides");
      return;
    }
    if (key === "h") {
      event.preventDefault();
      this.setGuideOrientation("horizontal");
      return;
    }
    if (key === "v") {
      event.preventDefault();
      this.setGuideOrientation("vertical");
      return;
    }
    if (event.key === "Alt") {
      this.altPressed.set(true);
      this.updateDistanceOverlay();
      return;
    }
    if (key === "escape") {
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
    if ((key === "backspace" || key === "delete") && this.selectedGuideId()) {
      event.preventDefault();
      const nextGuides = this.guides().filter(
        (guide) => guide.id !== this.selectedGuideId(),
      );
      this.guides.set(nextGuides);
      this.selectedGuideId.set(null);
      this.recordHistory(nextGuides);
    }
  }

  @HostListener("window:keyup", ["$event"])
  handleKeyup(event: KeyboardEvent) {
    if (event.key === "Alt") {
      this.altPressed.set(false);
      this.distanceOverlay.set(null);
    }
  }

  @HostListener("window:pointermove", ["$event"])
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
          const rawPosition =
            guide.orientation === "vertical" ? event.clientX : event.clientY;
          const max =
            guide.orientation === "vertical" ? viewport.width : viewport.height;
          return { ...guide, position: clamp(rawPosition, 0, max) };
        }),
      );
      return;
    }
    if (this.toolMode() !== "select" || !this.hoverHighlightEnabled) {
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

  @HostListener("window:pointerup")
  handlePointerUp() {
    if (!this.draggingGuideId) {
      return;
    }
    this.recordHistory(this.guides());
    this.draggingGuideId = null;
  }

  @HostListener("window:click", ["$event"])
  handleClick(event: MouseEvent) {
    if (!this.enabled() || !this.isBrowser) {
      return;
    }
    const overlay = this.overlayRoot()?.nativeElement ?? null;
    if (this.toolMode() === "guides") {
      if (overlay && overlay.contains(event.target as Node)) {
        return;
      }
      this.addGuide({
        id: createId(),
        orientation: this.guideOrientation(),
        position:
          this.guideOrientation() === "vertical"
            ? this.snapGuide(event.clientX)
            : this.snapGuide(event.clientY),
      });
      return;
    }
    if (this.toolMode() !== "select") {
      return;
    }
    const target = getTargetElement(
      { x: event.clientX, y: event.clientY },
      overlay,
    );
    if (!target) {
      this.selectedMeasurement.set(null);
      this.selectedElement = null;
      this.distanceOverlay.set(null);
      this.refreshTypographyBlocks();
      return;
    }
    this.selectedMeasurement.set(getInspectMeasurement(target));
    this.selectedElement = target;
    this.selectedGuideId.set(
      this.findGuideAtPoint(event.clientX, event.clientY),
    );
    this.updateDistanceOverlay();
    this.refreshTypographyBlocks();
  }

  @HostListener("window:resize")
  @HostListener("window:scroll")
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
      getVisibleTextBlocks(this.overlayRoot()?.nativeElement ?? null).map(
        (block) => ({
          ...block,
          rect: {
            ...block.rect,
            left: clamp(block.rect.left, 0, viewport.width - 12),
            top: clamp(block.rect.top, 14, viewport.height),
          },
        }),
      ),
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
      if (
        guide.orientation === "vertical" &&
        Math.abs(guide.position - x) <= GUIDE_HITBOX_SIZE
      ) {
        return guide.id;
      }
      if (
        guide.orientation === "horizontal" &&
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
}
