export const STATUS_CFG: Record<string, { label: string; color: string }> = {
  trialing:   { label: 'Trial',      color: '#10B981' },
  active:     { label: 'Active',     color: '#6366F1' },
  past_due:   { label: 'Past Due',   color: '#F59E0B' },
  cancelled:  { label: 'Cancelled',  color: '#64748B' },
  paused:     { label: 'Paused',     color: '#94A3B8' },
  incomplete: { label: 'Incomplete', color: '#EF4444' },
};

export const PLAN_DISPLAY_NAME: Record<string, string> = {
  free_trial: 'Free Trial',
  basic:      'Basic',
  premium:    'Premium',
  family:     'Family',
};

export function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
