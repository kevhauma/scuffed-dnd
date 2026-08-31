# 13 · Spells — a 418-spell compendium with caster-scaled effects

**Sheet source (xlsx):** `background calculations spells ` A8:E428 — columns **B name · C mana ·
D range/time · E effect** (the online copy lays the same data out as B/D/E/F; fragments cite the
xlsx). Row 10 is a template row (name `empty`, mana 0, range `0f`, effect `0`); A1:A2 hold the two
state labels `locked` / `Learned`. Plus the **`Spellbook`** sheet, A1:F5.

## What the new sheet says

418 spells (rows 11–428). Per spell: a per-player **locked/Learned** flag, a name, a **mana
cost**, a free-text **range/time**, and **effect text**. One spell is `Learned` in the sample
(Acid Splash); Setup's *Chosen abiltie* box is empty.

**The `Spellbook` sheet is the play surface**: one `FILTER` of the spells table down to rows whose
flag is `learned`, showing name / mana / range / effect. That is the app's spellbook view,
specified by the sheet itself.

### Effect text is computed — confirmed as formulas

**326 of the 418 effect cells are live formulas**; the rest are plain text. Each formula is
string concatenation around engine cells (overview D4), read verbatim from the xlsx:

- *Acid Splash*: `…"lowers the endurance of creatures hit by " & Calcu!R7 …` — **final Wis**.
- *Aid*: `…"Choose up to " & Calcu!M30+1 & " creatures … gains " & Calcu!F20 & " hit points"` —
  **perception's bonus + 1** and **Healing's level**.
- *Alter self*: `…"for " & Calcu!F32 & " hour"` — **Prefomance's level**.
- The Fireball seam ("centered on takes") is a missing text fragment inside such a concatenation.

So a spell's numbers may reference **any final stat, skill level, or skill bonus** — arbitrary
per spell, exactly the shape of a formula placeholder inside template text. The resolved sample
values (cure wounds 5, Fireball 55/11) are golden-fixture material *now*, since the referenced
cells are known.

### Numbers and anomalies

- Mana costs run 60–360 in steps of 30, with outliers: `planar help` 400, `Greater time stop`
  800, `Fabricate`/`Feign Death` 160.
- **`mighty fortress` has its columns swapped** — mana "1 Mile", range "270". Recorded as-is.
- **`Summon Lesser Demons`'s effect cell is `#VERW!`** — a live formula error in the sheet
  (Dutch `#REF!`). The corpus records the error, never invents the text.
- range/time spellings are wildly inconsistent (`60f`, `60 Feet`, `120`, `touch`/`Touch`,
  `self/focus`, `Monitor Crystal`, `sight`, `on hit`, `/`, six blanks). It is a free-text field;
  normalising it is the User's edit.

### The full index (name | mana | range/time, sheet order and spelling)

