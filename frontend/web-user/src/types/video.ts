export type VideoStatus = 'uploading' | 'processing' | 'ready' | 'failed';

export interface Video {
  id: string;
  uploader_id: string;
  title: string;
  description: string;
  tags: string[];
  category: string;
  age_rating: string;
  duration_seconds: number | null;
  status: VideoStatus;
  hls_manifest_url: string | null;
  thumbnail_url: string | null;
  available_qualities: string[];
  is_published: boolean;
  published_at: string | null;
  is_live: boolean;
  view_count: number;
  created_at: string;
  updated_at: string;
}

export interface PaginatedVideos {
  count: number;
  next: string | null;
  previous: string | null;
  results: Video[];
}
