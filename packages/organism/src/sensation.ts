// Sensation + urge templating: the ONLY bridge from hidden state to the Resident.
// Plain bodily language. No emotion words, no drive/variable names, no numbers, no "need/bar/level".
// Deterministic: wording depends on (temperament.seed, feeling id, time window).
import { DEFAULT_ORGANISM_CONFIG, type OrganismConfig } from "./config";
import { bodyDrives } from "./survival";
import { hash32, strHash, unitAt } from "./rng";
import type {
  BodySignals,
  OrganismState,
  Physiology,
  SurvivalChannels,
  Temperament,
} from "./types";

type Bank = readonly [readonly string[], readonly string[], readonly string[]]; // mild, moderate, strong

const S: Record<string, Bank> = {
  stomach_emptiness: [
    [
      "There is a faint hollow low in your stomach.",
      "Your stomach feels a little empty.",
      "A slight gnawing stirs under your ribs.",
    ],
    [
      "Your stomach is hollow and clenching.",
      "A steady gnawing sits under your ribs.",
      "Your stomach growls and aches with emptiness.",
    ],
    [
      "Your stomach is a hollow, cramping fist.",
      "A sharp, twisting emptiness grips your belly.",
      "Your belly aches savagely with emptiness.",
    ],
  ],
  stomach_ache: [
    [
      "A dull, sour ache lies in your belly.",
      "Your belly feels slack and sore.",
      "A low ache drags at your middle.",
    ],
    [
      "A sour ache spreads through your belly.",
      "Your belly is sore and sunken.",
      "A dragging ache pulls at your middle.",
    ],
    [
      "Your belly burns with a sour, wasting ache.",
      "A deep gnawing ache eats at your middle.",
      "Your belly feels scraped raw from inside.",
    ],
  ],
  nausea: [
    [
      "Your stomach turns faintly and your mouth waters.",
      "A slight queasy swirl moves in your belly.",
      "Something unsettled rolls in your stomach.",
    ],
    [
      "Waves of sickness roll through your belly.",
      "Your stomach churns and sour wetness gathers in your mouth.",
      "Your gut lurches and your skin turns clammy.",
    ],
    [
      "Your stomach heaves and sour wetness floods your mouth.",
      "Sickness rises in violent waves from your gut.",
      "Your belly twists and everything in you wants to come up.",
    ],
  ],
  dry_mouth: [
    [
      "Your mouth is a little dry.",
      "Your tongue feels slightly sticky.",
      "Your lips feel dry when you press them together.",
    ],
    [
      "Your mouth is dry and your tongue sticks to its roof.",
      "Your lips are dry and your swallow is hard.",
      "Your mouth feels coated and pasty.",
    ],
    [
      "Your tongue is thick and your throat is like sand.",
      "Your mouth is parched and your lips are cracked.",
      "Your throat is raw and dry when you swallow.",
    ],
  ],
  shivering: [
    [
      "A small shiver runs across your shoulders.",
      "A chill ripples over your back.",
      "Your skin prickles with cold.",
    ],
    [
      "You shiver in long waves and your teeth chatter.",
      "Cold shudders run through you.",
      "You shake with cold and cannot warm yourself.",
    ],
    [
      "Your whole body shakes hard with cold.",
      "You cannot hold your jaw still for shaking.",
      "Violent shudders rack you from head to foot.",
    ],
  ],
  numb_extremities: [
    [
      "Your fingers and toes feel cool and stiff.",
      "Your fingertips are cold and a bit stiff.",
      "Your feet feel cold and far away.",
    ],
    [
      "Your fingers and toes are numb and clumsy.",
      "Your hands are stiff and fumbling with cold.",
      "Your toes have gone numb.",
    ],
    [
      "You can barely feel your hands and feet; they feel like wood.",
      "Your fingers will not close; they feel like stone.",
      "Your hands and feet are dead weights.",
    ],
  ],
  sweating: [
    ["Your skin is damp.", "A light sweat beads on your skin.", "Your palms are damp."],
    [
      "Sweat runs down your back and temples.",
      "Your clothes cling with sweat.",
      "Sweat gathers and drips from your brow.",
    ],
    [
      "Sweat pours from you and soaks your clothes.",
      "You are drenched in sweat.",
      "Sweat streams down your face and stings your eyes.",
    ],
  ],
  flushed_heat: [
    [
      "Your skin feels warm.",
      "A mild heat sits in your face.",
      "You feel warmer than you would like.",
    ],
    [
      "Heat prickles across your face and chest.",
      "Your skin is hot and flushed.",
      "Your body is hot and your face is burning.",
    ],
    [
      "Your face burns and your body feels baked from inside.",
      "Heat presses on you from every side.",
      "You are burning up, skin tight and hot.",
    ],
  ],
  fever_chills: [
    [
      "A thin chill runs beneath warm skin.",
      "Your skin feels hot while shivers flicker under it.",
      "Cold flickers run under your skin.",
    ],
    [
      "Cold shivers ripple under hot, dry skin.",
      "You are hot and cold at once.",
      "Your skin burns while your bones feel cold.",
    ],
    [
      "Hot and cold waves crash through you; your bones ache.",
      "Your skin burns and you shake from the inside.",
      "You are shaking and scorched at the same time.",
    ],
  ],
  dizziness: [
    [
      "The room tilts slightly when you turn your head.",
      "A faint swimming comes and goes in your head.",
      "Standing up makes your head float.",
    ],
    [
      "The ground sways under you and you steady yourself.",
      "Your head swims whenever you move.",
      "The edges of things drift and slide.",
    ],
    [
      "Everything spins and your knees go loose.",
      "The world lurches and you cannot rely on your feet.",
      "Your head reels and the floor seems to rise.",
    ],
  ],
  trembling_weakness: [
    [
      "Your limbs feel a little unsteady.",
      "A faint weakness runs through your arms.",
      "Your legs feel slightly soft.",
    ],
    [
      "Your arms and legs tremble and feel weak.",
      "Your knees shake when you stand.",
      "Your strength drains from your limbs.",
    ],
    [
      "Your whole body trembles and your legs barely hold you.",
      "Your arms are too weak to lift much.",
      "You shake with weakness at every movement.",
    ],
  ],
  blurred_sight: [
    [
      "Your sight is slightly soft at the edges.",
      "Things look a little hazy.",
      "A thin haze lies over what you see.",
    ],
    [
      "Things in the distance smear and swim.",
      "Your sight blurs and clears and blurs again.",
      "Your eyes will not hold a clear picture.",
    ],
    [
      "Your sight swims and dark spots drift across it.",
      "The world blurs and darkens at the edges.",
      "You see only smears and shadows.",
    ],
  ],
  ringing_ears: [
    [
      "A faint thin whine sits in your ears.",
      "Your ears hum quietly.",
      "A tiny high note rings in your ears.",
    ],
    [
      "A high ringing fills your ears.",
      "Your ears ring and sounds seem far off.",
      "A steady whine presses in your ears.",
    ],
    [
      "A loud ringing drowns out the world.",
      "Your ears roar and the world sounds distant.",
      "A shrill ringing swallows every other sound.",
    ],
  ],
  heartbeat: [
    [
      "Your pulse is a little quick.",
      "You can feel your heartbeat in your chest.",
      "Your heart beats faster than usual.",
    ],
    [
      "Your heart pounds hard and fast against your ribs.",
      "Your pulse thuds in your throat and wrists.",
      "Your heart races and you can feel every beat.",
    ],
    [
      "Your heart hammers so hard it shakes your chest.",
      "Your heart slams against your ribs.",
      "Your pulse roars in your ears.",
    ],
  ],
  breath: [
    [
      "Your breath comes a little quicker than usual.",
      "Your breathing is lighter and higher in your chest.",
      "You notice your own breathing.",
    ],
    [
      "Your breath is shallow and fast.",
      "You breathe in quick, short pulls.",
      "Your breathing is quick and catches at the top.",
    ],
    [
      "You gasp for air and cannot get a full breath.",
      "Your breath tears in and out of you.",
      "Your lungs heave and still feel empty.",
    ],
  ],
  muscle_tension: [
    [
      "Your shoulders are a little stiff.",
      "Your muscles hold a faint tightness.",
      "Your neck feels slightly drawn.",
    ],
    [
      "Your muscles are tight and braced.",
      "Your shoulders are hunched and hard.",
      "Your back and neck are drawn tight.",
    ],
    [
      "Every muscle is clamped hard.",
      "Your body is rigid and braced as if for a blow.",
      "Your muscles are locked and aching.",
    ],
  ],
  hand_tremor: [
    [
      "Your hands are not quite steady.",
      "A faint tremor runs through your fingers.",
      "Your fingers feel slightly jittery.",
    ],
    [
      "Your hands tremble.",
      "Your fingers shake when you hold them out.",
      "Your hands twitch and will not settle.",
    ],
    [
      "Your hands shake so much you cannot hold them still.",
      "Your hands rattle and cannot grip.",
      "Your fingers jerk and flutter uncontrollably.",
    ],
  ],
  chest_warmth: [
    [
      "A soft warmth sits in your chest.",
      "There is a gentle warmth behind your breastbone.",
      "Your chest feels faintly warm.",
    ],
    [
      "A spreading warmth fills your chest.",
      "Your chest glows warm and open.",
      "A warm ease spreads through your chest and shoulders.",
    ],
    [
      "A deep glow of warmth fills your chest up to your throat.",
      "Your chest is full of a rich, spreading warmth.",
      "Warmth floods from your chest to your face.",
    ],
  ],
  chest_pressure: [
    [
      "A faint weight sits on your chest.",
      "Your chest feels slightly snug.",
      "A slight pressure rests under your breastbone.",
    ],
    [
      "Your chest feels tight and pressed.",
      "A heavy weight presses on your chest.",
      "Your chest is bound by a tightening band.",
    ],
    [
      "Your chest is clamped as if bound by an iron band.",
      "A crushing weight sits on your chest.",
      "Your chest is so tight each breath is hard won.",
    ],
  ],
  throat_tightness: [
    [
      "Your throat feels a little narrow.",
      "You notice a slight catch in your throat.",
      "Swallowing feels faintly effortful.",
    ],
    [
      "Your throat is tight when you swallow.",
      "A lump sits in your throat.",
      "Your throat is drawn and tight.",
    ],
    [
      "Your throat is clenched almost shut.",
      "A hard knot chokes your throat.",
      "You can scarcely swallow past the tightness.",
    ],
  ],
  gut_knot: [
    [
      "A small knot sits in your belly.",
      "Your belly feels slightly tied up.",
      "A faint tightness curls in your gut.",
    ],
    [
      "Your belly is knotted and tight.",
      "A hard knot twists in your gut.",
      "Your gut feels wrung.",
    ],
    [
      "Your gut is wrung into a hard, sick knot.",
      "A tight cold knot clamps your belly.",
      "Your belly is twisted so tight it hurts.",
    ],
  ],
  gut_flutter: [
    [
      "Something flutters faintly low in your belly.",
      "A light quiver moves in your stomach.",
      "Your belly feels lightly stirred.",
    ],
    [
      "Your belly flutters and swoops.",
      "A restless fluttering runs through your stomach.",
      "Your stomach dips and lifts.",
    ],
    [
      "Your belly swoops and tumbles.",
      "Your stomach is a tumble of wings.",
      "Your gut flips over and over.",
    ],
  ],
  goosebumps: [
    [
      "Fine hairs rise on your arms.",
      "A light prickle moves over your skin.",
      "Your arms pebble slightly.",
    ],
    [
      "Gooseflesh prickles over your arms and neck.",
      "Your skin ripples with prickles.",
      "The hair on your neck stands up.",
    ],
    [
      "Your skin crawls with gooseflesh from head to foot.",
      "Every hair on your body stands on end.",
      "Your whole skin ripples and prickles.",
    ],
  ],
  tear_pressure: [
    [
      "Your eyes sting slightly.",
      "A faint wetness gathers at your eyes.",
      "Your eyes feel a little full.",
    ],
    [
      "Your eyes burn and fill.",
      "Your eyes are hot and brimming.",
      "A hot pressure builds behind your eyes.",
    ],
    [
      "Your eyes spill over and your chest hitches.",
      "Tears run hot down your face.",
      "Your face crumples and your eyes overflow.",
    ],
  ],
  face_tension: [
    [
      "Your jaw is a little tight.",
      "Your brow feels slightly drawn.",
      "Your face holds a faint tightness.",
    ],
    [
      "Your jaw is clenched and your brow drawn.",
      "Your face feels tight and set.",
      "Your teeth are pressed together.",
    ],
    [
      "Your jaw is locked and your face is pulled taut.",
      "Your teeth are clamped so hard they ache.",
      "Your whole face is drawn and rigid.",
    ],
  ],
  heaviness: [
    [
      "Your limbs feel a little heavy.",
      "A slight heaviness lies in your arms and legs.",
      "Your body feels slightly weighted.",
    ],
    [
      "Your arms and legs feel weighted and slow.",
      "Your limbs drag when you move.",
      "A thick heaviness presses on your body.",
    ],
    [
      "Your limbs are lead; lifting a hand takes effort.",
      "You feel poured full of lead.",
      "Every movement drags as if through mud.",
    ],
  ],
  head_pressure: [
    [
      "A faint pressure sits in your head.",
      "A dull throb begins at your temples.",
      "Your head feels slightly full.",
    ],
    [
      "Your head throbs steadily, thick and heavy.",
      "A band of pressure circles your head.",
      "Your temples pulse and your head feels thick.",
    ],
    [
      "Your skull pounds with every heartbeat.",
      "Your head throbs as if it would split.",
      "A savage pressure crushes your head.",
    ],
  ],
  light_sensitivity: [
    [
      "Bright light is slightly harsh on your eyes.",
      "You squint a little at the light.",
      "The light stings faintly.",
    ],
    [
      "Light is harsh and makes you squint.",
      "Brightness pricks at your eyes.",
      "You turn your eyes from the glare.",
    ],
    [
      "Light stabs at your eyes and you shut them.",
      "Even soft light is hard to bear.",
      "The glare is unbearable.",
    ],
  ],
  closed_posture: [
    [
      "You are holding yourself a little closed.",
      "Your shoulders have drawn in slightly.",
      "You are holding your arms close.",
    ],
    [
      "You find yourself hunched in on yourself.",
      "Your shoulders curl forward and your chin drops.",
      "You are drawn in, arms wrapped close.",
    ],
    [
      "You are curled tightly into yourself.",
      "Your body folds in as small as it can go.",
      "You are bent and drawn in around your middle.",
    ],
  ],
};

