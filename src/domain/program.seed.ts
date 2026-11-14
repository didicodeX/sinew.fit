/**
 * Seed for the current program — Phase 2 "Skill & Strength" (docs/BRIEF.md §7).
 * Data, not code: it is written into the database once per user, then edited in-app.
 * IDs here are stable slugs; the DB seeder maps them to real row ids.
 */
import type {
  ExerciseDef,
  PlannedExercise,
  ProgramDef,
  ProgressionChainDef,
  SessionTemplate,
  Warmup,
} from "./types";

const min = (m: number) => m * 60;

export const SEED_CHAINS: ProgressionChainDef[] = [
  { id: "planche", name: "Planche", steps: ["lean", "tuck", "advanced tuck", "straddle", "full"] },
  { id: "front-lever", name: "Front lever", steps: ["tuck", "advanced tuck", "one leg", "straddle", "full"] },
  { id: "back-lever", name: "Back lever", steps: ["tuck", "advanced tuck", "one leg", "straddle", "full"] },
  { id: "handstand", name: "Handstand", steps: ["wall", "freestanding"] },
  { id: "hspu", name: "HSPU", steps: ["pike", "elevated pike", "wall HSPU"] },
  { id: "muscle-up", name: "Muscle-up", steps: ["assisted", "unassisted"] },
  { id: "l-sit", name: "L-sit", steps: ["tuck", "one leg", "full"] },
  {
    id: "windshield-wipers",
    name: "Windshield wipers",
    steps: ["bent knees", "half-bent legs", "straight legs", "hanging"],
  },
  {
    id: "dragon-flag",
    name: "Dragon flag",
    steps: ["negative bent knees", "negative straight legs", "full"],
  },
];

const ex = (
  id: string,
  name: string,
  kind: ExerciseDef["kind"],
  opts: Partial<Omit<ExerciseDef, "id" | "name" | "kind">> = {},
): ExerciseDef => ({ id, name, kind, perSide: false, allowsWeight: false, ...opts });

export const SEED_EXERCISES: ExerciseDef[] = [
  // Push
  ex("planche-lean", "Planche lean", "hold", { chain: { chainId: "planche", step: "lean" } }),
  ex("tuck-planche", "Tuck planche", "hold", { chain: { chainId: "planche", step: "tuck" } }),
  ex("straight-bar-dips", "Straight bar dips", "reps", {
    notes: "Bar at hip level, lean forward — muscle-up transition prep.",
  }),
  ex("cable-triceps-extensions", "Cable triceps extensions", "reps", {
    allowsWeight: true,
    aliases: ["Triceps pushdown", "Overhead cable triceps extension"],
  }),
  ex("wall-hspu-negatives", "Wall HSPU negatives", "reps", {
    aliases: ["Wall handstand push-up negatives"],
    notes: "Lower for 3–4 s.",
  }),
  ex("pike-push-ups-elevated", "Pike push-ups, feet elevated", "reps", {
    aliases: ["Elevated pike push-ups"],
    chain: { chainId: "hspu", step: "elevated pike" },
  }),
  ex("pseudo-planche-push-ups", "Pseudo planche push-ups", "reps", { aliases: ["PPPU"] }),
  ex("parallel-bar-dips", "Parallel bar dips", "reps", {
    allowsWeight: true,
    aliases: ["Dips"],
    notes: "Forward lean, elbows tucked.",
  }),
  // Legs
  ex("pistol-squat", "Pistol squat", "reps", { perSide: true, allowsWeight: true, aliases: ["Pistols"] }),
  ex("romanian-deadlift", "Romanian deadlift", "reps", { allowsWeight: true, aliases: ["RDL"] }),
  ex("nordic-curl", "Nordic curl", "reps", { aliases: ["Nordic hamstring curl"] }),
  ex("bulgarian-split-squat", "Bulgarian split squat", "reps", {
    perSide: true,
    allowsWeight: true,
    aliases: ["BSS"],
  }),
  ex("hip-thrust", "Hip thrust", "reps", { allowsWeight: true }),
  ex("calf-raises", "Calf raises", "reps", { allowsWeight: true }),
  ex("jump-squats", "Jump squats", "reps"),
  // Pull
  ex("high-pull-ups", "High pull-ups", "reps"),
  ex("explosive-high-pull-ups", "Explosive high pull-ups", "reps"),
  ex("band-assisted-muscle-up", "Band-assisted muscle-up", "reps", {
    allowsAssistance: true,
    chain: { chainId: "muscle-up", step: "assisted" },
    notes: "Record which band.",
  }),
  ex("tuck-front-lever", "Tuck front lever", "hold", { chain: { chainId: "front-lever", step: "tuck" } }),
  ex("front-lever-rows", "Front lever rows", "reps"),
  ex("strict-pull-ups", "Strict pull-ups", "reps", { allowsWeight: true }),
  ex("inverted-rows-elevated", "Inverted rows, feet elevated", "reps", {
    aliases: ["Elevated inverted rows", "Australian rows"],
  }),
  ex("face-pulls", "Face pulls", "reps", { notes: "Band or rings." }),
  ex("y-t-w", "Y-T-W", "reps", { aliases: ["YTW", "Y T W raises"] }),
  ex("tuck-back-lever", "Tuck back lever", "hold", { chain: { chainId: "back-lever", step: "tuck" } }),
  // Core
  ex("tuck-l-sit", "Tuck L-sit", "hold", { chain: { chainId: "l-sit", step: "tuck" } }),
  ex("l-sit", "L-sit", "hold", { chain: { chainId: "l-sit", step: "full" } }),
  ex("dynamic-compression", "Dynamic compression", "reps"),
  ex("compression-lifts", "Compression lifts", "reps"),
  ex("hollow-body-hold", "Hollow body hold", "hold", { aliases: ["Hollow hold"] }),
  ex("hollow-body-rocks", "Hollow body rocks", "reps", { aliases: ["Hollow rocks"] }),
  ex("side-plank", "Side plank", "hold", { perSide: true }),
  ex("negative-dragon-flag-bent", "Negative dragon flag, bent knees", "reps", {
    chain: { chainId: "dragon-flag", step: "negative bent knees" },
    notes: "Lower 3–4 s.",
  }),
  ex("windshield-wipers", "Windshield wipers", "reps", {
    chain: { chainId: "windshield-wipers", step: "bent knees" },
  }),
  // Skill practice outside sessions (GTG)
  ex("handstand", "Handstand", "hold", { chain: { chainId: "handstand", step: "wall" } }),
];

