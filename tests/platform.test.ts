import { describe, expect, it } from 'vitest';
import { hasPrimaryModifier, isMacPlatform, primaryModifierLabel } from '../src/services/platform';

describe('platform keyboard conventions', () => {
  it('uses Command, not Control, on macOS', () => {
    expect(isMacPlatform('MacIntel')).toBe(true);
    expect(hasPrimaryModifier({ metaKey: true, ctrlKey: false }, 'MacIntel')).toBe(true);
    expect(hasPrimaryModifier({ metaKey: false, ctrlKey: true }, 'MacIntel')).toBe(false);
    expect(primaryModifierLabel('MacIntel')).toBe('⌘');
  });

  it('uses Control, not Command, on Windows and Linux', () => {
    for (const platform of ['Win32', 'Linux x86_64']) {
      expect(hasPrimaryModifier({ metaKey: false, ctrlKey: true }, platform)).toBe(true);
      expect(hasPrimaryModifier({ metaKey: true, ctrlKey: false }, platform)).toBe(false);
      expect(primaryModifierLabel(platform)).toBe('Ctrl+');
    }
  });
});
