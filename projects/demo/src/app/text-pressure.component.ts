import {
  AfterViewInit,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  QueryList,
  ViewChild,
  ViewChildren,
  computed,
  inject,
  input,
} from '@angular/core';
import { Subscription } from 'rxjs';

interface MutableFontFaceSet extends FontFaceSet {
  add(font: FontFace): this;
  delete(font: FontFace): boolean;
}

@Component({
  selector: 'text-pressure',
  standalone: true,
  imports: [],
  template: `
    <div #container class="container" [style.--stroke-color]="strokeColor()">
      <h1 #title class="title" [class.flex]="flex()" [class.stroke]="stroke()">
        @for (char of chars(); track $index) {
          <span #charSpan [attr.data-char]="char">{{ char }}</span>
        }
      </h1>
    </div>
  `,
  styles: [
    `
      .container {
        position: relative;
        width: 100%;
        height: 100%;
        background: transparent;
        overflow: hidden;
      }
      .title {
        margin: 0;
        text-align: left;
        user-select: none;
        white-space: nowrap;
        font-weight: 300;
        width: 100%;
        line-height: 1;
      }
      .flex {
        display: flex;
        justify-content: space-between;
      }
      .stroke span {
        position: relative;
      }
      .stroke span::after {
        content: attr(data-char);
        position: absolute;
        left: 0;
        top: 0;
        color: transparent;
        z-index: -1;
        -webkit-text-stroke-width: 3px;
        -webkit-text-stroke-color: var(--stroke-color);
      }
    `,
  ],
})
export class TextPressureComponent implements AfterViewInit, OnDestroy {
  readonly text = input('Compressa');
  readonly fontFamily = input('Compressa VF');
  readonly fontUrl = input(
    'https://res.cloudinary.com/dr6lvwubh/raw/upload/v1529908256/CompressaPRO-GX.woff2',
  );
  readonly width = input(true);
  readonly weight = input(true);
  readonly italic = input(true);
  readonly alpha = input(false);
  readonly flex = input(true);
  readonly stroke = input(false);
  readonly scale = input(false);
  readonly textColor = input('#FFFFFF');
  readonly strokeColor = input('#FF0000');
  readonly minFontSize = input(24);
  readonly chars = computed(() => Array.from(this.text()));

  @ViewChild('container') container!: ElementRef<HTMLDivElement>;
  @ViewChild('title') title!: ElementRef<HTMLHeadingElement>;
  @ViewChildren('charSpan', { read: ElementRef })
  charSpans!: QueryList<ElementRef<HTMLSpanElement>>;

  private readonly ngZone = inject(NgZone);
  private mouse = { x: 0, y: 0 };
  private cursor = { x: 0, y: 0 };
  private rafId?: number;
  private sizeRafId?: number;
  private resizeObserver?: ResizeObserver;
  private fontFace?: FontFace;
  private charSpansSubscription?: Subscription;
  private destroyed = false;

  ngAfterViewInit() {
    this.injectFont();
    this.charSpansSubscription = this.charSpans.changes.subscribe(() =>
      this.setSize(),
    );
    this.ngZone.runOutsideAngular(() => {
      this.setupEventListeners();
      this.setSize();
      this.animate();
    });
  }

  ngOnDestroy() {
    this.destroyed = true;
    if (this.rafId !== undefined) cancelAnimationFrame(this.rafId);
    if (this.sizeRafId !== undefined) cancelAnimationFrame(this.sizeRafId);
    this.resizeObserver?.disconnect();
    this.charSpansSubscription?.unsubscribe();
    window.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('touchmove', this.handleTouchMove);
    if (this.fontFace) {
      (document.fonts as MutableFontFaceSet).delete(this.fontFace);
    }
  }