type P = Omit<PlannedExercise, "target"> & { target: PlannedExercise["target"] };
const reps = (exerciseId: string, sets: number, lo: number, hi: number | undefined, restSec: number, restMaxSec?: number, extra: Partial<P> = {}): P => ({
  exerciseId,
  sets,
  target: { min: lo, max: hi, unit: "reps" },
  restSec,
  restMaxSec,
  ...extra,
});
const hold = (exerciseId: string, sets: number, lo: number, hi: number | undefined, restSec: number, restMaxSec?: number, extra: Partial<P> = {}): P => ({
  exerciseId,
  sets,
  target: { min: lo, max: hi, unit: "sec" },
  restSec,
  restMaxSec,
  ...extra,
});

export const SEED_TEMPLATES: SessionTemplate[] = [
  {
    id: "push-a-legs-a",
    name: "Push A → Legs A",
    parts: [
      {
        name: "Push A: planche",
        kind: "push",
        goal: "Planche strength",
        warmupKey: "push",
        items: [
          hold("planche-lean", 4, 10, 15, min(2), min(3)),
          hold("tuck-planche", 3, 3, 6, min(3), undefined, { notes: "Attempts" }),
          reps("straight-bar-dips", 3, 5, 8, min(2), min(3)),
          reps("cable-triceps-extensions", 3, 10, 15, 90, undefined, { notes: "Pushdown or overhead" }),
        ],
      },
      {
        name: "Legs A: strength",
        kind: "legs",
        goal: "Strong legs and the pistol squat",
        warmupKey: "legs",
        items: [
          reps("pistol-squat", 4, 5, 8, min(2), min(3), { notes: "Per leg" }),
          reps("romanian-deadlift", 3, 8, 10, min(2), undefined, { notes: "Weighted (kg)" }),
          reps("nordic-curl", 3, 5, 8, min(2)),
        ],
      },
    ],
  },
  {
    id: "pull-a-core-a",
    name: "Pull A → Core A",
    parts: [
      {
        name: "Pull A: muscle-up and front lever",
        kind: "pull",
        goal: "Pulling height, muscle-up transition, front lever strength. The most intense pull session.",
        warmupKey: "pull",
        items: [
          reps("high-pull-ups", 4, 3, 5, min(3), min(4)),
          reps("band-assisted-muscle-up", 3, 3, 5, min(3), undefined, { notes: "Record which band" }),
          hold("tuck-front-lever", 4, 8, 12, min(3)),
          reps("front-lever-rows", 3, 6, 10, min(2), min(3)),
        ],
      },
      {
        name: "Core A",
        kind: "core",
        goal: "L-sit, compression, core base for the levers, obliques",
        warmupKey: "core",
        items: [
          hold("tuck-l-sit", 4, 10, 20, min(2)),
          reps("dynamic-compression", 3, 5, 10, 90),
          hold("hollow-body-hold", 3, 20, 40, 90),
          hold("side-plank", 2, 20, 40, 60, undefined, { notes: "Per side" }),
        ],
      },
    ],
  },
  {
    id: "push-b-legs-b",
    name: "Push B → Legs B",
    parts: [
      {
        name: "Push B: vertical push and HSPU",
        kind: "push",
        goal: "Vertical shoulder strength and pushing power",
        warmupKey: "push",
        items: [
          reps("wall-hspu-negatives", 3, 3, 5, min(2), min(3), { notes: "Lower for 3–4 s" }),
          reps("pike-push-ups-elevated", 4, 5, 8, min(2), min(3)),
          reps("pseudo-planche-push-ups", 3, 6, 10, min(2)),
          reps("parallel-bar-dips", 3, 6, 10, min(2), undefined, { notes: "Forward lean, elbows tucked" }),
        ],
      },
      {
        name: "Legs B: volume",
        kind: "legs",
        goal: "Leg volume without excessive fatigue",
        warmupKey: "legs",
        items: [
          reps("pistol-squat", 3, 6, 8, min(2), undefined, { notes: "Per leg" }),
          reps("bulgarian-split-squat", 3, 8, 12, 90, undefined, { notes: "Per leg" }),
          reps("hip-thrust", 3, 8, 12, 90),
          reps("calf-raises", 3, 12, 20, 60),
        ],
      },
    ],
  },
  {
    id: "pull-b-core-b",
    name: "Pull B → Core B",
    parts: [
      {
        name: "Pull B: front lever and strength",
        kind: "pull",
        goal: "Vertical and horizontal pulling strength. No muscle-up (that was Tuesday).",
        warmupKey: "pull",
        items: [
          hold("tuck-front-lever", 4, 8, 12, min(3)),
          reps("strict-pull-ups", 3, 6, 10, min(2), min(3), { notes: "Keep 2 reps in reserve" }),
          reps("inverted-rows-elevated", 4, 8, 12, 90),
          reps("face-pulls", 3, 12, 20, 60, undefined, { altExerciseIds: ["y-t-w"], notes: "Band or rings, or Y-T-W" }),
        ],
      },
      {
        name: "Core B",
        kind: "core",
        goal: "L-sit, dynamic core work incl. dragon flag, hollow for the levers",
        warmupKey: "core",
        items: [
          hold("l-sit", 4, 10, 20, min(2)),
          reps("negative-dragon-flag-bent", 3, 3, 6, min(2), undefined, { notes: "Lower 3–4 s" }),
          reps("compression-lifts", 3, 6, 10, 90),
          reps("hollow-body-rocks", 3, 10, 20, 90),
        ],
      },
    ],
  },
  {
    id: "push-c-legs-c",
    name: "Push C → Legs C",
    parts: [
      {
        name: "Push C: technique, light",
        kind: "push",
        goal: "Skill practice without fatigue. Leave thinking \"I had more in me\".",
        warmupKey: "push",
        items: [
          hold("planche-lean", 3, 8, 12, min(2)),
          hold("tuck-planche", 3, 3, 5, min(2), min(3)),
          reps("wall-hspu-negatives", 3, 3, undefined, min(2), undefined, { notes: "Lower 3–4 s, easy effort" }),
          reps("cable-triceps-extensions", 2, 10, 15, 90),
        ],
      },
      {
        name: "Legs C: light",
        kind: "legs",
        goal: "Power and maintaining the pistol",
        warmupKey: "legs",
        items: [
          reps("jump-squats", 3, 4, 6, min(2)),
          reps("pistol-squat", 2, 5, 8, min(2), undefined, { notes: "Per leg" }),
          reps("nordic-curl", 2, 5, 6, min(2)),
        ],
      },
    ],
  },
  {
    id: "pull-c-core-c",
    name: "Pull C → Core C",
    parts: [
      {
        name: "Pull C: muscle-up and back lever",
        kind: "pull",
        goal: "Explosiveness and back lever, moderate intensity",
        warmupKey: "pull",
        items: [
          reps("explosive-high-pull-ups", 3, 3, undefined, min(3)),
          reps("band-assisted-muscle-up", 3, 3, undefined, min(3)),
          hold("tuck-back-lever", 3, 8, 12, min(2), min(3)),
          reps("face-pulls", 2, 12, 15, 60, undefined, { altExerciseIds: ["y-t-w"], notes: "Or Y-T-W" }),
        ],
      },
      {
        name: "Core C: light",
        kind: "core",
        goal: "Maintain L-sit, progress on windshield wipers",
        warmupKey: "core",
        items: [
          hold("l-sit", 3, 10, 20, 90),
          hold("hollow-body-hold", 2, 20, 30, 60),
          reps("windshield-wipers", 2, 6, 10, 60, undefined, { notes: "Bent knees, then straighter with progression" }),
        ],
      },
    ],
  },
];