const WOUND_BANKS: Record<string, Bank> = {
  cut: [
    [
      "A thin stinging line runs across your {loc}.",
      "Your {loc} stings faintly where the skin is split.",
      "A small sting sits on your {loc}.",
    ],
    [
      "Your {loc} stings and throbs where the skin is split.",
      "A hot stinging throb pulses in your {loc}.",
      "Your {loc} smarts and throbs.",
    ],
    [
      "A hot, tearing ache pulses from your {loc}.",
      "Your {loc} burns and throbs with every heartbeat.",
      "A fierce sting floods your {loc}.",
    ],
  ],
  bruise: [
    [
      "A dull tender patch lies on your {loc}.",
      "Your {loc} is faintly sore to the touch.",
      "A small tenderness sits on your {loc}.",
    ],
    [
      "Your {loc} aches dully when touched or moved.",
      "A deep bruised soreness lies in your {loc}.",
      "Your {loc} throbs dully.",
    ],
    [
      "Your {loc} throbs with a deep, heavy ache.",
      "A sickening deep ache pounds in your {loc}.",
      "Your {loc} is badly sore and swollen.",
    ],
  ],
  burn: [
    [
      "Your {loc} feels tight and tender, with a slight sting.",
      "A faint raw sting sits on your {loc}.",
      "Your {loc} is warm and a little raw.",
    ],
    [
      "Your {loc} is raw and smarting.",
      "A raw, stinging heat lingers on your {loc}.",
      "Your {loc} smarts and the skin feels tight.",
    ],
    [
      "Your {loc} sears with a raw, burning hurt.",
      "A fierce raw burning throbs on your {loc}.",
      "Your {loc} screams with scalded rawness.",
    ],
  ],
  sprain: [
    [
      "Your {loc} twinges when you move it.",
      "A slight ache hangs in the joint of your {loc}.",
      "Your {loc} feels slightly loose.",
    ],
    [
      "Your {loc} aches and gives when weight is put on it.",
      "A wrenched ache sits in your {loc}.",
      "Your {loc} throbs and will not trust your weight.",
    ],
    [
      "Your {loc} grinds and gives with a sick wrenching pain.",
      "A hot, wrenching ache stabs from your {loc}.",
      "Your {loc} cannot bear any weight.",
    ],
  ],
  bite: [
    [
      "A small sharp ache sits where your {loc} was broken.",
      "Your {loc} stings with tiny punctures.",
      "A tender sting marks your {loc}.",
    ],
    [
      "Your {loc} throbs with torn, stabbing hurt.",
      "A deep stabbing throb pulses in your {loc}.",
      "Your {loc} aches where the skin is torn.",
    ],
    [
      "Your {loc} throbs with a deep, tearing hurt.",
      "A fierce tearing hurt pulses from your {loc}.",
      "Your {loc} is a fiery mass of torn hurt.",
    ],
  ],
};

