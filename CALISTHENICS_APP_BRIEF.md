# Brief: Calisthenics Training Log App (web first, Apple Watch later)

> Context file for Claude Code. Put it at the repo root (or in `CLAUDE.md` / `docs/BRIEF.md`).
> Owner: Dylane, junior developer based in Calgary. The app UI is **English by default**.
> Name: **Sinew** (domain: `sinew.fit`).

## 1. Goal

Replace Dylane's **paper calisthenics log** with an app. He trains once a day, about 6 days a week, and writes every session in a physical notebook.

The app must cover the notebook's full cycle, only faster and with the history made searchable:

1. **Before the gym**: see (or prepare) the planned session: exercises, sets × reps, rest.
2. **At the gym**: record what was actually done, set by set, with an automatic rest timer.
3. **After**: look back at previous sessions and track progression per exercise over time.

**Two big requirements that shape everything:**

- **Import of past training data.** He will keep using the notebook until it is full (around the week of Jan 18, 2027), then switch to the app. Everything he wrote in the notebook must be importable so the app starts with his full history (see section 6): **by photo of the pages (AI OCR)**, by spreadsheet, or by quick manual entry. This is a first-class feature, not an afterthought.
- **Start of real use: around Feb 1, 2027.** So the app only needs the *current* program (Phase 2, section 7). There is no need for the Phase 1 catch-up block, the strength test week or any date-specific plan. The program is a repeating weekly template.

**Platforms**
- **V1: web app** (mobile-first PWA, usable at the gym on a phone, works offline).
- **V2: Apple Watch.** A watch app must be native (SwiftUI / watchOS), a PWA cannot run on the watch. He doesn't own a watch yet. So from day one: clean data model, business logic separated from UI, and an API/backend that a native client can reuse. Do not build anything watchOS-specific now.

## 2. Stack

**Same as Paymavo** (his existing personal project, on his machine at `C:\Users\tanol.DYLANE\ProDev\Paymavo\paymavo.com`, deployed on Vercel, Next.js).
Before choosing anything, **read that repo** (`package.json`, folder structure, auth, database, styling, lint/test setup, env handling) and mirror its choices: framework, language, styling, ORM/DB, auth, deployment. Don't assume; verify. If a Paymavo choice is clearly a poor fit here (for example no offline support), say so and propose the smallest change.

Additions this app needs on top of that stack:
- **PWA** (manifest + service worker), installable, offline-capable.
- **Local-first storage** for sessions in progress (IndexedDB, e.g. Dexie) so a bad gym connection never loses a set, with background sync to the server.
- **Accounts + sync from V1** (decided): a user logs in and finds the same data on phone and web, and later on the watch. Every row belongs to a `user_id`, enforced server-side.
- Pure TypeScript domain module for program/progression logic, no UI imports, unit-tested.
- **AI vision / OCR pipeline for photo import**: Paymavo already has one (receipt photos parsed by AI). Reuse its pattern and provider (see 6.5).

Design it **multi-user ready** (separate accounts, per-user data isolation, user-facing import) even though Dylane is the only user at first. The import feature in particular should work for anyone coming from a paper log or a spreadsheet.

## 3. Design principles

