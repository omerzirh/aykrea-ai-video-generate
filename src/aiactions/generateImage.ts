import { GoogleGenAI } from "@google/genai";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const backend= import.meta.env.VITE_BACKEND_URL

if (!apiKey) {
  throw new Error("VITE_GEMINI_API_KEY is missing from environment variables");
}

const ai = new GoogleGenAI({ apiKey });

export async function generateImage({
  prompt,
  numberOfImages = 1,
  accessToken,
}: {
  prompt: string;
  numberOfImages?: number;
  accessToken?: string;
}) {
  // Generate images using Gemini API
  const response = await ai.models.generateImages({
    model: "imagen-3.0-generate-002",
    prompt,
    config: {
      numberOfImages,
    },
  });

  // Get base64 encoded images
  const base64Images = response.generatedImages?.map((img) => {
    // Ensure image and imageBytes exist before accessing
    if (img && img.image && img.image.imageBytes) {
      return `data:image/png;base64,${img.image.imageBytes}`;
    }
    return '';
  }).filter(Boolean) || [];
  
  // If we have an access token, store the images on the server
  if (accessToken && base64Images.length > 0) {
    try {
      // Send the images to our server for storage in S3 and Supabase
      const storeResponse = await fetch(`${backend}/api/generate-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          prompt,
          images: base64Images
        })
      });
      
      if (storeResponse.ok) {
        const data = await storeResponse.json();
        // Return the S3 URLs of the stored images
        return data.images || base64Images;
      }
    } catch (error) {
      console.error('Error storing images:', error);
      // Fall back to the original base64 images if storage fails
    }
  }

  // Return the original base64 encoded images
  return base64Images;
}
