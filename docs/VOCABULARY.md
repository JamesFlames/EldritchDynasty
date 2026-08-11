# VOCABULARY

**Generated — run `npm run gen:docs`. Do not edit.**

Every closed vocabulary in the game, read off the schemas that define them.
Written so that authoring content or wiring an effect needs this file and
not `event.ts`, `conditions.ts`, `frequency.ts`, `person.ts` and `attributes.ts`.

`T?` optional · `T = x` defaults to x · `T[]` array · `A|B` one of

## Effects

What an outcome may do. The union is closed; `applyEffect` in
`core/src/events/effects.ts` ends in `assertNever`, so adding a kind is a
compile error until it is handled.

| kind | fields |
|---|---|
| `attribute` | `target: Target` `attr: string` `delta: number` |
| `trait` | `target: Target` `trait: string` `op: add\|remove` |
| `status` | `target: Target` `status: string` `cause: string?` |
| `madness` | `target: Target` `delta: number` |
| `heirloom` | `op: grant\|use\|transfer = "grant"` `heirloom: string` `to: string?` |
| `spellbook` | `op: gain\|lose\|degrade` `book: string` |
| `treasury` | `delta: number` |
| `respect` | `delta: number` |
| `flag` | `flag: string` `set: boolean \| number \| string` |
| `relationship` | `from: Target` `to: Target` `sentiment: number?` `grudge: {severity, inheritance}?` |
| `chronicle` | `text: string` |
| `knowledge` | `op: grant\|revoke` `flag: string` |
| `discrepancy` | `op: create\|prove\|bury` `id: string` `severity: minor\|major\|total?` `provableBy: string[]?` |
| `rumour` | `op: seed\|feed\|correct` `id: string` `accuracy: number?` |
| `clause` | `reveal: string` |
| `branch` | `op: appease\|slight` `slot: string?` `amount: number = 10` |
| `recast` | `slot: string` |
| `schedule` | `event: string` `inYears: number` |
| `arc` | `op: start\|advance\|cancel` `arc: string` |

**Target** — who an effect lands on: `{ slot }`, `{ all }`, `head`, `household`, `all_blood`, `children_of_head`.

## Conditions

Gate an event, an Age onset or an arc successor on world state. Named by
which key is present. `all` / `any` / `not` nest.

| condition | shape |
|---|---|
| `all` | `all: Condition[]` |
| `any` | `any: Condition[]` |
| `not` | `not: Condition` |
| `flag` | `flag: string` `is: boolean?` |
| `knowledge` | `knowledge: string` `has: boolean` |
| `respect` | `respect: {op, tier}` |
| `year` | `year: {op, value}` |
| `generation` | `generation: {op, value}` |
| `treasury` | `treasury: {op, value}` |
| `clausesRecovered` | `clausesRecovered: {op, value}` |
| `familyAny` | `familyAny: {attr, atLeast}` |
| `familySize` | `familySize: {op, value}` |
| `inRegency` | `inRegency: boolean` |
| `hasExpressingHead` | `hasExpressingHead: boolean` |
| `cadetBranches` | `cadetBranches: {op, value}` |
| `branchGrievance` | `branchGrievance: {op, value}` |
| `discontent` | `discontent: {op, value}` |
| `grudgeAgainstUs` | `grudgeAgainstUs: {op, value}` |
| `ageActive` | `ageActive: string` |
| `ageRegister` | `ageRegister: warm\|cold\|institutional` |
| `ageElapsed` | `ageElapsed: {op, years}` |
| `ageStacked` | `ageStacked: {op, count}` |
| `ageNamed` | `ageNamed: boolean` |
| `discrepancy` | `discrepancy: string` `state: open\|proven\|buried?` |
| `openDiscrepancies` | `openDiscrepancies: {op, value}` |
| `unlocked` | `unlocked: string` |

## Filters

Narrow a slot's candidates, or an heirloom's eligible bearers. Run against
one person at a time.

| filter | shape |
|---|---|
| `attr` | `attr: string` `op: lt\|lte\|eq\|gte\|gt\|ne` `value: number` |
| `trait` | `trait: string` `has: boolean` |
| `tag` | `tag: string` `has: boolean` |
| `sex` | `sex: male\|female` |
| `age` | `age: {op, value}` |
| `status` | `status: string[]` |
| `membership` | `membership: string[]` |
| `awakened` | `awakened: boolean` |
| `canExpress` | `canExpress: boolean` |
| `relation` | `relation: not\|child_of\|sibling_of\|spouse_of\|blood_of` `of: string` |
| `all` | `all: Filter[]` |
| `any` | `any: Filter[]` |
| `not` | `not: Filter` |

## Frequency

A rationing tier, not a weight synonym. It reaches into scheduling,
presentation, folklore and whether a Record choice is required.

| tier | cap | cooldown | record block | folklore | chronicle |
|---|---|---|---|---|---|
| `common` | none | none | forbidden | never | line |
| `uncommon` | none | 12 yr | optional | optional | paragraph |
| `rare` | 22/run | 55 yr | required | always | page, named |
| `mythic` | 3/run | 170 yr | required | always | illuminated, named |

## Enumerations

**SlotRole** — `head` · `family_member` · `spouse` · `child` · `sibling` · `cadet` · `unwoken` · `retainer` · `rival_house` · `outsider` · `heirloom` · `spellbook` · `tutor` · `rival` · `fragile` · `the_match` · `listener_record` · `listener_blood` · `guardian`
<br>Who a slot may cast. `core/src/events/slots.ts` narrows the pool.

