import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";

import { InspectorCheckpointRegistry } from "./checkpoints";
import { inspectorComponent } from "./inspector.component";

describe("inspectorComponent", () => {
  let component: inspectorComponent;
  let fixture: ComponentFixture<inspectorComponent>;
  let checkpointRegistry: InspectorCheckpointRegistry;

  beforeEach(async () => {
    window.localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [inspectorComponent],
      providers: [provideRouter([]), InspectorCheckpointRegistry],
    }).compileComponents();

    fixture = TestBed.createComponent(inspectorComponent);
    component = fixture.componentInstance;
    checkpointRegistry = TestBed.inject(InspectorCheckpointRegistry);
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  it("starts with overlays inactive", () => {
    expect(component.toolMode()).toBe("none");
    expect(component.showTypography()).toBeFalse();
  });

  it("renders direct secondary tools without More or guide options buttons", () => {
    const root = fixture.nativeElement as HTMLElement;
    const reveal = root.querySelector(".inspector-toolbar__reveal");

    expect(reveal).not.toBeNull();
    expect(reveal?.querySelector('[aria-label="Typography overlay"]')).not.toBeNull();
    expect(reveal?.querySelector('[aria-label="Vertical guides"]')).not.toBeNull();
    expect(reveal?.querySelector('[aria-label="Horizontal guides"]')).not.toBeNull();
    expect(root.querySelector('[aria-label^="More tools"]')).toBeNull();
    expect(root.querySelector('[aria-label="Guide options"]')).toBeNull();
  });

  it("activates vertical and horizontal guide modes independently", () => {
    const root = fixture.nativeElement as HTMLElement;
    const vertical = root.querySelector('[aria-label="Vertical guides"]') as HTMLButtonElement;
    const horizontal = root.querySelector('[aria-label="Horizontal guides"]') as HTMLButtonElement;

    vertical.click();
    fixture.detectChanges();
    expect(component.toolMode()).toBe("guides");
    expect(component.guideOrientation()).toBe("vertical");
    expect(vertical.classList).toContain("is-active");

    horizontal.click();
    fixture.detectChanges();
    expect(component.toolMode()).toBe("guides");
    expect(component.guideOrientation()).toBe("horizontal");
    expect(horizontal.classList).toContain("is-active");
  });

  it("renders the short checkpoint empty state without storage bytes", () => {
    component.toggleCheckpoints();
    fixture.detectChanges();

    const panel = fixture.nativeElement.querySelector(".inspector-checkpoint-panel") as HTMLElement;
    expect(panel.textContent).toContain("Checkpoints");
    expect(panel.textContent).toContain("Save current");
    expect(panel.textContent).toContain("No checkpoints yet.");
    expect(panel.textContent).not.toMatch(/\b(?:B|KB)\b/);
  });

  it("renders each checkpoint as only a name and Restore/Delete actions", async () => {
    await checkpointRegistry.save("Summary ready");
    component.toggleCheckpoints();
    fixture.detectChanges();

    const row = fixture.nativeElement.querySelector(".inspector-checkpoint-item") as HTMLElement;
    const main = row.querySelector(".inspector-checkpoint-item__main")!;
    expect(main.children.length).toBe(1);
    expect(main.textContent?.trim()).toBe("Summary ready");
    expect(row.textContent).not.toContain("1970");
    expect(row.textContent).not.toContain(" B");
    expect(Array.from(row.querySelectorAll("button")).map((button) => button.textContent?.trim()))
      .toEqual(["Summary ready", "Restore", "Delete"]);
  });

  it("keeps rename, restore, delete, busy, error, and warning behavior", async () => {
    const checkpoint = await checkpointRegistry.save("Summary ready");
    const restore = spyOn(checkpointRegistry, "restore").and.resolveTo(true);
    const remove = spyOn(checkpointRegistry, "delete");
    component.toggleCheckpoints();
    fixture.detectChanges();

    (fixture.nativeElement.querySelector(".inspector-checkpoint-name") as HTMLButtonElement).click();
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector(".inspector-checkpoint-name-input") as HTMLInputElement;
    input.value = "Renamed";
    input.dispatchEvent(new Event("blur"));
    expect(checkpointRegistry.checkpoints()[0].name).toBe("Renamed");

    fixture.detectChanges();
    const actions = fixture.nativeElement.querySelectorAll(".inspector-checkpoint-actions button");
    actions[0].click();
    actions[1].click();
    expect(restore).toHaveBeenCalledWith(checkpoint!.id);
    expect(remove).toHaveBeenCalledWith(checkpoint!.id);

    checkpointRegistry.isBusy.set(true);
    checkpointRegistry.error.set("Unable to save checkpoint.");
    checkpointRegistry.warning.set("Storage was full.");
    fixture.detectChanges();
    expect(Array.from(fixture.nativeElement.querySelectorAll("button:disabled")).length).toBe(3);
    expect(fixture.nativeElement.textContent).toContain("Unable to save checkpoint.");
    expect(fixture.nativeElement.textContent).toContain("Storage was full.");
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
