'use client';
import { useCallback, useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import { alpha, useTheme } from '@mui/material/styles';
import SensorsRoundedIcon from '@mui/icons-material/SensorsRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import StopCircleRoundedIcon from '@mui/icons-material/StopCircleRounded';
import { fetchLiveSessions, forceEndLiveSession } from '@/lib/api';
import { getToken } from '@/lib/auth-client';
import type { LiveSession, LiveSessionStatus } from '@/types/live';

const POLL_MS = 15_000;

const STATUS_CFG: Record<LiveSessionStatus, { label: string; color: string }> = {
  live:          { label: 'Live',          color: '#EF4444' },
  stitching:     { label: 'Stitching',     color: '#F59E0B' },
  ended:         { label: 'Ended',         color: '#94A3B8' },
  stitch_failed: { label: 'Stitch failed', color: '#EF4444' },
  error:         { label: 'Error',         color: '#EF4444' },
};

function StatusBadge({ status }: { status: LiveSessionStatus }) {
  const cfg = STATUS_CFG[status] ?? { label: status, color: '#64748B' };
  const isLive = status === 'live';
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, px: 1, py: 0.25, borderRadius: 1.5, bgcolor: alpha(cfg.color, 0.12) }}>
      <Box
        sx={{
          width: 7, height: 7, borderRadius: '50%', bgcolor: cfg.color,
          ...(isLive && {
            animation: 'pulse 1.4s ease-in-out infinite',
            '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.3 } },
          }),
        }}
      />
      <Typography variant="caption" sx={{ fontWeight: 600, color: cfg.color, fontSize: '0.72rem' }}>{cfg.label}</Typography>
    </Box>
  );
}

function elapsed(startedAt: string): string {
  const secs = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function AdminLivePage() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState<LiveSession | null>(null);
  const [ending, setEnding] = useState(false);

  const load = useCallback(async () => {
    const token = await getToken();
    if (!token) { setError('Not signed in'); setLoading(false); return; }
    try {
      const data = await fetchLiveSessions(token);
      setSessions(data);
      setError(null);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_MS);
    return () => clearInterval(interval);
  }, [load]);

  const confirmEnd = async () => {
    if (!target) return;
    setEnding(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('Not signed in');
      await forceEndLiveSession(token, target.id);
      setTarget(null);
      load();
    } catch (err) {
      setError(String(err));
    } finally {
      setEnding(false);
    }
  };

  const liveSessions = sessions.filter(s => s.status === 'live');

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
        <SensorsRoundedIcon sx={{ color: '#EF4444' }} />
        <Typography variant="h5" sx={{ fontWeight: 700 }}>Live Sessions</Typography>
        {!loading && (
          <Chip
            size="small"
            label={`${liveSessions.length} live`}
            sx={{ ml: 1, height: 22, fontWeight: 600, color: '#EF4444', bgcolor: 'rgba(239,68,68,0.12)' }}
          />
        )}
      </Box>
      <Typography sx={{ color: 'text.secondary', mb: 3 }}>
        Monitor active broadcasts and force-end any session. Refreshes every 15s.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
      ) : liveSessions.length === 0 ? (
        <Card variant="outlined" sx={{ borderRadius: 3, py: 6, textAlign: 'center' }}>
          <Typography sx={{ color: 'text.secondary' }}>No active broadcasts right now.</Typography>
        </Card>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {liveSessions.map(s => (
            <Card key={s.id} variant="outlined" sx={{ borderRadius: 3, p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                <Box sx={{ flex: 1, minWidth: 200 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <Typography sx={{ fontWeight: 600 }}>{s.title || 'Untitled stream'}</Typography>
                    <StatusBadge status={s.status} />
                  </Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'monospace' }}>
                    {s.userId}
                  </Typography>
                </Box>

                <Box sx={{ textAlign: 'center', px: 1.5 }}>
                  <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1 }}>{s.viewerCount}</Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>watching</Typography>
                </Box>
                <Box sx={{ textAlign: 'center', px: 1.5 }}>
                  <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1 }}>{s.peakViewerCount}</Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>peak</Typography>
                </Box>
                <Box sx={{ textAlign: 'center', px: 1.5 }}>
                  <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1 }}>{elapsed(s.startedAt)}</Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>uptime</Typography>
                </Box>

                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    component="a"
                    href={s.hlsMasterUrl}
                    target="_blank"
                    rel="noopener"
                    size="small"
                    variant="outlined"
                    startIcon={<VisibilityRoundedIcon />}
                    sx={{ borderColor: isDark ? alpha('#94A3B8', 0.3) : undefined }}
                  >
                    HLS
                  </Button>
                  <Button
                    size="small"
                    variant="contained"
                    color="error"
                    startIcon={<StopCircleRoundedIcon />}
                    onClick={() => setTarget(s)}
                  >
                    Force end
                  </Button>
                </Box>
              </Box>
            </Card>
          ))}
        </Box>
      )}

      <Dialog open={!!target} onClose={() => !ending && setTarget(null)}>
        <DialogTitle>Force-end this broadcast?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            &quot;{target?.title}&quot; will be stopped immediately and the publisher disconnected.
            The replay (VOD) will still be stitched and published. This cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setTarget(null)} disabled={ending}>Cancel</Button>
          <Button onClick={confirmEnd} color="error" variant="contained" disabled={ending}>
            {ending ? 'Ending…' : 'Force end'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
