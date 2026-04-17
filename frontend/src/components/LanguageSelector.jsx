import { useTranslation } from 'react-i18next';

export default function LanguageSelector() {
  const { i18n } = useTranslation();

  return (
    <label className="inline-flex items-center gap-2 text-sm">
      <span className="text-base-content/60">Language</span>
      <select
        value={i18n.language}
        onChange={(e) => i18n.changeLanguage(e.target.value)}
        className="px-2 py-1 border border-base-300 rounded-md bg-base-100"
      >
        <option value="en">English</option>
      </select>
    </label>
  );
}
