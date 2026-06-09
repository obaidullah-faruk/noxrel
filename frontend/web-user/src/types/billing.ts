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

export interface Invoice {
  id: string;
  subscription_id: string;
  stripe_invoice_id: string;
  amount_usd: string;
  status: string; // paid | open | void | uncollectible
  invoice_pdf_url: string;
  billing_reason: string;
  created_at: string;
  paid_at: string | null;
}

export interface PaymentMethod {
  id: string;
  stripe_payment_method_id: string;
  type: string;
  card_brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
  is_default: boolean;
  created_at: string;
}

export interface CheckoutSession {
  checkout_url: string;
  session_id: string;
}
