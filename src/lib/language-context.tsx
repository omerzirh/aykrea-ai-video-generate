import { createContext, useState, useEffect, ReactNode } from 'react';
import { Language, LanguageContextType } from './language-types';

// Import translations
const translations = {
  en: {
    header: {
      title: 'AI Video Creator',
      subtitle: 'Create stunning videos and images with AI',
      signIn: 'Sign In',
      signOut: 'Sign Out',
      dashboard: 'Dashboard',
      myContent: 'My Content',
      viewPlans: 'View Plans',
      plan: 'Plan'
    },
    app: {
      tabs: {
        textToImage: 'Text to Image',
        textToVideo: 'Text to Video',
        imageToVideo: 'Image to Video'
      },
      prompts: {
        imagePrompt: 'Describe the image you want to create',
        videoPrompt: 'Describe the video you want to create',
        videoFromImagePrompt: 'Describe the motion for your video (optional)'
      },
      buttons: {
        generate: 'Generate',
        generateImage: 'Generate Image',
        generateVideo: 'Generate Video',
        uploadImage: 'Upload Image',
        selectImage: 'Select Image'
      },
      options: {
        aspectRatio: 'Aspect Ratio',
        duration: 'Duration',
        seconds: 'seconds'
      },
      validation: {
        detailedDescription: 'Please provide a more detailed description (at least 3 words)',
        uploadImage: 'Please upload an image first',
        signIn: 'Please sign in to generate',
        usageLimit: 'You have reached your daily generation limit. Please upgrade your subscription for more.',
        durationLimit: 'Your current subscription only allows videos up to {0} seconds',
        error: 'Error generating',
        fileTooLarge: 'Image file is too large (max 10MB)'
      }
    },
    auth: {
      email: 'Email',
      password: 'Password',
      confirmPassword: 'Confirm Password',
      signIn: 'Sign In',
      signUp: 'Sign Up',
      forgotPassword: 'Forgot Password?',
      noAccount: 'Don\'t have an account?',
      haveAccount: 'Already have an account?',
      resetPassword: 'Reset Password',
      resetPasswordSuccess: 'Password reset email sent. Check your inbox.',
      resetPasswordError: 'Error sending reset email',
      back: 'Back',
      sending: 'Sending...',
      creatingAccount: 'Creating account...',
      emailPasswordRequired: 'Email and password are required',
      passwordsDoNotMatch: 'Passwords do not match',
      passwordTooShort: 'Password must be at least 6 characters'
    },
    subscription: {
      plans: 'Subscription Plans',
      free: 'Free',
      basic: 'Basic',
      premium: 'Premium',
      features: 'Features',
      currentPlan: 'Current Plan',
      upgrade: 'Upgrade Plan',
      changePlan: 'Change Plan',
      subscribe: 'Subscribe',
      perMonth: '/month',
      expiresOn: 'Expires on',
      active: 'Active',
      managementError: 'Failed to open subscription management',
      processing: 'Processing...',
      setupRequired: 'Setup Required',
      chooseAPlan: 'Choose the plan that works for you',
      loadingPlans: 'Loading available plans...',
      tryAgain: 'Please try again',
      freeDescription: 'Basic access for occasional use',
      basicDescription: 'Perfect for regular creators',
      premiumDescription: 'For professional content creators',
      checkout: {
        success: 'Payment Successful',
        canceled: 'Payment Canceled',
        returnToApp: 'Return to App'
      }
    },
    dashboard: {
      title: 'User Dashboard',
      usageStats: 'Today\'s Usage',
      dailyReset: 'Daily limits reset at midnight',
      loadingUsage: 'Loading usage data...',
      noUsageData: 'No usage data available',
      imagesGenerated: 'Images Generated',
      videosGenerated: 'Videos Generated',
      imagesPerDay: 'images per day',
      videosPerDay: 'videos per day',
      secondVideos: 'second videos',
      standardQuality: 'Standard quality generation',
      highQuality: 'High quality generation',
      usageLimit: 'Usage Limit',
      currentPlan: 'Your current plan',
      managePlan: 'Manage Billing'
    },
    content: {
      myContent: 'My Content',
      images: 'Images',
      videos: 'Videos',
      noContent: 'No content generated yet',
      download: 'Download',
      delete: 'Delete'
    },
    language: {
      select: 'Language',
      en: 'English',
      tr: 'Turkish'
    }
  },
  tr: {
    header: {
      title: 'AI Video Oluşturucu',
      subtitle: 'AI ile etkileyici videolar ve görseller oluşturun',
      signIn: 'Giriş Yap',
      signOut: 'Çıkış Yap',
      dashboard: 'Kontrol Paneli',
      myContent: 'İçeriklerim',
      viewPlans: 'Planları Görüntüle',
      plan: 'Plan'
    },
    app: {
      tabs: {
        textToImage: 'Metinden Görsel',
        textToVideo: 'Metinden Video',
        imageToVideo: 'Görselden Video'
      },
      prompts: {
        imagePrompt: 'Oluşturmak istediğiniz görseli tanımlayın',
        videoPrompt: 'Oluşturmak istediğiniz videoyu tanımlayın',
        videoFromImagePrompt: 'Videonuz için hareketi tanımlayın (isteğe bağlı)'
      },
      buttons: {
        generate: 'Oluştur',
        generateImage: 'Görsel Oluştur',
        generateVideo: 'Video Oluştur',
        uploadImage: 'Görsel Yükle',
        selectImage: 'Görsel Seç'
      },
      options: {
        aspectRatio: 'En-Boy Oranı',
        duration: 'Süre',
        seconds: 'saniye'
      },
      validation: {
        detailedDescription: 'Lütfen daha detaylı bir açıklama girin (en az 3 kelime)',
        uploadImage: 'Lütfen önce bir görsel yükleyin',
        signIn: 'Lütfen oluşturmak için giriş yapın',
        usageLimit: 'Günlük oluşturma limitinize ulaştınız. Daha fazlası için aboneliğinizi yükseltin.',
        durationLimit: 'Mevcut aboneliğiniz sadece {0} saniyelik videolara izin veriyor',
        error: 'Oluşturma hatası',
        fileTooLarge: 'Görsel dosyası çok büyük (maksimum 10MB)'
      }
    },
    auth: {
      email: 'E-posta',
      password: 'Şifre',
      confirmPassword: 'Şifreyi Onayla',
      signIn: 'Giriş Yap',
      signUp: 'Kayıt Ol',
      forgotPassword: 'Şifremi Unuttum?',
      noAccount: 'Hesabınız yok mu?',
      haveAccount: 'Zaten hesabınız var mı?',
      resetPassword: 'Şifreyi Sıfırla',
      resetPasswordSuccess: 'Şifre sıfırlama e-postası gönderildi. Gelen kutunuzu kontrol edin.',
      resetPasswordError: 'Sıfırlama e-postası gönderilirken hata oluştu',
      back: 'Geri',
      sending: 'Gönderiliyor...',
      creatingAccount: 'Hesap oluşturuluyor...',
      emailPasswordRequired: 'E-posta ve şifre gerekli',
      passwordsDoNotMatch: 'Şifreler eşleşmiyor',
      passwordTooShort: 'Şifre en az 6 karakter olmalıdır'
    },
    subscription: {
      plans: 'Abonelik Planları',
      free: 'Ücretsiz',
      basic: 'Temel',
      premium: 'Premium',
      features: 'Özellikler',
      currentPlan: 'Mevcut Plan',
      upgrade: 'Planı Yükselt',
      changePlan: 'Planı Değiştir',
      subscribe: 'Abone Ol',
      perMonth: '/ay',
      expiresOn: 'Bitiş tarihi',
      active: 'Aktif',
      managementError: 'Abonelik yönetimi açılamadı',
      processing: 'İşleniyor...',
      setupRequired: 'Kurulum Gerekli',
      chooseAPlan: 'Size uygun planı seçin',
      loadingPlans: 'Mevcut planlar yükleniyor...',
      checkout: {
        success: 'Ödeme Başarılı',
        canceled: 'Ödeme İptal Edildi',
        returnToApp: 'Uygulamaya Dön'
      }
    },
    dashboard: {
      title: 'Kullanıcı Paneli',
      usageStats: 'Günlük Kullanım',
      dailyReset: 'Günlük limitler gece yarısında sıfırlanır',
      loadingUsage: 'Kullanım verileri yükleniyor...',
      noUsageData: 'Kullanım verisi bulunamadı',
      imagesGenerated: 'Oluşturulan Görseller',
      videosGenerated: 'Oluşturulan Videolar',
      imagesPerDay: 'görsel/gün',
      videosPerDay: 'video/gün',
      secondVideos: 'saniyelik videolar',
      standardQuality: 'Standart kalite oluşturma',
      highQuality: 'Yüksek kalite oluşturma',
      usageLimit: 'Kullanım Limiti',
      currentPlan: 'Mevcut planınız',
      managePlan: 'Ödeme Yönetimi'
    },
    content: {
      myContent: 'İçeriklerim',
      images: 'Görseller',
      videos: 'Videolar',
      noContent: 'Henüz içerik oluşturulmadı',
      download: 'İndir',
      delete: 'Sil'
    },
    language: {
      select: 'Dil',
      en: 'İngilizce',
      tr: 'Türkçe'
    }
  }
};

// Export the context so it can be used in the hook
export const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

interface LanguageProviderProps {
  children: ReactNode;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  // Try to get saved language from localStorage, default to English
  const [language, setLanguageState] = useState<Language>(() => {
    const savedLanguage = localStorage.getItem('language');
    return (savedLanguage as Language) || 'en';
  });

  // Update localStorage when language changes
  useEffect(() => {
    localStorage.setItem('language', language);
  }, [language]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
  };

  // Translation function
  const t = (key: string): string => {
    const keys = key.split('.');
    let result: any = translations[language];
    
    for (const k of keys) {
      if (result && result[k]) {
        result = result[k];
      } else {
        // Fallback to English if key not found in current language
        let fallback: any = translations['en'];
        for (const fb of keys) {
          if (fallback && fallback[fb]) {
            fallback = fallback[fb];
          } else {
            return key; // Return the key if not found in any language
          }
        }
        return fallback;
      }
    }
    
    return result as string;
  };

  const value = {
    language,
    setLanguage,
    t
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};
