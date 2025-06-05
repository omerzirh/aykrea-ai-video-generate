import { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { useAuth } from '../../lib/auth-context';
import { useLanguageHook as useLanguage } from '../../lib/use-language';

interface ResetPasswordFormProps {
  onBack: () => void;
  // onSuccess: () => void; // Not used in this component
}

export default function ResetPasswordForm({ onBack }: ResetPasswordFormProps) {
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { resetPassword } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      return;
    }
    
    setIsLoading(true);
    
    try {
      await resetPassword(email);
      setIsSubmitted(true);
      // After successful submission, we'll show the success message
      // and then call onSuccess when the user clicks the back button
    } catch (error: unknown) {
      // Show error message
      console.error('Reset password error:', error);
      alert(t('auth.resetPasswordError'));
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="space-y-4">
        <p className="text-sm">
          {t('auth.resetPasswordSuccess')}
        </p>
        <Button type="button" onClick={onBack} className="w-full">
          {t('auth.signIn')}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">{t('auth.email')}</Label>
        <Input
          id="email"
          type="email"
          placeholder="your.email@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      
      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={onBack} className="flex-1">
          {t('auth.back')}
        </Button>
        <Button type="submit" className="flex-1" disabled={isLoading}>
          {isLoading ? t('auth.sending') : t('auth.resetPassword')}
        </Button>
      </div>
    </form>
  );
}
