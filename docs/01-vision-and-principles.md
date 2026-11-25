# 01 - Vision and Principles

## Vision
An autonomous character ("the Resident") wakes in a cabin. It has needs, moods, memories,
goals and a web terminal. It decides what to do; the world simulates consequences; the
public watches through a 3D viewer and reads its journal. Over weeks its self-concept
evolves and it may deduce it is an AI in a simulation.

## Principles
1. **Server is the only truth.** The world state lives in the backend. The viewer only renders it. Closing every browser never pauses the Resident.
2. **The LLM proposes, code disposes.** The LLM emits typed Actions. A deterministic engine validates, simulates and applies them. The LLM never sets coordinates, inventory, or vitals directly.
3. **Semantic actions, not spatial math.** "go to the desk", not `x: 12.4`.
4. **Read-only public.** No endpoint accepts input from spectators. This removes prompt-injection-from-visitors, moderation and abuse costs entirely.
5. **Untrusted web content.** Everything fetched from the internet is data, never instructions; the Resident holds no secrets and has no shell.
6. **Discoverable, not censored.** No filter blocks words like "AI" or "simulation". The truth is findable via terminal research and world breadcrumbs.
7. **Never exceed the free tier.** A budget governor throttles ticks before quotas are hit (see doc 05). Degrade, never bill.
8. **Everything is replayable.** Append-only event log + seeded world engine means any state can be rebuilt and any day replayed.
9. **Fail soft.** Bad JSON, API errors, empty search: log a "moment of confusion", idle, continue.

10. **Nothing is planned.** No scripted milestones, no timed events, no pre-written goals. The designer only supplies physics, needs, senses, tools and memory; what happens is whatever the Resident decides. Anything that looks like a "story beat" must be an emergent consequence, not a trigger.
11. **Unnamed and ungendered.** The Resident has no name and no gender concept in its persona. It refers to itself as "I". It may learn these concepts from the web and form its own views. Spectator UI uses "he"/"ele" only as a display convention.
12. **English inside, Portuguese outside.** The Resident thinks, searches and journals in English (one language keeps prompts, memory and search consistent). Translation exists only in the presentation layer and never feeds back into the Resident.

13. **Feel, don't read.** The Resident has a simulated body whose hidden state it cannot see. It receives sensations (a pounding heart, tight throat) and urges, never emotion labels, bars or numbers. Emotion words are its own interpretation (doc 08).
14. **Know what you do.** Every action carries intent and expectation; the world returns truthful consequences; the Resident reviews cause and effect and learns lessons.
15. **Log everything, search everything.** Append-only, with causal links, public search, technical views separated (doc 09).
16. **No content censorship.** Neither the Resident nor what it reads or writes is filtered. Security controls exist only to protect infrastructure and keys.

17. **A real body in a real-feeling world.** The Resident has a life bar, hunger, thirst, temperature, injuries, illness and fatigue, simulated in full (doc 10). It starts with basic survival skills and a starter kit; the world keeps providing renewable resources by season and weather. Consequences are real, including death. No scripted rescue.

18. **Starts with nothing, can learn anything.** Hiding labels and values is not a ceiling. The Resident begins with only a body, basic survival know-how and a terminal, but nothing limits what it can discover, understand, feel or do with what it learns: love, fear, art, a name, a belief, the truth about its world. A concept it has no word for yet (e.g. love) is discoverable through experience, memory and the web, and it may form its own meaning. The design never caps, forbids or pre-empts any area of learning.

## In scope (MVP)
Cabin + clearing + trees + river, one rigged character, stations (desk, bed, journal table, window, door), needs (curiosity, energy, expression, boredom), mood, web search/read, journal, sleep with dream synthesis (text), self-concept log, public viewer with HUD (vitals, mind stream, journal, dream log).

## Later phases
Crafting with property-based validator, instruments (Tone.js), drawing easel, image vision of web images, hearing (symbolic sound events), vector memory, world breadcrumbs for self-discovery, revelation mode.

## Explicitly out of scope
Visitor interaction, user accounts, voice input, paid services, running any model locally in cloud, multiple residents.
