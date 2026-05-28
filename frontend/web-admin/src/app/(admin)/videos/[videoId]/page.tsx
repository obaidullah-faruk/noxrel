'use client';
import { useState, useEffect, use, KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import TextField from '@mui/material/TextField';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import InputLabel from '@mui/material/InputLabel';
import FormControl from '@mui/material/FormControl';
import FormHelperText from '@mui/material/FormHelperText';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Skeleton from '@mui/material/Skeleton';
import { alpha, useTheme } from '@mui/material/styles';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import PublishRoundedIcon from '@mui/icons-material/PublishRounded';
import RemoveRedEyeRoundedIcon from '@mui/icons-material/RemoveRedEyeRounded';
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded';
import CalendarTodayRoundedIcon from '@mui/icons-material/CalendarTodayRounded';
import LocalOfferRoundedIcon from '@mui/icons-material/LocalOfferRounded';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { VideoPlayer } from '@/components/VideoPlayer/VideoPlayer';
import { fetchVideo, updateVideo, publishVideo } from '@/lib/api';
import { getToken } from '@/lib/auth-client';
import type { Video } from '@/types/video';

const CATEGORIES = [
  'Education', 'Entertainment', 'Gaming', 'Music',
  'News', 'Science & Tech', 'Sports', 'Travel', 'Other',
];

const AGE_RATINGS = [
  { value: 'G',     label: 'G — General Audiences' },
  { value: 'PG',    label: 'PG — Parental Guidance' },
  { value: 'PG-13', label: 'PG-13 — Parents Strongly Cautioned' },
  { value: 'R',     label: 'R — Restricted' },
  { value: 'NC-17', label: 'NC-17 — Adults Only' },
];

const editSchema = z.object({
  title:       z.string().min(1, 'Title is required'),
  description: z.string(),
  category:    z.string(),
  age_rating:  z.string(),
});
type EditForm = z.infer<typeof editSchema>;

function StatusBadge({ status }: { status: string }) {
  const configs: Record<string, { label: string; color: string; bg: string }> = {
    processing: { label: 'Processing', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
    uploading:  { label: 'Uploading',  color: '#38BDF8', bg: 'rgba(56,189,248,0.12)' },
    ready:      { label: 'Ready',      color: '#10B981', bg: 'rgba(16,185,129,0.12)' },
    failed:     { label: 'Failed',     color: '#EF4444', bg: 'rgba(239,68,68,0.12)'  },
  };
  const cfg = configs[status] ?? { label: status, color: '#64748B', bg: 'rgba(100,116,139,0.1)' };
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, px: 1.25, py: 0.5, borderRadius: 2, bgcolor: cfg.bg }}>
      <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: cfg.color }} />
      <Typography variant="caption" sx={{ fontWeight: 700, color: cfg.color }}>{cfg.label}</Typography>
    </Box>
  );
}

function MetaStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  const theme = useTheme();
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Box sx={{ color: theme.palette.text.secondary, display: 'flex' }}>{icon}</Box>
      <Typography variant="caption" color="text.secondary">{label}:</Typography>
      <Typography variant="caption" sx={{ fontWeight: 600 }}>{value}</Typography>
    </Box>
  );
}

