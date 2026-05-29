'use client';
import { useState, useTransition, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import Link from '@mui/material/Link';
import { alpha } from '@mui/material/styles';
import PlayCircleFilledRoundedIcon from '@mui/icons-material/PlayCircleFilledRounded';
import EmailRoundedIcon from '@mui/icons-material/EmailRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded';

function SignupForm() {
  const router = useRouter();

  const [email, setEmail]               = useState('');
  const [username, setUsername]         = useState('');
  const [displayName, setDisplayName]   = useState('');
  const [password, setPassword]         = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPass, setShowPass]         = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [fieldErrors, setFieldErrors]   = useState<Record<string, string>>({});
  const [pending, startTransition]      = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    startTransition(async () => {
      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, username, display_name: displayName, password, password_confirm: passwordConfirm }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({})) as Record<string, unknown>;
          const detail = body.detail;
          if (typeof detail === 'string') {
            setError(detail);
          } else if (typeof body === 'object') {
            const errs: Record<string, string> = {};
            for (const [k, v] of Object.entries(body)) {
              errs[k] = Array.isArray(v) ? (v as string[]).join(' ') : String(v);
            }
            setFieldErrors(errs);
            setError('Please fix the errors below.');
          } else {
            setError('Registration failed. Please try again.');
          }
          return;
        }

        router.push('/');
        router.refresh();
      } catch {
        setError('Cannot reach the server. Check your connection.');
      }
    });
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', bgcolor: '#0B0F1A' }}>
      {/* Left branding panel */}
      <Box
        sx={{
          display: { xs: 'none', md: 'flex' },
          flex: 1,
          flexDirection: 'column',
          justifyContent: 'space-between',
          p: 5,
          background: 'linear-gradient(160deg, #1E1B4B 0%, #0B0F1A 50%, #0B1120 100%)',
          borderRight: '1px solid rgba(99,102,241,0.15)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            position: 'absolute', top: -100, left: -100, width: 400, height: 400,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(99,102,241,0.2) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />
        <Box
          sx={{
            position: 'absolute', bottom: -80, right: -80, width: 300, height: 300,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, position: 'relative', zIndex: 1 }}>
          <Box
            sx={{
              width: 40, height: 40, borderRadius: 2,
              background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 20px rgba(99,102,241,0.4)',
            }}
          >
            <PlayCircleFilledRoundedIcon sx={{ fontSize: 22, color: '#fff' }} />
          </Box>
          <Box>
            <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: '1.1rem', letterSpacing: '-0.01em', lineHeight: 1.2 }}>
              StreamVid
            </Typography>
            <Typography sx={{ color: alpha('#fff', 0.4), fontSize: '0.7rem', letterSpacing: '0.06em' }}>
              PLATFORM
            </Typography>
          </Box>
        </Box>

        <Box sx={{ position: 'relative', zIndex: 1 }}>
          <Typography variant="h3" sx={{ color: '#fff', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.15, mb: 2 }}>
            Join StreamVid
            <Box component="span" sx={{ display: 'block', background: 'linear-gradient(135deg, #818CF8, #C084FC)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              for free today
            </Box>
          </Typography>
          <Typography sx={{ color: alpha('#fff', 0.5), fontSize: '1rem', lineHeight: 1.7, maxWidth: 360 }}>
            Create your account and get instant access to thousands of videos in stunning quality.
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, position: 'relative', zIndex: 1 }}>
          {[
            { label: 'Free to sign up', color: '#6366F1' },
            { label: 'HLS adaptive streaming', color: '#8B5CF6' },
            { label: 'Watch on any device', color: '#EC4899' },
          ].map(({ label, color }) => (
            <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: color, boxShadow: `0 0 8px ${color}` }} />
              <Typography sx={{ color: alpha('#fff', 0.6), fontSize: '0.875rem' }}>{label}</Typography>
            </Box>
          ))}
        </Box>
      </Box>

      {/* Right form panel */}
      <Box
        sx={{
          flex: { xs: 1, md: 'none' },
          width: { xs: '100%', md: 480 },
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          p: { xs: 3, sm: 5 }, bgcolor: '#0B0F1A',
          overflowY: 'auto',
        }}
      >
        <Box sx={{ width: '100%', maxWidth: 380, py: 2 }}>
          <Box sx={{ display: { xs: 'flex', md: 'none' }, alignItems: 'center', gap: 1.5, mb: 4 }}>
            <Box
              sx={{
                width: 36, height: 36, borderRadius: 2,
                background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <PlayCircleFilledRoundedIcon sx={{ fontSize: 20, color: '#fff' }} />
            </Box>
            <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '1rem' }}>StreamVid</Typography>
          </Box>

          <Typography variant="h5" sx={{ fontWeight: 800, color: '#F1F5F9', mb: 0.75, letterSpacing: '-0.02em' }}>
            Create your account
          </Typography>
          <Typography variant="body2" sx={{ color: alpha('#fff', 0.4), mb: 4 }}>
            Already have one?{' '}
            <Link href="/login" underline="hover" sx={{ color: '#818CF8' }}>Sign in</Link>
          </Typography>

          {error && (
            <Alert
              severity="error"
              sx={{
                mb: 3, borderRadius: 2,
                bgcolor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                color: '#FCA5A5', '& .MuiAlert-icon': { color: '#EF4444' },
              }}
            >
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit} noValidate sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Email address"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              fullWidth required autoFocus autoComplete="email"
              error={!!fieldErrors.email}
              helperText={fieldErrors.email}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <EmailRoundedIcon sx={{ fontSize: 18, color: '#4B5563' }} />
                    </InputAdornment>
                  ),
                },
              }}
              sx={inputSx}
            />
            <TextField
              label="Username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              fullWidth required autoComplete="username"
              error={!!fieldErrors.username}
              helperText={fieldErrors.username}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <PersonRoundedIcon sx={{ fontSize: 18, color: '#4B5563' }} />
                    </InputAdornment>
                  ),
                },
              }}
              sx={inputSx}
            />
            <TextField
              label="Display name (optional)"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              fullWidth autoComplete="name"
              error={!!fieldErrors.display_name}
              helperText={fieldErrors.display_name}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <PersonRoundedIcon sx={{ fontSize: 18, color: '#4B5563' }} />
                    </InputAdornment>
                  ),
                },
              }}
              sx={inputSx}
            />
            <TextField
              label="Password"
              type={showPass ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              fullWidth required autoComplete="new-password"
              error={!!fieldErrors.password}
              helperText={fieldErrors.password}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockRoundedIcon sx={{ fontSize: 18, color: '#4B5563' }} />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setShowPass(p => !p)} edge="end" sx={{ color: '#4B5563' }}>
                        {showPass ? <VisibilityOffRoundedIcon fontSize="small" /> : <VisibilityRoundedIcon fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
              sx={inputSx}
            />
            <TextField
              label="Confirm password"
              type={showPass ? 'text' : 'password'}
              value={passwordConfirm}
              onChange={e => setPasswordConfirm(e.target.value)}
              fullWidth required autoComplete="new-password"
              error={!!fieldErrors.password_confirm}
              helperText={fieldErrors.password_confirm}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockRoundedIcon sx={{ fontSize: 18, color: '#4B5563' }} />
                    </InputAdornment>
                  ),
                },
              }}
              sx={inputSx}
            />

            <Button
              type="submit"
              variant="contained"
              fullWidth
              size="large"
              disabled={pending || !email || !username || !password || !passwordConfirm}
              sx={{
                mt: 1, py: 1.5,
                background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
                fontSize: '0.95rem', fontWeight: 700, letterSpacing: '0.01em',
                '&:hover': {
                  background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
                  boxShadow: '0 8px 24px rgba(99,102,241,0.4)',
                },
                '&.Mui-disabled': { background: 'rgba(99,102,241,0.3)', color: 'rgba(255,255,255,0.4)' },
              }}
            >
              {pending ? <CircularProgress size={22} sx={{ color: 'rgba(255,255,255,0.7)' }} /> : 'Create Account'}
            </Button>
          </Box>

          <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', mt: 3, color: alpha('#fff', 0.2) }}>
            StreamVid — your video streaming destination
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

const inputSx = {
  '& .MuiOutlinedInput-root': {
    bgcolor: 'rgba(255,255,255,0.04)',
    '& fieldset': { borderColor: 'rgba(148,163,184,0.15)' },
    '&:hover fieldset': { borderColor: 'rgba(148,163,184,0.3)' },
    '&.Mui-focused fieldset': { borderColor: '#6366F1' },
  },
  '& .MuiInputLabel-root': { color: '#6B7280' },
  '& .MuiInputBase-input': { color: '#F1F5F9' },
  '& .MuiFormHelperText-root': { color: '#FCA5A5' },
} as const;

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}
