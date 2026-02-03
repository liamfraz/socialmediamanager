import OpenAI from "openai";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

let openai: OpenAI | null = null;
if (OPENAI_API_KEY) {
  openai = new OpenAI({ apiKey: OPENAI_API_KEY });
}

// Photo metadata structure for AI input
export interface PhotoForAI {
  id: string;
  tags: string;
  description?: string;
}

// Result types
export interface CurationResult {
  success: boolean;
  photoIds: string[];
  error?: string;
}

export interface CaptionResult {
  success: boolean;
  caption: string;
  error?: string;
}

export interface PostGenerationResult {
  success: boolean;
  topic: string;
  photoIds: string[];
  caption: string;
  error?: string;
}

// ============================================
// CAROUSEL CURATOR
// ============================================

const CURATOR_SYSTEM_PROMPT = `You are an Instagram Carousel Curator for a wedding photographer.
You must select photos that DIRECTLY match the user's requested topic.
You must NOT invent details. You must NOT reference photos not provided.
If the user asks for "bride" photos, you MUST select photos tagged with bride-related tags.
If the user asks for "groom" photos, you MUST select photos tagged with groom-related tags.
NEVER mix subjects - if the topic is about brides, do NOT include groom photos.`;

function buildCuratorUserPrompt(photosForAI: PhotoForAI[], topic: string): string {
  return `You will receive:
1) A JSON array called "photos_for_ai" containing REAL photo metadata. Each item is:
- id (string)
- tags (comma-separated words)
- description (optional)

Here is the EXACT "photos_for_ai" array you must choose from:

${JSON.stringify(photosForAI, null, 2)}

USER'S REQUESTED TOPIC:
"${topic}"

YOUR TASK
Select photos that DIRECTLY match the user's topic above.

You must:
- FIRST: Identify which photos have tags/descriptions that match the topic
- ONLY select photos that are relevant to the topic
- If the topic mentions "bride" or "bridal" - select ONLY photos with bride-related tags (bride, bridal, wedding dress, bouquet held by bride, etc.)
- If the topic mentions "groom" - select ONLY photos with groom-related tags (groom, bow tie, suit, groomsmen, etc.)
- If the topic mentions "flowers" or "bouquet" - select photos that feature flowers prominently
- Choose 5–10 photo IDs that match the topic
- No duplicates
- Do NOT select photos that don't match the topic, even if they look nice

CRITICAL RULES (DO NOT BREAK)
- Return photo IDs ONLY.
- Do NOT output indexes.
- Do NOT invent, guess, or modify anything.
- Every photo ID you return MUST be one of the "id" values present in photos_for_ai.
- Prefer 5–10 items.

OUTPUT FORMAT (STRICT)
Return ONLY valid JSON in exactly this shape:

{
  "photo_ids": ["id1", "id2", "id3"]
}

Rules:
- Must be valid JSON
- Must contain ONLY "photo_ids"
- Values must be strings (photo IDs)
- Do not output anything else (no explanations, no markdown, no extra keys)`;
}

export async function curatePhotosForTopic(
  photosForAI: PhotoForAI[],
  topic: string
): Promise<CurationResult> {
  if (!openai) {
    return {
      success: false,
      photoIds: [],
      error: "OpenAI API key not configured",
    };
  }

  if (photosForAI.length === 0) {
    return {
      success: false,
      photoIds: [],
      error: "No photos available for curation",
    };
  }

  try {
    console.log(`[Curator] Starting curation for topic: "${topic}" with ${photosForAI.length} photos`);

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.1,
      max_tokens: 1000,
      messages: [
        { role: "system", content: CURATOR_SYSTEM_PROMPT },
        { role: "user", content: buildCuratorUserPrompt(photosForAI, topic) },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return {
        success: false,
        photoIds: [],
        error: "No response from curator",
      };
    }

    // Parse JSON response - handle potential markdown code blocks
    let jsonContent = content.trim();
    if (jsonContent.startsWith("```")) {
      jsonContent = jsonContent.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    }

    let parsed: { photo_ids?: string[] };
    try {
      parsed = JSON.parse(jsonContent);
    } catch (parseError) {
      console.error("[Curator] Failed to parse JSON:", content);
      return {
        success: false,
        photoIds: [],
        error: `Invalid JSON response: ${content.substring(0, 100)}`,
      };
    }

    if (!parsed.photo_ids || !Array.isArray(parsed.photo_ids)) {
      return {
        success: false,
        photoIds: [],
        error: "Response missing photo_ids array",
      };
    }

    // Validate that all returned IDs exist in the input
    const validIds = new Set(photosForAI.map((p) => p.id));
    const validatedIds = parsed.photo_ids.filter((id) => {
      if (!validIds.has(id)) {
        console.warn(`[Curator] Ignoring invalid photo ID: ${id}`);
        return false;
      }
      return true;
    });

    // Remove duplicates
    const uniqueIds = [...new Set(validatedIds)];

    // Enforce 5-10 limit
    if (uniqueIds.length > 10) {
      console.warn(`[Curator] Trimming ${uniqueIds.length} photos to 10`);
    }
    const finalIds = uniqueIds.slice(0, 10);

    if (finalIds.length === 0) {
      return {
        success: false,
        photoIds: [],
        error: "No valid photos selected by curator",
      };
    }

    if (finalIds.length < 5) {
      console.warn(`[Curator] Only ${finalIds.length} photos selected (less than 5)`);
    }

    console.log(`[Curator] Selected ${finalIds.length} photos for topic: "${topic}"`);
    return {
      success: true,
      photoIds: finalIds,
    };
  } catch (error) {
    console.error("[Curator] Error:", error);
    return {
      success: false,
      photoIds: [],
      error: error instanceof Error ? error.message : "Unknown curator error",
    };
  }
}

