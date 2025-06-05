import { GoogleGenAI } from "@google/genai";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

if (!apiKey) {
  throw new Error("VITE_GEMINI_API_KEY is missing from environment variables");
}

const ai = new GoogleGenAI({ apiKey });

// Helper function to validate prompt
const isValidPrompt = (prompt: string): boolean => {
  if (!prompt) return false;
  const words = prompt.trim().split(/\s+/);
  return words.length > 2;
};

// Define types for the API response
interface Video {
  uri?: string;
  [key: string]: unknown;
}

interface GeneratedVideo {
  video?: Video;
  [key: string]: unknown;
}

interface VideoOperationResponse {
  generatedVideos?: GeneratedVideo[];
  [key: string]: unknown;
}

export async function generateVideoFromImage({
  prompt,
  imageBytes,
  aspectRatio = "16:9",
  durationSeconds = 6,
  numberOfVideos = 1,
}: {
  prompt: string;
  imageBytes: string; // base64 string
  aspectRatio?: "16:9" | "9:16";
  durationSeconds?: number;
  numberOfVideos?: 1 | 2;
}) {
  if (!isValidPrompt(prompt)) {
    throw new Error("Invalid prompt. Please provide a prompt with more than 2 words.");
  }

  // Ensure minimum duration is 5 seconds
  const validDuration = Math.max(5, durationSeconds);
  
  let operation = await ai.models.generateVideos({
    model: "veo-2.0-generate-001",
    prompt,
    image: {
      imageBytes,
      mimeType: "image/png",
    },
    config: {
      aspectRatio,
      durationSeconds: validDuration,
      numberOfVideos,
    },
  });

  while (!operation.done) {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    operation = await ai.operations.getVideosOperation({
      operation,
    });
  }

  return (
    (operation.response as VideoOperationResponse)?.generatedVideos?.map((generatedVideo: GeneratedVideo) =>
      `${generatedVideo.video?.uri}&key=${apiKey}`
    ) || []
  );
}
