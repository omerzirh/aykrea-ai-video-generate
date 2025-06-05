import { useState, useEffect } from 'react';
import { useAuth } from '../lib/auth-context';
import { Button } from './ui/button';
import { FileVideo, Download } from 'lucide-react';
import toast from 'react-hot-toast';

interface GeneratedVideo {
  id: string;
  url: string;
  prompt_text: string;
  type: 'image_to_video' | 'text_to_video';
  created_at: string;
  aspect_ratio: string;
}

export default function GeneratedContentTab() {
  const [videos, setVideos] = useState<GeneratedVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const { session } = useAuth();
  
  useEffect(() => {
    async function fetchVideos() {
      if (!session?.access_token) return;
      
      setLoading(true);
      try {
        const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/user/videos`, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          setVideos(data.videos || []);
        } else {
          console.error('Error fetching videos:', response.statusText);
          toast.error('Failed to load your generated videos');
        }
      } catch (error) {
        console.error('Error fetching videos:', error);
        toast.error('Failed to load your generated videos');
      } finally {
        setLoading(false);
      }
    }
    
    fetchVideos();
  }, [session]);
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  if (videos.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="mb-4">
          <FileVideo className="h-12 w-12 mx-auto text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium mb-2">No videos generated yet</h3>
        <p className="text-muted-foreground mb-4">
          Generate your first video using the Text to Video or Image to Video tabs
        </p>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Your Generated Videos</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {videos.map((video) => (
          <div key={video.id} className="border rounded-lg overflow-hidden bg-card shadow-sm">
            <div className="aspect-video relative">
              <video 
                src={video.url} 
                controls 
                className="w-full h-full object-cover"
                poster="/video-poster.png"
              />
            </div>
            
            <div className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                  {video.type === 'image_to_video' ? 'Image to Video' : 'Text to Video'}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDate(video.created_at)}
                </span>
              </div>
              
              <p className="text-sm line-clamp-2">{video.prompt_text}</p>
              
              <div className="flex justify-between items-center pt-2">
                <span className="text-xs text-muted-foreground">
                  {video.aspect_ratio}
                </span>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const a = document.createElement('a');
                    a.href = video.url;
                    a.download = `video-${video.id}.mp4`;
                    a.click();
                  }}
                  className="flex items-center gap-1"
                >
                  <Download className="h-4 w-4" />
                  <span>Download</span>
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
