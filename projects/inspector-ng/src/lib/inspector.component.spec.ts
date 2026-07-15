import { ComponentFixture, TestBed } from "@angular/core/testing";
import { Action, provideStore } from "@ngrx/store";

import {
  INSPECTOR_CHECKPOINT_REPOSITORY,
  InspectorCheckpointRecord,
  InspectorCheckpointRepository,
  InspectorCheckpointService,
  provideInspectorCheckpoints,
} from "./checkpoints";
import { inspectorComponent } from "./inspector.component";

class MemoryRepository extends InspectorCheckpointRepository {
  records: InspectorCheckpointRecord[] = [];
  async list() {
    return structuredClone(this.records);
  }
  async put(checkpoint: InspectorCheckpointRecord) {
    this.records = [
      checkpoint,
      ...this.records.filter(({ id }) => id !== checkpoint.id),
    ];
  }
  async delete(id: string) {
    this.records = this.records.filter((checkpoint) => checkpoint.id !== id);
  }
}

function reducer(state = { value: 1 }, _action: Action) {
  return state;
}

function keydown(key: string, options: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true,
    ...options,
  });
  window.dispatchEvent(event);
  return event;
}

function keyup(key: string, options: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent("keyup", {
    key,
    bubbles: true,
    cancelable: true,
    ...options,
  });
  window.dispatchEvent(event);
  return event;
}

describe("inspectorComponent without checkpoints", () => {
  it("does not render checkpoint controls or steal Ctrl+Shift+P", async () => {
    await TestBed.configureTestingModule({
      imports: [inspectorComponent],
    }).compileComponents();
    const fixture = TestBed.createComponent(inspectorComponent);
    fixture.detectChanges();

    const event = keydown("p", { ctrlKey: true, shiftKey: true });
    fixture.detectChanges();
    expect(event.defaultPrevented).toBeFalse();
    expect(
      fixture.nativeElement.querySelector('[aria-label="Save checkpoint"]'),
    ).toBeNull();
    expect(fixture.nativeElement.querySelector("dialog")).toBeNull();
  });
});

