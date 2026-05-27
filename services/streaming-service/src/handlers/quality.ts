export const QUALITY_CAPS: Record<string, string> = {
  guest:              '240p',
  free_trial:         '480p',
  basic_subscriber:   '1080p',
  premium_subscriber: '4K',
  admin:              '4K',
  superadmin:         '4K',
};

export const QUALITY_ORDER = ['240p', '480p', '720p', '1080p', '4K'] as const;
type Quality = (typeof QUALITY_ORDER)[number];

export function filterMasterManifest(masterM3U8: string, maxQuality: string): string {
  const maxIdx = QUALITY_ORDER.indexOf(maxQuality as Quality);
  const lines = masterM3U8.split('\n');
  const filtered: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (line.startsWith('#EXT-X-STREAM-INF')) {
      const uriLine = lines[i + 1] ?? '';
      const quality = extractQualityFromPath(uriLine);
      // Always consume the URI line (i++) to prevent it falling into the else branch
      i++;
      if (quality !== null && QUALITY_ORDER.indexOf(quality) <= maxIdx) {
        filtered.push(line, uriLine);
      }
      // else: drop both stream-inf and its URI line
    } else {
      filtered.push(line);
    }
  }

  return filtered.join('\n');
}

function extractQualityFromPath(uri: string): Quality | null {
  const match = uri.match(/^(240p|480p|720p|1080p|4K)\//);
  return (match?.[1] as Quality) ?? null;
}
