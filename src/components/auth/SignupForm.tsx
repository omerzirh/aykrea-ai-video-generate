import { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { useAuth } from '../../lib/auth-context';
import { useLanguageHook as useLanguage } from '../../lib/use-language';

interface SignupFormProps {
  onSuccess: () => void;
  onLogin: () => void;
}

export default function SignupForm({ onSuccess, onLogin }: SignupFormProps) {
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { signUp } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!email || !password) {
      setError(t('auth.emailPasswordRequired'));
      return;
    }
    
    if (password !== confirmPassword) {
      setError(t('auth.passwordsDoNotMatch'));
      return;
    }
    
    if (password.length < 6) {
      setError(t('auth.passwordTooShort'));
      return;
    }
    
    setIsLoading(true);
    
    try {
      await signUp(email, password);
      onSuccess();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : t('auth.signUpError');
      setError(errorMessage);
      // If the error is about an existing account, suggest login
      if (errorMessage.includes('email already exists')) {
        setTimeout(() => {
          onLogin();
        }, 3000);
      }
    } finally {
      setIsLoading(false);
    }
  };

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
      
      <div className="space-y-2">
        <Label htmlFor="password">{t('auth.password')}</Label>
        <Input
          id="password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">{t('auth.confirmPassword')}</Label>
        <Input
          id="confirmPassword"
          type="password"
          placeholder="••••••••"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />
      </div>
      
      {error && (
        <div className="text-sm text-red-500">{error}</div>
      )}
      
      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? t('auth.creatingAccount') : t('auth.signUp')}
      </Button>
    </form>
  );
}
