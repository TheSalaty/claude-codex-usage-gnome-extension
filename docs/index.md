---
title: Claude & Codex Usage — a GNOME Shell extension for Claude Code and Codex limits
description: See how much of your Claude Code and OpenAI Codex usage limits you have burned through, when they reset, and what the same traffic would have cost at API rates — in the GNOME top panel.
---

# Claude & Codex Usage

A GNOME Shell extension that shows how much of your **Claude Code** and **OpenAI Codex** usage
limits you have burned through, when they reset, and what the same traffic would have cost at API
rates — right in the top panel.

Works with Claude Code alone, Codex alone, or both. Everything is read from the session files
already on your machine; nothing is sent anywhere. Tested on GNOME 49 and 50, Wayland and X11,
Arch/Manjaro, Fedora and Ubuntu.

![The Claude & Codex Usage menu showing Claude Code and Codex limits, resets and cost](menu.png)

## What it shows

- **Limits** — every rolling limit with a bar: Claude's 5-hour session, weekly and weekly-Opus
  quota, Codex's 5-hour and weekly quota. The same figures `/usage` reports inside Claude Code.
- **Resets** — how long until each limit refills ("Resets in 4h").
- **Cost at API rates** — what the last 24 hours / 7 days / 30 days would have cost at API list
  prices, plus what prompt caching saved. A subscription is flat-rate, so this is not a bill.
- **Where it went** — cost per model, and the share spent under each skill, subagent and MCP tool.
- **In the panel** — the tightest limit's percentage, the window's cost, or just the icon.

## Install

Needs GNOME Shell 49 or 50. Download the zip from the
[latest release](https://github.com/TheSalaty/claude-codex-usage-gnome-extension/releases/latest),
then:

```sh
gnome-extensions install --force ai-usage-monitor@thesalaty.github.io.shell-extension.zip
```

Log out and back in — Wayland cannot reload the shell in place — and enable it:

```sh
gnome-extensions enable ai-usage-monitor@thesalaty.github.io
```

## Compared with the other usage extensions

- **CodexBar / GodexBar** wrap the CodexBar CLI — another binary to install and keep current. This
  reads the session files directly, no helper process.
- **Provider Limits** shows limits and resets only. This adds the API-equivalent cost and the
  per-model, per-skill and per-subagent breakdown behind it.
- **Claude Code Usage**, **Claude Usage Panel** and similar cover Claude alone. This covers both
  CLIs in one indicator, and stays useful with only one of them installed.

Source, settings and the pricing overrides:
[github.com/TheSalaty/claude-codex-usage-gnome-extension](https://github.com/TheSalaty/claude-codex-usage-gnome-extension).
MIT licensed.
