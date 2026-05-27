'use client';

import { useState, useRef, useCallback } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { initUpload, completeUpload, uploadPartToS3 } from '@/lib/api';
import type { PartEtag } from '@/lib/api';
import { getToken } from '@/lib/auth-client';

const schema = z.object({
  title:       z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  category:    z.string().optional(),
  age_rating:  z.string().optional(),
  tags:        z.string().optional(),
});
type FormData = z.infer<typeof schema>;

type UploadPhase = 'idle' | 'uploading' | 'completing' | 'done' | 'error';

interface Props {
  open: boolean;
  onClose: () => void;
  onUploaded: (videoId: string) => void;
}

export function VideoUploadDialog({ open, onClose, onUploaded }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile]         = useState<File | null>(null);
  const [phase, setPhase]       = useState<UploadPhase>('idle');
  const [progress, setProgress] = useState(0);   // 0–100
  const [partsDone, setPartsDone] = useState(0);
  const [totalParts, setTotalParts] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [videoId, setVideoId]   = useState<string | null>(null);
  const abortRef = useRef(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0] ?? null;
    setFile(picked);
  };

  const handleDropZoneClick = () => fileInputRef.current?.click();

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files[0];
    if (dropped) setFile(dropped);
  }, []);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => e.preventDefault();

  const handleClose = () => {
    if (phase === 'uploading' || phase === 'completing') return;
    reset();
    setFile(null);
    setPhase('idle');
    setProgress(0);
    setPartsDone(0);
    setTotalParts(0);
    setErrorMsg(null);
    setVideoId(null);
    abortRef.current = false;
    onClose();
  };

  const onSubmit = async (data: FormData) => {
    if (!file) return;
    abortRef.current = false;
    setPhase('uploading');
    setProgress(0);
    setPartsDone(0);
    setErrorMsg(null);

    try {
      const token = await getToken();

      // 1. Init multipart upload
      const init = await initUpload(token, {
        title:          data.title,
        description:    data.description,
        category:       data.category,
        age_rating:     data.age_rating,
        tags:           data.tags?.split(',').map(t => t.trim()).filter(Boolean),
        file_size_bytes: file.size,
      });

      setTotalParts(init.total_parts);

      // 2. Upload parts directly to S3
      // Must use the same 5 MB chunk boundary the server used when generating
      // presigned URLs — S3 rejects CompleteMultipartUpload if any non-last
      // part is smaller than 5 MB (EntityTooSmall).
      const CHUNK_SIZE = 5 * 1024 * 1024;
      const partEtags: PartEtag[] = [];
      let bytesUploaded = 0;

      for (const part of init.presigned_parts) {
        if (abortRef.current) throw new Error('Upload cancelled');

        const start = (part.part_number - 1) * CHUNK_SIZE;
        const end   = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);

        const etag = await uploadPartToS3(part.url, chunk, (loaded) => {
          const done = bytesUploaded + loaded;
          setProgress(Math.round((done / file.size) * 100));
        });

        bytesUploaded += chunk.size;
        partEtags.push({ part_number: part.part_number, etag });
        setPartsDone(part.part_number);
        setProgress(Math.round((bytesUploaded / file.size) * 100));
      }

      // 3. Complete upload
      setPhase('completing');
      const result = await completeUpload(token, init.upload_id, partEtags);
      setVideoId(result.video_id);
      setPhase('done');
    } catch (err) {
      if (!abortRef.current) {
        setErrorMsg(err instanceof Error ? err.message : String(err));
        setPhase('error');
      }
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isSubmitting = phase === 'uploading' || phase === 'completing';

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Upload Video</DialogTitle>

      <DialogContent dividers>
        {phase === 'done' ? (
          <Box sx={{ textAlign: 'center', py: 3 }}>
            <CheckCircleIcon color="success" sx={{ fontSize: 56, mb: 1 }} />
            <Typography variant="h6" gutterBottom>Upload complete!</Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom component="div">
              The video is now processing. You&apos;ll see it in the list with status{' '}
              <Chip label="processing" size="small" color="warning" />.
            </Typography>
            {videoId && (
              <Typography variant="caption" color="text.secondary">
                Video ID: {videoId}
              </Typography>
            )}
          </Box>
        ) : (
          <Box component="form" id="upload-form" onSubmit={handleSubmit(onSubmit)} sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            {/* Drop zone */}
            <Box
              onClick={!isSubmitting ? handleDropZoneClick : undefined}
              onDrop={!isSubmitting ? handleDrop : undefined}
              onDragOver={handleDragOver}
              sx={{
                border: '2px dashed',
                borderColor: file ? 'success.main' : 'divider',
                borderRadius: 2,
                p: 3,
                textAlign: 'center',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                bgcolor: file ? 'success.50' : 'action.hover',
                transition: 'border-color 0.2s',
                '&:hover': { borderColor: isSubmitting ? 'divider' : 'primary.main' },
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                style={{ display: 'none' }}
                onChange={handleFileChange}
                disabled={isSubmitting}
              />
              <CloudUploadIcon sx={{ fontSize: 40, color: file ? 'success.main' : 'text.secondary', mb: 1 }} />
              {file ? (
                <>
                  <Typography variant="body2" fontWeight={600}>{file.name}</Typography>
                  <Typography variant="caption" color="text.secondary">{formatBytes(file.size)}</Typography>
                </>
              ) : (
                <>
                  <Typography variant="body2">Drag & drop a video file here</Typography>
                  <Typography variant="caption" color="text.secondary">or click to browse</Typography>
                </>
              )}
            </Box>

            {/* Metadata fields */}
            <TextField
              label="Title *"
              {...register('title')}
              error={!!errors.title}
              helperText={errors.title?.message}
              size="small"
              fullWidth
              disabled={isSubmitting}
            />
            <TextField
              label="Description"
              {...register('description')}
              size="small"
              fullWidth
              multiline
              rows={2}
              disabled={isSubmitting}
            />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Category"
                {...register('category')}
                size="small"
                fullWidth
                disabled={isSubmitting}
              />
              <TextField
                label="Age Rating"
                {...register('age_rating')}
                size="small"
                fullWidth
                placeholder="G, PG, PG-13, R…"
                disabled={isSubmitting}
              />
            </Box>
            <TextField
              label="Tags (comma-separated)"
              {...register('tags')}
              size="small"
              fullWidth
              placeholder="action, drama, sci-fi"
              disabled={isSubmitting}
            />

            {/* Progress */}
            {isSubmitting && (
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="caption" color="text.secondary">
                    {phase === 'completing'
                      ? 'Finalising upload…'
                      : `Uploading part ${partsDone} / ${totalParts}`}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">{progress}%</Typography>
                </Box>
                <LinearProgress variant="determinate" value={phase === 'completing' ? 100 : progress} />
              </Box>
            )}

            {errorMsg && (
              <Alert severity="error" onClose={() => { setPhase('idle'); setErrorMsg(null); }}>
                {errorMsg}
              </Alert>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        {phase === 'done' ? (
          <>
            <Button onClick={() => { onUploaded(videoId!); handleClose(); }} variant="contained">
              View Video
            </Button>
            <Button onClick={handleClose}>Close</Button>
          </>
        ) : (
          <>
            <Button onClick={handleClose} disabled={isSubmitting}>Cancel</Button>
            <Button
              type="submit"
              form="upload-form"
              variant="contained"
              disabled={!file || isSubmitting}
              startIcon={isSubmitting ? undefined : <CloudUploadIcon />}
            >
              {isSubmitting ? 'Uploading…' : 'Upload'}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
