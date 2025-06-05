import { useState, useRef, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Textarea } from './components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select';
// import { generateVideoFromImage } from './aiactions/generateVideoFromImage';
import { generateVideoFromImageRunway } from './aiactions/generateVideoFromImageRunway';
import { generateVideoFromTextRunway } from './aiactions/generateVideoFromTextRunway';
import { FileVideo, Image as ImageIcon, Wand2 } from 'lucide-react';
import { useAuth } from './lib/auth-context';
// import { useLanguageHook as useLanguage } from './lib/use-language';
import { useNavigate, useLocation } from 'react-router-dom';
import Header from './components/Header';
import UserDashboard from './components/subscription/UserDashboard';
import SubscriptionPlans from './components/subscription/SubscriptionPlans';
import CheckoutSuccess from './components/subscription/CheckoutSuccess';
import CheckoutCanceled from './components/subscription/CheckoutCanceled';

function AppWithSubscription() {
  // Translation function is used in imported components
  // but not directly in this file
  // const { t } = useLanguage();
  
  // State for prompts
  const [imagePrompt, setImagePrompt] = useState('');
  const [videoPrompt, setVideoPrompt] = useState('');
  const [videoFromImagePrompt, setVideoFromImagePrompt] = useState('');
  
  // State for generated content
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [generatedVideos, setGeneratedVideos] = useState<string[]>([]);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  
  // State for options
  const [aspectRatio, setAspectRatio] = useState<"16:9" | "9:16">("16:9");
  const [durationSeconds, setDurationSeconds] = useState(6);
  // const [numberOfVideos] = useState<1 | 2>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [videoModel] = useState<"runway">("runway");
  const [imageToVideoModel] = useState<"runway">("runway");
  
  // Auth state
  const { user, subscription, checkUsageLimit, incrementUsage } = useAuth();
  
  // Hash-based routing
  const [currentRoute, setCurrentRoute] = useState('');
  
  // File input reference
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Navigation
  const navigate = useNavigate();
  const location = useLocation();
  
  // Handle hash-based routing
  useEffect(() => {
    const handleHashChange = () => {
      console.log(location.hash.slice(1));
      setCurrentRoute(location.hash.slice(1) || '');
    };
    
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [location.hash]);

  // Handle direct path-based URLs
  useEffect(() => {
    // Check for direct path-based URLs that should use hash-based routing
    const pathname = location.pathname;
    if (pathname === '/success') {
      navigate('/success', { replace: true });
    } else if (pathname === '/canceled') {
      navigate('/canceled', { replace: true });
    }
  }, [location.pathname, location.search, navigate]);

  // Validate prompt has more than 2 words
  const isValidPrompt = (prompt: string) => {
    const words = prompt.trim().split(/\s+/);
    return words.length > 2;
  };

  // Handle image upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setUploadedImage(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  // Handle image generation
  const handleGenerateImage = async () => {
    if (!imagePrompt.trim()) return;
    
    if (!isValidPrompt(imagePrompt)) {
      alert('Please provide a more detailed description (at least 3 words)');
      return;
    }
    
    // Check if user is logged in
    if (!user) {
      alert('Please sign in to generate images');
      window.location.hash = '';
      return;
    }
    
    // Check usage limits
    const canGenerate = await checkUsageLimit('image');
    if (!canGenerate) {
      alert('You have reached your daily image generation limit. Please upgrade your subscription for more.');
      return;
    }
    
    setIsLoading(true);
    try {
      // const images = await generateImage({
      //   prompt: imagePrompt,
      //   numberOfImages: 1
      // });
      
      // Increment usage
      await incrementUsage('image');
      
      // setGeneratedImages(images);
    } catch (error) {
      console.error('Error generating image:', error);
      alert('Error generating image');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle video generation
  const handleGenerateVideo = async () => {
    if (!videoPrompt.trim()) return;
    
    if (!isValidPrompt(videoPrompt)) {
      alert('Please provide a more detailed description (at least 3 words)');
      return;
    }
    
    // Check if user is logged in
    if (!user) {
      alert('Please sign in to generate videos');
      window.location.hash = '';
      return;
    }
    
    // Check usage limits
    const canGenerate = await checkUsageLimit('video');
    if (!canGenerate) {
      alert('You have reached your daily video generation limit. Please upgrade your subscription for more.');
      return;
    }
    
    // Check duration limits based on subscription
    if (subscription && durationSeconds > subscription.features.maxVideoLength) {
      alert(`Your current subscription only allows videos up to ${subscription.features.maxVideoLength} seconds`);
      return;
    }
    
    setIsLoading(true);
    try {
      let videos;
      
      if (videoModel === "runway") {
        videos = await generateVideoFromTextRunway({
          prompt: videoPrompt,
          aspectRatio,
          durationSeconds
        });
      }
      
      // Increment usage if videos were generated
      if (videos && videos.length > 0) {
        await incrementUsage('video');
      }
      
      setGeneratedVideos(videos || []);
    } catch (error) {
      console.error('Error generating video:', error);
      alert('Error generating video');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle video from image generation
  const handleGenerateVideoFromImage = async () => {
    if (!uploadedImage) {
      alert('Please upload an image first');
      return;
    }
    
    if (videoFromImagePrompt && !isValidPrompt(videoFromImagePrompt)) {
      alert('Please provide a more detailed description (at least 3 words)');
      return;
    }
    
    // Check if user is logged in
    if (!user) {
      alert('Please sign in to generate videos');
      window.location.hash = '';
      return;
    }
    
    // Check usage limits
    const canGenerate = await checkUsageLimit('video');
    if (!canGenerate) {
      alert('You have reached your daily video generation limit. Please upgrade your subscription for more.');
      return;
    }
    
    // Check duration limits based on subscription
    if (subscription && durationSeconds > subscription.features.maxVideoLength) {
      alert(`Your current subscription only allows videos up to ${subscription.features.maxVideoLength} seconds`);
      return;
    }
    
    setIsLoading(true);
    try {
      // Extract base64 data from the data URL
      const base64Data = uploadedImage.split(',')[1];
      
      let videos;
      
      if (imageToVideoModel === "runway") {
        videos = await generateVideoFromImageRunway({
          prompt: videoFromImagePrompt,
          imageBytes: base64Data,
          aspectRatio,
          durationSeconds
        });
      }
      
      // Increment usage if videos were generated
      if (videos && videos.length > 0) {
        await incrementUsage('video');
      }
      
      setGeneratedVideos(videos || []);
    } catch (error) {
      console.error('Error generating video from image:', error);
      alert('Error generating video from image');
    } finally {
      setIsLoading(false);
    }
  };

  // Render content based on route
  const renderContent = () => {
    switch (currentRoute) {
      case 'dashboard':
        return <UserDashboard />;
      case 'plans':
        return <SubscriptionPlans />;
      case 'success':
        return <CheckoutSuccess />;
      case 'canceled':
        return <CheckoutCanceled />;
      default:
        return (
          <div className="space-y-6">
            <Tabs defaultValue="text-to-video" className="w-full">
              <TabsList className="grid grid-cols-3 mb-8">
                <TabsTrigger value="text-to-video">
                  <div className="flex items-center gap-2">
                    <FileVideo className="h-4 w-4" />
                    <span>Text to Video</span>
                  </div>
                </TabsTrigger>
                <TabsTrigger value="text-to-image">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="h-4 w-4" />
                    <span>Text to Image</span>
                  </div>
                </TabsTrigger>
                <TabsTrigger value="image-to-video" id="image-to-video-tab">
                  <div className="flex items-center gap-2">
                    <Wand2 className="h-4 w-4" />
                    <span>Image to Video</span>
                  </div>
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="text-to-video" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="video-prompt">Video Description</Label>
                  <Textarea 
                    id="video-prompt" 
                    placeholder="Describe the video you want to generate..."
                    value={videoPrompt}
                    onChange={(e) => setVideoPrompt(e.target.value)}
                    rows={5}
                    className="resize-none"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="aspect-ratio">Aspect Ratio</Label>
                    <Select 
                      value={aspectRatio} 
                      onValueChange={(value) => setAspectRatio(value as "16:9" | "9:16")}
                    >
                      <SelectTrigger id="aspect-ratio">
                        <SelectValue placeholder="Select aspect ratio" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="16:9">Landscape (16:9)</SelectItem>
                        <SelectItem value="9:16">Portrait (9:16)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="duration">Duration (seconds)</Label>
                    <Select 
                      value={durationSeconds.toString()} 
                      onValueChange={(value) => setDurationSeconds(parseInt(value))}
                    >
                      <SelectTrigger id="duration">
                        <SelectValue placeholder="Select duration" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="2">2 seconds</SelectItem>
                        <SelectItem value="4">4 seconds</SelectItem>
                        <SelectItem value="5">5 seconds</SelectItem>
                        <SelectItem value="6">6 seconds</SelectItem>
                        {subscription?.tier !== 'free' && (
                          <SelectItem value="8">8 seconds</SelectItem>
                        )}
                        {subscription?.tier === 'premium' && (
                          <>
                            <SelectItem value="10">10 seconds</SelectItem>
                            <SelectItem value="15">15 seconds</SelectItem>
                            <SelectItem value="30">30 seconds</SelectItem>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <Button 
                  onClick={handleGenerateVideo} 
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading ? 'Generating...' : 'Generate Video'}
                </Button>
                
                {generatedVideos.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="font-medium">Generated Videos</h3>
                    <div className="grid gap-4">
                      {generatedVideos.map((video, index) => (
                        <div key={index} className="border rounded-lg overflow-hidden">
                          <video 
                            src={video} 
                            controls 
                            className="w-full h-auto"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="text-to-image" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="image-prompt">Image Description</Label>
                  <Textarea 
                    id="image-prompt" 
                    placeholder="Describe the image you want to generate..."
                    value={imagePrompt}
                    onChange={(e) => setImagePrompt(e.target.value)}
                    rows={5}
                    className="resize-none"
                  />
                </div>
                
                <Button 
                  onClick={handleGenerateImage} 
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading ? 'Generating...' : 'Generate Image'}
                </Button>
                
                {generatedImages.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="font-medium">Generated Images</h3>
                    <div className="grid gap-4">
                      {generatedImages.map((image, index) => (
                        <div key={index} className="border rounded-lg overflow-hidden">
                          <img 
                            src={image} 
                            alt={`Generated image ${index + 1}`} 
                            className="w-full h-auto"
                          />
                          <div className="p-2 flex justify-between">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                setUploadedImage(image);
                                document.getElementById('image-to-video-tab')?.click();
                              }}
                            >
                              Use for Video
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                const a = document.createElement('a');
                                a.href = image;
                                a.download = `generated-image-${index}.png`;
                                a.click();
                              }}
                            >
                              Download
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="image-to-video" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="image-upload">Upload Image</Label>
                  <div className="grid gap-2">
                    <Input
                      id="image-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      ref={fileInputRef}
                      className="hidden"
                    />
                    <Button 
                      variant="outline" 
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full"
                    >
                      Select Image
                    </Button>
                    
                    {uploadedImage && (
                      <div className="border rounded-lg overflow-hidden">
                        <img 
                          src={uploadedImage} 
                          alt="Uploaded image" 
                          className="w-full h-auto max-h-64 object-contain"
                        />
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="video-from-image-prompt">Motion Description (Optional)</Label>
                  <Textarea 
                    id="video-from-image-prompt" 
                    placeholder="Describe how the image should animate..."
                    value={videoFromImagePrompt}
                    onChange={(e) => setVideoFromImagePrompt(e.target.value)}
                    rows={3}
                    className="resize-none"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="aspect-ratio-img">Aspect Ratio</Label>
                    <Select 
                      value={aspectRatio} 
                      onValueChange={(value) => setAspectRatio(value as "16:9" | "9:16")}
                    >
                      <SelectTrigger id="aspect-ratio-img">
                        <SelectValue placeholder="Select aspect ratio" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="16:9">Landscape (16:9)</SelectItem>
                        <SelectItem value="9:16">Portrait (9:16)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="duration-img">Duration (seconds)</Label>
                    <Select 
                      value={durationSeconds.toString()} 
                      onValueChange={(value) => setDurationSeconds(parseInt(value))}
                    >
                      <SelectTrigger id="duration-img">
                        <SelectValue placeholder="Select duration" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="2">2 seconds</SelectItem>
                        <SelectItem value="4">4 seconds</SelectItem>
                        <SelectItem value="5">5 seconds</SelectItem>
                        <SelectItem value="6">6 seconds</SelectItem>
                        {subscription?.tier !== 'free' && (
                          <SelectItem value="8">8 seconds</SelectItem>
                        )}
                        {subscription?.tier === 'premium' && (
                          <>
                            <SelectItem value="10">10 seconds</SelectItem>
                            <SelectItem value="15">15 seconds</SelectItem>
                            <SelectItem value="30">30 seconds</SelectItem>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <Button 
                  onClick={handleGenerateVideoFromImage} 
                  className="w-full"
                  disabled={isLoading || !uploadedImage}
                >
                  {isLoading ? 'Generating...' : 'Generate Video from Image'}
                </Button>
                
                {generatedVideos.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="font-medium">Generated Videos</h3>
                    <div className="grid gap-4">
                      {generatedVideos.map((video, index) => (
                        <div key={index} className="border rounded-lg overflow-hidden">
                          <video 
                            src={video} 
                            controls 
                            className="w-full h-auto"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
            
            {user && (
              <div className="p-4 bg-muted rounded-lg">
                <h3 className="font-medium mb-2">Subscription</h3>
                <p className="text-sm text-muted-foreground">
                  {subscription ? (
                    <>
                      You are on the <span className="font-medium capitalize">{subscription.tier}</span> plan. 
                      {subscription.tier !== 'premium' && (
                        <> Consider upgrading for more features and higher limits.</>
                      )}
                    </>
                  ) : (
                    <>Loading subscription information...</>
                  )}
                </p>
                <Button 
                  variant="link" 
                  className="p-0 h-auto text-sm" 
                  onClick={() => navigate('/plans')}
                >
                  View Plans
                </Button>
              </div>
            )}
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto py-8 px-4">
        {renderContent()}
      </main>
    </div>
  );
}

export default AppWithSubscription;
