# Claude & Codex Usage — a GNOME Shell extension for your Claude Code and Codex limits

A GNOME Shell extension that shows how much of your **Claude Code** and **OpenAI Codex** usage
limits you have burned through, when they reset, and what the same traffic would have cost at API
rates — right in the top panel.

Works with Claude Code alone, Codex alone, or both. Everything is read from the session files
already on your machine; nothing is sent anywhere.

Tested on GNOME 49 and 50, Wayland and X11, Arch/Manjaro, Fedora and Ubuntu.

<p align="center">
  <img src="docs/menu.png" alt="The Claude &amp; Codex Usage menu showing Claude Code and Codex limits, resets and cost" width="420">
</p>

## What it shows

- **Limits** — every rolling limit with a bar: Claude's 5-hour session, weekly and weekly-Opus
  quota, Codex's 5-hour and weekly quota. The same figures `/usage` reports inside Claude Code.
- **Resets** — how long until each limit refills ("Resets in 4h").
- **Cost at API rates** — what the last 24 hours / 7 days / 30 days would have cost at API list
  prices, plus what prompt caching saved. A subscription is flat-rate, so this is not a bill.
- **Where it went** — cost per model, and the share spent under each skill, subagent and MCP tool.
- **In the panel** — the tightest limit's percentage, the window's cost, or just the icon.

## Install

Needs GNOME Shell 49 or 50. Grab the zip from the
[latest release](https://github.com/TheSalaty/claude-codex-usage-gnome-extension/releases/latest):

```sh
gnome-extensions install --force ai-usage-monitor@thesalaty.github.io.shell-extension.zip
```

Or from source, which needs Node 20+:

```sh
git clone https://github.com/TheSalaty/claude-codex-usage-gnome-extension.git
cd claude-codex-usage-gnome-extension
npm install
make install
```

Then log out and back in — Wayland cannot reload the shell in place — and enable it:

```sh
gnome-extensions enable ai-usage-monitor@thesalaty.github.io
```

`make pack` builds a `.shell-extension.zip` instead.

## Settings

Open with the gear in the menu, or `gnome-extensions prefs ai-usage-monitor@thesalaty.github.io`.

| | |
|---|---|
| **Panel button shows** | Limit %, cost, or icon only |
| **Limit percentage shows** | Claude, Codex, or both |
| **Cost window** | Past 24 hours, 7 days or 30 days |
| **Refresh interval** | 60–3600 seconds between collections |

Prices come from a built-in list ([`src/lib/pricing.ts`](src/lib/pricing.ts), USD per million
tokens). Override any model by creating `~/.config/ai-usage-monitor/pricing.json` — the longest
matching model-id prefix wins:

```json
{
  "gpt-5.6": { "input": 1.25, "output": 10 },
  "claude-opus": { "input": 5, "output": 25, "cacheReadFactor": 0.1 }
}
```

## Notes

- **Claude's OAuth token is read, never refreshed.** If it has expired the menu says so and keeps
  showing cost; start Claude Code once and it refreshes itself.
- **Codex has no usage endpoint.** Its limits come from the snapshot in the last session it ran, so
  the menu labels them with their age. Run Codex and they update.

## Compared with the other usage extensions

- **CodexBar / GodexBar** wrap the CodexBar CLI — another binary to install and keep current. This
  reads the session files directly, no helper process.
- **Provider Limits** shows limits and resets only. This adds the API-equivalent cost and the
  per-model, per-skill and per-subagent breakdown behind it.
- **Claude Code Usage**, **Claude Usage Panel** and similar cover Claude alone. This covers both
  CLIs in one indicator, and stays useful with only one of them installed.

Building on this? See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

## Licence

MIT
