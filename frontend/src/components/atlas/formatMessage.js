import DOMPurify from 'dompurify';

const DOMPURIFY_CONFIG = {
  ALLOWED_TAGS: ['strong', 'em', 'b', 'i', 'br'],
  ALLOWED_ATTR: ['class'],
};
 * Converts Atlas/markdown-like message content to an array of React elements.
 * @param {string} content
 * @param {boolean} isUser
 * @returns {Array}
 */
export function formatMessage(content, isUser) {
  if (!content) return [];

  const textColor = isUser ? 'text-white' : 'text-base-content';
  const boldColor = isUser ? 'text-white' : 'text-base-content';
  const subColor = isUser ? 'text-emerald-100' : 'text-base-content/80';

  const sections = [];
  const paragraphs = content.split(/\n\n+/);

  paragraphs.forEach((paragraph, paraIndex) => {
    const lines = paragraph.split('\n');
    let hasSection = false;

    lines.forEach((line, lineIndex) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      const boldHeaderMatch = trimmed.match(/^\*\*(.+?)\*\*[:\-]?\s*(.*)$/);
      if (boldHeaderMatch) {
        hasSection = true;
        sections.push(
          <p key={`sec-${paraIndex}-${lineIndex}`} className={`font-bold mt-4 mb-2 text-base ${boldColor}`}>
            {boldHeaderMatch[1]}
            {boldHeaderMatch[2] && (
              <span className={`font-normal ${subColor} text-sm ml-1`}>{boldHeaderMatch[2]}</span>
            )}
          </p>,
        );
        return;
      }

      const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
      if (headingMatch) {
        hasSection = true;
        const level = headingMatch[1].length;
        const classes =
          level === 1
            ? `font-bold ${textColor} mt-5 mb-2`
            : level === 2
            ? `font-semibold ${textColor} mt-4 mb-1.5`
            : `font-medium ${subColor} mt-3 mb-1 uppercase tracking-wide`;
        sections.push(
          <p key={`h-${paraIndex}-${lineIndex}`} className={classes}>
            {headingMatch[2]}
          </p>,
        );
        return;
      }

      const bulletMatch = trimmed.match(/^[•\-\*]\s+(.+)$/);
      if (bulletMatch) {
        sections.push(
          <li
            key={`li-${paraIndex}-${lineIndex}`}
            className={`ml-4 list-disc list-inside mb-1.5 ${isUser ? 'text-emerald-50' : 'text-base-content/80'}`}
          >
            {bulletMatch[1]}
          </li>,
        );
        return;
      }

      const numberMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
      if (numberMatch) {
        sections.push(
          <li
            key={`num-${paraIndex}-${lineIndex}`}
            className={`ml-4 list-decimal list-inside mb-1.5 ${isUser ? 'text-emerald-50' : 'text-base-content/80'}`}
          >
            {numberMatch[2]}
          </li>,
        );
        return;
      }

      const boldMatch = trimmed.match(/\*\*(.+?)\*\*/g);
      let displayText = trimmed;
      if (boldMatch) {
        boldMatch.forEach((bold) => {
          const boldContent = bold.replace(/\*\*/g, '');
          displayText = displayText.replace(
            bold,
            `<strong class="font-bold ${boldColor}">${boldContent}</strong>`,
          );
        });
      }

      if (displayText !== trimmed) {
        sections.push(
          <p
            key={`b-${paraIndex}-${lineIndex}`}
            className={`mb-2 ${isUser ? 'text-emerald-50' : 'text-base-content/80'}`}
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(displayText, DOMPURIFY_CONFIG) }}
          />,
        );
        return;
      }

      sections.push(
        <p
          key={`p-${paraIndex}-${lineIndex}`}
          className={`mb-2 ${isUser ? 'text-emerald-50' : 'text-base-content/80'} ${hasSection ? 'ml-2' : ''}`}
        >
          {trimmed}
        </p>,
      );
    });
  });

  return sections;
}
