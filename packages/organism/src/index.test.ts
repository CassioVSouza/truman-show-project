import { describe, expect, test } from "vitest";
import {
  EMOTION_ATLAS,
  PACKAGE,
  PHYSIOLOGY_KEYS,
  ORGANISM_KEYS,
  advanceOrganism,
  applyAppraisal,
  consolidateMemories,
  deriveSurvival,
  derivePhysiology,
  emotionLabels,
  encodeMemoryBody,
  findLeaks,
  makeTemperament,
  newOrganism,
  reactivateMemory,
  renderReflexEvents,
  renderSensations,
  ruleAppraisal,
  shapeTemperament,
  type BodySignals,
  type OrganismRun,
  type RoutineEvent,
} from "./index";

const calmBody: BodySignals = {
  health: 100,
  satiety: 70,
  energy_reserve: 60,
  hydration: 80,
  core_temp: 37,
  wetness: 0,
  stamina: 90,
  sleep_pressure: 0.1,
  pain: 0,
  shiver: 0,
  sweat: 0,
  fever: 0,
  nausea: 0,
  illness: 0,
  asleep: false,
  wounds: [],
};

function sense(run: OrganismRun, body: BodySignals, tMin = 0) {
  const survival = deriveSurvival(body);
  const physiology = derivePhysiology(run.state, body, run.temperament, tMin);
  return renderSensations({
    physiology,
    survival,
    organism: run.state,
    body,
    temperament: run.temperament,
    tMin,
  });
}

