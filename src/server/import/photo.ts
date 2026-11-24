"use server";

import { cleanPhotoRead, todayIn, type PhotoSession } from "@domain/index";
import { env } from "@/env";
import { requirePageUser } from "@/server/current-user";

/**
 * Photo import, server side (brief §6.5): one notebook photo in, sessions read off it out.
 * The photo is sent to Gemini vision and never stored or logged. Nothing is saved here:
 * the person reviews everything, then the normal import batch writes it (with undo).
 */

// Vercel rejects request bodies over 4.5 MB before the function runs
const MAX_BYTES = 4 * 1024 * 1024;
/** Models tried, in order, when the main one stays overloaded. GEMINI_FALLBACK_MODELS (comma-separated) overrides. */
const DEFAULT_FALLBACKS = ["gemini-flash-lite-latest", "gemini-2.5-flash"];
function fallbackModels(main: string): string[] {
  const custom = env.GEMINI_FALLBACK_MODELS?.split(",").map((m) => m.trim()).filter(Boolean) ?? [];
  const list = custom.length ? custom : DEFAULT_FALLBACKS;
  return [...new Set(list)].filter((m) => m !== main);
}
const TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

const PROMPT = (today: string) => `You are reading a photo of a handwritten calisthenics training log page.
The notebook is a printed "Calisthenics Workout Log": each session spans two facing pages.
Printed layout: a header with DATE, START TIME, END TIME, TOTAL TIME; then up to 11 exercise blocks,
each with an EXERCISE name, a row of SETS 1-6 with handwritten REPS under each set number,
REST INTERVAL, NOTES, and BREAK (pause before the next exercise). A bracket or the same letter
drawn next to several exercises means they are a superset. A SESSION NOTES box sits at the bottom
of the second page. The photo may show both pages, one page, or another paper log with a similar idea.

Return every session you can see, in reading order. For each:
- date: ISO YYYY-MM-DD. This notebook writes dates YEAR FIRST: year.month.day with a 2-digit year
  (26.11.19 = 2026-11-19, never 26 November 2019). If only two parts are written they are month.day;
  use the latest year that does not put the date after ${today}. Empty string if no date is visible.
- dateText: the date exactly as written.
- start, end: clock times as HH:MM (24h); a bare hour like "7" means 07:00. Empty if not written.
- sessionNotes: the SESSION NOTES text.
- continuesPrevious: true only if this page has no header/date and continues a session from an earlier page.
- exercises, in order. name as written (fix obvious spelling only). reps: one value per filled set,
  separated by single spaces, e.g. "5 5 5" or "20 20 18". Never merge digits from different set boxes.
  unit "sec" when the values are hold times in seconds ("s" after a number means seconds; write m:ss
  values as seconds and leave the "s" out of reps), else "reps".
  rest and breakAfter as written (e.g. "1:30", "2 min"). notes as written, including any load like "+10 kg".
  superset: the letter of the group (A, B...) when bracketed or lettered, else empty.
- uncertainFields: list the fields you could not read confidently (handwriting confusions such as
  1/7, 4/9, 5/6, "35 35 35" vs "3 5 3 5").
Leave empty sets out. Do not invent values. Copy exactly what is written.`;

const SCHEMA = {
  type: "OBJECT",
  properties: {
    sessions: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          date: { type: "STRING" },
          dateText: { type: "STRING" },
          start: { type: "STRING" },
          end: { type: "STRING" },
          sessionNotes: { type: "STRING" },
          continuesPrevious: { type: "BOOLEAN" },
          uncertainFields: { type: "ARRAY", items: { type: "STRING", format: "enum", enum: ["date", "start", "end", "sessionNotes"] } },
          exercises: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                name: { type: "STRING" },
                reps: { type: "STRING" },
                unit: { type: "STRING", format: "enum", enum: ["reps", "sec"] },
                rest: { type: "STRING" },
                breakAfter: { type: "STRING" },
                notes: { type: "STRING" },
                superset: { type: "STRING" },
                uncertainFields: {
                  type: "ARRAY",
                  items: { type: "STRING", format: "enum", enum: ["name", "reps", "rest", "breakAfter", "notes", "superset"] },
                },
              },
              required: ["name", "reps", "unit"],
            },
          },
        },
        required: ["date", "exercises", "continuesPrevious"],
      },
    },
  },
  required: ["sessions"],
};

export type PhotoReadResult = { ok: true; sessions: PhotoSession[] } | { ok: false; error: string };