export const SEED_PROGRAM: ProgramDef = {
  id: "phase-2",
  name: "Skill & Strength",
  week: {
    0: "push-a-legs-a",
    1: "pull-a-core-a",
    2: "push-b-legs-b",
    3: "pull-b-core-b",
    4: "push-c-legs-c",
    5: "pull-c-core-c",
    6: null,
  },
};

export const WARMUPS: Warmup[] = [
  {
    key: "pull",
    name: "Pull warm-up",
    minutes: 8,
    steps: [
      "2 min light cardio",
      "Arm circles",
      "Scapular pull-ups 2×5",
      "Dead hang 2×15–20 s",
      "2 sets of 1 easy pull-up",
    ],
  },
  {
    key: "push",
    name: "Push warm-up",
    minutes: 8,
    steps: ["Wrist rotations 30 s", "Palm pulses 10–15", "Scapular push-ups 2×8–10", "Band external rotation 2×10–15"],
  },
  {
    key: "legs",
    name: "Legs warm-up",
    minutes: 6,
    steps: ["Bodyweight squat 2×10", "Reverse lunges 8/leg", "Hip circles", "Ankle rocks", "Glute bridge 2×10"],
  },
  {
    key: "core",
    name: "Core warm-up",
    steps: ["Wrists 30 s", "One light set of the first exercise"],
  },
];