// ============================================
// CAPTION WRITER
// ============================================

const CAPTION_SYSTEM_PROMPT = `You are writing Instagram captions in the voice of Amazing Days Photography.`;

function buildCaptionUserPrompt(selectedPhotos: PhotoForAI[], topic: string): string {
  return `TOPIC: ${topic}

SELECTED_PHOTOS: ${JSON.stringify(selectedPhotos, null, 2)}
(SELECTED_PHOTOS is an array where each element describes ONE photo using ONLY the stored metadata: tags + description.)

Your job:
Identify the strongest repeated vibe or moment across the photos.

Mandatory grounding rules:
Only reference details that clearly appear in SELECTED_PHOTOS.
Do not invent locations, weather, outfits, vendors, or moments.
If a detail isn't repeated or obvious, leave it out.

Caption style (critical):
Casual, warm, enthusiastic, slightly chaotic (in a good way).
Reads like a human photographer, not a brand.
Short punchy lines. Natural line breaks.
Emojis encouraged (1–3 max), used for energy not decoration.

Structure:
3–6 short lines total.
Flow:
- Hook tied to TOPIC (often with an emoji)
- A hype line reacting to the day/moment
- One line calling out the repeated visual/vibe from the photos
- Optional fun/reflective closer

Hashtags:
Add 3–5 hashtags only, drawn from:
- wedding photography context
- repeated themes present in SELECTED_PHOTOS
No generic filler tags (#love #instagood #happy).
Do not list vendors unless they are clearly visible and central in the photos.

Hard rules:
Output caption text only.
No labels, no bullet points, no explanations.`;
}

export async function generateCaption(
  selectedPhotos: PhotoForAI[],
  topic: string
): Promise<CaptionResult> {
  if (!openai) {
    return {
      success: false,
      caption: "",
      error: "OpenAI API key not configured",
    };
  }

  if (selectedPhotos.length === 0) {
    return {
      success: false,
      caption: "",
      error: "No photos provided for caption generation",
    };
  }

  try {
    console.log(`[Caption] Generating caption for topic: "${topic}" with ${selectedPhotos.length} photos`);

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.3,
      max_tokens: 500,
      messages: [
        { role: "system", content: CAPTION_SYSTEM_PROMPT },
        { role: "user", content: buildCaptionUserPrompt(selectedPhotos, topic) },
      ],
    });

    const caption = response.choices[0]?.message?.content?.trim();
    if (!caption) {
      return {
        success: false,
        caption: "",
        error: "No caption generated",
      };
    }

    console.log(`[Caption] Generated caption (${caption.length} chars) for topic: "${topic}"`);
    return {
      success: true,
      caption,
    };
  } catch (error) {
    console.error("[Caption] Error:", error);
    return {
      success: false,
      caption: "",
      error: error instanceof Error ? error.message : "Unknown caption error",
    };
  }
}

// ============================================
// FULL POST GENERATION (Curator + Caption)
// ============================================

export async function generatePost(
  topic: string,
  allPhotos: PhotoForAI[]
): Promise<PostGenerationResult> {
  // Step 1: Curate photos
  const curationResult = await curatePhotosForTopic(allPhotos, topic);
  if (!curationResult.success) {
    return {
      success: false,
      topic,
      photoIds: [],
      caption: "",
      error: `Curation failed: ${curationResult.error}`,
    };
  }

  // Step 2: Get selected photos metadata for caption
  const selectedPhotoIds = new Set(curationResult.photoIds);
  const selectedPhotos = allPhotos.filter((p) => selectedPhotoIds.has(p.id));

  // Step 3: Generate caption
  const captionResult = await generateCaption(selectedPhotos, topic);
  if (!captionResult.success) {
    return {
      success: false,
      topic,
      photoIds: curationResult.photoIds,
      caption: "",
      error: `Caption generation failed: ${captionResult.error}`,
    };
  }

  return {
    success: true,
    topic,
    photoIds: curationResult.photoIds,
    caption: captionResult.caption,
  };
}

/**
 * Check if post generation is available (OpenAI configured)
 */
export function isPostGenerationAvailable(): boolean {
  return openai !== null;
}
