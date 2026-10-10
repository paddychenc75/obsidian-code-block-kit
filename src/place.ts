const GAP = 4;
const INSET = 6;

export interface Placement {
  button: HTMLElement;
  end: number;
  top: number;
}

/**
 * Lines `buttons` up from the right edge of `host`, centred vertically on `native`, the control
 * Obsidian itself puts on the block (the copy button or the language label).
 *
 * Where they start depends on the theme. If `native` is in the right corner they start just left
 * of it. If the theme has moved it to the left, they take the right corner, at the inset `native`
 * keeps from its own side.
 */
export function measure(host: HTMLElement, native: HTMLElement | null, buttons: HTMLElement[]): Placement[] {
  const box = host.getBoundingClientRect();
  if (!box.width) return [];
  const left = box.left + host.clientLeft;
  const right = left + host.clientWidth;
  const top = box.top + host.clientTop;
  const anchor = native?.offsetWidth ? native.getBoundingClientRect() : null;
  const onRight = anchor ? anchor.left + anchor.width / 2 > (left + right) / 2 : false;

  let end = INSET;
  if (anchor) end = onRight ? right - anchor.left + GAP : Math.max(anchor.left - left, 0);
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
