"use server";

import { cleanPhotoRead, todayIn, type PhotoSession } from "@domain/index";
import { env } from "@/env";
import { requirePageUser } from "@/server/current-user";

/**
 * Photo import, server side (brief §6.5): one notebook photo in, sessions read off it out.
 * The photo is sent to Gemini vision and never stored or logged. Nothing is saved here:
 * the person reviews everything, then the normal import batch writes it (with undo).
 */

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

const PROMPT = (today: string) => `You are reading a photo of a handwritten calisthenics training log page.
The notebook is a printed "Calisthenics Workout Log": each session spans two facing pages.
Printed layout: a header with DATE, START TIME, END TIME, TOTAL TIME; then up to 11 exercise blocks,
each with an EXERCISE name, a row of SETS 1-6 with handwritten REPS under each set number,
REST INTERVAL, NOTES, and BREAK (pause before the next exercise). A bracket or the same letter
drawn next to several exercises means they are a superset. A SESSION NOTES box sits at the bottom
of the second page. The photo may show both pages, one page, or another paper log with a similar idea.

Return every session you can see, in reading order. For each:
- date: ISO YYYY-MM-DD. Dates are usually written day first (22/10 = 22 October). If the year is
  missing, use the latest year that does not put the date after ${today}. Empty string if no date is visible.
- dateText: the date exactly as written.
- start, end: clock times as HH:MM (24h), empty if not written.
- sessionNotes: the SESSION NOTES text.
- continuesPrevious: true only if this page has no header/date and continues a session from an earlier page.
- exercises, in order. name as written (fix obvious spelling only). reps: one value per filled set,
  separated by single spaces, e.g. "5 5 5" or "20 20 18". Never merge digits from different set boxes.
  unit "sec" when the values are hold times in seconds (write m:ss values as seconds), else "reps".
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
          uncertainFields: { type: "ARRAY", items: { type: "STRING", enum: ["date", "start", "end", "sessionNotes"] } },
          exercises: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                name: { type: "STRING" },
                reps: { type: "STRING" },
                unit: { type: "STRING", enum: ["reps", "sec"] },
                rest: { type: "STRING" },
                breakAfter: { type: "STRING" },
                notes: { type: "STRING" },
                superset: { type: "STRING" },
                uncertainFields: {
                  type: "ARRAY",
                  items: { type: "STRING", enum: ["name", "reps", "rest", "breakAfter", "notes", "superset"] },
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
  if (!(file instanceof File)) return { ok: false, error: "No photo received." };
  if (!TYPES.has(file.type)) return { ok: false, error: "Use a JPEG, PNG, WebP or HEIC photo." };
  if (file.size > MAX_BYTES) return { ok: false, error: "This photo is too large (max 5 MB)." };

  let today: string;
  try {
    today = todayIn(timeZone);
  } catch {
    today = todayIn();
  }

  const model = env.GEMINI_MODEL || "gemini-flash-latest";
  const data = Buffer.from(await file.arrayBuffer()).toString("base64");
  let res: Response;
  try {
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ inline_data: { mime_type: file.type, data } }, { text: PROMPT(today) }] }],
        generationConfig: { temperature: 0, responseMimeType: "application/json", responseSchema: SCHEMA },
      }),
      signal: AbortSignal.timeout(90_000),
    });
  } catch {
    return { ok: false, error: "The photo reader did not answer. Try again." };
  }
  if (!res.ok) {
    // Status only: never log the image or the model's text
    console.error(`photo import: Gemini responded ${res.status}`);
    return { ok: false, error: res.status === 429 ? "Too many photos at once. Wait a minute and retry." : "The photo could not be read. Try again." };
  }

  try {
    const body = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    const sessions = cleanPhotoRead(JSON.parse(text), Number.isInteger(photo) && photo >= 0 ? photo : 0);
    if (!sessions.length) return { ok: false, error: "No session found on this photo." };
    return { ok: true, sessions };
  } catch {
    return { ok: false, error: "The photo reader gave an answer that could not be used. Try again." };
  }
}
