# AI Usage Monitor

A GNOME Shell extension that puts Claude Code and Codex usage in the top panel: how much of each
rolling limit is gone, when it resets, and what the same traffic would have cost at API list
prices — broken down by model, by skill, by subagent and by MCP tool.

It detects which of the two CLIs is installed and works with either one on its own.

![The panel menu](docs/menu.png)

## What it shows

**Limits and resets** — the same figures `/usage` shows inside Claude Code, and the same figures
Codex prints in its status line, with a bar and a "Resets in 2h" line each.

**Cost at API rates** — every request in the selected window (24 hours, 7 days or 30 days) priced
against a local price list, plus what prompt caching saved. A subscription is flat-rate, so this
is not a bill; it is the "if billed at full API rate" number.

**Where it went** — cost per model, and the share attributed to each skill, subagent and MCP tool.
Claude Code stamps every assistant record with the skill, subagent and MCP tool it ran under, so
these are read from the transcript rather than guessed. Skills and subagents are independent
characteristics of the same spend, not a partition: their shares overlap and do not sum to 100%.

## Where the numbers come from

| | Limits | Cost |
|---|---|---|
| **Claude Code** | `GET /api/oauth/usage` with the OAuth token in `~/.claude/.credentials.json` | `~/.claude/projects/**/*.jsonl` |
| **Codex** | the rate-limit snapshot in the newest `~/.codex/sessions/**/rollout-*.jsonl` | the same rollout files |

Nothing is sent anywhere. The only outbound request is the one Claude Code itself makes to read
your limits, with the token Claude Code already stored.

Two consequences worth knowing:

- **Claude's token is read, never refreshed.** It lasts a few hours. If it has expired, the menu
  says so and keeps showing cost; start Claude Code once and it refreshes itself. Refreshing it
  here would rotate the refresh token out from under Claude Code and log you out.
- **Codex has no usage endpoint.** Its limits only exist as a snapshot written into the last
  session it ran, so the menu labels them with their age ("Limits from the last recorded session ·
  2h ago"). Run Codex and they update.

### Pricing

The built-in list is in [`src/lib/pricing.ts`](src/lib/pricing.ts), in USD per million tokens, with
Anthropic's cache multipliers (cache read 0.1×, 5-minute cache write 1.25×, 1-hour cache write 2×).
Override any prefix by creating `~/.config/ai-usage-monitor/pricing.json`:

```json
{
  "gpt-5.6": { "input": 1.25, "output": 10 },
  "claude-opus": { "input": 5, "output": 25, "cacheReadFactor": 0.1 }
}
```

The longest matching model-id prefix wins, so `claude-opus` covers every Opus snapshot. A model
with no price contributes tokens but no cost, and the menu names it in a warning rather than
quietly pricing it at zero.

## Install

Requires GNOME Shell 49 or 50 and Node 20+ to build.

```sh
npm install
make install          # builds, compiles the schema, copies into ~/.local/share/gnome-shell/extensions
```

Then log out and back in (Wayland cannot reload the shell in place) and:

```sh
gnome-extensions enable ai-usage-monitor@thesalaty.github.io
```

`make pack` produces a `.shell-extension.zip` instead.

## How it works

The shell process only draws. All the reading and parsing happens in a separate short-lived
process (`collector/main.js`, run with `gjs -m`) that prints one JSON snapshot on stdout, because
aggregating a 30-day window means touching hundreds of megabytes of transcript and doing that
in-process would stall the compositor.

Inside the collector, `find -newermt` narrows to files touched within the window — transcripts are
append-only, so a file older than the window cannot hold records inside it — and `grep` pulls out
the few thousand lines that carry token usage before any JSON parsing happens. A 30-day collection
over 1.4 GB of transcript takes under two seconds.

Two details the parsers exist to get right:

- Claude Code writes one record per content block while streaming, and a resumed or forked session
  re-logs earlier assistant messages verbatim. Both mean the same `message.id` appears several
  times, so records are deduplicated by id and the largest usage figure wins.
- Codex reports token usage as a **running total per session** and repeats the same snapshot across
  events. Spend is therefore the rise in that total, not the sum of the per-request field.

```
src/lib/         pure aggregation and formatting — no GI imports, covered by tests
src/collector/   the out-of-process collector (files, grep, HTTP)
src/ui/          panel button, menu rows
tools/           headless screenshot harness (see below)
```

## Development

```sh
npm run build          # tsc
npm test               # tsc + node --test over src/lib
make install           # install into ~/.local/share/gnome-shell/extensions
make logs              # follow gnome-shell's journal
gjs -m build/src/collector/main.js --window 7 | jq   # run the collector by hand
```

### Looking at the UI without touching your session

`tools/shoot.sh` starts a headless GNOME Shell on a virtual monitor with a throwaway XDG home —
so no other extension loads and the real desktop's dconf is untouched — enables this extension,
drives the pointer through Mutter's RemoteDesktop interface and captures frames from its ScreenCast
PipeWire stream:

```sh
dbus-run-session -- ./tools/shoot.sh --click 1095,12:menu --click 1030,308:expanded
# frames land in /tmp/aiu-shots/
```

GNOME 49+ refuses `org.gnome.Shell.Screenshot` for headless sessions and no longer exposes an
`UnsafeMode` property for `Eval`, which is why the harness goes through RemoteDesktop and
ScreenCast rather than asking the shell for a screenshot.

## Licence

MIT