const U: Record<string, Bank> = {
  drink: [
    [
      "A faint pull toward water.",
      "A small drift of your mind toward something to drink.",
      "Your thoughts turn now and then to water.",
    ],
    [
      "A strong pull toward something to drink.",
      "Your mind keeps leaning toward water.",
      "A steady pull toward cool water.",
    ],
    [
      "An overwhelming pull toward water; little else holds your mind.",
      "Everything in you leans toward water.",
      "A fierce pull toward anything wet to drink.",
    ],
  ],
  eat: [
    [
      "A faint pull toward something to eat.",
      "Your thoughts drift now and then toward food.",
      "A small pull toward where food is kept.",
    ],
    [
      "A strong pull toward food.",
      "Your mind keeps circling something to eat.",
      "Your hands want food.",
    ],
    [
      "An overwhelming pull toward anything to eat.",
      "Everything in you leans toward food.",
      "A fierce pull to put something in your mouth and chew.",
    ],
  ],
  warm: [
    [
      "A faint pull toward warmth.",
      "A drift of your mind toward something warm to wrap around you.",
      "You find yourself leaning toward warmth.",
    ],
    [
      "A strong pull toward warmth, toward the fire and the blanket.",
      "Your body wants to be close to heat.",
      "A steady pull to get warm.",
    ],
    [
      "An overwhelming pull toward heat; you would crawl into the flames' warmth if you could.",
      "Everything in you leans toward warmth.",
      "A fierce pull to get warm at any cost.",
    ],
  ],
  cool: [
    [
      "A faint pull toward shade and cool air.",
      "A drift of your mind toward something cool.",
      "You find yourself leaning toward shade.",
    ],
    [
      "A strong pull toward cool air and shade.",
      "Your body wants to get out of the heat.",
      "A steady pull toward coolness.",
    ],
    [
      "An overwhelming pull toward cool water and shade.",
      "Everything in you leans toward coolness.",
      "A fierce pull to escape the heat.",
    ],
  ],
  rest: [
    [
      "A heaviness behind your eyes, as if wanting to lie down.",
      "A faint pull to sit and be still.",
      "A small drift of your mind toward lying down.",
    ],
    [
      "A strong pull to lie down and shut your eyes.",
      "Your body wants to stop and sleep.",
      "A steady pull toward the bed.",
    ],
    [
      "You can hardly keep your eyes open; everything pulls you down.",
      "An overwhelming pull to lie down wherever you are.",
      "A fierce pull toward sleep.",
    ],
  ],
  guard_wound: [
    [
      "A small urge to hold the hurt place still.",
      "An urge to keep the sore place out of the way.",
      "A faint urge to check the sore place.",
    ],
    [
      "An urge to hold the hurt place still and guard it.",
      "An urge to clean and cover the hurt place.",
      "A steady urge to tend the sore place.",
    ],
    [
      "A fierce urge to cradle the hurt place and not move.",
      "An urge to cover and bind the hurt place at once.",
      "Everything in you curls around the hurt place.",
    ],
  ],
  lie_still: [
    [
      "A faint urge to be still and breathe slowly.",
      "A small urge to sit down and wait.",
      "A mild urge to keep still.",
    ],
    [
      "An urge to lie still and breathe slowly.",
      "An urge to curl up and wait it out.",
      "A steady urge to stay put and be quiet.",
    ],
    [
      "A fierce urge to lie flat and not move at all.",
      "An urge to curl up and shut out everything.",
      "Everything in you wants to lie still.",
    ],
  ],
  find_out: [
    [
      "A faint itch in your mind to find something out.",
      "A small itch to look into something.",
      "A light pull to go and see what there is to learn.",
    ],
    [
      "An itch in your mind to go and find something out.",
      "A steady itch to read, look and learn.",
      "Your mind pulls toward something new to read.",
    ],
    [
      "A pressing itch to find out, to look, to read something new.",
      "Your mind pulls hard toward something to learn.",
      "A fierce itch to know.",
    ],
  ],
  express: [
    [
      "A faint pressure to put something into words.",
      "A small wish to set something down.",
      "A light pull to say or write something.",
    ],
    [
      "A pressure in you to put something into words.",
      "A steady pull to write or say what is in you.",
      "Something in you wants to be said.",
    ],
    [
      "A strong pressure to get it out into words.",
      "Words crowd in you and want out.",
      "A fierce pull to write it all down.",
    ],
  ],
  company: [
    [
      "A faint pull toward another presence.",
      "A small drift of your mind toward someone else.",
      "The quiet around you feels slightly wide.",
    ],
    [
      "A pull toward another presence, though the room is empty.",
      "The quiet around you feels wide and hollow.",
      "A steady pull toward someone to be near.",
    ],
    [
      "A strong pull toward another presence; the emptiness weighs on you.",
      "The silence presses hollow around you.",
      "A fierce pull for company.",
    ],
  ],
  change: [
    [
      "A faint itch to do something different.",
      "A small stir to move on from this.",
      "A slight itch to shift what you are doing.",
    ],
    [
      "An itch to do something different, to move on from this.",
      "A steady itch to move and change what you are doing.",
      "You cannot settle on what is in front of you.",
    ],
    [
      "A fierce itch to do anything but this.",
      "You cannot hold still; you must change something.",
      "A strong itch to be elsewhere.",
    ],
  ],
  fit_together: [
    [
      "Something in your mind keeps turning faintly, wanting to fit together.",
      "A small loose thread tugs at your mind.",
      "A faint sense that something does not fit.",
    ],
    [
      "Something in your mind keeps turning over, wanting to fit together.",
      "A loose thread keeps tugging at your mind.",
      "Something does not fit and your mind keeps turning it over.",
    ],
    [
      "Your mind turns and turns at something that will not fit.",
      "A strong tugging at your mind will not let go.",
      "Something does not fit and you cannot leave it.",
    ],
  ],
  keep_watch: [
    [
      "A faint pull to keep watch.",
      "A small urge to glance around.",
      "A light pull to look behind you.",
    ],
    [
      "A pull to keep watch, to look about you.",
      "An urge to keep your back to a wall.",
      "A steady urge to listen and look.",
    ],
    [
      "A strong pull to hide, to be small and silent.",
      "An urge to flee or freeze and stay unseen.",
      "Everything in you pulls back and listens.",
    ],
  ],
  approach: [
    [
      "A faint pull forward, toward something that might be good.",
      "A small lean toward what is coming.",
      "A light spring in your steps.",
    ],
    [
      "A pull forward, toward something that might be good.",
      "A steady lean toward what lies ahead.",
      "Your body leans toward what is coming.",
    ],
    [
      "A strong pull forward, as if something good were near.",
      "Your body strains toward what lies ahead.",
      "A fierce lean toward what is coming.",
    ],
  ],
  quiet: [
    [
      "A faint wish for quiet.",
      "A small wish to hear nothing for a while.",
      "A slight pull to sit in silence.",
    ],
    [
      "A wish for quiet, for nothing to ask anything of you.",
      "A steady pull to sit in silence.",
      "A heaviness behind your eyes that wants quiet.",
    ],
    [
      "A strong wish for stillness and silence.",
      "A fierce pull to shut everything out.",
      "You want every sound and demand to stop.",
    ],
  ],
};