describe("temperament and dynamics", () => {
  test("scaffold + seeded temperament", () => {
    expect(PACKAGE).toBe("organism");
    expect(makeTemperament(5)).toEqual(makeTemperament(5));
    expect(makeTemperament(5)).not.toEqual(makeTemperament(6));
    expect(makeTemperament(5).habituation_rate).toBeGreaterThan(0.1);
  });

  test("18 variables and 21 channels", () => {
    expect(ORGANISM_KEYS.length).toBe(18);
    expect(PHYSIOLOGY_KEYS.length).toBe(21);
  });

  test("catch-up equals minute stepping (constant body)", () => {
    const body = { ...calmBody, hydration: 20, pain: 0.4 };
    let a = newOrganism(3);
    for (let i = 0; i < 600; i++) a = advanceOrganism(a, body, 1);
    const b = advanceOrganism(newOrganism(3), body, 600);
    const c = advanceOrganism(advanceOrganism(newOrganism(3), body, 100), body, 500);
    for (const k of ORGANISM_KEYS) {
      expect(a.state[k]).toBeCloseTo(b.state[k], 9);
      expect(c.state[k]).toBeCloseTo(b.state[k], 9);
    }
  });

  test("stress decays slowly, arousal fast", () => {
    let r = newOrganism(1);
    r = applyAppraisal(r, ruleAppraisal("sudden_injury"), "injury");
    const s0 = r.state;
    const later = advanceOrganism(r, calmBody, 60).state;
    const arousalLeft =
      (later.arousal - r.temperament.baselines.arousal!) /
      (s0.arousal - r.temperament.baselines.arousal!);
    const stressLeft =
      (later.stress_load - r.temperament.baselines.stress_load!) /
      (s0.stress_load - r.temperament.baselines.stress_load!);
    expect(arousalLeft).toBeLessThan(stressLeft);
  });

  test("repeated stimuli habituate, strong ones sensitise", () => {
    let r = newOrganism(2);
    const mild = ruleAppraisal("loud_noise");
    const first =
      applyAppraisal(r, { ...mild, novelty: 0.5 }, "noise").state.arousal - r.state.arousal;
    for (let i = 0; i < 6; i++) r = applyAppraisal(r, { ...mild, novelty: 0.5 }, "noise");
    r = advanceOrganism(r, calmBody, 200);
    const before = r.state.arousal;
    const later = applyAppraisal(r, { ...mild, novelty: 0.5 }, "noise").state.arousal - before;
    expect(later).toBeLessThan(first);
    const strong = { ...mild, threat: 1, novelty: 1 };
    const hab = applyAppraisal(r, strong, "noise");
    expect(hab.habit.noise!.level).toBeLessThan(r.habit.noise!.level);
  });

  test("body deprivation moves the organism (thirst raises stress, lowers comfort)", () => {
    const base = advanceOrganism(newOrganism(4), calmBody, 600).state;
    const dry = advanceOrganism(newOrganism(4), { ...calmBody, hydration: 5 }, 600).state;
    expect(dry.stress_load).toBeGreaterThan(base.stress_load + 0.2);
    expect(dry.comfort).toBeLessThan(base.comfort);
    expect(dry.valence).toBeLessThan(base.valence);
  });

  test("rule table covers routine events with sane output", () => {
    const events: RoutineEvent[] = [
      "walk",
      "rest",
      "sleep",
      "wake",
      "eat",
      "drink",
      "warm_by_fire",
      "make_fire",
      "repeat_action",
      "quiet",
      "minor_injury",
      "sudden_injury",
      "sickened",
      "action_failed",
      "action_succeeded",
      "loud_noise",
      "dusk",
      "dawn",
    ];
    for (const e of events) {
      const r = applyAppraisal(newOrganism(1), ruleAppraisal(e), e);
      for (const k of ORGANISM_KEYS) expect(Number.isFinite(r.state[k])).toBe(true);
    }
    expect(applyAppraisal(newOrganism(1), ruleAppraisal("eat"), "e").state.valence).toBeGreaterThan(
      newOrganism(1).state.valence,
    );
  });

  test("temperament is shaped slowly by experience", () => {
    const t = makeTemperament(1);
    const t2 = shapeTemperament(t, { stress_load: 0.9 }, 0.01);
    expect(t2.baselines.stress_load!).toBeGreaterThan(t.baselines.stress_load!);
    expect(t2.baselines.stress_load! - t.baselines.stress_load!).toBeLessThan(0.02);
  });

  test("memory snapshot reactivates body state; sleep attenuates", () => {
    let r = newOrganism(1);
    r = applyAppraisal(r, ruleAppraisal("sudden_injury"), "x");
    const snap = encodeMemoryBody(r);
    const calm = advanceOrganism(r, calmBody, 1000);
    const recalled = reactivateMemory(calm, snap);
    expect(recalled.state.arousal).toBeGreaterThan(calm.state.arousal);
    const [slept] = consolidateMemories([snap], 8);
    expect(slept!.arousal).toBeLessThan(snap.arousal);
    expect(slept!.intensity).toBeLessThan(snap.intensity);
  });

  test("physiology is deterministic, bounded, 21 channels", () => {
    const r = newOrganism(1);
    const a = derivePhysiology(r.state, calmBody, r.temperament, 10);
    const b = derivePhysiology(r.state, calmBody, r.temperament, 10);
    expect(a).toEqual(b);
    expect(Object.keys(a).length).toBe(21);
    const hot = derivePhysiology(
      applyAppraisal(r, ruleAppraisal("sudden_injury"), "x").state,
      { ...calmBody, pain: 0.8 },
      r.temperament,
      10,
    );
    expect(hot.heart_rate).toBeGreaterThan(a.heart_rate);
  });
});