- **Fast entry in the gym.** Big tap targets, one tap to confirm a set "as planned", +/- steppers to adjust reps, no long forms.
- **Zero retyping (core principle).** His weeks are nearly identical and exercises stay the same for long stretches, so he must **never re-enter the plan** the way he does in the paper notebook. The weekly program is defined once; every session is generated from it automatically (exercises, sets, targets, rest, order, supersets). The "prepare the week" step he does by hand in the notebook disappears: the week view simply shows the generated sessions. The exercise picker below is only for exceptions.
- **Progression = changing sets and reps, not exercises.** Dylane progresses by adjusting sets × reps (or hold seconds) on the same exercises, following his rule: first more reps, then more sets (e.g. 6×2 → 5×3 → 6×3 → 5×4), only when every set was clean with ~2 reps in reserve. He swaps an exercise only when it is not relevant or too hard to perform. So the targets are the part that changes often and must be **one-tap to adjust**, while exercises are stable.
- **Edit once, applies going forward.** Changing the program (a target, an exercise, a rest time) is done once in the template and affects future sessions only, never past ones. Optionally "apply from date X".
- **Prefilled by default.** Every set starts with the target from the program. Dylane only corrects what differs.
- **Automatic rest timer.** Confirming a set starts the planned rest (for example 3:00), with vibration/sound at the end. This is the biggest gain over paper.
- **Hold timer** for timed exercises (L-sit, lean, lever holds): start/stop, the value fills itself.
- **"Last time" shown inline** next to every exercise during a session (replaces flipping through the notebook).
- **Exercise picker = searchable combobox, not a free-text field.** Anywhere the user chooses an exercise that isn't dictated by the program (adding an extra exercise to a session, swapping one, quick-entry screen, import review), use one shared component: a list of his exercises (recents first) with type-to-filter. If nothing matches, the last row is **"Create 'typed text'"**, which creates the exercise inline with the minimum needed (name + kind: reps or hold; per-side and weight toggles default sensibly and are editable later). No separate form or page. This keeps names consistent (no "Pull ups" / "Pull-ups" / "pullups" splitting the history) and makes per-exercise stats, PRs and progression reliable. Inside a normal program session no picking is needed at all, since exercises come prefilled from the template.
- **Repeat / duplicate shortcuts** for anything not covered by the template: "start from my last session of this type" (carries over exercises, and optionally last weights and reps as the starting point), and "duplicate this session" in history and quick entry.
- **Quality over quantity**: no gamification, no badges, no aggressive streaks. Every exercise has a stated purpose, there is no filler.
- **Dark by default, sober, readable from a distance.** Collapsible sections (like his Notion page) rather than checklists for the program view.

## 4. What the notebook looks like (this is what we are replacing)

The notebook is the commercially available *Calisthenics Workout Log* (180 pages, 2 pages per session, up to 11 exercises per session, undated pages). Layout, from its Amazon listing:

**Session header**
- `DATE` (with day-of-week letters S M T W T F S to circle)
- `START` time, `END` time, `TOTAL` duration

**One block per exercise** (up to 11 per session)
- `EXERCISE` name (free text, he picks the exercises, nothing prefilled)
- `SETS` row numbered 1–6, and a `REPS` row with the reps for each set (e.g. `5 5 5`, or `4 4 4`)
- `REST INTERVAL`: rest between sets, in minutes + seconds
- `NOTES`: free text per exercise (e.g. "Getting stronger, try 5,5,6", "Last 2 reps chest didn't hit the bar")
- `BREAK`: the break *between this exercise and the next*, in minutes + seconds
- **Supersets** are marked by hand with a bracket joining two exercises

**Session level**
- `SESSION NOTES` box at the bottom (overall remarks, what to change next time)

**Also**: a yearly **Training Frequency Calendar** where he circles trained days and counts "days trained" per month. The app should replace this automatically (a trained-days calendar + monthly count).

**Notebook has no weight field** ("no mention of how much weight lifted, only sets and reps"). Dylane does use load in a few places (Romanian deadlift, weighted pull-ups later), so the app adds an optional `weight_kg`. Holds are timed: the app stores **seconds** for holds and **reps** for rep-based exercises.

Practical consequences for the data model:
- Rest is stored **per exercise** (planned and actual) and the **break after the exercise** is a separate field, both optional.
- Don't hard-limit to 6 sets or 11 exercises. The notebook's limits are physical, the app's are not.
- Notes exist at **exercise level and session level**.
- Superset grouping is a first-class concept (`superset_group` shared by consecutive exercises).
- Start/end time are optional and the total duration is derived.

## 4b. Gaps in the notebook that the app must fill

The app is not just a digital copy of the notebook. It should capture and compute what paper can't. All of the fields below are **optional and tucked behind a "details" toggle**, so they never slow down entry in the gym.

