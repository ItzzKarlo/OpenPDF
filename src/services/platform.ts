export function isMacPlatform(platform = typeof navigator === 'undefined' ? '' : navigator.platform) {
  return /Mac|iPhone|iPad|iPod/i.test(platform);
}

export function hasPrimaryModifier(event: Pick<KeyboardEvent | MouseEvent, 'metaKey' | 'ctrlKey'>, platform?: string) {
  return isMacPlatform(platform) ? event.metaKey : event.ctrlKey;
}

export function primaryModifierLabel(platform?: string) {
  return isMacPlatform(platform) ? '⌘' : 'Ctrl+';
}
