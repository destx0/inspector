import { ComponentFixture, TestBed } from "@angular/core/testing";
import { Router } from "@angular/router";
import { Action, Store, provideStore } from "@ngrx/store";

import {
  INSPECTOR_CHECKPOINT_REPOSITORY,
  InspectorCheckpointRecord,
  InspectorCheckpointRepository,
  InspectorCheckpointService,
  provideInspectorCheckpoints,
  resolveRouteQuery,
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
  it("does not render checkpoint controls or steal Alt+P", async () => {
    await TestBed.configureTestingModule({
      imports: [inspectorComponent],
    }).compileComponents();
    const fixture = TestBed.createComponent(inspectorComponent);
    fixture.detectChanges();

    const event = keydown("p", { altKey: true });
    fixture.detectChanges();
    expect(event.defaultPrevented).toBeFalse();
    expect(
      fixture.nativeElement.querySelector('[aria-label="Save checkpoint"]'),
    ).toBeNull();
    expect(fixture.nativeElement.querySelector("dialog")).toBeNull();
  });

  it("toggles Inspect mode with Alt+I without checkpoint support", async () => {
    await TestBed.configureTestingModule({
      imports: [inspectorComponent],
    }).compileComponents();
    const fixture = TestBed.createComponent(inspectorComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(keydown("i", { altKey: true }).defaultPrevented).toBeTrue();
    expect(component.toolMode()).toBe("select");
    expect(keydown("i", { altKey: true }).defaultPrevented).toBeTrue();
    expect(component.toolMode()).toBe("none");
    expect(keydown("s", { altKey: true }).defaultPrevented).toBeFalse();
  });
});

