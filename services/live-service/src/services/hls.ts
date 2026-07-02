import { config, RENDITION_SPECS, type Rendition } from '../config.js';

export interface ParsedSegment {
  seq: number;
  uri: string;
  duration: number;
}

// Parse a live media playlist FFmpeg wrote to disk. EXT-X-MEDIA-SEQUENCE gives
// the seq of the first segment listed; each #EXTINF precedes its segment URI.
// Segments named like `1080p_00042.ts` — we trust the embedded number for seq
// so a windowed (delete_segments-style) playlist still maps to absolute indices.
export function parseMediaPlaylist(text: string): ParsedSegment[] {
  const lines = text.split('\n');
  const segments: ParsedSegment[] = [];
  let pendingDuration: number | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith('#EXTINF:')) {
      const value = line.slice('#EXTINF:'.length).split(',')[0]!;
      pendingDuration = parseFloat(value);
    } else if (line && !line.startsWith('#')) {
      const seqMatch = line.match(/_(\d+)\.ts$/);
      segments.push({
        seq: seqMatch ? parseInt(seqMatch[1]!, 10) : segments.length,
        uri: line,
        duration: pendingDuration ?? 0,
      });
      pendingDuration = null;
    }
  }
  return segments;
}

// Master manifest for live playback. Uses relative variant URIs so it works
// behind any CDN domain. `name` in -var_stream_map produces `{name}.m3u8`.
export function buildLiveMaster(renditions: Rendition[]): string {
  return buildMaster(renditions, r => `${r}.m3u8`);
}

// Master manifest for replay — points at the VOD playlists written by finalize.
export function buildReplayMaster(renditions: Rendition[]): string {
  return buildMaster(renditions, r => `replay_${r}.m3u8`);
}

function buildMaster(renditions: Rendition[], uriFor: (r: Rendition) => string): string {
  const lines = ['#EXTM3U', '#EXT-X-VERSION:3'];
  // Highest quality first so default playback starts high then adapts down.
  for (const r of orderLadder(renditions)) {
    const spec = RENDITION_SPECS[r];
    lines.push(
      `#EXT-X-STREAM-INF:BANDWIDTH=${spec.bandwidth},RESOLUTION=${spec.width}x${spec.height},CODECS="${spec.codecs}"`,
      uriFor(r),
    );
  }
  return lines.join('\n') + '\n';
}

export function buildReplayMediaPlaylist(segments: ParsedSegment[]): string {
  const target = segments.length
    ? Math.ceil(Math.max(...segments.map(s => s.duration)))
    : 2;
  const lines = [
    '#EXTM3U',
    '#EXT-X-VERSION:3',
    `#EXT-X-TARGETDURATION:${target}`,
    '#EXT-X-PLAYLIST-TYPE:VOD',
    '#EXT-X-MEDIA-SEQUENCE:0',
  ];
  for (const seg of segments) {
    lines.push(`#EXTINF:${seg.duration.toFixed(3)},`, seg.uri);
  }
  lines.push('#EXT-X-ENDLIST');
  return lines.join('\n') + '\n';
}

// Canonical high→low ordering, restricted to the configured renditions.
const LADDER_ORDER: Rendition[] = ['1080p', '720p', '480p', '360p'];

export function orderLadder(renditions: Rendition[]): Rendition[] {
  return LADDER_ORDER.filter(r => renditions.includes(r));
}

export function activeRenditions(): Rendition[] {
  return orderLadder(config.RENDITIONS);
}