  private injectFont() {
    if (typeof FontFace === 'undefined') return;

    try {
      this.fontFace = new FontFace(
        this.fontFamily(),
        `url(${JSON.stringify(this.fontUrl())})`,
      );
      (document.fonts as MutableFontFaceSet).add(this.fontFace);
      void this.fontFace.load()
        .then(() => {
          if (!this.destroyed) this.setSize();
        })
        .catch(() => undefined);
    } catch {
      // The fallback font remains usable when a custom font URL is invalid.
    }
  }

  private setupEventListeners() {
    window.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('touchmove', this.handleTouchMove, { passive: true });

    const rect = this.container.nativeElement.getBoundingClientRect();
    this.mouse.x = this.cursor.x = rect.left + rect.width / 2;
    this.mouse.y = this.cursor.y = rect.top + rect.height / 2;

    this.resizeObserver = new ResizeObserver(() => this.setSize());
    this.resizeObserver.observe(this.container.nativeElement);
  }

  private readonly handleMouseMove = (event: MouseEvent) => {
    this.updateCursor(event.clientX, event.clientY);
  };

  private readonly handleTouchMove = (event: TouchEvent) => {
    const touch = event.touches.item(0);
    if (touch) this.updateCursor(touch.clientX, touch.clientY);
  };

  private updateCursor(x: number, y: number) {
    this.cursor.x = x;
    this.cursor.y = y;
  }

  private setSize() {
    const containerRect = this.container.nativeElement.getBoundingClientRect();
    const characterCount = Math.max(1, this.chars().length);
    const fontSize = Math.max(
      containerRect.width / (characterCount / 2),
      this.minFontSize(),
    );

    this.title.nativeElement.style.fontSize = `${fontSize}px`;
    this.title.nativeElement.style.fontFamily = this.fontFamily();
    this.title.nativeElement.style.color = this.textColor();
    this.title.nativeElement.style.transform = '';
    this.title.nativeElement.style.lineHeight = '1';

    if (this.scale()) {
      if (this.sizeRafId !== undefined) cancelAnimationFrame(this.sizeRafId);
      this.sizeRafId = requestAnimationFrame(() => {
        this.sizeRafId = undefined;
        const textRect = this.title.nativeElement.getBoundingClientRect();
        if (textRect.height > 0) {
          const scaleY = containerRect.height / textRect.height;
          this.title.nativeElement.style.transform = `scale(1, ${scaleY})`;
          this.title.nativeElement.style.lineHeight = `${scaleY}`;
        }
      });
    }
  }

  private animate = () => {
    this.mouse.x += (this.cursor.x - this.mouse.x) / 15;
    this.mouse.y += (this.cursor.y - this.mouse.y) / 15;

    const titleRect = this.title.nativeElement.getBoundingClientRect();
    const maxDist = Math.max(titleRect.width / 2, 1);
    const spans = this.charSpans.map(({ nativeElement }) => nativeElement);
    const rects = spans.map((span) => span.getBoundingClientRect());

    spans.forEach((span, index) => {
      const rect = rects[index];
      const charCenter = {
        x: rect.x + rect.width / 2,
        y: rect.y + rect.height / 2,
      };
      const d = Math.sqrt(
        (this.mouse.x - charCenter.x) ** 2 +
          (this.mouse.y - charCenter.y) ** 2,
      );

      const wdth = this.width()
        ? Math.floor(Math.min(200, Math.max(5, 205 - (200 * d) / maxDist)))
        : 100;
      const wght = this.weight()
        ? Math.floor(Math.min(900, Math.max(100, 1000 - (900 * d) / maxDist)))
        : 400;
      const ital = this.italic()
        ? Math.max(0, 1 - d / maxDist).toFixed(2)
        : '0';
      const alphaVal = this.alpha()
        ? Math.max(0, 1 - d / maxDist).toFixed(2)
        : '1';

      span.style.fontVariationSettings =
        `'wght' ${wght}, 'wdth' ${wdth}, 'ital' ${ital}`;
      span.style.opacity = alphaVal;
    });

    this.rafId = requestAnimationFrame(this.animate);
  };
}