- **Load (`weight_kg`) per set.** The notebook has no weight field, but weight is very useful: Romanian deadlift, weighted pull-ups/dips later, added weight on pistol squats. Store it as a first-class field on every set (kg), shown inline whenever the exercise allows weight.
- **Bodyweight log (kg).** In calisthenics, relative strength matters. A simple dated bodyweight entry lets the app show progress properly (e.g. pull-ups with added load vs bodyweight).
- **Assistance level** for assisted movements (muscle-up with a band, etc.) as a structured field (band label/colour, or kg), instead of a free-text note. The program says to record which band.
- **Effort per set:** reps in reserve (RIR), and a **`clean` flag** (every rep clean, yes/no). The program's rules ("~2 reps in reserve", "if form breaks the set ends") depend on this, but the paper log can only capture it in free text.
- **Variation step** (e.g. tuck vs advanced tuck front lever) stored as a structured link to the progression chain, so history shows exactly when he moved up.
- **Real rest times** measured by the timer, next to the planned rest (on paper he writes them by hand).
- **Automatic duration**, totals, and the **trained-days calendar** with a monthly count (replaces the circled calendar).
- **Things paper can't do:** personal bests, best set per exercise, trends, weekly volume, the "last time" hint during a session, and progression suggestions.
- **Discomfort flag** (optional, per exercise or session: none / mild / pain + note), because the program has explicit rules for elbow, wrist and shoulder pain and he needs to see patterns over time.

Principle: if a field can be derived (duration, volume, PRs), compute it. If it must be entered, make it one tap and optional.

## 5. Data model (to refine)

```ts
// ---- Library & program (editable data, never hardcoded) ----
Exercise {
  id, userId, name, aliases: string[],          // aliases power import matching
  kind: 'reps' | 'hold',                        // reps → reps; hold → seconds
  perSide: boolean,                             // pistol squat, side plank...
  allowsWeight: boolean,                        // RDL, weighted pull-ups
  progressionChainId?, notes?
}
ProgressionChain { id, name, steps: [{ order, label, exerciseId? }] }   // e.g. planche: lean → tuck → ...

SessionTemplate {                               // e.g. "Pull B → Core B"
  id, userId, name,
  parts: [{ name, goal?, warmupId?, items: PlannedExercise[] }]
}
PlannedExercise {
  exerciseId, sets, target: { min, max?, unit: 'reps' | 'sec' },
  restSec, altExerciseId?, notes?, supersetGroup?
}
Program { id, userId, name, weekTemplate: { mon..sun: SessionTemplateId | 'rest' }, active }

// ---- Log (what the notebook records) ----
WorkoutSession {
  id, userId, date, startedAt?, endedAt?, templateId?,
  sessionNotes?, source: 'app' | 'import', importBatchId?
}
ExerciseEntry {
  id, sessionId, exerciseId, order, supersetGroup?,
  plannedSets?, plannedTarget?,                 // copied at session time (history never changes if the program is edited)
  restSec?, breakAfterSec?, notes?
  sets: SetEntry[]
}
SetEntry {
  index, value, unit: 'reps' | 'sec', side?: 'L'|'R',
  weightKg?,                                    // added load in kg (RDL, weighted pull-ups...)
  assistance?: { type: 'band' | 'machine', label?: string, kg?: number },
  rir?: number, clean?: boolean, restActualSec?: number, note?
}
BodyweightLog { id, userId, date, kg }
// ExerciseEntry also gets: variationStepId? (position in the progression chain), discomfort?: 'none'|'mild'|'pain'

ImportBatch { id, userId, createdAt, kind: 'file' | 'photo' | 'quick_entry', sourceName, rowCount, status, summary }
ImportImage { id, batchId, storagePath, status: 'queued'|'parsed'|'needs_review'|'confirmed'|'failed', modelOutput?: json, fieldConfidence?: json }
```

Rule: **a session copies its planned targets at the moment it is created.** Editing the program later never rewrites history.

## 6. Import of historical data (priority feature)

**Why:** Dylane wants every notebook session loaded so the app knows his past performance and can show real progression from day one. This is also useful for any future user coming from a paper log or spreadsheet.

**Reality check:** the source is a paper notebook, so the data has to be transcribed first. Make that step as painless as possible, and make the importer tolerant.

