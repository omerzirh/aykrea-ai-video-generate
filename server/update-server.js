const fs = require('fs');
const path = require('path');

// Path to the server.ts file
const serverFilePath = path.join(__dirname, 'server.ts');

// Read the server.ts file
let serverCode = fs.readFileSync(serverFilePath, 'utf8');

// Update the image-to-video endpoint
const imageToVideoUpdate = `      if (!videoUrl) {
        return res.status(408).json({ error: 'Timeout or no video URL returned' });
      }

      // Update usage count
      await updateUsageCount(user.id, 'video');

      try {
        // Store video in S3 and save metadata in Supabase
        const videoData = await storeGeneratedVideo(
          user.id,
          videoUrl,
          'image_to_video',
          promptText || '',
          true, // Has prompt image
          aspectRatio
        );

        return res.json({
          videos: [videoData.url],
          videoId: videoData.id,
          metadata: videoData
        });
      } catch (storageError) {
        console.error('Error storing video:', storageError);
        // Fall back to returning the original video URL if storage fails
        return res.json({ videos: [videoUrl] });
      }`;

// Update the text-to-video endpoint
const textToVideoUpdate = `      if (!videoUrl) {
        return res.status(408).json({ error: 'Timeout or no video URL returned' });
      }

      // Update usage count
      await updateUsageCount(user.id, 'video');

      try {
        // Store video in S3 and save metadata in Supabase
        const videoData = await storeGeneratedVideo(
          user.id,
          videoUrl,
          'text_to_video',
          prompt,
          false, // No prompt image
          aspectRatio
        );

        return res.json({
          videos: [videoData.url],
          videoId: videoData.id,
          metadata: videoData
        });
      } catch (storageError) {
        console.error('Error storing video:', storageError);
        // Fall back to returning the original video URL if storage fails
        return res.json({ videos: [videoUrl] });
      }`;

// Find and replace the image-to-video endpoint code
const imageToVideoPattern = /      if \(!videoUrl\) {\n        return res\.status\(408\)\.json\({ error: 'Timeout or no video URL returned' }\);\n      }\n\n      \/\/ Update usage count\n      await updateUsageCount\(user\.id, 'video'\);\n\n      return res\.json\({ videos: \[videoUrl\] }\);/g;
serverCode = serverCode.replace(imageToVideoPattern, imageToVideoUpdate);

// Find and replace the text-to-video endpoint code
const textToVideoPattern = /      if \(!videoUrl\) {\n        return res\.status\(408\)\.json\({ error: 'Timeout or no video URL returned' }\);\n      }\n\n      \/\/ Update usage count\n      await updateUsageCount\(user\.id, 'video'\);\n\n      return res\.json\({ videos: \[videoUrl\] }\);/g;
serverCode = serverCode.replace(textToVideoPattern, textToVideoUpdate);

// Add a new endpoint for retrieving user's generated videos
const newEndpoint = `
// Endpoint for retrieving user's generated videos
app.get('/api/user/videos', jsonBodyParser, authenticate, (req: Request, res: Response) => {
  (async () => {
    try {
      const authenticatedReq = req as AuthenticatedRequest;
      const user = authenticatedReq.user;
      
      // Get all videos generated by the user
      const videos = await getUserVideos(user.id);
      
      return res.json({ videos });
    } catch (error) {
      console.error('Error retrieving user videos:', error);
      return res.status(500).json({ error: 'Failed to retrieve user videos' });
    }
  })();
});
`;

// Find the position to insert the new endpoint (after the last existing endpoint)
const lastEndpointPos = serverCode.lastIndexOf('app.');
const nextSectionPos = serverCode.indexOf('});', lastEndpointPos);
const insertPos = serverCode.indexOf('\n', nextSectionPos) + 1;

// Insert the new endpoint
serverCode = serverCode.slice(0, insertPos) + newEndpoint + serverCode.slice(insertPos);

// Write the updated code back to the file
fs.writeFileSync(serverFilePath, serverCode, 'utf8');

console.log('Server code updated successfully!');
