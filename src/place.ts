const GAP = 4;
const INSET = 6;

export interface Placement {
  button: HTMLElement;
  end: number;
  top: number;
}

/**
 * Lines `buttons` up leftwards from `native`, the control Obsidian itself puts in the block's
 * corner (the copy button or the language label), centred on it. Without one they take the corner.
 */
export function measure(host: HTMLElement, native: HTMLElement | null, buttons: HTMLElement[]): Placement[] {
  const box = host.getBoundingClientRect();
  if (!box.width) return [];
  const right = box.left + host.clientLeft + host.clientWidth;
  const top = box.top + host.clientTop;
  const anchor = native?.offsetWidth ? native.getBoundingClientRect() : null;

  let end = anchor ? right - anchor.left + GAP : INSET;
  return buttons.map((button) => {
    const size = button.getBoundingClientRect();
    const placement = {
      button,
      end: Math.round(end),
      top: Math.round(anchor ? anchor.top - top + (anchor.height - size.height) / 2 : INSET),
    };
    end += size.width + GAP;
    return placement;
  });
}

export function apply(placements: Placement[]): void {
  for (const { button, end, top } of placements) {
    button.setCssProps({ "--cbk-end": `${end}px`, "--cbk-top": `${top}px` });
  }
}
