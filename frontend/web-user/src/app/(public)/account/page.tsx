'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Avatar from '@mui/material/Avatar';
import Divider from '@mui/material/Divider';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import Alert from '@mui/material/Alert';
import { alpha, useTheme } from '@mui/material/styles';
import EmailRoundedIcon from '@mui/icons-material/EmailRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import CreditCardRoundedIcon from '@mui/icons-material/CreditCardRounded';
import { getToken } from '@/lib/auth-client';
import type { User } from '@/types/user';

const GATEWAY = process.env.NEXT_PUBLIC_API_GATEWAY_URL ?? 'http://localhost:8100';

const AVATAR_COLORS = ['#6366F1', '#8B5CF6', '#EC4899', '#10B981', '#F59E0B', '#0284C7'];
function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length] ?? '#6366F1';
}
function initials(user: User): string {
  if (user.display_name) return user.display_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  return user.username.slice(0, 2).toUpperCase();
}

const TIER_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  free_trial:         { label: 'Free Trial',   color: '#10B981', bg: 'rgba(16,185,129,0.1)' },
  basic_subscriber:   { label: 'Basic',        color: '#6366F1', bg: 'rgba(99,102,241,0.1)' },
  premium_subscriber: { label: 'Premium',      color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
  admin:              { label: 'Admin',         color: '#EF4444', bg: 'rgba(239,68,68,0.1)'  },
};

export default function AccountPage() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [user, setUser]       = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    getToken().then(token => {
      if (!token) { setError('Not signed in'); setLoading(false); return; }
      fetch(`${GATEWAY}/api/v1/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(r => r.ok ? r.json() : Promise.reject(new Error(`${r.status}`)))
        .then((u: User) => setUser(u))
        .catch(err => setError(String(err)))
        .finally(() => setLoading(false));
    });
  }, []);

  if (loading) {
    return (
      <Box sx={{ maxWidth: 600, mx: 'auto', px: { xs: 2, sm: 3 }, py: 4 }}>
        <Skeleton variant="text" width={160} height={36} sx={{ mb: 3 }} />
        <Card>
          <CardContent sx={{ p: '24px !important' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
              <Skeleton variant="circular" width={72} height={72} />
              <Box>
                <Skeleton variant="text" width={140} height={28} />
                <Skeleton variant="text" width={100} />
              </Box>
            </Box>
            {[1,2,3].map(i => <Skeleton key={i} variant="rectangular" height={44} sx={{ borderRadius: 2, mb: 1.5 }} />)}
          </CardContent>
        </Card>
      </Box>
    );
  }

  if (error || !user) {
    return (
      <Box sx={{ maxWidth: 600, mx: 'auto', px: { xs: 2, sm: 3 }, py: 4 }}>
        <Alert severity="error" sx={{ borderRadius: 2 }}>{error ?? 'Could not load account'}</Alert>
      </Box>
    );
  }

  const color = avatarColor(user.username);
  const tier = user.subscription_tier ?? 'free_trial';
  const tierCfg = TIER_LABELS[tier] ?? { label: tier, color: '#64748B', bg: 'rgba(100,116,139,0.1)' };

  return (
    <Box sx={{ maxWidth: 600, mx: 'auto', px: { xs: 2, sm: 3 }, py: 4 }}>
      <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: '-0.02em', mb: 3 }}>
        My Account
      </Typography>

      <Card>
        <CardContent sx={{ p: '24px !important' }}>
          {/* Avatar + name */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
            <Avatar
              src={user.avatar_url ?? undefined}
              sx={{ width: 72, height: 72, fontSize: '1.4rem', fontWeight: 700, bgcolor: color }}
            >
              {initials(user)}
            </Avatar>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                {user.display_name || user.username}
              </Typography>
              <Box
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  px: 1.25,
                  py: 0.35,
                  borderRadius: 2,
                  bgcolor: tierCfg.bg,
                  mt: 0.5,
                }}
              >
                <Typography variant="caption" sx={{ fontWeight: 700, color: tierCfg.color, fontSize: '0.75rem' }}>
                  {tierCfg.label}
                </Typography>
              </Box>
            </Box>
          </Box>

          <Divider sx={{ borderColor: isDark ? alpha('#94A3B8', 0.1) : '#F1F5F9', mb: 2.5 }} />

          {/* Details */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {[
              { icon: <PersonRoundedIcon sx={{ fontSize: 16 }} />, label: 'Username', value: `@${user.username}`, color: '#6366F1' },
              { icon: <EmailRoundedIcon sx={{ fontSize: 16 }} />, label: 'Email', value: user.email, color: '#10B981' },
              { icon: <CreditCardRoundedIcon sx={{ fontSize: 16 }} />, label: 'Plan', value: tierCfg.label, color: '#F59E0B' },
            ].map(({ icon, label, value, color: iconColor }) => (
              <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box
                  sx={{
                    width: 34,
                    height: 34,
                    borderRadius: 2,
                    bgcolor: isDark ? alpha(iconColor, 0.12) : alpha(iconColor, 0.08),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: iconColor,
                    flexShrink: 0,
                  }}
                >
                  {icon}
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{label}</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>{value}</Typography>
                </Box>
              </Box>
            ))}
          </Box>

          <Divider sx={{ borderColor: isDark ? alpha('#94A3B8', 0.1) : '#F1F5F9', my: 2.5 }} />

          <Button
            component={Link}
            href="/subscriptions"
            variant="outlined"
            fullWidth
            sx={{ borderRadius: 2, fontWeight: 600 }}
          >
            Manage Subscription
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
}
