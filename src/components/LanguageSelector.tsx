
import { useLanguageHook as useLanguage } from '../lib/use-language';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

export default function LanguageSelector() {
  const { language, setLanguage, t } = useLanguage();

  return (
    <div className="flex items-center">
      <Select value={language} onValueChange={(value) => setLanguage(value as 'en' | 'tr')}>
        <SelectTrigger className="w-[120px] h-8">
          <SelectValue placeholder={t('language.select')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="en">{t('language.en')}</SelectItem>
          <SelectItem value="tr">{t('language.tr')}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
