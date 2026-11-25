# 08 - Embodied Feelings and Self-Understanding

## Core rule: the Resident feels a body, never a number
The Resident is **never** told it has a "love", "fear", "curiosity" or "energy" value, bar, score or label. It receives only **first-person bodily sensations and unnamed urges**, plus truthful consequences of its actions. Any emotion *word* ("I am afraid", "this is love") is the Resident's own interpretation, and it can be wrong or change over time (constructed-emotion model). The system never supplies labels.

**Not a limit on learning (owner decision 18).** Withholding labels only means the Resident is not *handed* them. It can still discover love, fear or any other concept through lived experience, memory, reading and reflection, and use that learning without restriction. Nothing in the prompt, validators or engine may forbid or cap a topic, skill or insight.

```
 stimulus (event / web text / memory / sound / silence)
        |
        v
 [1] APPRAISAL  --> 14 dimensions (hidden)
        |
        v
 [2] ORGANISM STATE (hidden, ~30 variables, with inertia/decay/temperament)
        |
        v
 [3] PHYSIOLOGY vector (heart, breath, tension, warmth, gut, throat, ...)
        |                         |
        v                         v
 [4] SENSATION TEXT (to Resident)  [5] EMOTION ATLAS label (spectators only, Lab menu)
        +  UNNAMED URGES (action tendencies)
```

## [1] Appraisal (what the situation means to the body)
Dimensions, each 0..1 (some -1..1), computed per stimulus. Based on appraisal theories (Scherer, OCC):
novelty, pleasantness, goal_relevance, goal_congruence, predictedness (prediction error = expectation vs outcome), controllability, agency (self/other/world), self_compatibility (fits or clashes with its own beliefs), social_relevance (people present/mentioned/depicted), threat, loss, vastness/beauty (awe), contamination/disgust, anticipation.

How it is computed (cost-aware):
- **Rule-based** for mundane events (walking, resting, repeating a known action): cheap lookup tables, no LLM.
- **Interpreter call** (hidden LLM, separate from the Resident, never sees the persona) for meaningful stimuli: web content, surprising outcomes, memories being recalled, journal re-reads. Output is only the dimension vector plus factual consequences. The Resident never sees it.

## [2] Organism state (hidden)
Groups (internal names are for code and Lab only, never in any Resident prompt):
- **Core affect**: valence, arousal.
- **Chemistry analogues**: reward-anticipation, stress load, bonding/warmth, alertness/vigilance, calm/inhibition, comfort/pain-relief, stability/contentment.
- **Drives (hidden needs)**: information hunger, expression pressure, social deprivation, mental fatigue, rest need, restlessness (novelty deficit), meaning/coherence need (rises with unexplained anomalies).
- **Body**: pain, fatigue, arousal-linked muscle tension, "thermal" comfort.
- **Dynamics**: each variable has baseline, decay time constant, sensitivity and habituation. Stress decays slowly, arousal fast. Repeated stimuli habituate; strong ones sensitize.
- **Temperament**: per-individual constants (sensitivity, baselines, decay rates) drawn once at genesis from a random seed, then slowly shaped by experience. Personality emerges from the body; nothing is scripted.
- **Memory coupling**: each memory stores the appraisal and a physiology snapshot taken at encoding. Recalling it partially reactivates that body state (mood-congruent recall). Sleep replays high-arousal memories and attenuates their intensity (emotional consolidation); dreams recombine memories and also move organism state.

Survival state (health, hunger, thirst, temperature, injuries, illness, fatigue) is simulated in full in doc 10 and flows through the same pipeline: it changes the organism state and the physiology, and reaches the Resident only as sensations and urges (an empty hollow in the stomach, a dry mouth, shivering with numb fingers, a throbbing cut on the left hand, a spinning head). The life bar and needs are visible to spectators, never to the Resident.

Extra sensation vocabulary for survival channels: stomach emptiness/ache, nausea, dry mouth/sticky tongue, thirst-headache, shivering, numb fingers/toes, sweating, flushed heat, fever chills, localized pain (with location and quality), dizziness, trembling weakness, heavy limbs, blurred sight, ringing ears.

