import { Component, ElementRef, OnInit, OnDestroy, ViewChild, AfterViewInit, input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'text-pressure',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div #container class="container">
      <h1 #title class="title" [class.flex]="flex()" [class.stroke]="stroke()">
        @for (char of chars; track $index) {
          <span #charSpan [attr.data-char]="char">{{ char }}</span>
        }
      </h1>
    </div>
  `,
  styles: [`
    .container {
      position: relative;
      width: 100%;
      height: 100%;
      background: transparent;
      overflow: hidden;
    }
    .title {
      text-transform: uppercase;
      margin: 0;
      text-align: left;
      user-select: none;
      white-space: nowrap;
      font-weight: 100;
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
    }
  `]
})
export class TextPressureComponent implements OnInit, AfterViewInit, OnDestroy {
  text = input('Compressa');
  fontFamily = input('Compressa VF');
  fontUrl = input('https://res.cloudinary.com/dr6lvwubh/raw/upload/v1529908256/CompressaPRO-GX.woff2');
  width = input(true);
  weight = input(true);
  italic = input(true);
  alpha = input(false);
  flex = input(true);
  stroke = input(false);
  scale = input(false);
  textColor = input('#FFFFFF');
  strokeColor = input('#FF0000');
  minFontSize = input(24);

  @ViewChild('container') container!: ElementRef<HTMLDivElement>;
  @ViewChild('title') title!: ElementRef<HTMLHeadingElement>;
  @ViewChild('charSpan', { read: ElementRef }) charSpans!: ElementRef<HTMLSpanElement>[];

  chars: string[] = [];
  private mouse = { x: 0, y: 0 };
  private cursor = { x: 0, y: 0 };
  private rafId?: number;
  private resizeObserver?: ResizeObserver;

  ngOnInit() {
    this.chars = this.text().split('');
    this.injectFont();
  }

  ngAfterViewInit() {
    this.setupEventListeners();
    this.setSize();
    this.animate();
  }

  ngOnDestroy() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.resizeObserver?.disconnect();
  }

  private injectFont() {
    const style = document.createElement('style');
    style.textContent = `
      @font-face {
        font-family: '${this.fontFamily()}';
        src: url('${this.fontUrl()}');
        font-style: normal;
      }
      .stroke span::after {
        -webkit-text-stroke-color: ${this.strokeColor()};
      }
    `;
    document.head.appendChild(style);
  }

  private setupEventListeners() {
    const handleMove = (x: number, y: number) => {
      this.cursor.x = x;
      this.cursor.y = y;
    };

    window.addEventListener('mousemove', (e) => handleMove(e.clientX, e.clientY));
    window.addEventListener('touchmove', (e) => handleMove(e.touches[0].clientX, e.touches[0].clientY), { passive: true });

    const rect = this.container.nativeElement.getBoundingClientRect();
    this.mouse.x = this.cursor.x = rect.left + rect.width / 2;
    this.mouse.y = this.cursor.y = rect.top + rect.height / 2;

    this.resizeObserver = new ResizeObserver(() => this.setSize());
    this.resizeObserver.observe(this.container.nativeElement);
  }

  private setSize() {
    const containerRect = this.container.nativeElement.getBoundingClientRect();
    let fontSize = Math.max(containerRect.width / (this.chars.length / 2), this.minFontSize());
    let scaleY = 1;
    let lineHeight = 1;

    this.title.nativeElement.style.fontSize = `${fontSize}px`;
    this.title.nativeElement.style.fontFamily = this.fontFamily();
    this.title.nativeElement.style.color = this.textColor();

    if (this.scale()) {
      requestAnimationFrame(() => {
        const textRect = this.title.nativeElement.getBoundingClientRect();
        if (textRect.height > 0) {
          scaleY = containerRect.height / textRect.height;
          lineHeight = scaleY;
          this.title.nativeElement.style.transform = `scale(1, ${scaleY})`;
          this.title.nativeElement.style.lineHeight = `${lineHeight}`;
        }
      });
    }
  }

  private animate = () => {
    this.mouse.x += (this.cursor.x - this.mouse.x) / 15;
    this.mouse.y += (this.cursor.y - this.mouse.y) / 15;

    const titleRect = this.title.nativeElement.getBoundingClientRect();
    const maxDist = titleRect.width / 2;

    this.title.nativeElement.querySelectorAll('span').forEach((span: HTMLSpanElement) => {
      const rect = span.getBoundingClientRect();
      const charCenter = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
      const d = Math.sqrt((this.mouse.x - charCenter.x) ** 2 + (this.mouse.y - charCenter.y) ** 2);

      const wdth = this.width() ? Math.floor(Math.max(5, 200 - Math.abs((200 * d) / maxDist) + 5)) : 100;
      const wght = this.weight() ? Math.floor(Math.max(100, 900 - Math.abs((900 * d) / maxDist) + 100)) : 400;
      const ital = this.italic() ? Math.max(0, 1 - Math.abs((1 * d) / maxDist) + 0).toFixed(2) : '0';
      const alphaVal = this.alpha() ? Math.max(0, 1 - Math.abs((1 * d) / maxDist) + 0).toFixed(2) : '1';

      span.style.fontVariationSettings = `'wght' ${wght}, 'wdth' ${wdth}, 'ital' ${ital}`;
      if (this.alpha()) span.style.opacity = alphaVal;
    });

    this.rafId = requestAnimationFrame(this.animate);
  };
}
