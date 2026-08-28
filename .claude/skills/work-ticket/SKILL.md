---
name: work-ticket
description: Work a ticket end-to-end — read it, plan the implementation, build it, tick each acceptance criterion as it verifiably passes, then check off the ticket's line in overview.md. Use whenever someone says "work on a ticket", "start ticket TICKET-XXX", "implement this ticket", "pick up the next ticket", or points you at a ticket file to build.
---

# Work a ticket to done

The instructions live in the **`work-ticket` subagent**
([.claude/agents/work-ticket.md](../../agents/work-ticket.md)) — one home, so the procedure cannot
drift between two copies. This skill is the launcher; invoking it *is* the user asking for that
agent, so spawn it.

Run it in two phases, because a subagent cannot ask the user anything:

1. **Spawn it** with the ticket the user named — or with nothing, if they didn't name one — via the
   `Agent` tool, `subagent_type: "work-ticket"`. It locates the ticket, orients, and returns an
   implementation plan mapped to the acceptance criteria. It writes no code in this phase.
2. **Relay the plan to the user verbatim enough to judge it**, and put its two closing questions to
   them: approve or amend, and do they want the *"Verified live in the browser: …"* criteria checked
   live. Then **resume the same agent** with `SendMessage` — not a fresh `Agent` call, which would
   lose its context — passing the approval, any amendments, and the browser answer. It implements,
   verifies, ticks each criterion with evidence, lands the sheet-import fragment, checks off the
   story line, updates the docs it invalidated, and reports.

If the agent stops early — no ticket named and several are open, or the open line has no ticket link
and needs the **story-ticket** skill first — put its question to the user and resume it the same way.

Its final report is not shown to the user: summarize what changed, the verification result, and any
criterion it left open.