describe("sensation and urge templating", () => {
  test("thirsty, hungry, cold body produces body words and pulls", () => {
    const body = {
      ...calmBody,
      hydration: 5,
      satiety: 3,
      energy_reserve: 10,
      core_temp: 35.2,
      shiver: 0.8,
    };
    const run = advanceOrganism(newOrganism(1), body, 600);
    const s = sense(run, body, 600);
    expect(s.sentences.length).toBeGreaterThan(2);
    expect(s.text).toMatch(/mouth|tongue|throat/i);
    expect(s.urges.join(" ")).toMatch(/water|drink/i);
    expect(findLeaks(s.text)).toEqual([]);
  });

  test("wounds are described by location and quality", () => {
    const body = {
      ...calmBody,
      pain: 0.6,
      wounds: [{ type: "cut", location: "left hand", severity: 0.5 }],
    };
    const s = sense(advanceOrganism(newOrganism(1), body, 120), body);
    expect(s.text).toContain("left hand");
    expect(findLeaks(s.text)).toEqual([]);
  });

  test("asleep renders nothing; calm body renders little", () => {
    expect(sense(newOrganism(1), { ...calmBody, asleep: true }).text).toBe("");
    expect(sense(newOrganism(1), calmBody).sentences.length).toBeLessThanOrEqual(2);
  });

  test("deterministic, but wording varies across time windows and seeds", () => {
    const body = { ...calmBody, hydration: 20 };
    const run = advanceOrganism(newOrganism(1), body, 300);
    expect(sense(run, body, 300)).toEqual(sense(run, body, 300));
    const seen = new Set<string>();
    for (let w = 0; w < 12; w++) seen.add(sense(run, body, 300 + w * 200).text);
    expect(seen.size).toBeGreaterThan(1);
    const other = advanceOrganism(newOrganism(99), body, 300);
    const texts = new Set<string>();
    for (let sd = 1; sd < 8; sd++)
      texts.add(sense(advanceOrganism(newOrganism(sd), body, 300), body, 300).text);
    expect(texts.size).toBeGreaterThan(1);
    void other;
  });

  test("leak sweep: no emotion words, drive/variable names, numbers across hundreds of states", () => {
    let n = 0;
    const levels = [0, 0.3, 0.7, 1];
    for (const hydration of [100, 40, 5]) {
      for (const satiety of [90, 20, 0]) {
        for (const core of [34, 36, 37, 39.5]) {
          for (const pain of levels) {
            for (const fever of [0, 0.7]) {
              const body: BodySignals = {
                ...calmBody,
                hydration,
                satiety,
                energy_reserve: satiety,
                core_temp: core,
                pain,
                fever,
                nausea: fever,
                illness: fever,
                shiver: core < 36 ? 0.9 : 0,
                sweat: core > 38 ? 0.9 : 0,
                stamina: 100 - pain * 90,
                sleep_pressure: pain,
                health: 100 - pain * 90,
                wetness: 0.5,
                wounds:
                  pain > 0.2
                    ? [
                        {
                          type: ["cut", "bruise", "burn", "sprain", "bite"][n % 5]!,
                          location: "right forearm",
                          severity: pain,
                        },
                      ]
                    : [],
              };
              let run = advanceOrganism(newOrganism(n + 1), body, 400);
              run = applyAppraisal(
                run,
                ruleAppraisal(n % 2 ? "sudden_injury" : "action_succeeded"),
                "k",
              );
              for (const t of [0, 400, 5000]) {
                const s = sense(run, body, t);
                expect(findLeaks(s.text), s.text).toEqual([]);
                for (const u of s.urges) expect(u.length).toBeGreaterThan(5);
                n++;
              }
            }
          }
        }
      }
    }
    expect(n).toBeGreaterThan(800);
  });

  test("reflex events render as body sentences without leaks", () => {
    const lines = renderReflexEvents(
      [
        "withdraw_from_fire",
        "flinch",
        "vomit",
        "micro_sleep",
        "faint",
        "stumble",
        "shiver",
        "sweat",
        "wound_infected",
        "injury",
      ].map((kind) => ({ kind, data: { location: "left hand" } })),
      makeTemperament(1),
      10,
    );
    expect(lines.length).toBe(10);
    for (const l of lines) expect(findLeaks(l), l).toEqual([]);
  });

  test("leak scanner catches what it should", () => {
    expect(findLeaks("You are afraid.")).toContain("afraid");
    expect(findLeaks("Your hunger level is 40")).toEqual(
      expect.arrayContaining(["hunger", "level", "digit"]),
    );
    expect(findLeaks("This is love")).toContain("love");
    expect(findLeaks("A dry mouth and a pounding heart.")).toEqual([]);
  });
});

describe("emotion atlas (spectators only)", () => {
  test("50+ prototypes, top-3 weights sum to one, responds to state", () => {
    expect(Object.keys(EMOTION_ATLAS).length).toBeGreaterThanOrEqual(50);
    const hurt = applyAppraisal(newOrganism(1), ruleAppraisal("sudden_injury"), "x").state;
    const labels = emotionLabels(hurt);
    expect(labels.length).toBe(3);
    expect(labels.reduce((a, l) => a + l.weight, 0)).toBeCloseTo(1, 6);
    expect(emotionLabels(newOrganism(1).state)[0]!.label).not.toBe(labels[0]!.label);
  });
});
