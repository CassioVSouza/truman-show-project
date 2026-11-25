# 10 - Body, Mind, Survival and the Living World

The Resident is simulated as an organism in an environment. **Bars, rates and thresholds live in the engine and are visible to spectators (HUD + Lab). The Resident only receives sensations and urges derived from them (doc 08), plus truthful consequences.** All numbers below are config defaults to tune while watching, not fixed truths.

## 1. Body systems (engine truth)
| System | State | Dynamics |
|---|---|---|
| **Health ("life bar")** 0-100 | `health` | Regenerates slowly (+~1/h) when needs are met and no illness; drained by starvation, dehydration, hypothermia/hyperthermia, injuries, infection, poison. 0 = death |
| **Nutrition** | `satiety` (stomach, drains ~2/h), `energy_reserve` (long-term, drains only when satiety is empty), `nutrient_balance` (variety matters slowly) | Eating food adds satiety/reserve by item; spoiled/toxic food adds illness risk |
| **Hydration** | `hydration` (drains ~4/h, faster when hot/active) | Water sources: spring (clean), river (carries illness risk unless boiled), rain, jar |
| **Thermoregulation** | `core_temp` (37 C), `skin_temp`, `wetness` | Ambient (season, time of day, weather, wind) + insulation (clothing, blanket, shelter, fire) + activity heat + wetness. <35 C hypothermia damage; >39 C heatstroke. Shivering, sweating are physiology channels |
| **Energy / stamina** | `stamina`, `sleep_pressure`, `circadian_phase` | Activity drains stamina; sleep pressure builds ~while awake, drops in sleep; very low stamina or extreme sleep pressure forces micro-sleep (reflex) |
| **Injury** | list of wounds: type (cut, bruise, burn, sprain), location, severity, infected? | Heals with time and care; untreated cuts can infect; sprains slow movement |
| **Illness / immune** | `immune`, active conditions (food poisoning, fever, cold, infection) | Triggered by contaminated water, bad food, cold exposure, wounds; resolved by rest, fluids, warmth, herbs/treatment, immune strength |
| **Pain** | derived from injuries and illness | Narrows attention, raises stress, changes sensations |
| **Senses** | vision range by light, hearing range by noise/weather | Night and fog reduce what perception returns |
| **Hygiene (optional later)** | dirt, wound cleanliness | Raises infection risk |

Derived death causes: `starvation`, `dehydration`, `exposure`, `injury`, `illness`, `poisoning` (logged with a full causal chain).

## 2. Mind systems (engine truth + real effects on prompts)
| System | Effect |
|---|---|
| Attention | Arousal/pain/stress narrow it: perception returns fewer details (tunnel vision), fatigue blurs distant items |
| Working memory | Number of recalled memories and history tuples in the prompt scales down with mental fatigue and sleep deprivation |
| Long-term memory | Forgetting curve: recall probability decays with age, boosted by importance, emotion, rehearsal; consolidation during sleep |
| Learning | Skill levels rise with practice (diminishing returns); lessons stored; habituation lowers repeated responses |
| Motivation | Drives compete by strength (hunger, thirst, cold, fatigue, curiosity, social, expression). Strongest unmet urges dominate the sensation text; no explicit priority list is given |
| Emotion and mood | Appraisal -> organism state -> physiology (doc 08); mood is slow-moving average of core affect |
| Stress and coping | Stress load rises with threat/pain/deprivation; controllability and past success lower it |
| Cognitive fatigue | Noisier, shorter, more impulsive decisions: LLM `temperature` rises, `maxOutputTokens` and recalled context shrink |
| Sleep deprivation | Perception noise, irritability, micro-sleeps, impaired recall |
| Self-model | Plan chain, lessons, beliefs, own feeling descriptions (doc 08) |
| Metacognition | Outcome review each tick (cause, expectation, lesson) |

## 3. Survival skills at birth
Skills are competence levels (0-100) hidden from the Resident as numbers; it learns its own competence from outcomes, memory and short qualitative skill hints (`your hands are practiced / clumsy at...`).