export default function VideoDetailPage({ params }: { params: Promise<{ videoId: string }> }) {
  const { videoId } = use(params);
  const router = useRouter();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [video, setVideo]       = useState<Video | null>(null);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [toast, setToast]       = useState<{ msg: string; severity: 'success' | 'error' } | null>(null);
  const [tags, setTags]         = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  const { register, handleSubmit, reset, control, formState: { errors, isDirty } } = useForm<EditForm>({
    resolver: zodResolver(editSchema),
  });

  useEffect(() => {
    getToken().then(token =>
      fetchVideo(token, videoId)
        .then(v => {
          setVideo(v);
          setTags(v.tags ?? []);
          reset({
            title:       v.title,
            description: v.description,
            category:    v.category ?? '',
            age_rating:  v.age_rating ?? '',
          });
        })
        .catch(err => setError(String(err)))
        .finally(() => setLoading(false))
    );
  }, [videoId, reset]);

  // ── Tag helpers ───────────────────────────────────────────────────────────
  const commitTag = (raw: string) => {
    const val = raw.trim().toLowerCase().replace(/\s+/g, '-');
    if (val && !tags.includes(val) && tags.length < 10) setTags(prev => [...prev, val]);
    setTagInput('');
  };

  const handleTagKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commitTag(tagInput); }
    else if (e.key === 'Backspace' && tagInput === '' && tags.length > 0) setTags(prev => prev.slice(0, -1));
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const onSubmit = async (data: EditForm) => {
    setSaving(true);
    const token = await getToken();
    try {
      const updated = await updateVideo(token, videoId, {
        title:       data.title,
        description: data.description,
        category:    data.category,
        age_rating:  data.age_rating,
        tags,
      });
      setVideo(updated);
      setTags(updated.tags ?? []);
      setToast({ msg: 'Changes saved successfully', severity: 'success' });
    } catch (err) {
      setToast({ msg: `Save failed: ${String(err)}`, severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    const token = await getToken();
    try {
      await publishVideo(token, videoId);
      setVideo(prev => prev ? { ...prev, is_published: true } : prev);
      setToast({ msg: 'Video published successfully', severity: 'success' });
    } catch (err) {
      setToast({ msg: `Publish failed: ${String(err)}`, severity: 'error' });
    }
  };

  if (loading) {
    return (
      <Box>
        <Skeleton variant="rectangular" width={120} height={32} sx={{ borderRadius: 2, mb: 3 }} />
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card><CardContent><Skeleton variant="rectangular" height={320} sx={{ borderRadius: 2 }} /></CardContent></Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} variant="rectangular" height={40} sx={{ borderRadius: 2 }} />)}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    );
  }

  if (error || !video) {
    return (
      <Box>
        <Button startIcon={<ArrowBackRoundedIcon />} onClick={() => router.back()} sx={{ mb: 2, color: 'text.secondary' }}>Back</Button>
        <Alert severity="error" sx={{ borderRadius: 2 }}>{error ?? 'Video not found'}</Alert>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <IconButton
          onClick={() => router.back()}
          size="small"
          sx={{ bgcolor: isDark ? alpha('#94A3B8', 0.1) : '#F1F5F9', '&:hover': { bgcolor: isDark ? alpha('#94A3B8', 0.15) : '#E2E8F0' } }}
        >
          <ArrowBackRoundedIcon fontSize="small" />
        </IconButton>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
            <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: '-0.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60vw' }}>
              {video.title || '(untitled)'}
            </Typography>
            <StatusBadge status={video.status} />
            {video.is_published && (
              <Box sx={{ display: 'inline-flex', alignItems: 'center', px: 1.25, py: 0.5, borderRadius: 2, bgcolor: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)' }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: '#10B981' }}>Live</Typography>
              </Box>
            )}
          </Box>
        </Box>
        {!video.is_published && video.status === 'ready' && (
          <Button
            variant="contained"
            startIcon={<PublishRoundedIcon />}
            onClick={handlePublish}
            sx={{ background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)', '&:hover': { background: 'linear-gradient(135deg, #059669 0%, #047857 100%)' }, flexShrink: 0 }}
          >
            Publish
          </Button>
        )}
      </Box>

      <Grid container spacing={3}>
        {/* Player */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent sx={{ p: '20px !important' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>Preview</Typography>
              {video.status === 'ready' ? (
                <VideoPlayer videoId={video.id} initialBandwidthEstimate={50_000_000} />
              ) : (
                <Box sx={{ bgcolor: isDark ? alpha('#94A3B8', 0.05) : '#F8FAFC', border: `1px solid ${isDark ? alpha('#94A3B8', 0.1) : '#E2E8F0'}`, borderRadius: 2, p: 4, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">Video not ready for playback</Typography>
                  <Typography variant="caption" color="text.secondary">Current status: {video.status}</Typography>
                </Box>
              )}

              {video.available_qualities?.length > 0 && (
                <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mt: 1.5 }}>
                  {video.available_qualities.map(q => (
                    <Box key={q} sx={{ px: 1, py: 0.25, borderRadius: 1, bgcolor: isDark ? alpha('#6366F1', 0.12) : alpha('#6366F1', 0.08), border: `1px solid ${isDark ? alpha('#6366F1', 0.2) : alpha('#6366F1', 0.15)}` }}>
                      <Typography variant="caption" sx={{ fontWeight: 600, color: '#6366F1' }}>{q}</Typography>
                    </Box>
                  ))}
                </Box>
              )}

              <Divider sx={{ my: 2, borderColor: isDark ? alpha('#94A3B8', 0.1) : '#F1F5F9' }} />

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                <MetaStat icon={<RemoveRedEyeRoundedIcon sx={{ fontSize: 15 }} />} label="Views" value={video.view_count.toLocaleString()} />
                <MetaStat icon={<AccessTimeRoundedIcon sx={{ fontSize: 15 }} />} label="Duration" value={video.duration_seconds ? `${Math.round(video.duration_seconds / 60)}m ${video.duration_seconds % 60}s` : 'N/A'} />
                <MetaStat icon={<CalendarTodayRoundedIcon sx={{ fontSize: 15 }} />} label="Created" value={new Date(video.created_at).toLocaleString()} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Edit Form */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: '20px !important' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Metadata</Typography>
                {isDirty && <Typography variant="caption" sx={{ color: '#F59E0B', fontWeight: 600 }}>Unsaved changes</Typography>}
              </Box>

              <Box component="form" onSubmit={handleSubmit(onSubmit)} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                  label="Title"
                  {...register('title')}
                  error={!!errors.title}
                  helperText={errors.title?.message}
                  size="small"
                  fullWidth
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                />
                <TextField
                  label="Description"
                  {...register('description')}
                  size="small"
                  fullWidth
                  multiline
                  rows={3}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                />

                {/* Dropdowns */}
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <FormControl size="small" fullWidth>
                    <InputLabel>Category</InputLabel>
                    <Controller
                      name="category"
                      control={control}
                      render={({ field }) => (
                        <Select {...field} label="Category" sx={{ borderRadius: 2 }}>
                          <MenuItem value=""><em>Select category</em></MenuItem>
                          {CATEGORIES.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                        </Select>
                      )}
                    />
                  </FormControl>

                  <FormControl size="small" fullWidth>
                    <InputLabel>Age Rating</InputLabel>
                    <Controller
                      name="age_rating"
                      control={control}
                      render={({ field }) => (
                        <Select {...field} label="Age Rating" sx={{ borderRadius: 2 }}>
                          <MenuItem value=""><em>Select rating</em></MenuItem>
                          {AGE_RATINGS.map(r => <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>)}
                        </Select>
                      )}
                    />
                  </FormControl>
                </Box>

                {/* Tag chip input */}
                <Box>
                  <Box
                    sx={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      gap: 0.75,
                      minHeight: 40,
                      px: 1.5,
                      py: 0.75,
                      borderRadius: 2,
                      border: `1px solid ${isDark ? alpha('#94A3B8', 0.15) : '#E2E8F0'}`,
                      bgcolor: isDark ? alpha('#94A3B8', 0.05) : '#fff',
                      cursor: 'text',
                      transition: 'border-color 0.15s',
                      '&:focus-within': {
                        borderColor: theme.palette.primary.main,
                        boxShadow: `0 0 0 2px ${alpha(theme.palette.primary.main, 0.15)}`,
                      },
                    }}
                    onClick={() => document.getElementById('detail-tag-input')?.focus()}
                  >
                    <LocalOfferRoundedIcon sx={{ fontSize: 15, color: 'text.secondary', flexShrink: 0 }} />
                    {tags.map(tag => (
                      <Chip
                        key={tag}
                        label={tag}
                        size="small"
                        onDelete={() => setTags(prev => prev.filter(t => t !== tag))}
                        sx={{
                          height: 24,
                          fontSize: '0.75rem',
                          fontWeight: 500,
                          bgcolor: isDark ? alpha('#6366F1', 0.15) : alpha('#6366F1', 0.08),
                          color: '#6366F1',
                          border: `1px solid ${alpha('#6366F1', 0.2)}`,
                          '& .MuiChip-deleteIcon': { color: alpha('#6366F1', 0.6), fontSize: 14, '&:hover': { color: '#6366F1' } },
                        }}
                      />
                    ))}
                    <Box
                      id="detail-tag-input"
                      component="input"
                      value={tagInput}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTagInput(e.target.value)}
                      onKeyDown={handleTagKeyDown}
                      onBlur={() => tagInput && commitTag(tagInput)}
                      disabled={tags.length >= 10}
                      placeholder={tags.length === 0 ? 'Add tags…' : ''}
                      sx={{
                        border: 'none', outline: 'none', background: 'transparent',
                        color: 'text.primary', fontSize: '0.875rem', minWidth: 80, flex: 1, p: 0,
                        '&::placeholder': { color: isDark ? '#4B5563' : '#9CA3AF' },
                      }}
                    />
                  </Box>
                  <FormHelperText sx={{ mx: 1.5, mt: 0.5 }}>
                    Press Enter or comma to add · {tags.length}/10 tags
                  </FormHelperText>
                </Box>

                <Button
                  type="submit"
                  variant="contained"
                  disabled={saving || !isDirty}
                  startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <SaveRoundedIcon />}
                  sx={{
                    alignSelf: 'flex-start',
                    background: isDirty ? 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)' : undefined,
                  }}
                >
                  {saving ? 'Saving…' : 'Save Changes'}
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Snackbar open={!!toast} autoHideDuration={4000} onClose={() => setToast(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={toast?.severity} onClose={() => setToast(null)} sx={{ borderRadius: 2, minWidth: 280 }}>
          {toast?.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