```
Acid Splash|90|60f ; Aid|120|30f ; Alarm|90|0f ; Alter self|120|0f ; Animate Dead|150|24h ;
Animal messenger|90|24h ; Animal Friendship|90|4h ; Animate object|180|10f ;
Antilife Shell|210|self/focus ; Antimagic Field|300|Focus ; Arcane Eye|180|Monitor Crystal ;
Arcane Gate|240|100 feet ; Armor of Agathys|90|self ; Arms of Hadar|90|20 feet ;
Aura of Life|180|self ; Aura of Purity|180|self ; Aura of Vitality|150|self ; Awaken|210|Stone ;
Banishing Smite|210|self ; Barkskin|120|5f ; Beast Sense|120|touch ;
Bestow curse of strength|120|30 feet ; Bestow curse of Con|120|30 feet ;
Bestow curse of Dex|120|30 feet ; Bestow curse of Int|120|30 feet ;
Bestow curse of Char|120|30 feet ; Bestow curse of health|120|30 feet ;
Bestow curse of Mana|120|30 feet ; Bestow curse of Speed|120|30 feet ;
Blade Barrier|240|30 feet ; Ward|60|touch ; Bless|90|touch ; Blinding smite|120| ;
Blindness|120|25 feet ; Blur|120|self ; Branding Smite|120|5f ; Burning Hands|90|15 Feet ;
Call lightning|150|120 Feet ; Calm emotions|120|60 Feet ; Chain Lighting|240|150 Feet ;
Chill Touch|60|120 Feet ; Chromatic Orb|90|90 Feet ; Circle of Death|240|150 Feet ;
Clairvoyance|150|1 mile ; Clone|300|Touch ; Cloud of daggers|90|60 Feet ;
Cloudkill|210|120 Feet ; Command|90|60 Feet ; Cone of Cold|210|60 Feet ;
Conjure Animals|120|20 Feet ; Conjure Barrage|120|50 Feet ; Conjure Celestial|270|5 Feet ;
Conjure Elemental|210|15 Feet ; Conjure Fey|240|15 Feet ; contact other plane|210|self ;
Contingency|210|self ; continual Flame|120|30 Feet ; Controle Water|180|300 Feet ;
cordon of arrows|120|5 Feet ; Create food|150|25 Feet ; Create undead|210|touch ;
Crown of madness|120|50 Feet ; Crusaders Mantel|150|self ; cure wounds|90|touch ;
Dancing Lights|60|60 Feet ; Darkvision|120|touch ; Daylight|150|Touch ; Death ward|180|touch ;
Delayed blast Fireball|270|40 Feet ; Demiplane|300|5 Feet ; Destructive wave|210|self ;
Detect poison and deseases|90|self ; Detect Thoughts|120|30 Feet ;
Dimension door|180|750 Feet ; disintegrate|240|60 Feet ; disspell magic|360|80 Feet ;
Dissonant Whispers|90|60 Feet ; Divination|180|/ ; Divine favor|90|touch ;
Divine Word|270|30 Feet ; Dominate Beast|180|60 Feet ; Dominate Monster|300|60 Feet ;
Dominate Persone|120|60 Feet ; Drawmij's Instant Summons|60|touch ; Druidcraft|90| ;
earthquake|300|500 Feet ; Eldritch Blast|60|120 Feet ; Elemental Weapon|150|touch ;
Enhance Ability Bear|120|touch ; Enhance ability Bull|120|touch ; Enhance ability Cat|120|touch ;
enhance ability eagle|120|touch ; enhance ability fox|120|touch ; enhance abilty owl|120|touch ;
enlarge/ reduce|120| ; Ensnaring Strike|90|on hit ; Entangle|90|90 Feet ;
Etherealness|270|self ; Evards black Tentacles|180|90 Feet ; Eyebite|240|self ;
Fabricate|160| ; Faerie Fire|90|60 Feet ; False Life|90|self ; Fear|150|self ;
Feather Fall|90|touch ; Feeblemind|300| ; Feign Death|160|touch ; Find Familiar|90|10 Feet ;
Find Steed|120|30 Feet ; Find the Path|240|self ; Find Traps|120|120 Feet ;
Finger of Death|270|60 Feet ; Fireball|150|150 Feet ; Firebolt|60|120 Feet ;
Fire Shield|180|self ; Fire Storm|270|150 Feet ; Fire Blade|120|self ;
Flame Strike|210|60 Feet ; Flaming Sphere|120|60 Feet ; Flesh to Stone|240|60 Feet ;
Fly|150|touch ; Fog Cloud|90|120 Feet ; Forbiddance|240|touch ; Forcecage|270|100 Feet ;
Freedom of movement|180|touch ; Gaseous Form|150|touch ; Gate|330|60 Feet ; Geas|210|60 Feet ;
gentle repose|120|touch ; Gaint Insect|180|30 Feet ; glibness|300|self ;
Globe of Invulnerability|240|self ; Glyph of Warding|150|touch ; Goodberry|90|touch ;
Grasping Vine|180|30 Feet ; Grease|90|60 Feet ; Greater Invisibilty|180|touch ;
Greater Restoration|210|touch ; Guardian of faith|180|30 Feet ; Guards and Wards|240|touch ;
guidance|90|touch ; guiding bolt|90|120 ; Gust of wind|120|self ; Hail of Thorns|90|self ;
Hallow|210|touch ; Hallucinatory Terrain|180|300 Feet ; Harm|240|60 Feet ; Haste|150|30 Feet ;
Heal|240|60 Feet ; Healing word|90|60 Feet ; Heat Metal|120|60 Feet ;
Hellish Rebuke|90|60 Feet ; Heroism|90|touch ; Hex|90|90 Feet ; Hold|210|90 Feet ;
Holy Aura|300|Self ; Hunger of Hadar|150|90 Feet ; Hypnotic Pattern|150|120 Feet ;
Ice Storm|180|300 Feet ; Identify|90|touch ; Illusory Script|90|touch ;
imprisonment|330|30 Feet ; incendiary Cloud|300|150 Feet ; Inflict Wounds|90|touch ;
Insect Swarm|210|300 Feet ; Invisibilty|120|touch ; Jump|90|touch ; Knock|120|touch ;
Secret Chest|180|touch ; Secret Dome|150|touch ; Lesser Restoration|120|touch ;
Levitate|120|touch ; Light|60|touch ; Ligthing arrow|150|ranged attack ;
lighting bolt|150|100 Feet ; mage armor|60|touch ; Mage Hand|60|touch ;
Magic Circle|180|10 Feet ; Magic Jar|240|touch ; magic missel|90|120 Feet ;
Major Image|150|120 Feet ; mass cure wounds|210|60 Feet ; mass heal|330|60 Feet ;
Mass healing word|150| ; Mass suggestion|240|60 Feet ; maze|300|60 Feet ;
Melt into stone|150|touch ; acid arrow|120|90 feet ; mending|90|touch ;
meteor storm|330|1 mile ; Mind Blank|300|touch ; minor illiosooejeon|60|30 Feet ;
mirage arcane|270|sight ; mirror image|120|self ; mislead|210|self ; misty step|120|30 Feet ;
modify memory|210|touch ; moonbeam|120|120 Feet ; magnificent Mansion|270|300 Feet ;
Private Sanctum|180|120 ; mordekain's sword|270|60 Feet ; move earth|240|120 ;
Freezing sphere|240|300 Feet ; resilient sphere|180|30 Feet ; pass without a trace|120|touch ;
passwall|210|touch ; phantasamal force|120|60 Feet ; phantasmal killer|180|120 Feet ;
planar help|400|60 Feet ; planar binding|210|60 Feet ; plane shift|270|touch ;
plant growth|150|150 Feet ; Poison Spray|60|10 Feet ; Polymorph|180|60 Feet ;
Power Word Heal|330|touch ; Power Word Kill|330|60 Feet ; Power Word Stun|300|60 Feet ;
Prayer of Healing|120|30 Feet ; Prestidigitation|60|10 Feet ; Prismatic Spray|270|self ;
Prismatic wall|330|60 Feet ; Produce flame|60|30 Feet ; programmed illiusion|240|120 ;
Protection of enegery|150|touch ; protection from good or evil|90|touch ;
Protection form poison|120|touch ; purify food and drinks|90|touch ; raise death|210|touch ;
Telepatic link|210|touch ; ray of enfeeblement|120|60 Feet ; Ray of Frost|60|60 Feet ;
Ray of Sickness|90|60 Feet ; regenerate|270|Touch ; reincarnate|210|touch ;
remove curse|150|touch ; resurraction|270|touch ; reverse gravity|270|100 Feet ;
revifify|150|touch ; Sacred Flame|60|60 Feet ; Sanctuary|90|30 Feet ;
scorching ray|120|120 Feet ; Searing Smith|90|self ; See invisibilty|120|self ;
Seeming|210|30 Feet ; sequester|270|touch ; Shapechange|330|self ; shatter|120|60 Feet ;
Shield|90|self ; Shield of faith|90|60 Feet ; shocking grasp|60|touch ;
Silence|120|120 Feet ; Silent Image|90|60 Feet ; Simulacrum|270|touch ; Sleep|90|90 Feet ;
Sleet Storm|180|150 Feet ; slow|180|120 Feet ; spare the dying|60|touch ;
Speak with Animals|90|self ; Speak with dead|150|10 Feet ; Speak with plants|150|self ;
spider climb|120|self ; spike growth|120|150 Feet ; Spirit guardian|150|self ;
staggering smite|180|self ; stone shape|180|touch ; Stoneskin|180|touch ;
Strom of Vengeance|330|sight ; sunbeam|240|self ; sunburst|300|150 Feet ;
Swift Quiver|210|touch ; Symbol|270|touch ; telekiness|210|60 Feet ; teleport|270|10 Feet ;
teleportation circle|210|self ; floating disk|90|self ; thornwhip|60|self ;
Thunderous smite|90|self ; thunderwave|90|self ; time stop|330|self ; tongues|150|self ;
transport via plants|240|touch ; three stride|210|touch ; True polymorph|330|touch ;
true resurrection|330|touch ; True seeing|240|touch ; True strike|210|touch ;
Tsunami|300|sight ; vampire touch|150|touch ; vicious mockery|60|60 Feet ;
wall of fire|180|120 Feet ; wall of force|210|120 Feet ; wall of ice|240|120 Feet ;
Wall of stone|210|120 Feet ; wall of thorn|240|120 Feet ; water breathing|150|touch ;
water walk|150|touch ; Web|120|60 Feet ; wind walk|240|touch ; wind wall|150|120 Feet ;
witch bolt|90|30 Feet ; word of recall|180|5 Feet ; wrathfull Smite|90|touch ;
zone of truth|120|60 Feet ; abi-Dalzim's horrid wilting|300|150 Feet ;
Absorb Elements|90|self ; aganazzar"s scorcher|120|30 feet ; bones of the earth|240|120 Feet ;
Catnap|150|30 Feet ; Chaos bolt|90|120 Feet ; controle flames|60|60 Feet ;
controls wind|210|300 Feet ; create homunculus|240|touch ; crown of starts|270|self ;
danse macabre|210|60 Feet ; dawn|210|60 Feet ; Dragon's breath|120|touch ;
druid grove|240|touch ; dust devil|120|60 Feet ; earthbind|120|300 Feet ;
earth tremor|90|10 Feet ; elemental bane|180|90 Feet ; enemies abound|150|120 Feet ;
enervation|210|60 Feet ; erupting earth|150|120 Feet ; Far Step|210|60 Feet ;
flame arrow|150|touch ; frost bite|60|60 Feet ; guardian of nature|180|self ;
healing spirit|120|60 Feet ; Holy weapoin|210|touch ; ice knife|90|60 Feet ;
immolation|210|90 Feet ; infarnal calling|210|90 Feet ; investure of flames|240|self ;
investure of ice|240|self ; investure of stone|240|self ; investure of wind|240|self ;
invulnarabilty|330|self ; life transfer|150|touch ; madding darkness|330|150 Feet ;
maelstorm|210|120 Feet ; mass polymorph|330|120 Feet ; earthen grasp|120|30 Feet ;
minute meteors|150|self ; metal prison|240|60 Feet ; mighty fortress|1 Mile|270 ;
mind spike|120|60 Feet ; mold earth|60|30 Feet ; negative energy flood|210|60 Feet ;
primal savagery|60|self ; primoridial ward|240|self ; psychic Scream|330|90 Feet ;
scatter|240|30 Feet ; shadow blade|120|self ; shadow of moil|180|self ;
Sickening Radiance|180|120 Feet ; Snare|90|touch ; Snilloc's Snowball Swarm|120|90 Feet ;
Soul Cage|240|60 Feet ; Steel Wind Strike|210|30 Feet ; Storm Sphere|180|150 Feet ;
Summon Greater Demon|180|60 Feet ; Summon Lesser Demons|150|60 Feet ;
Synaptic Static|210|120 Feet ; Temple of the Gods|270|120 Feet ;
Tenser's Transformation|240|self ; Thunderclap|60|5 Feet ; Thunder Step|150|90 Feet ;
Tidal Wave|150|120 Feet ; Tiny Servant|150|touch ; toll the dead|60|60 Feet ;
transmute rock|210|120 Feet ; vitriolic Sphere|180|150 Feet ; wall of light|210|120 Feet ;
wall of sand|150|90 Feet ; wall of water|150|60 Feet ; warding wind|120|self ;
watery sphere|180|90 Feet ; whirlwind|270|300 Feet ; word of radiance|60|self ;
wrath of nature|210|120 Feet ; Zephyr Strike|90|self ; blade of disaster|330|60 Feet ;
booming blade|60|self ; dream of the blue veil|270|20 Feet ; green-flame blade|60|self ;
intellect fortress|150|30 Feet ; lightning lure|60|self ; mind sliver|60|60 Feet ;
spirit shroud|150|self ; summon aberration|180|90 Feet ; summon beast|90|90 Feet ;
summon celestial|210|90 Feet ; summon Construct|180|90 Feet ; summon elemental|180|90 Feet ;
summon fey|150|90 Feet ; summon fiend|240|90 Feet ; summon shadowspawn|150|90 Feet ;
summon undead|150|90 Feet ; Sword Burst|60|self ; Tasha's Caustic Brew|90|self ;
Tasha's mind whip|120|90 Feet ; tasha's otherworldly Guise|240|self ;
Ashardalon's Stride|150|self ; Draconic Transformation|270|self ;
Fizban's platinum shield|240|60 Feet ; nathair's mischief|90|60 Feet ;
raulothim's Psychic Lance|180|120 Feet ; Rime's Binding Ice|90|self ;
Summon Draconic Spirit|210|60 Feet ; Vortex Warp|120|90 Feet ; Wither and Bloom|120|60 Feet ;
air bubble|120|60 Feet ; Antagonize|150|30 Feet ; Spirit of Death|180|60 Feet ;
Spray of Cards|120|self ; Greater time stop|800|self ; Chaos Cloud|120|60 Feet
```

