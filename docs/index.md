---
title: Claude & Codex Usage — a GNOME Shell extension for Claude Code and Codex limits
description: See how much of your Claude Code and OpenAI Codex usage limits you have burned through, when they reset, and what the same traffic would have cost at API rates — in the GNOME top panel.
---

# Claude & Codex Usage

A GNOME Shell extension for **Claude Code** and **OpenAI Codex** that answers both questions from
the top panel: how much of your limits is left, and **where the spend actually went** — what the
same traffic would have cost at API rates, broken down per model, per skill, per subagent and per
MCP tool.

Every other panel extension in this space stops at the first question. This one is for when
"73% used" is not the thing you wanted to know.

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

There are a dozen of these now, so here is an honest table. Feature sets are from each project's
own README, checked in August 2026.

| | Claude | Codex | Limits & resets | Cost at API rates | Per model / skill / subagent | GNOME |
|---|---|---|---|---|---|---|
| **Claude & Codex Usage** (this) | ✅ | ✅ | ✅ | ✅ | ✅ | 49–50 |
| [Brain Usage](https://github.com/AltairInglorious/brainusage) | ✅ | ✅ | ✅ | — | — | 45–49 |
| [AI Usage Bar](https://github.com/wilfison/ai-usagebar) | ✅ | ✅ | ✅ | — | — | 50 |
| [Claude + Codex Usage](https://github.com/IanBraga96/gnome-claude-codex-usage) | ✅ | ✅ | ✅ | — | — | 48–50 |
| [Claude Monitor](https://github.com/CybrosysAssista/claude-monitor) | ✅ | ✅ | ✅ | — | — | 45–49 |
| [AI Token Bars](https://github.com/fen22/gnome-shell-extension-ai-token-bars) | ✅ | ✅ | ✅ | — | — | 42 |
| [claude-monitor](https://github.com/miferco97/claude-monitor-gnome-extension) | ✅ | — | ✅ | cost + burn rate | — | 48 |

Where the others are ahead, so you can pick properly: **AI Usage Bar** covers four more vendors
(Z.AI, OpenRouter, DeepSeek, Kimi). **Brain Usage** ships a KDE Plasma version and low-quota
notifications. **Claude Monitor** has a macOS menu-bar app. If limits are all you need and you are
on GNOME 45–48, those are the better fit — this one starts at 49.

What is here and nowhere else is the second half of the question: cost at API list prices for the
last 24h / 7d / 30d, what prompt caching saved, and the split across models, skills, subagents and
MCP tools. No helper CLI, no daemon — it reads the session files directly.

Source, settings and the pricing overrides:
[github.com/TheSalaty/claude-codex-usage-gnome-extension](https://github.com/TheSalaty/claude-codex-usage-gnome-extension).
MIT licensed.
