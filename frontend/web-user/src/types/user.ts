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
  subscription_tier?: string;
  profile?: {
    bio: string;
    country_code: string;
    preferred_language: string;
  };
}