## What the app has today

Nothing — Concept 13 (Spell) was always a later-milestone entity. Mana exists as a resource pool
(`isResource`, `currentResourceValues`), which is the whole casting economy this needs.

## Parity gap

Prefix to mint: **`SPL`**. This is at least three tickets' worth (ticket-size limit):

1. **`Spell` entity + panel + fragment** — `{ id, name, description?, manaCost, rangeTime,
   effectTemplate }` on an optional `Configuration.spells`; a Configuration-mode panel
   (`ConfigPanelShell`, like every other); `spells.json` carrying all 418 rows with the anomalies
   above recorded (`#VERW!` effect imported as an empty template with a note — never invented
   text).
2. **Learned spells + the Spellbook view** — `Character.learnedSpellIds?: string[]`
   (absent-means-none, the sheet's `locked` default) and a play-mode spellbook that mirrors the
   sheet's own `Spellbook` tab: the learned subset with name, mana, range and *resolved* effect.
   The Setup tab's *Chosen abiltie* box is built into nothing (settled below).
3. **Casting** — a cast spends `manaCost` against the Mana pool through the existing
   resource actions (refuse-below-zero is already `adjustCurrentStatValue`'s discipline; the
   ticket decides refuse-vs-allow for insufficient mana with the User).
4. **Effect templating (D4)** — placeholders in `effectTemplate` evaluated per caster by the one
   formula engine at a new `spell-effect` attachment point in `scoping.ts`. The confirmed
   references (final stats, skill levels, skill **bonuses**) mean the point needs the
   `stats`/`skills`/`const`/`curve` namespaces including the `.bonus` reading a skill already has.
   Rendered resolved on the spellbook; edited with `FormulaEditor` + `FormulaPreview` (FORM-08's
   standing rule). The fragment work is real transcription: 326 formulas to convert from
   `"text " & cell & " text"` concatenation into template syntax, each naming its cells — and the
   `#VERW!` row imported as an empty template with a note.

## Backend note

New optional array in `ruleset.data`, new optional character field, casting through existing
shared resource actions. Server-resolved rolls are untouched (a spell cast is a resource spend,
not a dice roll — unless the effect says "Roll 4D6", which stays a player-driven roll through the
existing roll surface).

## Settled

- **Spells unlock manually** (User ruling, 2026-08-29) — a hand-set flag, exactly what the sheet
  does. No rule derives it, nothing gates it on a skill level. One transcription note: the
  Spellbook filter matches the flag **case-insensitively** (`"learned"` vs the `Learned` written
  in the cells), so both spellings are the same state.
- **"Chosen abiltie" is nothing yet** (same ruling) — a placeholder box, in the same class as
  "Passive abilites: Coming soon" and the empty actives tab (overview D5). Build nothing; do not
  wire it to `learnedSpellIds` or to a signature-spell concept. It is recorded here so the next
  workbook revision has something to land against.
- **Effect scaling** — the references are read from the formulas, above.
- **An unaffordable cast is refused, with the shortfall named** (User, 2026-08-31, TICKET-SPL-02) —
  *"Fireball costs 150 and Mana is at 100 — 50 short. Nothing was spent."* This is deliberately
  **not** `setResourceValue`'s behaviour, which is open at the bottom so a table can track bleeding
  out (Req 14.4): a Player *writing* a pool has said what the number is, where a Player *casting*
  has asked whether they can. Two neighbours follow from rules already on the books — an **unpriced**
  spell (`mighty fortress`) cannot be cast, because inventing a 0 would be inventing a number; and
  an **unlearned** one cannot, which is the Spellbook's filter enforced a second time for requests.
- **The Player names the pool at cast time** (same ruling) — nothing in a `Configuration` says which
  resource casting draws on, so `cast-spell` carries a `statId` and the Spellbook shows a *Cast from*
  selector only when the ruleset has more than one resource. Matching a stat *named* Mana was
  rejected: it hard-codes an English spelling into the engine and breaks on a rename — or on a
  ruleset written in Dutch, as this workbook is. A `Configuration.castingResourceStatId?` is where
  this goes if the ruleset should ever decide instead.

## Open questions

None.