/** Read one photo. `photo` is its position in the upload, carried through for the review screen. */
export async function readNotebookPhoto(form: FormData): Promise<PhotoReadResult> {
  await requirePageUser("/import/photo");
  const key = env.GEMINI_API_KEY;
  if (!key) return { ok: false, error: "Photo reading is not set up on this server yet." };

  const file = form.get("photo");
  const photo = Number(form.get("index") ?? 0);
  const timeZone = String(form.get("tz") ?? "") || undefined;
  if (!(file instanceof File)) return fail("no file in the request", "No photo received.");
  if (!TYPES.has(file.type)) return fail(`unsupported type "${file.type}"`, "This photo format can't be read. Use a JPEG or PNG (on iPhone: Settings → Camera → Formats → Most Compatible).");
  if (file.size > MAX_BYTES) return fail(`file too large (${file.size} bytes)`, "This photo is too large (max 4 MB).");

  let today: string;
  try {
    today = todayIn(timeZone);
  } catch {
    today = todayIn();
  }

  const model = env.GEMINI_MODEL || "gemini-flash-latest";
  const data = Buffer.from(await file.arrayBuffer()).toString("base64");
  const started = Date.now();
  const body = JSON.stringify({
    contents: [{ role: "user", parts: [{ inline_data: { mime_type: file.type, data } }, { text: PROMPT(today) }] }],
    generationConfig: { temperature: 0, responseMimeType: "application/json", responseSchema: SCHEMA },
  });
  // Gemini answers 503 ("high demand") or 500 when a model is overloaded. Retry the main model once,
  // then fall back to other models (usually less busy), all inside one budget so the page never
  // waits past its own timeout. A fallback that does not exist (404) is skipped.
  const plan: { model: string; pauseBefore: number }[] = [
    { model, pauseBefore: 0 },
    { model, pauseBefore: 1_500 },
    ...fallbackModels(model).map((m) => ({ model: m, pauseBefore: 0 })),
  ];
  const deadline = started + 55_000;
  let res: Response | undefined;
  let used = model;
  for (const [i, step] of plan.entries()) {
    if (i > 0) {
      if (Date.now() + step.pauseBefore > deadline - 10_000) break;
      if (step.pauseBefore) await new Promise((r) => setTimeout(r, step.pauseBefore));
    }
    let attempt: Response;
    try {
      attempt = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(step.model)}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body,
        signal: AbortSignal.timeout(Math.max(1_000, deadline - Date.now())),
      });
    } catch (e) {
      if (res) break; // an earlier overloaded answer is reported below
      return fail(`request failed after ${Date.now() - started} ms (${step.model}): ${e instanceof Error ? e.name : "unknown"}`, "The photo reader did not answer in time. Try again.");
    }
    const fallbackMissing = step.model !== model && attempt.status === 404;
    if (fallbackMissing) {
      console.warn(`photo import: fallback model ${step.model} not found, skipping`);
      await attempt.body?.cancel();
      continue;
    }
    await res?.body?.cancel();
    res = attempt;
    used = step.model;
    if (res.status !== 503 && res.status !== 500) break;
    console.warn(`photo import: Gemini ${res.status} on ${step.model} after ${Date.now() - started} ms, trying next`);
  }
  if (!res) return fail("no answer from any model", "The photo reader did not answer. Try again.");
  if (res.ok && used !== model) console.info(`photo import: answered by fallback model ${used}`);
  if (!res.ok) {
    // Google's error message (never the image or the model's text) says what is wrong: key, model, quota
    const detail = await res.text().then((t) => {
      try {
        return String((JSON.parse(t) as { error?: { message?: string } }).error?.message ?? "").slice(0, 300);
      } catch {
        return t.slice(0, 300);
      }
    });
    const reason =
      res.status === 429 ? "Too many photos for the Gemini quota. Wait a minute and retry."
      : res.status === 404 ? `The Gemini model "${model}" was not found. Set GEMINI_MODEL to a current model.`
      : res.status === 400 && /api key/i.test(detail) ? "The Gemini key was refused. Check GEMINI_API_KEY in Vercel."
      : res.status === 403 ? "The Gemini key is not allowed to use this model (check the key's project and billing)."
      : res.status === 503 || res.status === 500 ? "Google's photo reader is overloaded right now. Wait a minute and try again."
      : `The photo reader returned an error (${res.status}). Try again.`;
    return fail(`Gemini ${res.status} (${used}, ${Date.now() - started} ms): ${detail}`, reason);
  }

  let text = "";
  try {
    const body = (await res.json()) as {
      candidates?: { finishReason?: string; content?: { parts?: { text?: string; thought?: boolean }[] } }[];
      promptFeedback?: { blockReason?: string };
    };
    const cand = body.candidates?.[0];
    text = cand?.content?.parts?.filter((p) => !p.thought).map((p) => p.text ?? "").join("") ?? "";
    if (!text) return fail(`empty answer (finish ${cand?.finishReason ?? "none"}, block ${body.promptFeedback?.blockReason ?? "none"})`, "The photo reader returned nothing for this photo. Try again or type it.");
    const sessions = cleanPhotoRead(JSON.parse(text), Number.isInteger(photo) && photo >= 0 ? photo : 0);
    if (!sessions.length) return fail(`no session in answer (${text.length} chars)`, "No session found on this photo. Is the whole page in the picture?");
    console.info(`photo import: read ${sessions.length} session(s) in ${Date.now() - started} ms`);
    return { ok: true, sessions };
  } catch {
    return fail(`unusable answer (${text.length} chars)`, "The photo reader gave an answer that could not be used. Try again.");
  }
}

/** Log why a photo failed (never its content) and give the person a message they can act on. */
function fail(log: string, error: string): PhotoReadResult {
  console.error(`photo import: ${log}`);
  return { ok: false, error };
}