### 6.1 Supported inputs
1. **Photos of notebook pages (AI OCR)** (primary, see 6.5): photograph the pages, the app reads them, he reviews and confirms.
2. **CSV / XLSX**: one row per set, or one row per exercise (see 6.2). Provide a **downloadable template** and an example file.
3. **JSON** (the app's own export format, so export → import round-trips).
4. **Notebook-style quick entry screen** (fallback and correction tool, in-app): a form that mirrors the paper page (date, start/end, then exercise blocks, each chosen with the shared exercise picker, with a reps row like `5 5 5`, rest, break, notes, session notes). It exists for fast manual backfilling and for correcting imported data. Because his notebook weeks look alike, it must offer **"duplicate previous session"** and **"duplicate this day to other dates"** so backfilling a repeated week means changing only the numbers that differ. Typing `5 5 5` or `5,5,5` must create three sets.

### 6.2 Row-per-exercise format (closest to the notebook)
One line per exercise block, sets compressed into one cell, since that is how the notebook reads:

```
date,start,end,exercise,reps,rest,break,notes,session_notes,superset
2026-10-22,12:40,13:17,Squats,"35 35 35",1:35,0:00,"Getting easier, consider increasing reps",,
2026-10-22,12:40,13:17,Pull-ups,"4 4 4",1:30,,"Weak, not done for a while, keep trying",,A
2026-10-22,12:40,13:17,Chin-ups,"4",,,"Final rep just about, keep trying",,
```

Accept: `reps` as space/comma/`x`-separated list, hold times in seconds (`20 20 18`) or `m:ss`, optional `weight_kg`, optional `unit` (`reps`/`sec`, otherwise inferred from the exercise). Also accept the **row-per-set** layout (`date, exercise, set_number, value, unit, weight_kg, rest_sec, note`). Auto-detect which layout is used from the headers.

### 6.3 Import flow (wizard)
1. Upload file (or paste).
2. **Column mapping** with auto-detected defaults and the ability to override.
3. **Exercise matching:** normalise names (case, hyphens, plurals, e.g. "Pull ups" / "pull-ups" / "Strict pull-ups"), match against the exercise library and aliases, and for unknown names let the user *map to existing*, *create new*, or *skip*. Remember choices as aliases so the next import is automatic.
4. **Dry-run preview:** how many sessions, exercises and sets will be created, the date range, plus **warnings** (unparseable value, duplicate date+exercise, set count outside 1–20, impossible times, end before start).
5. Confirm → write inside a single transaction tagged with an `ImportBatch`.
6. **Undo the whole batch** from the import history. Re-importing the same file must not create duplicates (dedupe on user + date + exercise + order, with a clear "skip / replace" choice).

### 6.4 Why it matters downstream
Imported sessions behave exactly like app-logged ones: the "last time" hint, per-exercise history charts, personal bests, trained-days calendar and progression suggestions all use them. Mark them `source: 'import'` but do not treat them as second-class data.

### 6.5 Photo import (AI OCR on notebook pages)

Dylane already built something similar in **Paymavo**: users photograph a paper receipt and an AI reads it. **Inspect that feature first** (upload flow, storage, which model/provider, prompt and schema approach, error handling, cost controls) and reuse the same pattern and provider. Don't add a new OCR vendor unless Paymavo's approach clearly can't read handwriting.

**Flow**
1. **Upload one or many photos** (camera or gallery). Ideal: one photo per session (the two-page spread). Also accept one photo per page and group pages that belong to the same session (page 1 has the header/date, page 2 has the continuation and the `SESSION NOTES` box).
2. **Server-side vision call with a structured output schema** matching section 5: session (date, start, end, total, session notes) and `exercises[]` (name, reps per set, rest, break, notes, superset marker, weight if written). The prompt describes the printed layout from section 4, since the template is known: `SETS` 1–6, `REPS`, `REST INTERVAL`, `NOTES`, `BREAK`, bracket for supersets. The model returns a value and a confidence level (or an "uncertain" flag) per field.
3. **Review screen (mandatory, never auto-commit).** Photo on one side (zoomable), parsed session as an editable form on the other, low-confidence fields highlighted. Exercise names use the shared exercise picker (matched automatically when possible). Handwriting will be misread sometimes (1 vs 7, 4 vs 9, 5 vs 6, `35 35 35` vs `3 5 3 5`), so a human confirms every session.
4. **Confirm** → same pipeline as 6.3 steps 3–6: exercise name matching and aliases, dedupe, a single `ImportBatch` with undo.
5. **Bulk mode:** upload e.g. 20+ pages, process them in the background in a queue, then review one by one with a progress indicator. It must be resumable (close the app, come back later).

**Details**
- **Sanity checks** on parsed data: reps far outside the exercise's usual range, end time before start, missing date (ask, or propose the date from the neighbouring sessions), more sets than plausible.
- **Weight extraction:** the notebook has no weight field, but if the notes or exercise name contain a load ("+10 kg", "10kg"), put it in `weightKg` and keep the original text in the note.
- **Images:** store privately, linked to the `ImportBatch`, and let the user delete them. Never log image content. Enforce file type/size limits and a per-user rate limit or quota (cost control).
- **Fallback:** if parsing fails or is mostly wrong, open the quick-entry screen with the photo beside it.
- **Evaluation:** Dylane's own pages are the test set. Build a small script that compares parsed output against a few hand-transcribed pages (field-level accuracy) and use it to tune the prompt before trusting bulk import.
- **Generic by design:** the same flow should later work for other paper logs. Keep the layout hint optional and configurable.

## 7. Program to seed (current program, Phase 2: "Skill & Strength")

Source of truth today is Dylane's Notion page *"Calisthenics Program — FINAL"* (see section 9 for where the program will live). Seed it as **data** (`program.seed.ts` or JSON), as an editable repeating week. No dates and no phases in the app for now.

**Structure:** one session per day: **Part 1 (Pull/Push) first while fresh, then Part 2 (Core/Legs)**. Sunday is full rest. If the second part drops in quality, cut sets (4 → 3) before skipping the session. Each gym trip must stay substantial (he commutes by CTrain), so no tiny sessions.

**Rules (show them in the session UI as reminders):**
- Never to failure: keep ~2 reps in reserve.
- Every rep clean. If form breaks down, the set ends.
- Progression: first more reps, then more sets (6×2 → 5×3 → 6×3 → 5×4). Only add when every set was clean with ~2 reps left.
- Move to the next skill variation only after hitting the top of the range on every set, clean, with ~2 s / 2 reps in reserve, **for 2 sessions in a row**.

### Weekly template
| Day | Session (part 1 → part 2) |
|---|---|
| Monday | Push A (planche) → Legs A |
| Tuesday | Pull A (muscle-up, front lever) → Core A |
| Wednesday | Push B (vertical push, HSPU) → Legs B |
| Thursday | Pull B (front lever, strength) → Core B |
| Friday | Push C (technique, light) → Legs C (light) |
| Saturday | Pull C (muscle-up, back lever) → Core C (light) |
| Sunday | Full rest |

### Sessions (sets × reps/seconds · rest)

**Push A: planche** (goal: planche strength)
1. Planche lean: 4 × 10–15 s · 2–3 min
2. Tuck planche (attempts): 3 × 3–6 s · 3 min
3. Straight bar dips (bar at hip level, lean forward, muscle-up transition prep): 3 × 5–8 · 2–3 min
4. Cable triceps extensions (pushdown or overhead): 3 × 10–15 · 90 s

**Legs A: strength** (goal: strong legs and the pistol squat)
1. Pistol squat: 4 × 5–8 per leg · 2–3 min
2. Romanian deadlift (weighted, kg): 3 × 8–10 · 2 min
3. Nordic curl: 3 × 5–8 · 2 min

**Pull A: muscle-up and front lever** (goal: pulling height, muscle-up transition, front lever strength; the most intense pull session)
1. High pull-ups: 4 × 3–5 · 3–4 min
2. Band-assisted muscle-up: 3 × 3–5 · 3 min (record which band)
3. Tuck front lever: 4 × 8–12 s · 3 min
4. Front lever rows: 3 × 6–10 · 2–3 min

**Core A** (goal: L-sit, compression, core base for the levers, obliques)
1. Tuck L-sit: 4 × 10–20 s · 2 min
2. Dynamic compression: 3 × 5–10 · 90 s
3. Hollow body hold: 3 × 20–40 s · 90 s
4. Side plank: 2 × 20–40 s per side · 60 s

**Push B: vertical push and HSPU** (goal: vertical shoulder strength and pushing power)
1. Wall HSPU negatives (lower for 3–4 s): 3 × 3–5 · 2–3 min
2. Pike push-ups, feet elevated: 4 × 5–8 · 2–3 min
3. Pseudo planche push-ups: 3 × 6–10 · 2 min
4. Parallel bar dips (forward lean, elbows tucked): 3 × 6–10 · 2 min

**Legs B: volume** (goal: leg volume without excessive fatigue)
1. Pistol squat: 3 × 6–8 per leg · 2 min
2. Bulgarian split squat: 3 × 8–12 per leg · 90 s
3. Hip thrust: 3 × 8–12 · 90 s
4. Calf raises: 3 × 12–20 · 60 s

**Pull B: front lever and strength** (goal: vertical and horizontal pulling strength; no muscle-up, that was Tuesday)
1. Tuck front lever: 4 × 8–12 s · 3 min
2. Strict pull-ups: 3 × 6–10 · 2–3 min (keep 2 reps in reserve)
3. Inverted rows, feet elevated: 4 × 8–12 · 90 s
4. Face pulls (band or rings) or Y-T-W: 3 × 12–20 · 60 s

**Core B** (goal: L-sit, dynamic core work incl. dragon flag, hollow for the levers)
1. L-sit: 4 × 10–20 s · 2 min
2. Negative dragon flag, bent knees (lower 3–4 s): 3 × 3–6 · 2 min
3. Compression lifts: 3 × 6–10 · 90 s
4. Hollow body rocks: 3 × 10–20 · 90 s

**Push C: technique, light** (goal: skill practice without fatigue; leave thinking "I had more in me")
1. Planche lean: 3 × 8–12 s · 2 min
2. Tuck planche: 3 × 3–5 s · 2–3 min
3. Wall HSPU negatives (lower 3–4 s, easy effort): 3 × 3 · 2 min
4. Cable triceps extensions: 2 × 10–15 · 90 s

**Legs C: light** (goal: power and maintaining the pistol)
1. Jump squats: 3 × 4–6 · 2 min
2. Pistol squat: 2 × 5–8 per leg · 2 min
3. Nordic curl: 2 × 5–6 · 2 min

**Pull C: muscle-up and back lever** (goal: explosiveness and back lever, moderate intensity)
1. Explosive high pull-ups: 3 × 3 · 3 min
2. Band-assisted muscle-up: 3 × 3 · 3 min
3. Tuck back lever: 3 × 8–12 s · 2–3 min
4. Face pulls or Y-T-W: 2 × 12–15 · 60 s

**Core C: light** (goal: maintain L-sit, progress on windshield wipers)
1. L-sit: 3 × 10–20 s · 90 s
2. Hollow body hold: 2 × 20–30 s · 60 s
3. Windshield wipers (bent knees, then straighter with progression): 2 × 6–10 · 60 s

### Warm-ups (one per part; light first set of the first exercise when moving to Core/Legs)
- **Pull (8 min):** 2 min light cardio, arm circles, scapular pull-ups 2×5, dead hang 2×15–20 s, 2 sets of 1 easy pull-up.
- **Push (8 min):** wrist rotations 30 s, palm pulses 10–15, scapular push-ups 2×8–10, band external rotation 2×10–15.
- **Legs (6 min):** bodyweight squat 2×10, reverse lunges 8/leg, hip circles, ankle rocks, glute bridge 2×10.
- **Core:** wrists 30 s, then one light set of the first exercise.

### Skill progression chains
- **Planche:** lean → tuck → advanced tuck → straddle → full
- **Front / back lever:** tuck → advanced tuck → one leg → straddle → full
- **Handstand / HSPU:** wall → freestanding. Pike → elevated pike → wall HSPU
- **Muscle-up:** assisted → unassisted
- **L-sit:** tuck → one leg → full
- **Windshield wipers:** bent knees → half-bent legs → straight legs → hanging
- **Dragon flag:** negative bent knees → negative straight legs → full

### Deload and pain (general rules, shown as guidance)
- A deload week roughly every 4 weeks: same exercises, **−1 set on anything with 3+ sets**, ~3 reps in reserve, no progression. Make it a user-configurable setting (on/off, interval), not a fixed date.
- If performance drops several sessions in a row, or a wrist / elbow / shoulder hurts: reduce volume (4 → 3 sets) before skipping a session. Persistent joint or tendon pain: don't push through.
- Elbows and biceps tendons take a lot of load (front lever, muscle-up, back lever, front lever rows). If they start to pull: cut the back lever first, then reduce front lever rows.
- Weighted pull-ups are optional, only when 3×10 strict feels easy, never before high pulls and the muscle-up.

### Handstand GTG (separate from sessions)
4–6 short sets per day (30 s to 2 min), 4–5 days a week, spread through the day, always fresh, never to failure. Skip if wrists hurt. Model it as a lightweight daily counter, not as part of a session.

## 8. Features and priorities

**P0: what must exist before he switches from the notebook (target: ~Feb 1, 2027)**
1. Auth + accounts, server sync, offline-first session logging.
2. Exercise library with aliases, program seeded from section 7 and editable in-app (templates, exercises, targets, rest).
3. "Today" screen (day of week → session, or rest day) with Start.
4. Session mode: parts, per-exercise sets prefilled, 1-tap confirm, +/- adjust, rest timer, hold timer, notes per exercise, session notes, optional start/end time, superset support.
5. History: past sessions, session detail, "last time" inline.
6. **Import (section 6) with undo: photo import (AI OCR, 6.5), spreadsheet import, and the notebook-style quick-entry screen.** All three share one pipeline (matching, dedupe, batch, undo).
7. JSON export of everything.

**P1**
8. Progress per exercise: best set, estimated trend, volume per week, charts. Trained-days calendar and monthly count (replaces the notebook's frequency calendar).
9. **Progression suggestions** (reps → sets → next variation), always suggestions, never forced. After a session (or at the end of the week), if every set of an exercise was clean with enough reps in reserve, propose the next target (more reps within the range, then more sets) with a one-tap **"Apply to template"** button, plus manual "+1 rep / +1 set" steppers in the template editor. Target changes are **versioned by effective date** (a `TargetChange` history per planned exercise), so he can see when and how each target evolved, while past sessions keep the targets they were done with.
9b. **Retire, don't delete, an exercise** when it is replaced (not relevant, or too hard to perform): archive it so the history stays intact, with an optional one-line reason, and let the replacement start a fresh history. Archived exercises stay searchable in the picker and in the import matcher.
10. Warm-up screens, rules reminders, deload mode.
11. Handstand GTG counter.

**P2**
12. Watch app (V2): today's session, confirm sets, rest timer with haptics.

## 9. Where does the program live? (decision)

Dylane isn't sure whether the program stays in Notion or moves into the app. **Recommendation, implement this unless he says otherwise:**

- **The app is the source of truth** for the program. It is data in the database, editable in a simple in-app editor, because the app needs structured data (sets, reps, rest, progression chains) to prefill sessions and run timers. A Notion page is free text and would need fragile parsing.
- **No two-way Notion sync.** It costs a lot and breaks easily.
- **One-time seed** from section 7 of this brief. Notion stays as a readable reference until the in-app editor is good enough, then he can retire it.
- If he later wants a read-only copy in Notion, add an export, not a sync.

## 10. Suggested build order

1. Read Paymavo, set up the repo on the same stack, PWA shell, dark theme, deploy.
2. Domain layer + seed + tests: exercises, templates, "session for a given weekday".
3. Auth + DB schema + sync model (decide conflict handling: last-write-wins per session is enough for a single user).
4. Session mode (the core UX), then Today and History.
5. **Import pipeline** (matching, dedupe, batch/undo), then the **quick-entry screen**, then **photo import** on top of it. Build this early so Dylane can start loading notebook pages while he is still filling it; he has ~2 months.
6. Progress charts, calendar, suggestions.
7. Polish, offline hardening, export.
8. Later: native watchOS app against the same API.

## 11. Open items

- **Name:** **Sinew**, domain `sinew.fit` (available at the time of choice; Dylane to register it). Keep the app name in a single config constant so a rename stays a one-line change. Still to check by Dylane: trademark search (CIPO / USPTO), App Store / Play Store availability, GitHub and social handles.
- **Notebook import:** photo import (6.5) is the main path. Dylane will provide real photos of his own pages (ideally a few already hand-transcribed) to tune and evaluate the OCR prompt. Handwriting accuracy is not guaranteed, hence the mandatory review step.
- **Paymavo specifics** (auth, DB, ORM) are unknown to this brief on purpose: Claude Code must inspect the repo.
- **Units:** kg for loads (Romanian deadlift, weighted work), seconds for holds, reps otherwise. Decided.
