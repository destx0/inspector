import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InspenctorComponent } from './inspenctor.component';

describe('InspenctorComponent', () => {
  let component: InspenctorComponent;
  let fixture: ComponentFixture<InspenctorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InspenctorComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(InspenctorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
