import { ComponentFixture, TestBed } from "@angular/core/testing";

import { inspectorComponent } from "./inspector.component";

describe("inspectorComponent", () => {
  let component: inspectorComponent;
  let fixture: ComponentFixture<inspectorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [inspectorComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(inspectorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