describe("inspectorComponent checkpoint command bar", () => {
  let fixture: ComponentFixture<inspectorComponent>;
  let component: inspectorComponent;
  let repository: MemoryRepository;
  let service: InspectorCheckpointService;
  let router: jasmine.SpyObj<Router>;

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
    router = jasmine.createSpyObj<Router>("Router", ["navigateByUrl"], { url: "/" });
    router.navigateByUrl.and.resolveTo(true);
    await TestBed.configureTestingModule({
      imports: [inspectorComponent],
      providers: [
        provideStore({ test: reducer }),
        provideInspectorCheckpoints(),
        { provide: INSPECTOR_CHECKPOINT_REPOSITORY, useValue: repository },
        { provide: Router, useValue: router },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(inspectorComponent);
    component = fixture.componentInstance;
    service = TestBed.inject(InspectorCheckpointService);
    fixture.detectChanges();
  });

  async function openCommandBar() {
    const event = keydown("p", { altKey: true });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return event;
  }

  it("opens with Alt+P, focuses search, and loads results", async () => {
    spyOn(Math, "random").and.returnValue(0);
    expect(keydown("p", { ctrlKey: true, shiftKey: true }).defaultPrevented).toBeFalse();
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
    expect(getComputedStyle(petSprite).animationName).toContain(
      "inspector-pet-cycle",
    );
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
    expect((await openCommandBar()).defaultPrevented).toBeTrue();
    expect(petSwitcher.getAttribute("aria-label")).toBe(
      "Change pet. Current pet: Pixel cat",
    );
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

  it("randomizes pets without immediate repeats and returns focus to search", async () => {
    spyOn(Math, "random").and.returnValue(0);
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

  it("uses a fresh random pet on every open and click", async () => {
    spyOn(Math, "random").and.returnValue(0.5);

    await openCommandBar();
    expect(component.petIndex()).toBe(17);

    component.cyclePet();
    expect(component.petIndex()).toBe(0);

    component.closeCheckpointCommandBar();
    await openCommandBar();
    expect(component.petIndex()).toBe(17);
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

  it("hides route metadata and truncates long names from the start", async () => {
    await openCommandBar();

    const activeContent = fixture.nativeElement.querySelector(
      "#inspector-checkpoint-new .inspector-command-row__content",
    ) as HTMLElement;
    const activeName = activeContent.querySelector(
      ".inspector-command-row__name",
    ) as HTMLElement;
    const activeActivity = activeContent.querySelector(
      ".inspector-command-row__activity",
    ) as HTMLElement;
    const activeActions = fixture.nativeElement.querySelector(
      "#inspector-checkpoint-new .inspector-command-row__actions",
    ) as HTMLElement;
    const nameDirection = activeName.querySelector("bdi") as HTMLElement;
    const nameStyle = getComputedStyle(activeName);

    expect(
      fixture.nativeElement.querySelector(".inspector-command-row__route"),
    ).toBeNull();
    expect(nameStyle.direction).toBe("rtl");
    expect(nameStyle.textOverflow).toBe("ellipsis");
    expect(nameDirection.dir).toBe("ltr");
    expect(activeName.nextElementSibling).toBe(activeActivity);
    expect(getComputedStyle(activeActions).opacity).toBe("1");
    expect(getComputedStyle(activeActions).pointerEvents).toBe("auto");
    expect(parseFloat(getComputedStyle(activeActivity).fontSize)).toBeLessThan(
      parseFloat(nameStyle.fontSize),
    );
  });

  it("searches Inspector actions after checkpoint results and runs the active match", async () => {
    await openCommandBar();
    const orderedResults = fixture.nativeElement.querySelectorAll(
      "[data-command-index]",
    );
    expect(orderedResults.length).toBe(7);
    expect(orderedResults[0].id).toBe("inspector-checkpoint-new");
    expect(orderedResults[1].id).toBe("inspector-checkpoint-old");
    expect(orderedResults[2].id).toBe("inspector-action-save");
    expect(orderedResults[6].id).toBe("inspector-action-select");

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

    keydown("ArrowLeft");
    fixture.detectChanges();
    expect(component.activeCommandResultId()).toBe("inspector-action-select");
    expect(
      fixture.nativeElement.querySelector(
        ".inspector-command-action.is-selected",
      )?.id,
    ).toBe("inspector-action-select");

    keydown("ArrowDown");
    expect(component.activeCommandResultId()).toBe("inspector-checkpoint-new");
    keydown("ArrowLeft");
    expect(component.activeCommandResultId()).toBe("inspector-action-select");
    keydown("ArrowLeft");
    expect(component.activeCommandResultId()).toBe("inspector-action-horizontal");
    keydown("ArrowRight");
    expect(component.activeCommandResultId()).toBe("inspector-action-select");

    keydown("Enter");
    fixture.detectChanges();
    expect(component.toolMode()).toBe("select");
    expect(component.commandBarOpen()).toBeFalse();
  });

  it("moves from the first checkpoint to the action strip with ArrowUp", async () => {
    await openCommandBar();
    expect(component.activeCommandResultId()).toBe("inspector-checkpoint-new");

    keydown("ArrowUp");

    expect(component.activeCommandResultId()).toBe("inspector-action-select");
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
    const toast = fixture.nativeElement.querySelector(
      ".inspector-checkpoint-toast",
    ) as HTMLElement;
    const toastStyle = getComputedStyle(toast);
    expect(toastStyle.display).toBe("flex");
    expect(toastStyle.borderRadius).toBe("6px");
    expect(getComputedStyle(toast, "::before").width).toBe("5px");
  });

  it("navigates to the active checkpoint with Shift+Enter, keeping state", async () => {
    await openCommandBar();
    const store = TestBed.inject(Store);
    const dispatch = spyOn(store, "dispatch").and.callThrough();
    const restore = spyOn(service, "restore").and.resolveTo(true);

    expect(keydown("Enter", { shiftKey: true }).defaultPrevented).toBeTrue();
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();

    expect(router.navigateByUrl).toHaveBeenCalledWith("/summary");
    expect(restore).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
    expect(component.commandBarOpen()).toBeFalse();
    expect(fixture.nativeElement.textContent).toContain(
      "Navigated to “/summary” — state unchanged.",
    );
  });

  it("navigates with Shift+click on a checkpoint row without restoring", async () => {
    await openCommandBar();
    const store = TestBed.inject(Store);
    const dispatch = spyOn(store, "dispatch").and.callThrough();

    const row = fixture.nativeElement.querySelector(
      "#inspector-checkpoint-old",
    ) as HTMLElement;
    row.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true, shiftKey: true }),
    );
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();

    expect(router.navigateByUrl).toHaveBeenCalledWith("/workflow");
    expect(dispatch).not.toHaveBeenCalled();
    expect(component.commandBarOpen()).toBeFalse();
  });

  it("navigates to a typed relative route with Enter, keeping state", async () => {
    await openCommandBar();
    const store = TestBed.inject(Store);
    const dispatch = spyOn(store, "dispatch").and.callThrough();
    const input = fixture.nativeElement.querySelector(
      "#inspector-checkpoint-search",
    ) as HTMLInputElement;
    input.value = "../next-page";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    fixture.detectChanges();

    const expected = resolveRouteQuery("../next-page", window.location.pathname)!;
    expect(expected).toBeTruthy();
    expect(component.navigateTarget()).toBe(expected);
    expect(component.filteredCheckpoints()).toEqual([]);
    expect(component.activeCommandResultId()).toBe("inspector-navigate");
    const navigateRow = fixture.nativeElement.querySelector(
      "#inspector-navigate",
    ) as HTMLElement;
    expect(navigateRow).not.toBeNull();
    expect(navigateRow.textContent).toContain(`Go to ${expected}`);
    expect(navigateRow.textContent).toContain("navigate · keeps state");

    keydown("Enter");
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();

    expect(router.navigateByUrl).toHaveBeenCalledWith(expected);
    expect(dispatch).not.toHaveBeenCalled();
    expect(component.commandBarOpen()).toBeFalse();
    expect(fixture.nativeElement.textContent).toContain(
      `Navigated to “${expected}” — state unchanged.`,
    );
  });

  it("threads arrow navigation between matching checkpoints and the navigate row", async () => {
    repository.records = [
      ...structuredClone(records),
      {
        version: 1,
        id: "route",
        name: "/summary",
        route: "/summary",
        createdAt: "2026-01-03T00:00:00.000Z",
        state: { test: { value: 3 } },
      },
    ];
    await openCommandBar();
    const input = fixture.nativeElement.querySelector(
      "#inspector-checkpoint-search",
    ) as HTMLInputElement;
    input.value = "/sum";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    fixture.detectChanges();

    expect(component.filteredCheckpoints().map(({ id }) => id)).toEqual(["route"]);
    expect(component.navigateTarget()).toBe("/sum");
    expect(component.activeCommandResultId()).toBe("inspector-checkpoint-route");

    keydown("ArrowDown");
    expect(component.activeCommandResultId()).toBe("inspector-navigate");
    keydown("ArrowDown");
    expect(component.activeCommandResultId()).toBe("inspector-navigate");
    keydown("ArrowUp");
    expect(component.activeCommandResultId()).toBe("inspector-checkpoint-route");
    keydown("ArrowUp");
    expect(component.activeCommandResultId()).toBe("inspector-navigate");
  });

  it("renames with F2 and deletes with Delete", async () => {
    await openCommandBar();
    expect(keydown("F2").defaultPrevented).toBeTrue();
    fixture.detectChanges();
    const renameInput = fixture.nativeElement.querySelector(
      ".inspector-command-row__rename",
    ) as HTMLInputElement;
    expect(component.editingCheckpointId()).toBe("new");
    expect(document.activeElement).toBe(renameInput);
    expect(renameInput.selectionStart).toBe(0);
    expect(renameInput.selectionEnd).toBe(renameInput.value.length);

    keydown("Escape");
    const deleteCheckpoint = spyOn(service, "delete").and.resolveTo(true);
    expect(keydown("Delete").defaultPrevented).toBeTrue();
    await Promise.resolve();
    fixture.detectChanges();
    expect(deleteCheckpoint).toHaveBeenCalledWith("new");
  });

  it("compresses CSS edge values for compact combined spacing labels", () => {
    expect(component.formatEdges({ top: 0, right: 0, bottom: 0, left: 0 })).toBe("0");
    expect(component.formatEdges({ top: 4, right: 8, bottom: 4, left: 8 })).toBe("4 8");
    expect(component.formatEdges({ top: 4, right: 8, bottom: 12, left: 8 })).toBe("4 8 12");
    expect(component.formatEdges({ top: 4, right: 8, bottom: 12, left: 16 })).toBe("4 8 12 16");
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

  it("saves a checkpoint with Alt+S", async () => {
    const saved = { ...records[0], id: "shortcut", name: "Shortcut save" };
    const save = spyOn(service, "save").and.resolveTo(saved);

    expect(keydown("s", { altKey: true }).defaultPrevented).toBeTrue();
    await Promise.resolve();
    fixture.detectChanges();

    expect(save).toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain(
      "Saved “Shortcut save”.",
    );
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
    fixture.detectChanges();
    const spacingTag = fixture.nativeElement.querySelector(
      ".inspector-box-tag--spacing",
    ) as HTMLElement;
    expect(spacingTag.textContent?.replace(/\s+/g, "").trim()).toBe("M0·P0");
    expect(
      fixture.nativeElement.querySelectorAll(".inspector-box-tag--spacing").length,
    ).toBe(1);
    const distanceTag = fixture.nativeElement.querySelector(
      ".inspector-distance-tag",
    ) as HTMLElement;
    const horizontalLine = fixture.nativeElement.querySelector(
      ".inspector-distance-line--horizontal",
    ) as HTMLElement;
    const verticalLine = fixture.nativeElement.querySelector(
      ".inspector-distance-line--vertical",
    ) as HTMLElement;
    const verticalTag = fixture.nativeElement.querySelector(
      ".inspector-distance-tag--vertical",
    ) as HTMLElement;
    const distanceTagStyle = getComputedStyle(distanceTag);
    expect(distanceTag.style.top).toBe(horizontalLine.style.top);
    expect(verticalTag.style.left).toBe(verticalLine.style.left);
    expect(distanceTagStyle.backgroundColor).toContain("/ 0.72");
    expect(distanceTagStyle.backdropFilter).toBe("blur(4px)");
    expect(distanceTagStyle.textShadow).toBe("none");

    keyup("Alt");
    expect(component.altPressed()).toBeFalse();
    expect(component.distanceOverlay()).toBeNull();
    selected.remove();
    hovered.remove();
  });

  it("measures from a nested element to its parent boundaries", () => {
    const parent = document.createElement("section");
    const child = document.createElement("button");
    parent.appendChild(child);
    document.body.appendChild(parent);
    spyOn(parent, "getBoundingClientRect").and.returnValue(
      new DOMRect(10, 20, 200, 120),
    );
    spyOn(child, "getBoundingClientRect").and.returnValue(
      new DOMRect(40, 45, 50, 30),
    );
    spyOn(document, "elementsFromPoint").and.returnValues([child], [parent]);
    component.setToolMode("select");

    component.handleClick(new MouseEvent("click", { clientX: 50, clientY: 55 }));
    component.handlePointerMove(
      new PointerEvent("pointermove", { clientX: 15, clientY: 25 }),
    );
    keydown("Alt");

    expect(component.distanceOverlay()?.horizontal?.value).toBe(30);
    expect(component.distanceOverlay()?.vertical?.value).toBe(25);
    expect(
      component.distanceOverlay()?.horizontalDistances.map(({ value }) => value),
    ).toEqual([30, 120]);
    expect(
      component.distanceOverlay()?.verticalDistances.map(({ value }) => value),
    ).toEqual([25, 65]);
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelectorAll(".inspector-distance-line").length,
    ).toBe(4);
    expect(
      Array.from(
        fixture.nativeElement.querySelectorAll(".inspector-distance-tag"),
      ).map((tag) => (tag as HTMLElement).textContent?.trim()),
    ).toEqual(["30", "120", "25", "65"]);
    keyup("Alt");
    parent.remove();
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