describe("inspectorComponent checkpoint command bar", () => {
  let fixture: ComponentFixture<inspectorComponent>;
  let component: inspectorComponent;
  let repository: MemoryRepository;
  let service: InspectorCheckpointService;

  const records: InspectorCheckpointRecord[] = [
    {
      version: 1,
      id: "new",
      name: "Summary ready",
      route: "/summary",
      createdAt: "2026-01-02T00:00:00.000Z",
      state: { test: { value: 2 } },
    },
    {
      version: 1,
      id: "old",
      name: "Workflow start",
      route: "/workflow",
      createdAt: "2026-01-01T00:00:00.000Z",
      state: { test: { value: 1 } },
    },
  ];

  beforeEach(async () => {
    repository = new MemoryRepository();
    repository.records = structuredClone(records);
    await TestBed.configureTestingModule({
      imports: [inspectorComponent],
      providers: [
        provideStore({ test: reducer }),
        provideInspectorCheckpoints(),
        { provide: INSPECTOR_CHECKPOINT_REPOSITORY, useValue: repository },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(inspectorComponent);
    component = fixture.componentInstance;
    service = TestBed.inject(InspectorCheckpointService);
    fixture.detectChanges();
  });

  async function openCommandBar(metaKey = false) {
    const event = keydown("p", { ctrlKey: !metaKey, metaKey, shiftKey: true });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return event;
  }

  it("opens with Ctrl/Cmd+Shift+P, focuses search, and loads results", async () => {
    expect((await openCommandBar()).defaultPrevented).toBeTrue();
    expect(component.commandBarOpen()).toBeTrue();
    expect(document.activeElement?.id).toBe("inspector-checkpoint-search");
    expect((document.activeElement as HTMLInputElement).placeholder).toBe(
      "inspector-ng…",
    );
    const petSwitcher = fixture.nativeElement.querySelector(
      ".inspector-command__pet-switcher",
    );
    expect(petSwitcher).not.toBeNull();
    expect(petSwitcher.getAttribute("aria-label")).toBe(
      "Change pet. Current pet: Measuring caterpillar",
    );
    const petSprite = petSwitcher.querySelector(
      ".inspector-command__pet-sprite",
    ) as HTMLImageElement;
    expect(petSprite).not.toBeNull();
    expect(petSprite.getAttribute("aria-hidden")).toBe("true");
    expect(
      fixture.nativeElement.querySelectorAll(".inspector-command-row").length,
    ).toBe(2);
    expect(
      fixture.nativeElement.querySelector(".inspector-command__footer"),
    ).toBeNull();
    expect(
      fixture.nativeElement.querySelector(".inspector-command-row__activity")
        ?.textContent,
    ).toContain("Saved");

    component.closeCheckpointCommandBar();
    fixture.detectChanges();
    expect((await openCommandBar(true)).defaultPrevented).toBeTrue();
  });

  it("opens while an application input is focused and while the inspector is disabled", async () => {
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();
    component.disableInspector();
    await openCommandBar();

    expect(component.enabled()).toBeFalse();
    expect(component.commandBarOpen()).toBeTrue();
    input.remove();
  });

  it("cycles through the generated pets and returns focus to search", async () => {
    await openCommandBar();
    const petSwitcher = fixture.nativeElement.querySelector(
      ".inspector-command__pet-switcher",
    ) as HTMLButtonElement;
    const sprite = petSwitcher.querySelector(
      ".inspector-command__pet-sprite",
    ) as HTMLImageElement;
    const search = fixture.nativeElement.querySelector(
      "#inspector-checkpoint-search",
    ) as HTMLInputElement;
    const firstSpriteSrc = sprite.src;

    for (const name of [
      "Pixel cat",
      "Corgi",
      "Bunny",
      "Fox",
      "Panda",
      "Frog",
      "Axolotl",
      "Raccoon",
      "Duckling",
      "Turtle",
      "Hedgehog",
      "Red panda",
      "Penguin",
      "Otter",
      "Capybara",
      "Shiba inu",
      "Mouse",
      "Hamster",
      "Koala",
      "Sloth",
      "Baby seal",
      "Octopus",
      "Crab",
      "Bumblebee",
      "Moth",
      "Tiny bat",
      "Owl",
      "Parrot",
      "Chameleon",
      "Gecko",
      "Snail",
      "Baby triceratops",
      "Alpaca",
    ]) {
      petSwitcher.click();
      fixture.detectChanges();
      expect(petSwitcher.getAttribute("aria-label")).toBe(
        `Change pet. Current pet: ${name}`,
      );
      expect(document.activeElement).toBe(search);
    }

    expect(sprite.src).not.toBe(firstSpriteSrc);
    petSwitcher.click();
    fixture.detectChanges();
    expect(petSwitcher.getAttribute("aria-label")).toBe(
      "Change pet. Current pet: Measuring caterpillar",
    );
    expect(sprite.src).toBe(firstSpriteSrc);
  });

  it("filters names and clamps arrow navigation", async () => {
    await openCommandBar();
    const input = fixture.nativeElement.querySelector(
      "#inspector-checkpoint-search",
    ) as HTMLInputElement;
    input.value = "work";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    fixture.detectChanges();

    expect(component.filteredCheckpoints().map(({ id }) => id)).toEqual([
      "old",
    ]);
    keydown("ArrowDown");
    keydown("ArrowDown");
    expect(component.activeCommandIndex()).toBe(0);
  });

  it("hides route metadata when it duplicates the checkpoint name", () => {
    expect(
      component.shouldShowCheckpointRoute({ ...records[0], name: "/summary" }),
    ).toBeFalse();
    expect(
      component.shouldShowCheckpointRoute({ ...records[0], name: "SUMMARY/" }),
    ).toBeFalse();
    expect(component.shouldShowCheckpointRoute(records[0])).toBeTrue();
  });

  it("searches Inspector actions after checkpoint results and runs the active match", async () => {
    await openCommandBar();
    const orderedResults = fixture.nativeElement.querySelectorAll(
      "[data-command-index]",
    );
    expect(orderedResults.length).toBe(8);
    expect(orderedResults[0].id).toBe("inspector-checkpoint-new");
    expect(orderedResults[1].id).toBe("inspector-checkpoint-old");
    expect(orderedResults[2].id).toBe("inspector-action-save");

    const input = fixture.nativeElement.querySelector(
      "#inspector-checkpoint-search",
    ) as HTMLInputElement;
    input.value = "typography";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    fixture.detectChanges();

    expect(component.filteredCheckpoints()).toEqual([]);
    expect(component.filteredInspectorActions().map(({ id }) => id)).toEqual([
      "type",
    ]);
    expect(component.activeCommandResultId()).toBe("inspector-action-type");

    keydown("Enter");
    fixture.detectChanges();
    expect(component.showTypography()).toBeTrue();
    expect(component.commandBarOpen()).toBeFalse();
  });

  it("uses left and right arrows within the horizontal action strip", async () => {
    await openCommandBar();
    expect(component.activeCommandResultId()).toBe("inspector-checkpoint-new");
    expect(
      fixture.nativeElement.querySelector(".inspector-command-row.is-active")
        ?.id,
    ).toBe("inspector-checkpoint-new");

    keydown("ArrowRight");
    fixture.detectChanges();
    expect(component.activeCommandResultId()).toBe("inspector-action-save");
    expect(
      fixture.nativeElement.querySelector(
        ".inspector-command-action.is-selected",
      )?.id,
    ).toBe("inspector-action-save");

    keydown("ArrowRight");
    expect(component.activeCommandResultId()).toBe("inspector-action-select");
    keydown("ArrowRight");
    expect(component.activeCommandResultId()).toBe("inspector-action-type");
    keydown("ArrowLeft");
    expect(component.activeCommandResultId()).toBe("inspector-action-select");

    keydown("Enter");
    fixture.detectChanges();
    expect(component.toolMode()).toBe("select");
    expect(component.commandBarOpen()).toBeFalse();
  });

  it("restores the active checkpoint with Enter and announces success", async () => {
    await openCommandBar();
    const restore = spyOn(service, "restore").and.resolveTo(true);
    keydown("Enter");
    await Promise.resolve();
    fixture.detectChanges();

    expect(restore).toHaveBeenCalledWith("new");
    expect(component.commandBarOpen()).toBeFalse();
    expect(fixture.nativeElement.textContent).toContain(
      "Restored “Summary ready”.",
    );
  });

  it("keeps rename and delete as explicit actions instead of keyboard shortcuts", async () => {
    await openCommandBar();
    expect(keydown("F2").defaultPrevented).toBeFalse();
    fixture.detectChanges();
    expect(component.editingCheckpointId()).toBeNull();

    (
      fixture.nativeElement.querySelector(
        '[aria-label="Rename Summary ready"]',
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    expect(component.editingCheckpointId()).toBe("new");

    keydown("Escape");
    expect(keydown("Delete").defaultPrevented).toBeFalse();
    fixture.detectChanges();
    expect(component.deletingCheckpointId()).toBeNull();

    (
      fixture.nativeElement.querySelector(
        '[aria-label="Delete Summary ready"]',
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    expect(component.deletingCheckpointId()).toBe("new");
    expect(fixture.nativeElement.textContent).toContain(
      "Delete “Summary ready”?",
    );
  });

  it("does not register the removed global Inspector shortcuts", () => {
    for (const key of ["m", "s", "g", "h", "v", "Delete"]) {
      expect(keydown(key).defaultPrevented).toBeFalse();
    }
    expect(keydown("z", { ctrlKey: true }).defaultPrevented).toBeFalse();
    expect(component.enabled()).toBeTrue();
    expect(component.toolMode()).toBe("none");
    expect(component.altPressed()).toBeFalse();
  });

  it("measures the distance from the selected element while Alt is held", () => {
    const selected = document.createElement("div");
    const hovered = document.createElement("div");
    document.body.append(selected, hovered);
    spyOn(selected, "getBoundingClientRect").and.returnValue(
      new DOMRect(10, 20, 30, 40),
    );
    spyOn(hovered, "getBoundingClientRect").and.returnValue(
      new DOMRect(70, 80, 20, 20),
    );
    spyOn(document, "elementsFromPoint").and.returnValues(
      [selected],
      [hovered],
    );
    component.setToolMode("select");

    component.handleClick(new MouseEvent("click", { clientX: 15, clientY: 25 }));
    component.handlePointerMove(
      new PointerEvent("pointermove", { clientX: 75, clientY: 85 }),
    );
    expect(component.distanceOverlay()).toBeNull();

    expect(keydown("Alt").defaultPrevented).toBeFalse();
    expect(component.altPressed()).toBeTrue();
    expect(component.distanceOverlay()?.horizontal?.value).toBe(30);
    expect(component.distanceOverlay()?.vertical?.value).toBe(20);

    keyup("Alt");
    expect(component.altPressed()).toBeFalse();
    expect(component.distanceOverlay()).toBeNull();
    selected.remove();
    hovered.remove();
  });

  it("selects the minimum common parent with Ctrl+click in selection mode", () => {
    const parent = document.createElement("section");
    const first = document.createElement("button");
    const second = document.createElement("button");
    parent.append(first, second);
    document.body.appendChild(parent);
    spyOn(parent, "getBoundingClientRect").and.returnValue(
      new DOMRect(10, 10, 100, 50),
    );
    spyOn(first, "getBoundingClientRect").and.returnValue(
      new DOMRect(10, 10, 40, 50),
    );
    spyOn(second, "getBoundingClientRect").and.returnValue(
      new DOMRect(70, 10, 40, 50),
    );
    spyOn(document, "elementsFromPoint").and.returnValues([first], [second]);
    component.setToolMode("select");

    component.handleClick(new MouseEvent("click", { clientX: 20, clientY: 20 }));
    component.handleClick(
      new MouseEvent("click", { clientX: 80, clientY: 20, ctrlKey: true }),
    );

    expect(component.selectedMeasurement()?.label).toBe("section");
    parent.remove();
  });

  it("does not steal Escape when the Inspector canvas is already empty", () => {
    expect(keydown("Escape").defaultPrevented).toBeFalse();
  });

  it("clears selections, guides, and transient overlays with Escape", () => {
    const guide = {
      id: "guide-1",
      orientation: "vertical" as const,
      position: 120,
    };
    component.guides.set([guide]);
    component.selectedGuideId.set(guide.id);
    component.hoverRect.set({ left: 10, top: 20, width: 30, height: 40 });
    component.guidePreview.set(guide);
    component.altPressed.set(true);
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector(
        '[aria-label="Vertical guide at 120 pixels"]',
      ),
    ).not.toBeNull();

    expect(keydown("Escape").defaultPrevented).toBeTrue();
    expect(component.guides()).toEqual([]);
    expect(component.selectedGuideId()).toBeNull();
    expect(component.hoverRect()).toBeNull();
    expect(component.guidePreview()).toBeNull();
    expect(component.altPressed()).toBeFalse();
  });

  it("saves immediately from the command palette and shows a status toast", async () => {
    const saved = { ...records[0], id: "saved", name: "/summary" };
    const save = spyOn(service, "save").and.resolveTo(saved);
    (
      fixture.nativeElement.querySelector(
        '[aria-label="Save checkpoint"]',
      ) as HTMLButtonElement
    ).click();
    await Promise.resolve();
    fixture.detectChanges();

    expect(save).toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain("Saved “/summary”.");
  });

  it("announces save failures as alerts", async () => {
    const save = spyOn(service, "save").and.callFake(async () => {
      service.error.set(
        "Browser storage is full. Delete old checkpoints, then try saving again.",
      );
      return null;
    });
    (
      fixture.nativeElement.querySelector(
        '[aria-label="Save checkpoint"]',
      ) as HTMLButtonElement
    ).click();
    await Promise.resolve();
    fixture.detectChanges();

    expect(save).toHaveBeenCalled();
    const alert = fixture.nativeElement.querySelector(
      '.inspector-checkpoint-toast[role="alert"]',
    );
    expect(alert?.textContent).toContain("Browser storage is full");
  });
});
