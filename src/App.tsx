import { useState, useRef, useEffect } from 'react'
import toast from 'react-hot-toast'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs'
import { Button } from './components/ui/button'
import { Input } from './components/ui/input'
import { Label } from './components/ui/label'
import { Textarea } from './components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select'
import { generateVideoFromImageRunway } from './aiactions/generateVideoFromImageRunway'
import { generateVideoFromTextRunway } from './aiactions/generateVideoFromTextRunway'
import { FileVideo, Image as ImageIcon, Wand2 } from 'lucide-react'
import { useAuth } from './lib/auth-context'
import { useLanguageHook as useLanguage } from './lib/use-language'
// // import GeneratedContentTab from './components/GeneratedContentTab'
import AuthModal from './components/auth/AuthModal'

function App() {
  // Get translation function
  const { t } = useLanguage()
  
  // State for prompts
  const [imagePrompt, setImagePrompt] = useState<string>('')
  const [videoPrompt, setVideoPrompt] = useState<string>('')
  const [videoFromImagePrompt, setVideoFromImagePrompt] = useState<string>('')
  
  // State for generated content
  const [generatedImages, setGeneratedImages] = useState<string[]>([])
  const [generatedVideos, setGeneratedVideos] = useState<string[]>([])
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  
  // State for options
  const [aspectRatio, setAspectRatio] = useState<"16:9" | "9:16">("16:9")
  const [durationSeconds, setDurationSeconds] = useState<number>(6)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [videoModel] = useState<string>("runway")
  const [imageToVideoModel] = useState<string>("runway")
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false)
  
  // Auth state
  const { user, subscription, checkUsageLimit, incrementUsage, session } = useAuth()
  
  // File input reference
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Clean up generated URLs when component unmounts
  useEffect(() => {
    return () => {
      // Revoke object URLs to avoid memory leaks
      generatedImages.forEach(url => {
        if (url.startsWith('blob:')) {
          URL.revokeObjectURL(url)
        }
      })
      generatedVideos.forEach(url => {
        if (url.startsWith('blob:')) {
          URL.revokeObjectURL(url)
        }
      })
    }
  }, [generatedImages, generatedVideos])

  // Validate prompt has more than 2 words
  const isValidPrompt = (prompt: string): boolean => {
    const words = prompt.trim().split(/\s+/);
    return words.length > 2;
  }

  // Handle image upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      toast.error(t('app.validation.uploadImage'));
      return;
    }
    
    // Check file size (limit to 10MB)
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_FILE_SIZE) {
      toast.error(t('app.validation.fileTooLarge'));
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setUploadedImage(event.target.result as string);
      }
    };
    reader.onerror = () => {
      toast.error(t('app.validation.error'));
    };
    reader.readAsDataURL(file);
  };

  // Handle image generation
  const handleGenerateImage = async () => {
    if (!imagePrompt.trim()) return;
    
    if (!isValidPrompt(imagePrompt)) {
      toast.error(t('app.validation.detailedDescription'));
      return;
    }
    
    // Check if user is logged in
    if (!user) {
      toast.error(t('app.validation.signIn'));
      return;
    }
    
    // Check usage limits
    const canGenerate = await checkUsageLimit('image');
    if (!canGenerate) {
      toast.error(t('app.validation.usageLimit'));
      return;
    }
    
    setIsLoading(true);
    try {
      // const images = await generateImage({
      //   prompt: imagePrompt,
      //   numberOfImages: 1,
      //   accessToken: session?.access_token
      // });
      
      // Increment usage
      await incrementUsage('image');
      
      // setGeneratedImages(images);
    } catch (error) {
      console.error('Error generating image:', error);
      toast.error(t('app.validation.error'));
    } finally {
      setIsLoading(false);
    }
  };

  // Handle video generation
  const handleGenerateVideo = async () => {
    if (!videoPrompt.trim()) return;
    
    if (!isValidPrompt(videoPrompt)) {
      toast.error(t('app.validation.detailedDescription'));
      return;
    }
    
    // Check if user is logged in
    if (!user) {
      toast.error(t('app.validation.signIn'));
      return;
    }
    
    // Check usage limits
    const canGenerate = await checkUsageLimit('video');
    if (!canGenerate) {
      toast.error(t('app.validation.usageLimit'));
      return;
    }
    
    // Check duration limits based on subscription
    if (subscription && durationSeconds > subscription.features.maxVideoLength) {
      toast.error(t('app.validation.durationLimit').replace('{0}', subscription.features.maxVideoLength.toString()));
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
      toast.error(t('app.validation.error'));
    } finally {
      setIsLoading(false);
    }
  };

  // Handle video from image generation
  const handleGenerateVideoFromImage = async () => {
    if (!uploadedImage) {
      toast.error(t('app.validation.uploadImage'));
      return;
    }
    
    if (videoFromImagePrompt && !isValidPrompt(videoFromImagePrompt)) {
      toast.error(t('app.validation.detailedDescription'));
      return;
    }
    
    // Check if user is logged in
    if (!user) {
      toast.error(t('app.validation.signIn'));
      return;
    }
    
    // Check usage limits
    const canGenerate = await checkUsageLimit('video');
    if (!canGenerate) {
      toast.error(t('app.validation.usageLimit'));
      return;
    }
    
    // Check duration limits based on subscription
    if (subscription && durationSeconds > subscription.features.maxVideoLength) {
      toast.error(t('app.validation.durationLimit').replace('{0}', subscription.features.maxVideoLength.toString()));
      return;
    }
    
    setIsLoading(true);
    try {
      // Extract base64 data from the data URL
      const base64Data = uploadedImage!.split(',')[1];
      
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
      toast.error(t('app.validation.error'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="text-to-video" className="w-full">
        <TabsList className="grid grid-cols-3 mb-8">
          <TabsTrigger value="text-to-video">
            <div className="flex items-center gap-2">
              <FileVideo className="h-4 w-4" />
              <span>{t('app.tabs.textToVideo')}</span>
            </div>
          </TabsTrigger>
          <TabsTrigger value="text-to-image">
            <div className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4" />
              <span>{t('app.tabs.textToImage')}</span>
            </div>
          </TabsTrigger>
          <TabsTrigger value="image-to-video" id="image-to-video-tab">
            <div className="flex items-center gap-2">
              <Wand2 className="h-4 w-4" />
              <span>{t('app.tabs.imageToVideo')}</span>
            </div>
          </TabsTrigger>
        </TabsList>
            
        <TabsContent value="text-to-video" className="space-y-4">
          <div className="flex flex-col md:flex-row gap-6">
            {/* Left side - Controls */}
            <div className="w-full md:w-2/5 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="video-prompt">{t('app.prompts.videoPrompt')}</Label>
                <Textarea 
                  id="video-prompt" 
                  placeholder={t('app.prompts.videoPrompt')}
                  value={videoPrompt}
                  onChange={(e) => setVideoPrompt(e.target.value)}
                  rows={5}
                  className="resize-none"
                  aria-required="true"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="aspect-ratio">{t('app.options.aspectRatio')}</Label>
                  <Select 
                    value={aspectRatio} 
                    onValueChange={(value: "16:9" | "9:16") => setAspectRatio(value)}
                  >
                    <SelectTrigger id="aspect-ratio">
                      <SelectValue placeholder={t('app.options.aspectRatio')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="16:9">Landscape (16:9)</SelectItem>
                      <SelectItem value="9:16">Portrait (9:16)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="duration">{t('app.options.duration')}</Label>
                  <Select 
                    value={durationSeconds.toString()} 
                    onValueChange={(value) => setDurationSeconds(parseInt(value))}
                  >
                    <SelectTrigger id="duration">
                      <SelectValue placeholder={t('app.options.duration')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2">2 {t('app.options.seconds')}</SelectItem>
                      <SelectItem value="4">4 {t('app.options.seconds')}</SelectItem>
                      <SelectItem value="5">5 {t('app.options.seconds')}</SelectItem>
                      <SelectItem value="6">6 {t('app.options.seconds')}</SelectItem>
                      {subscription?.tier !== 'free' && (
                        <SelectItem value="8">8 {t('app.options.seconds')}</SelectItem>
                      )}
                      {subscription?.tier === 'premium' && (
                        <>
                          <SelectItem value="10">10 {t('app.options.seconds')}</SelectItem>
                          <SelectItem value="15">15 {t('app.options.seconds')}</SelectItem>
                          <SelectItem value="30">30 {t('app.options.seconds')}</SelectItem>
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
                {isLoading ? 'Generating...' : t('app.buttons.generateVideo')}
              </Button>
            </div>
            
            {/* Right side - Generated content */}
            <div className="w-full md:w-3/5">
              {generatedVideos.length > 0 ? (
                <div className="space-y-2">
                  <h3 className="font-medium">{t('content.videos')}</h3>
                  <div className="grid gap-4">
                    {generatedVideos.map((video, index) => (
                      <div key={index} className="border rounded-lg overflow-hidden">
                        <video 
                          src={video} 
                          controls 
                          className="w-full h-auto"
                          aria-label={`Generated video ${index + 1}`}
                        />
                        <div className="p-2 flex justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const a = document.createElement('a');
                              a.href = video;
                              a.download = `generated-video-${index}.mp4`;
                              a.click();
                            }}
                          >
                            {t('content.download')}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full min-h-[300px] border-2 border-dashed rounded-lg p-6">
                  <div className="text-center">
                    <FileVideo className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="font-medium mb-2">{t('content.noContent')}</h3>
                    <p className="text-sm text-muted-foreground">{t('app.prompts.videoPrompt')}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="text-to-image" className="space-y-4">
          <div className="flex flex-col md:flex-row gap-6">
            {/* Left side - Controls */}
            <div className="w-full md:w-2/5 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="image-prompt">{t('app.prompts.imagePrompt')}</Label>
                <Textarea 
                  id="image-prompt" 
                  placeholder={t('app.prompts.imagePrompt')}
                  value={imagePrompt}
                  onChange={(e) => setImagePrompt(e.target.value)}
                  rows={5}
                  className="resize-none"
                  aria-required="true"
                />
              </div>
              
              <Button 
                onClick={handleGenerateImage} 
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? 'Generating...' : t('app.buttons.generateImage')}
              </Button>
            </div>
            
            {/* Right side - Generated content */}
            <div className="w-full md:w-3/5">
              {generatedImages.length > 0 ? (
                <div className="space-y-2">
                  <h3 className="font-medium">{t('content.images')}</h3>
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
                            {t('app.buttons.generateVideo')}
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
                            {t('content.download')}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full min-h-[300px] border-2 border-dashed rounded-lg p-6">
                  <div className="text-center">
                    <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="font-medium mb-2">{t('content.noContent')}</h3>
                    <p className="text-sm text-muted-foreground">{t('app.prompts.imagePrompt')}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="image-to-video" className="space-y-4">
          <div className="flex flex-col md:flex-row gap-6">
            {/* Left side - Controls */}
            <div className="w-full md:w-2/5 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="image-upload">{t('app.buttons.uploadImage')}</Label>
                <div className="grid gap-2">
                  <Input
                    id="image-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    ref={fileInputRef}
                    className="hidden"
                    aria-hidden="true"
                  />
                  <Button 
                    variant="outline" 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full"
                    aria-label="Select image to upload"
                  >
                    {t('app.buttons.selectImage')}
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
                <Label htmlFor="video-from-image-prompt">{t('app.prompts.videoFromImagePrompt')}</Label>
                <Textarea 
                  id="video-from-image-prompt" 
                  placeholder={t('app.prompts.videoFromImagePrompt')}
                  value={videoFromImagePrompt}
                  onChange={(e) => setVideoFromImagePrompt(e.target.value)}
                  rows={3}
                  className="resize-none"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="aspect-ratio-img">{t('app.options.aspectRatio')}</Label>
                  <Select 
                    value={aspectRatio} 
                    onValueChange={(value: "16:9" | "9:16") => setAspectRatio(value)}
                  >
                    <SelectTrigger id="aspect-ratio-img">
                      <SelectValue placeholder={t('app.options.aspectRatio')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="16:9">Landscape (16:9)</SelectItem>
                      <SelectItem value="9:16">Portrait (9:16)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="duration-img">{t('app.options.duration')}</Label>
                  <Select 
                    value={durationSeconds.toString()} 
                    onValueChange={(value) => setDurationSeconds(parseInt(value))}
                  >
                    <SelectTrigger id="duration-img">
                      <SelectValue placeholder={t('app.options.duration')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2">2 {t('app.options.seconds')}</SelectItem>
                      <SelectItem value="4">4 {t('app.options.seconds')}</SelectItem>
                      <SelectItem value="5">5 {t('app.options.seconds')}</SelectItem>
                      {subscription?.tier !== 'free' && (
                        <SelectItem value="8">8 {t('app.options.seconds')}</SelectItem>
                      )}
                      {subscription?.tier === 'premium' && (
                        <>
                          <SelectItem value="10">10 {t('app.options.seconds')}</SelectItem>
                          <SelectItem value="15">15 {t('app.options.seconds')}</SelectItem>
                          <SelectItem value="30">30 {t('app.options.seconds')}</SelectItem>
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
                {isLoading ? 'Generating...' : t('app.buttons.generateVideo')}
              </Button>
            </div>
            
            {/* Right side - Generated content */}
            <div className="w-full md:w-3/5">
              {generatedVideos.length > 0 ? (
                <div className="space-y-2">
                  <h3 className="font-medium">{t('content.videos')}</h3>
                  <div className="grid gap-4">
                    {generatedVideos.map((video, index) => (
                      <div key={index} className="border rounded-lg overflow-hidden">
                        <video 
                          src={video} 
                          controls 
                          className="w-full h-auto"
                          aria-label={`Generated video ${index + 1}`}
                        />
                        <div className="p-2 flex justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const a = document.createElement('a');
                              a.href = video;
                              a.download = `generated-video-${index}.mp4`;
                              a.click();
                            }}
                          >
                            {t('content.download')}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full min-h-[300px] border-2 border-dashed rounded-lg p-6">
                  <div className="text-center">
                    <FileVideo className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="font-medium mb-2">{t('content.noContent')}</h3>
                    <p className="text-sm text-muted-foreground">{t('app.prompts.videoFromImagePrompt')}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
      
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />
    </div>
  );
}

export default App;
