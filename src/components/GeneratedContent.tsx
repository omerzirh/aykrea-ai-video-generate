import { useState, useEffect } from 'react';
import { useAuth } from '../lib/auth-context';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { FileVideo, Image as ImageIcon, Download } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardFooter, CardHeader } from './ui/card';

interface Video {
  id: string;
  url: string;
  prompt_text: string;
  created_at: string;
}

interface Image {
  id: string;
  url: string;
  prompt_text: string;
  created_at: string;
}

export function GeneratedContent() {
  const { session } = useAuth();
  const [videos, setVideos] = useState<Video[]>([]);
  const [images, setImages] = useState<Image[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchContent() {
      if (!session?.access_token) return;

      try {
        setLoading(true);
        setError(null);

        // Fetch all user content from our simple content server
        const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/user/content`, {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch generated content');
        }

        const data = await response.json();
        setVideos(data.videos || []);
        setImages(data.images || []);
      } catch (err) {
        console.error('Error fetching content:', err);
        setError('Failed to load your generated content. Please try again later.');
      } finally {
        setLoading(false);
      }
    }

    fetchContent();
  }, [session]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-8 text-destructive">
        <p>{error}</p>
      </div>
    );
  }

  const hasContent = videos.length > 0 || images.length > 0;

  if (!hasContent) {
    return (
      <div className="text-center p-8 text-muted-foreground">
        <h2 className="text-xl font-semibold mb-2">No Generated Content Yet</h2>
        <p>
          Start creating videos and images to see them here!
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">My Generated Content</h1>
      
      <Tabs defaultValue="videos">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="videos" className="flex items-center gap-2">
            <FileVideo className="h-4 w-4" />
            Videos ({videos.length})
          </TabsTrigger>
          <TabsTrigger value="images" className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4" />
            Images ({images.length})
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="videos">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {videos.map((video) => (
              <Card key={video.id} className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="aspect-video">
                    <video 
                      src={video.url} 
                      controls 
                      className="w-full h-full object-cover"
                    />
                  </div>
                </CardContent>
                <CardHeader className="pb-2 pt-4">
                  <p className="text-sm text-muted-foreground">
                    {new Date(video.created_at).toLocaleDateString()}
                  </p>
                </CardHeader>
                <CardFooter className="flex justify-between">
                  <p className="text-sm line-clamp-1 flex-1">
                    {video.prompt_text}
                  </p>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    asChild
                    className="ml-2"
                  >
                    <a href={video.url} download>
                      <Download className="h-4 w-4" />
                    </a>
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </TabsContent>
        
        <TabsContent value="images">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {images.map((image) => (
              <Card key={image.id} className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="aspect-square">
                    <img 
                      src={image.url} 
                      alt={image.prompt_text} 
                      className="w-full h-full object-cover"
                    />
                  </div>
                </CardContent>
                <CardHeader className="pb-2 pt-4">
                  <p className="text-sm text-muted-foreground">
                    {new Date(image.created_at).toLocaleDateString()}
                  </p>
                </CardHeader>
                <CardFooter className="flex justify-between">
                  <p className="text-sm line-clamp-1 flex-1">
                    {image.prompt_text}
                  </p>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    asChild
                    className="ml-2"
                  >
                    <a href={image.url} download>
                      <Download className="h-4 w-4" />
                    </a>
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
