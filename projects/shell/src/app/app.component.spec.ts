import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideState, provideStore } from '@ngrx/store';
import { provideInspectorCheckpoints } from 'inspector-ng';
import { workflowFeature } from '@inspector-ng/federation-demo-state';
import { AppComponent } from './app.component';

describe('AppComponent (shell)', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        provideStore(),
        provideState(workflowFeature),
        provideInspectorCheckpoints(),
      ],
    }).compileComponents();
  });

  it('creates the shell with inspector overlay', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(fixture.componentInstance).toBeTruthy();
    expect(el.querySelector('inspector-overlay')).toBeTruthy();
  });
});
