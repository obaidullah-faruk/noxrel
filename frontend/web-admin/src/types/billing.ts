// Mirrors services/billing-service/app/billing/schemas.py
// Money fields arrive as JSON strings (Pydantic serializes Decimal as a string).

export interface SubscriptionPlan {
  id: string;
  name: string;
  billing_interval: string; // "month" | "year"
  price_usd: string;
  max_quality: string; // "480p" | "1080p" | "4K"
  simultaneous_streams: number;
  can_download: boolean;
}

export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'cancelled'
  | 'paused'
  | 'incomplete';

export interface Subscription {
  id: string;
  user_id: string;
  plan_id: string;
  stripe_subscription_id: string | null;
  status: SubscriptionStatus;
  trial_start: string | null;
  trial_end: string | null;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  cancelled_at: string | null;
  created_at: string;
  plan: SubscriptionPlan;
}

// Admin endpoint returns Subscription plus the Stripe customer id.
export interface AdminSubscription extends Subscription {
  stripe_customer_id: string;
}

export interface Refund {
  refund_id: string;
  amount_usd: string;
  status: string;
}
