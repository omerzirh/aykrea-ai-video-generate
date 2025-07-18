import toast from "react-hot-toast";
import { supabase } from "../lib/supabase";

export async function generateVideoFromImageRunway({
  prompt,
  imageBytes,
  aspectRatio = "16:9",
  durationSeconds = 5,
}: {
  prompt: string;
  imageBytes: string; // base64 string
  aspectRatio?: "16:9" | "9:16";
  durationSeconds?: number;
}) {
  try {
    toast.loading("Generating video from image with Runway...", { id: "video-loading" });
    
    // Get the current session from Supabase
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    
    if (!token) {
      toast.dismiss("video-loading");
      toast.error("You must be logged in to generate videos");
      return [];
    }
    
    // Convert aspect ratio to format expected by the server
    const ratio = aspectRatio === "16:9" ? "16:9" : "9:16";
    
    // Make a request to our backend server
    const response = await fetch(`${process.env.VITE_BACKEND_URL}/api/generate-video-from-image/runway`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        promptText: prompt,
        imageBase64: imageBytes,
        aspectRatio: ratio,
        durationSeconds
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      console.error("Runway API error:", errorData);
      
      if (response.status === 429) {
        toast.dismiss("video-loading");
        toast.error(`Daily video generation limit reached (${errorData?.used}/${errorData?.limit})`);
        return [];
      }
      
      throw new Error(`Failed to generate video from image: ${response.statusText}`);
    }

    const data = await response.json();
    toast.dismiss("video-loading");
    toast.success("Video generated successfully!");
    
    return data.videos || [];
  } catch (error) {
    toast.dismiss("video-loading");
    toast.error("Failed to generate video from image with Runway");
    console.error("Runway API error:", error);
    throw error;
  }
}
