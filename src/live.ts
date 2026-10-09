import { RangeSetBuilder, StateEffect, StateField } from "@codemirror/state";
import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
} from "@codemirror/view";
import { Editor, editorInfoField, editorLivePreviewField } from "obsidian";
import { setButtonIcon } from "./output";
import { parseFences } from "./fence";
import { canFormat } from "./format";
import { apply, measure, Placement } from "./place";
import { canRun } from "./run";

type Action = (editor: Editor, line: number) => Promise<void> | void;

class ActionWidget extends WidgetType {
  constructor(
    private icon: string,
    private label: string,
    private action: Action,
  ) {
    super();
  }

  eq(other: ActionWidget): boolean {
    return other.icon === this.icon;
  }

  toDOM(view: EditorView): HTMLElement {
    const button = createSpan({
      cls: "cbk-button clickable-icon",
      attr: { "aria-label": this.label, contenteditable: "false" },
    });
    setButtonIcon(button, this.icon);

    // Keep the press from moving the cursor into the block, which would reveal the fence.
    button.addEventListener("mousedown", (event) => event.preventDefault());
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const editor = view.state.field(editorInfoField).editor;
      if (!editor || button.hasClass("is-busy")) return;
      const line = view.state.doc.lineAt(view.posAtDOM(button)).number - 1;
      button.addClass("is-busy");
      void Promise.resolve(this.action(editor, line)).finally(() => button.removeClass("is-busy"));
    });
    return button;
  }

  ignoreEvent(): boolean {
    return true;
  }
}

/** Live Preview: format and run buttons on the first line of every block that supports them. */
export function liveButtons(format: Action, run: Action) {
  const formatButton = Decoration.widget({
    widget: new ActionWidget("wand-sparkles", "Format code", format),
    side: 1,
  });
  const runButton = Decoration.widget({ widget: new ActionWidget("play", "Run code", run), side: 2 });

  const build = (view: EditorView): DecorationSet => {
    if (!view.state.field(editorLivePreviewField)) return Decoration.none;
    const builder = new RangeSetBuilder<Decoration>();
    const doc = view.state.doc;
    for (const fence of parseFences(doc.toJSON())) {
      const at = doc.line(fence.open + 1).to;
      if (canFormat(fence.lang)) builder.add(at, at, formatButton);
      if (canRun(fence.lang)) builder.add(at, at, runButton);
    }
    return builder.finish();
  };

  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      // The language label comes and goes with the cursor and its width depends on the
      // language name, so the buttons are lined up against it again after every update.
      private place = {
        key: this,
        read: (view: EditorView): Placement[] => {
          const lines = new Map<HTMLElement, HTMLElement[]>();
          // Only the editor's own lines: a rendered callout carries Reading view buttons, which
          // are placed against the copy button instead.
          for (const button of Array.from(view.contentDOM.querySelectorAll<HTMLElement>(".cm-line > .cbk-button"))) {
            const line = button.parentElement;
            if (line) lines.set(line, [...(lines.get(line) ?? []), button]);
          }
          return Array.from(lines).flatMap(([line, buttons]) =>
            measure(line, line.querySelector<HTMLElement>(".code-block-flair"), buttons),
          );
        },
        write: apply,
      };

      constructor(view: EditorView) {
        this.decorations = build(view);
        view.requestMeasure(this.place);
      }

      update(update: ViewUpdate): void {
        const live = editorLivePreviewField;
        if (update.docChanged || update.startState.field(live) !== update.state.field(live)) {
          this.decorations = build(update.view);
        }
        update.view.requestMeasure(this.place);
      }
    },
    { decorations: (plugin) => plugin.decorations },
  );
}

class OutputWidget extends WidgetType {
  constructor(readonly panel: HTMLElement) {
    super();
  }

  eq(other: OutputWidget): boolean {
    return other.panel === this.panel;
  }

  toDOM(): HTMLElement {
    // Block widgets must not have margins; the host's padding spaces the panel instead.
    const host = createDiv({ cls: "cbk-output-host" });
    host.appendChild(this.panel);
    return host;
  }

  ignoreEvent(): boolean {
    return true;
  }
}

const showOutput = StateEffect.define<{ pos: number; widget: OutputWidget }>();
const hideOutput = StateEffect.define<HTMLElement>();

const panelOf = (decoration: Decoration): HTMLElement =>
  (decoration.spec as { widget: OutputWidget }).widget.panel;

/** Output panels shown under code blocks in the editor. */
export const outputField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(panels, tr) {
    panels = panels.map(tr.changes);
    for (const effect of tr.effects) {
      if (effect.is(showOutput)) {
        const { pos, widget } = effect.value;
        panels = panels.update({
          add: [Decoration.widget({ widget, block: true, side: 1 }).range(pos)],
        });
      } else if (effect.is(hideOutput)) {
        panels = panels.update({ filter: (_from, _to, value) => panelOf(value) !== effect.value });
      }
    }
    return panels;
  },
  provide: (field) => EditorView.decorations.from(field),
});

/** The output panel already shown below the line that ends at `pos`, if any. */
export function outputAt(view: EditorView, pos: number): HTMLElement | null {
  let panel: HTMLElement | null = null;
  view.state.field(outputField).between(pos, pos, (_from, _to, value) => {
    panel = panelOf(value);
  });
  return panel;
}

/** Shows `panel` below the line that ends at `pos` and returns the function that removes it. */
export function mountOutput(view: EditorView, pos: number, panel: HTMLElement): () => void {
  view.dispatch({ effects: showOutput.of({ pos, widget: new OutputWidget(panel) }) });
  return () => {
    try {
      view.dispatch({ effects: hideOutput.of(panel) });
    } catch {
      // The pane was closed before the run was.
    }
  };
}
