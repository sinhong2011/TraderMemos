import { useState } from 'react';
import { Text, type TextProps } from 'react-native';

/**
 * `Text` with a working `adjustsFontSizeToFit`. On Fabric, the iOS font-fit
 * pass collapses the text to unreadably small — ignoring `minimumFontScale`
 * entirely — whenever the style carries an explicit `lineHeight`, and every
 * Tailwind named size (`text-2xl`, `leading-[15px]`, …) does. Stripping the
 * line height here restores a sane fit; the default leading for the fitted
 * size is what these one-liners want anyway. The one-shot re-key guards the
 * separate transient-width latch, where a tile measured mid pager-settle
 * keeps its first (near-zero) fit.
 */
export function FitText({ onLayout, style, ...props }: TextProps) {
  const [settled, setSettled] = useState(false);
  return (
    <Text
      adjustsFontSizeToFit
      {...props}
      style={[style, { lineHeight: undefined }]}
      key={settled ? 'fit' : 'pre'}
      onLayout={(e) => {
        if (!settled && e.nativeEvent.layout.width > 0) setSettled(true);
        onLayout?.(e);
      }}
    />
  );
}
