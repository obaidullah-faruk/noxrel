'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Skeleton from '@mui/material/Skeleton';
import CircularProgress from '@mui/material/CircularProgress';
import { alpha, useTheme } from '@mui/material/styles';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import { getToken } from '@/lib/auth-client';
import { createCheckout, fetchMySubscription, fetchPlans } from '@/lib/billing';
import { PLAN_DISPLAY_NAME } from '@/lib/billing-display';
import type { Subscription, SubscriptionPlan } from '@/types/billing';

// Visual treatment is keyed off the plan name; everything else is data-driven.
const PLAN_THEME: Record<string, { color: string; highlighted?: boolean }> = {
  free_trial: { color: '#10B981' },
  basic:      { color: '#6366F1', highlighted: true },
  premium:    { color: '#F59E0B' },
  family:     { color: '#EC4899' },
};

function planFeatures(plan: SubscriptionPlan): string[] {
  const features = [`${plan.max_quality} video quality`];
  features.push(
    plan.simultaneous_streams === 1
      ? 'Watch on 1 device'
      : `Watch on ${plan.simultaneous_streams} devices`,
  );
  features.push(plan.can_download ? 'Download for offline' : 'Streaming only');
  features.push(
    Number(plan.price_usd) === 0 ? 'No payment required' : 'Ad-free experience',
  );
  return features;
}

export default function SubscriptionsPage() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkoutPlanId, setCheckoutPlanId] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  useEffect(() => {
    getToken().then(token => {
      if (!token) {
        window.location.href = '/login?next=/subscriptions';
        return;
      }
      Promise.all([fetchPlans(token), fetchMySubscription(token)])
        .then(([planList, sub]) => {
          setPlans(planList);
          setSubscription(sub);
        })
        .catch(err => setError(err instanceof Error ? err.message : String(err)))
        .finally(() => setLoading(false));
    });
  }, []);

  const handleCheckout = useCallback(async (planId: string) => {
    setCheckoutError(null);
    setCheckoutPlanId(planId);
    try {
      const token = await getToken();
      if (!token) {
        window.location.href = '/login?next=/subscriptions';
        return;
      }
      const session = await createCheckout(token, planId);
      window.location.href = session.checkout_url;
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : String(err));
      setCheckoutPlanId(null);
    }
  }, []);

  const currentPlanId = subscription?.plan_id ?? null;

  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto', px: { xs: 2, sm: 3 }, py: 4 }}>
      <Button
        startIcon={<ArrowBackRoundedIcon />}
        component={Link}
        href="/account"
        size="small"
        sx={{ mb: 3, color: 'text.secondary', fontWeight: 500 }}
      >
        Back to Account
      </Button>

      <Box sx={{ textAlign: 'center', mb: 5 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: '-0.03em', mb: 1 }}>
          Choose Your Plan
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Unlock the full streaming experience with a subscription
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ borderRadius: 2, mb: 3 }}>
          Could not load plans — {error}
        </Alert>
      )}
      {checkoutError && (
        <Alert severity="error" sx={{ borderRadius: 2, mb: 3 }} onClose={() => setCheckoutError(null)}>
          {checkoutError}
        </Alert>
      )}

      {loading ? (
        <Grid container spacing={3} sx={{ justifyContent: 'center' }}>
          {[1, 2, 3].map(i => (
            <Grid key={i} size={{ xs: 12, sm: 6, md: 4 }}>
              <Skeleton variant="rectangular" height={420} sx={{ borderRadius: 3 }} />
            </Grid>
          ))}
        </Grid>
      ) : (
        <Grid container spacing={3} sx={{ justifyContent: 'center' }}>
          {plans.map(plan => {
            const planTheme = PLAN_THEME[plan.name] ?? { color: '#6366F1' };
            const color = planTheme.color;
            const highlighted = planTheme.highlighted ?? false;
            const isCurrent = plan.id === currentPlanId;
            const isFree = Number(plan.price_usd) === 0;
            const checkingOut = checkoutPlanId === plan.id;

            return (
              <Grid key={plan.id} size={{ xs: 12, sm: 6, md: 4 }}>
                <Card
                  sx={{
                    borderRadius: 3,
                    position: 'relative',
                    overflow: 'hidden',
                    border: highlighted
                      ? `2px solid ${alpha(color, 0.6)}`
                      : `1px solid ${isDark ? alpha('#94A3B8', 0.1) : '#E2E8F0'}`,
                    boxShadow: highlighted ? `0 8px 32px ${alpha(color, 0.2)}` : undefined,
                    transition: 'transform 0.15s ease',
                    '&:hover': { transform: 'translateY(-3px)' },
                  }}
                >
                  {highlighted && (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: 4,
                        background: `linear-gradient(90deg, ${color}, ${alpha(color, 0.5)})`,
                      }}
                    />
                  )}
                  <CardContent sx={{ p: '28px !important' }}>
                    {highlighted && (
                      <Box
                        sx={{
                          display: 'inline-flex',
                          px: 1.5,
                          py: 0.4,
                          borderRadius: 2,
                          bgcolor: alpha(color, 0.12),
                          mb: 1.5,
                        }}
                      >
                        <Typography variant="caption" sx={{ fontWeight: 700, color, fontSize: '0.72rem', letterSpacing: '0.05em' }}>
                          MOST POPULAR
                        </Typography>
                      </Box>
                    )}
                    <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
                      {PLAN_DISPLAY_NAME[plan.name] ?? plan.name}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5, mb: 2.5 }}>
                      <Typography variant="h3" sx={{ fontWeight: 800, letterSpacing: '-0.03em', color }}>
                        ${Number(plan.price_usd).toFixed(2)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        /{plan.billing_interval}
                      </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, mb: 3 }}>
                      {planFeatures(plan).map(feat => (
                        <Box key={feat} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <CheckRoundedIcon sx={{ fontSize: 16, color, flexShrink: 0 }} />
                          <Typography variant="body2" color="text.secondary">{feat}</Typography>
                        </Box>
                      ))}
                    </Box>

                    <Button
                      variant={highlighted ? 'contained' : 'outlined'}
                      fullWidth
                      disabled={isCurrent || isFree || checkingOut}
                      onClick={() => handleCheckout(plan.id)}
                      sx={{
                        borderRadius: 2,
                        fontWeight: 700,
                        py: 1.25,
                        ...(highlighted && !isCurrent && {
                          background: `linear-gradient(135deg, ${color} 0%, ${alpha(color, 0.7)} 100%)`,
                          '&:hover': { background: `linear-gradient(135deg, ${alpha(color, 0.85)} 0%, ${alpha(color, 0.6)} 100%)` },
                        }),
                        ...(!highlighted && !isCurrent && !isFree && {
                          borderColor: alpha(color, 0.5),
                          color,
                          '&:hover': { borderColor: color, bgcolor: alpha(color, 0.06) },
                        }),
                      }}
                    >
                      {checkingOut ? (
                        <CircularProgress size={20} sx={{ color: 'inherit' }} />
                      ) : isCurrent ? (
                        'Current Plan'
                      ) : isFree ? (
                        'Included'
                      ) : (
                        `Get ${PLAN_DISPLAY_NAME[plan.name] ?? plan.name}`
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}
    </Box>
  );
}
