# 10 · Inlays — a new entity: socketed gems

**Sheet source:** `Background Reference inlay: scaling` A1:J253 (two group headers:
"### Common Gems (Stones & Ores)" row 1, "### Precious Gems (Stones & Ores)" row 123).

## What the new sheet says

25 gem families × 10 tiers of stat grants over **nine columns** — all six core stats plus
**Health, Mana, Speed**. An item carries at most one inlay ("Battleaxe **with empty inlay**",
"…**with Diamond 4 inlay**" — systems/12), and the inlay's tier row adds to the item's stat side.
Mana is the axis inlays dominate: tier-10 gems reach 800–1000 Mana, which is where the sample's
4211 Mana comes from.

**23 of the 25 families are exactly linear in tier** — tier *N* = *N* × tier 1, verified across
every row of the capture. So the catalog reduces to tier-1 vectors
(`Str/Dex/Con/Int/Wis/Char/Health/Mana/Speed`):

| Family | Group | Tier 1 |
|---|---|---|
| Quartz | Common | 0/0/0/2/0/0/0/100/0 |
| Agate | Common | 0/2/0/0/0/0/0/80/5 |
| Hematite | Common | 1/0/2/0/0/0/0/80/0 |
| Lapis Lazuli | Common | 0/0/0/1/2/0/0/120/0 |
| Malachite | Common | 0/0/1/0/0/0/5/100/0 |
| Turquoise | Common | 0/1/0/0/1/0/0/120/6 |
| Topaz | Common | 0/2/0/0/0/0/0/150/10 |
| Bloodstone | Common | 1/0/0/0/0/0/8/100/0 |
| Carnelian | Common | 2/0/0/0/0/1/0/90/0 |
| Moonstone | Common | 0/0/0/1/2/0/0/150/0 |
| Onyx | Common | 0/0/2/1/0/0/0/120/0 |
| Zircon | Common | 0/1/0/0/0/2/0/100/0 — **tier 10 row is blank in the sheet** |
| Sapphire | Precious | 0/0/0/2/2/0/0/500/0 |
| Amethyst | Precious | 0/0/0/0/2/2/0/450/0 |
| Garnet | Precious | 2/0/1/0/0/0/6/400/0 |
| Jade | Precious | 0/0/1/0/2/0/10/400/0 |
| Pearl | Precious | 0/0/0/0/2/2/0/350/0 |
| Tourmaline | Precious | 0/2/0/2/0/0/0/450/12 |
| Emerald | Precious | 0/0/0/2/2/0/8/600/0 |
| Opal | Precious | 0/0/0/2/0/2/0/700/8 |
| Ruby | Precious | 2/0/2/0/0/0/10/600/0 |
| Star Sapphire | Precious | 0/0/0/2/2/2/0/800/0 |
| Diamond | Precious | 2/0/2/0/0/2/0/1000/0 |
| Dragonstone | Precious | 2/2/0/2/0/0/10/1000/10 |
| Obsidian | Precious | **non-linear, hand-authored** — full ladder below |

The two exceptions, exactly as the sheet has them:

- **Zircon 10 is an empty row** (tiers 1–9 are linear). A gap, not a zero — never invent the
  missing row.
- **Obsidian** (`Str/Dex/Con/Int/Wis/Char/Health/Mana/Speed`, tiers 1→10):
  `1/0/1/0/0/1/0/100/0`, `2/0/1/0/0/2/0/200/0`, `4/0/2/1/0/2/0/300/0`, `5/0/2/1/0/3/0/400/0`,
  `6/0/3/2/0/4/0/500/0`, `7/0/4/2/0/5/0/600/0`, `8/0/4/2/0/6/0/700/0`, `10/0/5/3/0/6/0/800/0`,
  `11/0/5/3/0/7/0/900/0`, `12/0/6/4/0/8/0/1000/0`. (An *Obsidian* also exists as a **material**
  family with different numbers — same name, two entities, both kept.)

Every gem family also appears as *items* in the shop catalog (systems/11, "Common Gems"/"Precious
Gems" under Stones & Ores) — the purchasable form of the same stones.

## What the app has today

Nothing. No inlay entity, no socket on `Item`, no third bonus source on equipment.

## Parity gap

1. **New entity `Inlay`** on the `Configuration` — mirror the `Material` family/tier shape (it is
   the same structure over nine axes): family + ten tiers of `{statId, modifier}` rows, grouped
   Common/Precious. Follow the `constants` pattern: optional array, absent means none. Store all
   ten rows per family (the sheet writes them; linearity is a property the capture verified, not
   a generator to impose — Obsidian and Zircon prove why).
2. **A socket on the item** — systems/12 (the composed item names `inlayId` + `inlayLevel` the
   way it already names `materialId` + `materialLevel`).
3. **Engine** — equipment stat bonuses become material row **plus inlay row** per equipped item
   (arithmetic confirmed, systems/12).
4. **New fragment `inlays.json`** with the Zircon gap and the double-Obsidian noted.

Prefix to mint: **`INL`**.

## Backend note

New optional array inside `ruleset.data`; additive → no version bump, no server change.

## Open questions

- **Zircon 10** — leave the tier absent (importable, selectable up to 9) and let the User fill it,
  or hold the whole family? Recommend absent-tier; the shape already tolerates families with
  missing tiers if it mirrors materials (confirm it does in the ticket).
