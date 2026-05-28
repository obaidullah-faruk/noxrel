'use client';
import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import Divider from '@mui/material/Divider';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { VideoPlayer } from '@/components/VideoPlayer/VideoPlayer';
import { fetchVideo, updateVideo, publishVideo } from '@/lib/api';
import { getToken } from '@/lib/auth-client';
import type { Video } from '@/types/video';

const editSchema = z.object({
  title:       z.string().min(1, 'Title is required'),
  description: z.string(),
  category:    z.string(),
  age_rating:  z.string(),
  tags:        z.string(),
});
type EditForm = z.infer<typeof editSchema>;

function statusColor(status: string): 'warning' | 'info' | 'success' | 'error' | 'default' {
  switch (status) {
    case 'processing': return 'warning';
    case 'uploading':  return 'info';
    case 'ready':      return 'success';
    case 'failed':     return 'error';
    default:           return 'default';
  }
}

export default function VideoDetailPage({ params }: { params: Promise<{ videoId: string }> }) {
  const { videoId } = use(params);
  const router = useRouter();
  const [video, setVideo]       = useState<Video | null>(null);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [toast, setToast]       = useState<string | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<EditForm>({
    resolver: zodResolver(editSchema),
  });

  useEffect(() => {
    getToken().then(token =>
      fetchVideo(token, videoId)
        .then(v => {
          setVideo(v);
          reset({
            title: v.title,
            description: v.description,
            category: v.category,
            age_rating: v.age_rating,
            tags: (v.tags ?? []).join(', '),
          });
        })
        .catch(err => setError(String(err)))
        .finally(() => setLoading(false))
    );
  }, [videoId, reset]);

  const onSubmit = async (data: EditForm) => {
    setSaving(true);
    const token = await getToken();
    try {
      const updated = await updateVideo(token, videoId, {
        title: data.title,
        description: data.description,
        category: data.category,
        age_rating: data.age_rating,
        tags: data.tags.split(',').map(t => t.trim()).filter(Boolean),
      });
      setVideo(updated);
      setToast('Video updated successfully');
    } catch (err) {
      setToast(`Save failed: ${String(err)}`);
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    const token = await getToken();
    try {
      await publishVideo(token, videoId);
      setVideo(prev => prev ? { ...prev, is_published: true } : prev);
      setToast('Video published');
    } catch (err) {
      setToast(`Publish failed: ${String(err)}`);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !video) {
    return (
      <Box>
        <Button startIcon={<ArrowBackIcon />} onClick={() => router.back()} sx={{ mb: 2 }}>
          Back
        </Button>
        <Alert severity="error">{error ?? 'Video not found'}</Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Button startIcon={<ArrowBackIcon />} onClick={() => router.back()} sx={{ mb: 2 }}>
        Back to Videos
      </Button>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Typography variant="h5" fontWeight={700} sx={{ flexGrow: 1 }}>
          {video.title || '(untitled)'}
        </Typography>
        <Chip label={video.status} color={statusColor(video.status)} />
        {!video.is_published && video.status === 'ready' && (
          <Button variant="contained" size="small" onClick={handlePublish}>
            Publish
          </Button>
        )}
        {video.is_published && <Chip label="Published" color="success" variant="outlined" />}
      </Box>

      <Grid container spacing={3}>
        {/* Preview Player */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                Preview
                {video.available_qualities.length > 0 && (
                  <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                    ({video.available_qualities.join(', ')})
                  </Typography>
                )}
              </Typography>
              {video.status === 'ready' ? (
                <VideoPlayer videoId={video.id} initialBandwidthEstimate={50_000_000} />
              ) : (
                <Alert severity="info">
                  Video is not ready for playback yet (status: {video.status})
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Edit Form */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                Metadata
              </Typography>
              <Box component="form" onSubmit={handleSubmit(onSubmit)} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                  label="Title"
                  {...register('title')}
                  error={!!errors.title}
                  helperText={errors.title?.message}
                  size="small"
                  fullWidth
                />
                <TextField
                  label="Description"
                  {...register('description')}
                  size="small"
                  fullWidth
                  multiline
                  rows={3}
                />
                <TextField
                  label="Category"
                  {...register('category')}
                  size="small"
                  fullWidth
                />
                <TextField
                  label="Age Rating"
                  {...register('age_rating')}
                  size="small"
                  fullWidth
                  placeholder="G, PG, PG-13, R…"
                />
                <TextField
                  label="Tags (comma-separated)"
                  {...register('tags')}
                  size="small"
                  fullWidth
                  placeholder="action, drama, sci-fi"
                />
                <Button type="submit" variant="contained" disabled={saving} sx={{ alignSelf: 'flex-start' }}>
                  {saving ? 'Saving…' : 'Save Changes'}
                </Button>
              </Box>

              <Divider sx={{ my: 2 }} />

              <Typography variant="body2" color="text.secondary">
                Views: {video.view_count} · Duration: {video.duration_seconds ? `${Math.round(video.duration_seconds / 60)}m` : 'N/A'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Created: {new Date(video.created_at).toLocaleString()}
              </Typography>
              {video.available_qualities?.length > 0 && (
                <Box sx={{ mt: 1, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                  {video.available_qualities.map(q => (
                    <Chip key={q} label={q} size="small" />
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Snackbar
        open={!!toast}
        autoHideDuration={4000}
        onClose={() => setToast(null)}
        message={toast}
      />
    </Box>
  );
}