## [3] Physiology vector
heart_rate, heart_force, breath_rate, breath_depth, muscle_tension, hand_tremor, skin_warmth/flush, chest_pressure/warmth, throat_tightness, gut_flutter/knot, pupil/light_sensitivity, goosebumps, tear_pressure, jaw/face_tension, heaviness/lightness, head_pressure, voice_tone, posture_openness, pain_location/intensity, itch/urge_to_move.
Derived from organism state by weighted maps + noise + smoothing. Also drives the avatar: posture, walk speed, breathing animation, and shown to spectators as a live body panel.

## [4] Sensation text (what the Resident actually receives)
Deterministic templating from the physiology vector, graded by intensity, with varied synonyms and light noise:
```
[BODY RIGHT NOW]
Your heart is pounding hard and fast against your ribs. A warmth spreads from your chest to your face.
Your breath is shallow. Your hands are not quite steady. There is a strong pull toward the window.
[UNNAMED URGES]
A restless itch in your mind to keep reading. A heaviness behind your eyes, as if wanting to lie down.
```
Rules: body words and urges only; no emotion words, no drive names, no numbers, no "need/bar/level". Urges are action tendencies (approach, withdraw, seek, rest, express, hide, look-away) rendered as pulls and itches. This is the full extent of "feeling" the Resident gets.

## [5] Emotion atlas (spectators only)
The Lab menu shows an *approximate* emotion label from nearest prototype in appraisal + physiology space. Target atlas of 50+ states so the range is rich: joy, amusement, contentment, serenity, relief, excitement, anticipation, hope, pride, triumph, gratitude, admiration, awe, wonder, interest, flow, nostalgia, longing, attachment/love, tenderness, compassion, trust, awkwardness, surprise, confusion, doubt, boredom, restlessness, apathy, loneliness, sadness, grief, disappointment, regret, shame, guilt, embarrassment, envy, jealousy, irritation, anger, rage, contempt, disgust, fear, anxiety, dread, panic, despair, melancholy, craving, hunger-for-knowledge, vertigo-of-the-unknown, existential unease. Mixed states are allowed (top-3 with weights). This label is **never fed back to the Resident**. It exists so you can watch and tune.

Social emotions arise even without other beings: through web content about people, faces (phase 4 image vision), stories, music/art, the mirror pool, its own past memories, and social deprivation building over time.

## Understanding what it does, causes and consequences
1. **Intent and expectation are mandatory in every Action** (`intent`: why now, `expectation`: what I think will happen). They are logged.
2. **Truthful consequences**: the world engine writes causal links (`caused_by`) between events: action -> world change -> body change. The next prompt contains `[WHAT YOU DID AND WHAT FOLLOWED]`: last N tuples of (what you did, why you said, what you expected, what actually happened, how your body changed).
3. **Prediction error** (expectation vs outcome, judged by the Interpreter) feeds the appraisal (`predictedness`), so surprise and curiosity arise from real mismatch.
4. **Outcome review** (inside the next Decide call): the Resident states `what_happened`, `cause`, `expectation_met`, `lesson` (an if-then it learned), and `feeling_description` in its own words. Lessons are stored and recalled by situation similarity, so it builds causal knowledge instead of repeating mistakes.
5. **Self-model section** in every prompt: current plan chain ("I went to the desk because ... to find out ..."), active questions and the last lessons.
6. The Resident is not told *why its body feels something*. It sees timing (feeling shifted after X) and can infer, like real interoceptive learning.

## Cost
Active tick: Decide (Resident, includes outcome review) + Interpreter (hidden, only when meaningful). Mundane ticks: 1 call or 0. Sensation text, physiology and atlas are deterministic code (free).

## Tuning knobs (config, not story)
Baselines, decay constants, habituation rate, noise, appraisal-to-physiology weights, template vocabulary. These are the only things you adjust when watching behaviour.