export const TRAINING_RULES: string[] = [
  "Never to failure: keep ~2 reps in reserve.",
  "Every rep clean. If form breaks down, the set ends.",
  "Progression: first more reps, then more sets (6×2 → 5×3 → 6×3 → 5×4). Only add when every set was clean with ~2 reps left.",
  "Move to the next skill variation only after hitting the top of the range on every set, clean, with ~2 s / 2 reps in reserve, for 2 sessions in a row.",
  "If the second part drops in quality, cut sets (4 → 3) before skipping the session.",
];

export const RECOVERY_GUIDANCE: string[] = [
  "Deload roughly every 4 weeks: same exercises, −1 set on anything with 3+ sets, ~3 reps in reserve, no progression.",
  "If performance drops several sessions in a row, or a wrist / elbow / shoulder hurts: reduce volume (4 → 3 sets) before skipping a session. Persistent joint or tendon pain: don't push through.",
  "Elbows and biceps tendons take a lot of load (front lever, muscle-up, back lever, front lever rows). If they start to pull: cut the back lever first, then reduce front lever rows.",
  "Weighted pull-ups are optional, only when 3×10 strict feels easy, never before high pulls and the muscle-up.",
];

export const GTG_HANDSTAND = {
  exerciseId: "handstand",
  description:
    "4–6 short sets per day (30 s to 2 min), 4–5 days a week, spread through the day, always fresh, never to failure. Skip if wrists hurt.",
  setsPerDay: { min: 4, max: 6 },
  daysPerWeek: { min: 4, max: 5 },
};