const grade = (x: number) => (x < 0.45 ? 0 : x < 0.75 ? 1 : 2);

interface Ctx {
  seed: number;
  window: number;
  tMin: number;
  noise: (id: string) => number;
}

function choose(bank: Bank, id: string, x: number, c: Ctx): string {
  const variants = bank[grade(x)];
  const idx = hash32(c.seed ^ strHash(id), c.window) % variants.length;
  return variants[idx] ?? variants[0] ?? "";
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export interface Sensations {
  sentences: string[];
  urges: string[];
  /** sentences then urges, plain text, no headers (the prompt builder owns section markers). */
  text: string;
}

export interface SensationInput {
  physiology: Physiology;
  survival: SurvivalChannels;
  organism: OrganismState;
  body: BodySignals;
  temperament: Temperament;
  tMin: number;
}

/** Render body sentences and unnamed urges. Pure and deterministic. */
export function renderSensations(
  inp: SensationInput,
  cfg: OrganismConfig = DEFAULT_ORGANISM_CONFIG,
): Sensations {
  if (inp.body.asleep) return { sentences: [], urges: [], text: "" };
  const { physiology: p, survival: sv, organism: o, body: b } = inp;
  const c: Ctx = {
    seed: inp.temperament.seed,
    window: Math.floor(inp.tMin / cfg.wordingWindowMin),
    tMin: inp.tMin,
    noise: (id) =>
      (unitAt(inp.temperament.seed, strHash(id) ^ Math.floor(inp.tMin)) * 2 - 1) * 0.05,
  };
  const cand: { id: string; x: number; text: string }[] = [];
  const add = (id: string, raw: number, bank: Bank | undefined, loc?: string) => {
    const x = raw + c.noise(id);
    if (!bank || x < cfg.sensationThreshold) return;
    const t = choose(bank, id, x, c);
    cand.push({ id, x, text: loc ? t.replace("{loc}", loc) : t });
  };
  const r = (v: number, lo: number, hi: number) => Math.max(0, Math.min(1, (v - lo) / (hi - lo)));

  add("stomach_emptiness", sv.stomach_emptiness, S.stomach_emptiness);
  add("stomach_ache", sv.stomach_ache, S.stomach_ache);
  add("nausea", sv.nausea, S.nausea);
  add("dry_mouth", sv.dry_mouth, S.dry_mouth);
  add("shivering", sv.shivering, S.shivering);
  add("numb_extremities", sv.numb_extremities, S.numb_extremities);
  add("sweating", sv.sweating, S.sweating);
  add("flushed_heat", sv.flushed_heat, S.flushed_heat);
  add("fever_chills", sv.fever_chills, S.fever_chills);
  add("dizziness", sv.dizziness, S.dizziness);
  add("trembling_weakness", sv.trembling_weakness, S.trembling_weakness);
  add("blurred_sight", sv.blurred_sight, S.blurred_sight);
  add("ringing_ears", sv.ringing_ears, S.ringing_ears);
  add("heartbeat", r(p.heart_rate, 78, 150), S.heartbeat);
  add(
    "breath",
    Math.max(r(p.breath_rate, 16, 34), r(0.35 - p.breath_depth, 0, 0.35) * 0.6),
    S.breath,
  );
  add("muscle_tension", p.muscle_tension, S.muscle_tension);
  add("hand_tremor", p.hand_tremor, S.hand_tremor);
  add("chest_warmth", r(p.chest_warmth, 0.3, 1), S.chest_warmth);
  add("chest_pressure", p.chest_pressure, S.chest_pressure);
  add("throat_tightness", p.throat_tightness, S.throat_tightness);
  add("gut_knot", p.gut_knot, S.gut_knot);
  add("gut_flutter", p.gut_flutter, S.gut_flutter);
  add("goosebumps", p.goosebumps, S.goosebumps);
  add("tear_pressure", p.tear_pressure, S.tear_pressure);
  add("face_tension", p.face_tension, S.face_tension);
  add("heaviness", p.heaviness, S.heaviness);
  add("head_pressure", p.head_pressure, S.head_pressure);
  add("light_sensitivity", r(p.pupil_light_sensitivity, 0.5, 1), S.light_sensitivity);
  add("closed_posture", r(0.5 - p.posture_openness, 0, 0.5), S.closed_posture);
  [...sv.wounds]
    .sort((a, b2) => b2.intensity - a.intensity)
    .slice(0, 2)
    .forEach((w, i) =>
      add(`wound${i}`, w.intensity, WOUND_BANKS[w.type] ?? WOUND_BANKS.bruise, w.location),
    );

  // attention narrows with pain and stress: fewer details come through
  const narrow = Math.round(3 * Math.max(b.pain, o.stress_load > 0.5 ? o.stress_load : 0));
  const n = Math.max(3, cfg.maxSensations - narrow);
  cand.sort((a, z) => z.x - a.x || a.id.localeCompare(z.id));
  const sentences = cand.slice(0, n).map((x) => cap(x.text));

  // urges (action tendencies as pulls and itches)
  const d = bodyDrives(b);
  const woundMax = sv.wounds.reduce((m, w) => Math.max(m, w.intensity), 0);
  const u: { id: string; x: number }[] = [
    { id: "drink", x: d.thirst },
    { id: "eat", x: d.hunger },
    { id: "warm", x: d.cold },
    { id: "cool", x: d.heat },
    { id: "rest", x: Math.max(d.sleepy, o.rest_need * 0.9) },
    { id: "guard_wound", x: woundMax },
    { id: "lie_still", x: sv.nausea * 0.9 },
    { id: "find_out", x: r(o.info_hunger, 0.35, 1) * (1 - 0.6 * d.discomfort) },
    { id: "express", x: r(o.expression_pressure, 0.25, 0.95) * (1 - 0.6 * d.discomfort) },
    { id: "company", x: r(o.social_deprivation, 0.3, 1) * 0.8 },
    { id: "change", x: r(o.restlessness, 0.3, 0.85) * 0.8 },
    { id: "fit_together", x: r(o.coherence_need, 0.25, 0.9) },
    { id: "keep_watch", x: r(o.vigilance, 0.35, 0.9) },
    { id: "approach", x: r(o.reward_anticipation, 0.3, 0.9) },
    { id: "quiet", x: r(o.mental_fatigue, 0.3, 0.9) * 0.8 },
  ];
  const urges = u
    .map((e) => ({ ...e, x: e.x + c.noise(`u:${e.id}`) }))
    .filter((e) => e.x >= cfg.sensationThreshold)
    .sort((a, z) => z.x - a.x || a.id.localeCompare(z.id))
    .slice(0, cfg.maxUrges)
    .map((e) => choose(U[e.id] as Bank, `u:${e.id}`, e.x, c));

  return { sentences, urges, text: [...sentences, ...urges].join(" ") };
}

// ---------------- reflexes and sudden events rendered as body sentences ----------------
const EVENT_LINES: Record<string, readonly string[]> = {
  withdraw_from_fire: [
    "Your hand jerked back from the heat before you had decided anything.",
    "Your hand snatched itself away from the flames on its own.",
  ],
  flinch: [
    "You flinched at a sudden sharp sting.",
    "Your body jerked at a sudden hot jab of hurt.",
  ],
  vomit: ["Your stomach heaved and emptied itself.", "Your gut clenched and everything came up."],
  micro_sleep: [
    "Your eyes closed on their own and the world went away for a moment.",
    "Your head dropped and you slipped away for a short while before jerking back.",
  ],
  faint: [
    "Your legs gave way and everything went dark.",
    "The world narrowed to a point and went black.",
  ],
  stumble: [
    "Your legs buckled and you stumbled.",
    "Your foot caught and your legs would not hold you.",
  ],
  shiver: ["Your body began to shake with cold.", "A hard shudder of cold took hold of you."],
  sweat: ["Sweat broke out across your skin.", "Your skin turned wet with sweat."],
  wound_infected: ["The hurt place has turned hot and swollen and throbs more deeply."],
  injury: ["A sharp hurt flared in your {loc}.", "Sudden pain tore through your {loc}."],
};

/** Plain sentences for reflexes and sudden events (inputs are engine events; output is body language only). */
export function renderReflexEvents(
  events: { kind: string; data?: Record<string, number | string | boolean> }[],
  temperament: Temperament,
  tMin: number,
): string[] {
  const out: string[] = [];
  events.forEach((e, i) => {
    const lines = EVENT_LINES[e.kind];
    if (!lines) return;
    const line =
      lines[hash32(temperament.seed ^ strHash(e.kind), Math.floor(tMin) + i) % lines.length] ??
      lines[0] ??
      "";
    const loc = typeof e.data?.location === "string" ? e.data.location : "body";
    out.push(line.replace("{loc}", loc));
  });
  return out;
}