| Skill | Start | Effect |
|---|---|---|
| Drinking & water safety (boil) | 30 | knows to drink; knows boiling cleans water but must still do it |
| Foraging (common safe plants/berries) | 25 | success and correct identification; toxic look-alikes exist, skill lowers poison risk |
| Fire-making | 25 | success chance from flint+steel with dry tinder, lower in rain/wet |
| Fire tending | 25 | keep fire alive, warmth yield |
| Basic shelter / warmth | 20 | blanket, layers, cabin upkeep |
| First aid | 20 | clean/bandage wounds, rest |
| Cooking | 15 | safety and nutrition from food |
| Woodcutting (hand tools) | 10 | gather firewood |
| Fishing | 0 | needs learning and tools |
| Crafting | 0 | phase 3 |
These are capability, not story or goals: the Resident still chooses what to do. A short list of **innate know-how** (procedural, no narrative) is provided in the prompt as `[WHAT YOUR HANDS KNOW]` (how to drink, eat, light a fire, rest, bind a wound). Everything else is discovered through the web, trial and memory.

## 4. The world gives resources (natural, no rescue scripts)
**Starter kit in and around the cabin** (finite, visible, discoverable by looking): water jar (full), ~6 portions of dried food, a few fruits, firewood stack (several fires' worth), flint-and-steel, tinder, knife, cooking pot, wool blanket, simple clothing worn, bed, first-aid scraps (cloth).
**Renewable resources in the map:** spring (clean water), river (illness risk), berry bushes (safe + toxic look-alike), fruit trees (seasonal), edible roots and herbs (some medicinal), mushrooms (edible/toxic), fish (needs skill and a tool), trees (wood), stones, flint, clay, reeds, small animals (phase 3).
**Economy model:** each node has capacity, regrowth (logistic with season modulation), yield per gather by skill/tool, depletion and recovery time. Weather (rain, drought, snow) and season change regrowth and temperature. **Gentle start:** a configurable abundance multiplier (default 1.5x) fades linearly to 1.0 over the first 14 days so a first inexperienced week is survivable but not guaranteed. After that, the world is plain and consistent.
Seasons: configurable length (`SEASON_DAYS`, default 14 real days per season) so changes are watchable. Day/night follows real time.

## 5. Autonomic reflexes (engine, no LLM)
Ticks are 10 minutes apart; the body must not be helpless between them. Reflexes are deterministic and logged: withdraw hand from fire (burn avoided), shiver, sweat, flinch, vomit after toxin, micro-sleep at exhaustion, faint at very low health, stumble when exhausted. Reflexes never choose goals or meaningful survival actions (eating, fire, shelter remain the Resident's decisions).
**Early wake:** crossing a critical threshold (sudden injury, severe hypothermia onset, health < 25, fire out in cold, etc.) schedules an extra tick within ~1-2 minutes, if the governor allows. Otherwise the engine continues the current macro-action safely.

## 6. Actions (macro-actions with durations)
One decision covers a duration (e.g. forage 30 min, rest 4 h). While it runs, the engine advances the body each minute. New actions: `eat(item)`, `drink(source)`, `gather(target)`, `make_fire`, `tend_fire`, `cook(item)`, `boil_water`, `wear/remove(item)`, `treat_wound`, `sleep/rest`, `use_item`, `build/repair_shelter`, `fish`, `chop`. Phase 3 adds `craft`, `play_instrument`, `draw`.

## 7. Death
Health reaching 0 ends that life: a causal death report is logged (what led to it, body timeline), the Resident is marked `dead`, the world freezes and the viewer switches to memorial/replay. Default design: **no respawn**, no scripted rescue. Whether another life may begin is your decision (doc 07).

## 8. Starting tuning (all config; expect changes)
satiety -2/h, hydration -4/h (x1.5 hot), stamina -3.5/h awake, sleep restores +12/h, health regen +1/h (needs met), starvation -2 health/h after reserves empty, dehydration -4 health/h at 0, hypothermia -3/h below 35 C, river water illness chance 35% without boiling (lower with immunity/skill), toxic look-alike berry ~20% of unidentified. Validate with a simulated 14-day run (Phase 1 test) that a competent policy survives, a random policy usually dies after ~day 4-6, and an idle policy dies by dehydration around day 2.
