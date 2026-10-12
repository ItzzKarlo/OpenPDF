export function navigateToPage(pageId: string) {
  document.getElementById(`page-${pageId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
