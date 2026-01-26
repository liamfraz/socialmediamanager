import OpenAI from "openai";
import * as fs from "fs";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Initialize OpenAI client only if API key is available
let openai: OpenAI | null = null;
if (OPENAI_API_KEY) {
  openai = new OpenAI({ apiKey: OPENAI_API_KEY });
}

const TAGGING_PROMPT = `Analyze this image and return a comma-separated list of tags.

CONTEXT:
These tags are for a professional wedding photography business.
Use wedding-related terms ONLY if they are visually evident in the image.
Do NOT assume a wedding context unless it is clearly visible.

CRITICAL RULES:

1. Tags MUST be ordered strictly from MOST → LEAST important using this priority:
   - Visual Dominance is the PRIMARY factor
   - Semantic Importance is SECONDARY and only used to break ties

2. The FIRST tag MUST be a single noun that best categorizes the image overall
   (e.g., wedding, bride, groom, ceremony, reception, venue, portrait, details).

3. The NEXT 1–2 tags MUST describe the primary subject, people, or setting.

4. The NEXT tags MUST describe key actions, objects, attire, or symbolic elements.

5. The FINAL tags MUST describe background elements, atmosphere, style, or mood.

6. Use only words or short noun phrases.
7. Do NOT infer relationships, emotions, or events beyond what is visually present.
8. Output ONLY the comma-separated tags — no explanations or extra text.`;

export interface TaggingResult {
  success: boolean;
  tags: string[];
  error?: string;
}

/**
 * Analyze an image using OpenAI Vision API and extract tags
 * @param imagePath - Path to the image file on disk
 * @returns TaggingResult with success status and tags array
 */
export async function analyzeImageForTags(imagePath: string): Promise<TaggingResult> {
  if (!openai) {
    return {
      success: false,
      tags: [],
      error: "OpenAI API key not configured. Set OPENAI_API_KEY environment variable.",
    };
  }

  try {
    // Read image file and convert to base64
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString("base64");

    // Determine mime type from extension
    const extension = imagePath.toLowerCase().split(".").pop();
    let mimeType = "image/jpeg";
    if (extension === "png") mimeType = "image/png";
    else if (extension === "webp") mimeType = "image/webp";
    else if (extension === "gif") mimeType = "image/gif";

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: TAGGING_PROMPT,
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`,
                detail: "low", // Use low detail to reduce cost/latency
              },
            },
          ],
        },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return {
        success: false,
        tags: [],
        error: "No response content from OpenAI",
      };
    }

    // Parse the comma-separated tags
    const tags = content
      .split(",")
      .map((tag) => tag.trim().toLowerCase())
      .filter((tag) => tag.length > 0 && tag.length < 50) // Filter out empty and overly long entries
      .slice(0, 20); // Limit to 20 tags max

    return {
      success: true,
      tags,
    };
  } catch (error) {
    console.error("OpenAI Vision API error:", error);
    return {
      success: false,
      tags: [],
      error: error instanceof Error ? error.message : "Unknown error during image analysis",
    };
  }
}

/**
 * Check if OpenAI is configured and available
 */
export function isOpenAIConfigured(): boolean {
  return openai !== null;
}

export interface RegenerateCaptionResult {
  success: boolean;
  caption?: string;
  error?: string;
}

/**
 * Regenerate a caption for a post using AI
 * @param currentCaption - The current caption to rewrite
 * @param imageUrls - Optional image URLs for context
 * @returns RegenerateCaptionResult with the new caption
 */
export async function regenerateCaption(
  currentCaption: string,
  imageUrls?: string[]
): Promise<RegenerateCaptionResult> {
  if (!openai) {
    return {
      success: false,
      error: "OpenAI API key not configured. Set OPENAI_API_KEY environment variable.",
    };
  }

  try {
    const systemPrompt = `You are a social media caption writer for a professional wedding photography business.
Your task is to rewrite the given caption to make it more engaging while keeping the same general meaning and context.

Guidelines:
- Keep the caption concise but impactful (under 2200 characters for Instagram)
- Use a warm, professional tone appropriate for wedding photography
- Include relevant emojis sparingly (1-3 max)
- Include a call-to-action when appropriate
- Preserve any @mentions or #hashtags from the original
- Do NOT add hashtags unless they were in the original

Return ONLY the new caption text, nothing else.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 1000,
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: `Please rewrite this Instagram caption:\n\n${currentCaption}`,
        },
      ],
    });

    const newCaption = response.choices[0]?.message?.content;
    if (!newCaption) {
      return {
        success: false,
        error: "No response content from OpenAI",
      };
    }

    return {
      success: true,
      caption: newCaption.trim(),
    };
  } catch (error) {
    console.error("OpenAI caption regeneration error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error during caption regeneration",
    };
  }
}
