export interface User {
  id: string;
  email: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  is_active: boolean;
  is_email_verified: boolean;
  created_at: string;
  updated_at: string;
  profile?: {
    bio: string;
    country_code: string;
    preferred_language: string;
  };
}

export interface PaginatedUsers {
  count: number;
  next: string | null;
  previous: string | null;
  results: User[];
}

export interface DashboardStats {
  total_videos: number;
  total_users: number;
  videos_processing: number;
  videos_ready: number;
}
