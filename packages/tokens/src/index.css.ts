/**
 * Design tokens as CSS variables
 * Use this for non-Tailwind consumers
 */

import { colors, fontFamily, fontSize, fontWeight, spacing, borderRadius, boxShadow, transitionDuration, transitionTimingFunction, zIndex } from './index.js';

function mapToCssVars(obj: Record<string, unknown>, prefix = ''): string {
  const lines: string[] = [];

  for (const [key, value] of Object.entries(obj)) {
    const varName = prefix ? `${prefix}-${key}` : key;

    if (typeof value === 'object' && value !== null) {
      lines.push(mapToCssVars(value as Record<string, unknown>, varName));
    } else {
      lines.push(`  --${varName}: ${value};`);
    }
  }

  return lines.join('\n');
}

export const cssVariables = `
:root {
${mapToCssVars(colors, 'color')}
${mapToCssVars(fontFamily, 'font')}
${mapToCssVars(fontSize, 'text')}
${mapToCssVars(fontWeight, 'font')}
${mapToCssVars(spacing, 'spacing')}
${mapToCssVars(borderRadius, 'radius')}
${mapToCssVars(boxShadow, 'shadow')}
${mapToCssVars(transitionDuration, 'duration')}
${mapToCssVars(transitionTimingFunction, 'ease')}
${mapToCssVars(zIndex, 'z')}
}
`.trim();

export default cssVariables;
