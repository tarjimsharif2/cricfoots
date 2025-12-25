import { useMemo, forwardRef } from 'react';
import DOMPurify from 'dompurify';
import { useSiteSettings } from '@/hooks/useSiteSettings';

interface AdSlotProps {
  position: 'header' | 'sidebar' | 'footer' | 'in_article' | 'popup';
  className?: string;
}

const AdSlot = forwardRef<HTMLDivElement, AdSlotProps>(({ position, className = '' }, ref) => {
  const { data: settings } = useSiteSettings();

  // Sanitize ad code to prevent XSS attacks
  const sanitizedAdCode = useMemo(() => {
    if (!settings?.ads_enabled) return null;

    const adCodeMap: Record<string, string | null> = {
      header: settings.header_ad_code,
      sidebar: settings.sidebar_ad_code,
      footer: settings.footer_ad_code,
      in_article: settings.in_article_ad_code,
      popup: settings.popup_ad_code,
    };

    const adCode = adCodeMap[position];
    if (!adCode) return null;

    // Configure DOMPurify to allow ad-related elements and attributes
    // This allows common ad network scripts while still preventing malicious code
    return DOMPurify.sanitize(adCode, {
      ADD_TAGS: ['iframe', 'script', 'ins'],
      ADD_ATTR: [
        'data-ad-client',
        'data-ad-slot',
        'data-ad-format',
        'data-full-width-responsive',
        'async',
        'crossorigin',
        'src',
        'style',
        'class',
        'id',
        'width',
        'height',
        'frameborder',
        'scrolling',
        'allowfullscreen',
        'allow',
        'loading',
      ],
      ALLOW_UNKNOWN_PROTOCOLS: false,
    });
  }, [settings, position]);

  if (!sanitizedAdCode) return null;

  return (
    <div 
      ref={ref}
      className={`ad-slot ad-slot-${position} ${className}`}
      dangerouslySetInnerHTML={{ __html: sanitizedAdCode }}
    />
  );
});

AdSlot.displayName = 'AdSlot';

export default AdSlot;
