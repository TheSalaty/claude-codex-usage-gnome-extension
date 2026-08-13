import Clutter from 'gi://Clutter'
import Pango from 'gi://Pango'
import St from 'gi://St'

import * as BarLevel from 'resource:///org/gnome/shell/ui/barLevel.js'
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js'

import { formatPercent, formatUntil } from '../lib/format.js'
import { severityFor } from '../lib/snapshot.js'
import type { Attribution, Limit } from '../lib/types.js'

/**
 * A non-interactive menu row. Limits and figures are readouts, not commands.
 *
 * The shell greys out every row it considers insensitive, which is unreadable for rows that are
 * content rather than disabled commands — `aiu-row` is what the stylesheet hangs the full-contrast
 * text colour on.
 */
export const staticItem = (styleClass: string): PopupMenu.PopupBaseMenuItem =>
  new PopupMenu.PopupBaseMenuItem({
    reactive: false,
    can_focus: false,
    style_class: `popup-menu-item aiu-row ${styleClass}`,
  })

export const sectionHeader = (title: string, trailing: string | null): PopupMenu.PopupBaseMenuItem => {
  const item = staticItem('aiu-section-header')
  item.add_child(new St.Label({ text: title, style_class: 'aiu-section-title' }))
  item.add_child(new St.Widget({ x_expand: true }))
  if (trailing !== null) {
    item.add_child(new St.Label({ text: trailing, style_class: 'aiu-section-trailing' }))
  }
  return item
}

export const keyValue = (
  key: string,
  value: string,
  options: { dim?: boolean } = {},
): PopupMenu.PopupBaseMenuItem => {
  const item = staticItem('aiu-kv')
  item.add_child(
    new St.Label({
      text: key,
      style_class: options.dim === true ? 'aiu-kv-key aiu-dim' : 'aiu-kv-key',
    }),
  )
  item.add_child(new St.Widget({ x_expand: true }))
  item.add_child(new St.Label({ text: value, style_class: 'aiu-kv-value' }))
  return item
}

export const note = (text: string): PopupMenu.PopupBaseMenuItem => {
  const item = staticItem('aiu-note')
  const label = new St.Label({ text, style_class: 'aiu-note-label' })
  label.clutter_text.line_wrap = true
  label.clutter_text.ellipsize = Pango.EllipsizeMode.NONE
  item.add_child(label)
  return item
}

/**
 * A limit as Claude Code and Codex present it: name, percentage, a bar, and when it clears.
 * BarLevel is the shell's own meter widget, so it inherits theme colours and accessibility.
 */
export const limitRow = (limit: Limit, nowMs: number): PopupMenu.PopupBaseMenuItem => {
  const item = staticItem('aiu-limit')
  const column = new St.BoxLayout({ vertical: true, x_expand: true, style_class: 'aiu-limit-box' })

  const heading = new St.BoxLayout({ x_expand: true })
  heading.add_child(new St.Label({ text: limit.label, style_class: 'aiu-limit-label' }))
  heading.add_child(new St.Widget({ x_expand: true }))
  heading.add_child(
    new St.Label({ text: formatPercent(limit.percent), style_class: 'aiu-limit-percent' }),
  )
  column.add_child(heading)

  const bar = new BarLevel.BarLevel({
    style_class: `aiu-bar aiu-bar-${severityFor(limit.percent)}`,
    x_expand: true,
  })
  // BarLevel's `value` and `maximum-value` are doubles capped at 2 by their ParamSpecs, so a
  // percentage has to arrive as a fraction of the default maximum of 1 — passing 90 out of 100
  // clamps both ends and draws a bar that no longer matches the number beside it.
  bar.value = Math.max(0, Math.min(1, limit.percent / 100))
  column.add_child(bar)

  const until = formatUntil(limit.resetsAt, nowMs)
  if (until !== null) {
    column.add_child(
      new St.Label({
        text: until === 'now' ? 'Resetting now' : `Resets in ${until}`,
        style_class: 'aiu-limit-reset aiu-dim',
      }),
    )
  }

  item.add_child(column)
  return item
}

/** Share-of-spend rows, e.g. skills or subagents. Shares overlap by design. */
export const attributionRows = (
  title: string,
  entries: readonly Attribution[],
  total: number,
  limit: number,
): PopupMenu.PopupBaseMenuItem[] => {
  if (entries.length === 0 || total <= 0) return []
  const rows = [keyValue(title, '% of cost', { dim: true })]
  for (const entry of entries.slice(0, limit)) {
    const share = Math.round((entry.usd / total) * 100)
    if (share < 1) continue
    rows.push(keyValue(`    ${entry.name}`, `${share}%`))
  }
  return rows.length > 1 ? rows : []
}

/** A row of mutually exclusive choices, e.g. the 24h / 7 days / 30 days window. */
export const choiceRow = <T extends string | number>(
  choices: readonly { value: T; label: string }[],
  selected: T,
  onSelect: (value: T) => void,
): PopupMenu.PopupBaseMenuItem => {
  const item = staticItem('aiu-choices')
  const box = new St.BoxLayout({ x_expand: true, style_class: 'aiu-choice-box' })
  for (const choice of choices) {
    const button = new St.Button({
      label: choice.label,
      style_class:
        choice.value === selected ? 'aiu-choice aiu-choice-active' : 'aiu-choice',
      can_focus: true,
      x_expand: true,
    })
    button.connect('clicked', () => {
      onSelect(choice.value)
      return Clutter.EVENT_STOP
    })
    box.add_child(button)
  }
  item.add_child(box)
  return item
}
