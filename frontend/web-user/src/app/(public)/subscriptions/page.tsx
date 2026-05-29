'use client';
import Link from 'next/link';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Button from '@mui/material/Button';
import { alpha, useTheme } from '@mui/material/styles';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';

const PLANS = [
  {
    id: 'free_trial',
    name: 'Free Trial',
    price: '$0',
    period: '/month',
    color: '#10B981',
    features: [
      '240p video quality',
      'Ad-supported',
      '10 hours/month',
      'No downloads',
    ],
    cta: 'Current Plan',
    disabled: true,
  },
  {
    id: 'basic',
    name: 'Basic',
    price: '$7.99',
    period: '/month',
    color: '#6366F1',
    highlighted: true,
    features: [
      '1080p Full HD quality',
      'Ad-free experience',
      'Unlimited streaming',
      'Watch on 2 devices',
    ],
    cta: 'Get Basic',
    disabled: false,
  },
  {
    id: 'premium',
    name: 'Premium',
    price: '$13.99',
    period: '/month',
    color: '#F59E0B',
    features: [
      '4K Ultra HD quality',
      'Ad-free experience',
      'Unlimited streaming',
      'Watch on 4 devices',
      'Download for offline',
    ],
    cta: 'Get Premium',
    disabled: false,
  },
];

export default function SubscriptionsPage() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

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

      <Grid container spacing={3} sx={{ justifyContent: 'center' }}>
        {PLANS.map(plan => (
          <Grid key={plan.id} size={{ xs: 12, sm: 6, md: 4 }}>
            <Card
              sx={{
                borderRadius: 3,
                position: 'relative',
                overflow: 'hidden',
                border: plan.highlighted
                  ? `2px solid ${alpha(plan.color, 0.6)}`
                  : `1px solid ${isDark ? alpha('#94A3B8', 0.1) : '#E2E8F0'}`,
                boxShadow: plan.highlighted
                  ? `0 8px 32px ${alpha(plan.color, 0.2)}`
                  : undefined,
                transition: 'transform 0.15s ease',
                '&:hover': { transform: 'translateY(-3px)' },
              }}
            >
              {plan.highlighted && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 4,
                    background: `linear-gradient(90deg, ${plan.color}, ${alpha(plan.color, 0.5)})`,
                  }}
                />
              )}
              <CardContent sx={{ p: '28px !important' }}>
                {plan.highlighted && (
                  <Box
                    sx={{
                      display: 'inline-flex',
                      px: 1.5,
                      py: 0.4,
                      borderRadius: 2,
                      bgcolor: alpha(plan.color, 0.12),
                      mb: 1.5,
                    }}
                  >
                    <Typography variant="caption" sx={{ fontWeight: 700, color: plan.color, fontSize: '0.72rem', letterSpacing: '0.05em' }}>
                      MOST POPULAR
                    </Typography>
                  </Box>
                )}
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>{plan.name}</Typography>
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5, mb: 2.5 }}>
                  <Typography variant="h3" sx={{ fontWeight: 800, letterSpacing: '-0.03em', color: plan.color }}>
                    {plan.price}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">{plan.period}</Typography>
                </Box>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, mb: 3 }}>
                  {plan.features.map(feat => (
                    <Box key={feat} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CheckRoundedIcon sx={{ fontSize: 16, color: plan.color, flexShrink: 0 }} />
                      <Typography variant="body2" color="text.secondary">{feat}</Typography>
                    </Box>
                  ))}
                </Box>

                <Button
                  variant={plan.highlighted ? 'contained' : 'outlined'}
                  fullWidth
                  disabled={plan.disabled}
                  sx={{
                    borderRadius: 2,
                    fontWeight: 700,
                    py: 1.25,
                    ...(plan.highlighted && {
                      background: `linear-gradient(135deg, ${plan.color} 0%, ${alpha(plan.color, 0.7)} 100%)`,
                      '&:hover': { background: `linear-gradient(135deg, ${alpha(plan.color, 0.85)} 0%, ${alpha(plan.color, 0.6)} 100%)` },
                    }),
                    ...(!plan.highlighted && !plan.disabled && {
                      borderColor: alpha(plan.color, 0.5),
                      color: plan.color,
                      '&:hover': { borderColor: plan.color, bgcolor: alpha(plan.color, 0.06) },
                    }),
                  }}
                >
                  {plan.cta}
                </Button>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