**Purpose** — `advance_clause` · `change_relationship` · `worldbuild_through_action` · `establish_magic_rule` · `test_magic_rule` · `change_standing` · `plant_rumour` · `force_record_choice` · `buy_patience`
<br>Every template declares exactly three, all distinct.

**EventTier** — `individual` · `head` · `family` · `record` · `frame`
<br>`frame` events are filtered out of selection and nothing else reads them yet.

**Frequency** — `common` · `uncommon` · `rare` · `mythic`
<br>A rationing tier, not a weight synonym. See the table below.

**ChronicleWeight** — `line` · `paragraph` · `page` · `illuminated`
<br>How an entry renders. Decided by frequency, not authored.

**RespectTier** — `unknown` · `known` · `regarded` · `eminent` · `exalted`
<br>Ordered. Decay floors at `known`; `unknown` has to be done to you.

**Register** — `warm` · `cold` · `institutional`
<br>An Age's texture. Two Ages of one register never run consecutively.

**CompareOp** — `lt` · `lte` · `eq` · `gte` · `gt` · `ne`

**Sex** — `male` · `female`

**PersonStatus** — `alive` · `dead` · `vessel_consumed` · `missing` · `given_to_church` · `ascended` · `guardian`
<br>`guardian` is the Narrator after he crosses over — never `alive` again.

**MembershipKind** — `blood` · `married_in` · `retainer` · `ward` · `hostage` · `clergy` · `cadet` · `none`
<br>One OPEN record per person. Two puts them in two halls at once.

**RetainerRole** — `tutor` · `steward` · `guard` · `midwife` · `archivist` · `singer` · `physician` · `chronicler`
<br>An `archivist` in post is what makes an Age pay its clause.

**AttributeKind** — `core` · `affinity` · `eldritch` · `derived` · `hidden`
<br>The list of attributes is open; nothing in the engine counts them.

## The year

In order. Each phase draws from its own RNG stream, seeded from its name.
Source: `core/src/year/phases.ts`.

| # | phase | after | why |
|---|---|---|---|
| 1 | `ages` | — | An Age is the weather every other phase happens in, so it is decided first. |
| 2 | `lifecycle` | `ages` | Awakening, Madness and mortality all read the year the Age has just set. |
| 3 | `guardian` | `lifecycle` | He can only have crossed over in the pass that tried to kill him. |
| 4 | `quarrels` | `lifecycle` | Grudges pass to the living and posts fall vacant, both on this year's deaths. |
| 5 | `economy` | `quarrels` | Wages are owed to whoever is still in post after the contracts settle. |
| 6 | `succession` | `lifecycle` | The seat and the recurring cast refill on this year's vacancies. Without this the head, tutor and rival slots empty within a generation and the event pool silently collapses to nothing. |
| 7 | `branches` | `succession` | A son leaves the year his brother takes the seal, and not before. |
| 8 | `marriage` | `branches` | A bride joins the hall her husband is in, which the split has just decided. |
| 9 | `births` | `marriage` | A couple married this spring may conceive this year. |
| 10 | `arcs` | `births` | A substory casts from the living, and this year's dead and born are settled. |
| 11 | `ambient` | `arcs` | Substories get the year's attention before the ambient pool spends any of it. |
| 12 | `generation` | `ambient` | The generation counter gates content, so it turns over once everything else has. |

## Validation rules

Run one with `runRule(id, bundle)`. Source: `schema/src/rules.ts`.

| rule | what it is for |
|---|---|
| `ids/unique` | Two events with one id means one of them is unreachable, and save files name both. |
| `event/purposes` | CI gate 6. Exactly three distinct purposes, from the closed vocabulary (editor brief §4.5). |
| `frequency/obligations` | A tier is a set of duties, not a weight: Record blocks, folklore, caps, accounts. |
| `slots/references` | Every {TOKEN} in a body names a slot the event actually declares. |
| `slots/arc-bound` | A slot bound for a whole substory needs an arc, and an absent-body if it may go missing. |
| `madness/gate` | Madness may only be dealt to a target the slot has already gated to someone who can express. |
| `refs/known` | Ages, arcs and knowledge flags named by an event must be things that exist. |
| `discrepancy/wiring` | A Discrepancy proved or buried without ever being created cannot be found; provableBy must name a real house. |
| `arcs/wiring` | An arc that points at a node or an event that is not there dies silently at that node. |
| `outcomes/weights` | A group of outcomes whose weights sum to zero can never resolve. |
| `event/shape` | A choice with one option is narration; a body of twenty words is a stub. |
| `checks/wiring` | A Check must be declared to be named, its bands ordered highest-first, and every band must name a real outcome. |
| `ages/coverage` | An Age with no content of its own is a modifier wearing a name. |
| `clause/ages` | CI gate 7. A clause pinned to fewer than two Ages is a clause some runs never see. |
| `traits/mystic-restriction` | Women practise only the Threshold four (concept §9), so a female-tagged elemental trait is unlearnable. |
| `event/purpose-overlap` | CI gate 6. Three templates sharing all three purposes are three drafts of one event. |
| `prose/voice` | Bodies over five sentences are held to the countable half of the prose manual. |
