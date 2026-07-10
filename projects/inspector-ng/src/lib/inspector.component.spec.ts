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

  it("starts with overlays inactive", () => {
    expect(component.toolMode()).toBe("none");
    expect(component.showTypography()).toBeFalse();
  });

  it("renders secondary tools inside the compact rail reveal", () => {
    const root = fixture.nativeElement as HTMLElement;
    const reveal = root.querySelector(".inspector-toolbar__reveal");

    expect(reveal).not.toBeNull();
    expect(reveal?.querySelector('[aria-label="Typography overlay"]')).not.toBeNull();
    expect(reveal?.querySelector('[aria-label="Guides mode"]')).not.toBeNull();
    expect(reveal?.querySelector('[aria-label="Guide options"]')).not.toBeNull();
  });

  it("migrates legacy state with typography inactive", () => {
    window.localStorage.setItem(
      "inspector-state",
      JSON.stringify({
        version: 1,
        enabled: true,
        toolMode: "guides",
        guideOrientation: "horizontal",
        guides: [],
        showTypography: true,
      }),
    );

    const migrationFixture = TestBed.createComponent(inspectorComponent);
    migrationFixture.componentRef.setInput("persistOnReload", true);
    migrationFixture.detectChanges();

    expect(migrationFixture.componentInstance.toolMode()).toBe("guides");
    expect(migrationFixture.componentInstance.guideOrientation()).toBe(
      "horizontal",
    );
    expect(migrationFixture.componentInstance.showTypography()).toBeFalse();

    migrationFixture.destroy();
    window.localStorage.removeItem("inspector-state");
  });
});
