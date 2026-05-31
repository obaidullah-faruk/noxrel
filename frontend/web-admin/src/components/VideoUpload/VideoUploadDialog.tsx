'use client';

import { useState, useRef, useCallback, KeyboardEvent } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import InputLabel from '@mui/material/InputLabel';
import FormControl from '@mui/material/FormControl';
import FormHelperText from '@mui/material/FormHelperText';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import Alert from '@mui/material/Alert';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import { alpha, useTheme } from '@mui/material/styles';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import InsertDriveFileRoundedIcon from '@mui/icons-material/InsertDriveFileRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import LocalOfferRoundedIcon from '@mui/icons-material/LocalOfferRounded';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { initUpload, completeUpload, uploadPartToS3 } from '@/lib/api';
import type { PartEtag } from '@/lib/api';
import { getToken } from '@/lib/auth-client';

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

const schema = z.object({
  title:       z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  category:    z.string().optional(),
  age_rating:  z.string().optional(),
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
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [file, setFile]             = useState<File | null>(null);
  const [phase, setPhase]           = useState<UploadPhase>('idle');
  const [progress, setProgress]     = useState(0);
  const [partsDone, setPartsDone]   = useState(0);
  const [totalParts, setTotalParts] = useState(0);
  const [errorMsg, setErrorMsg]     = useState<string | null>(null);
  const [videoId, setVideoId]       = useState<string | null>(null);
  const [dragOver, setDragOver]     = useState(false);
  const [tags, setTags]             = useState<string[]>([]);
  const [tagInput, setTagInput]     = useState('');
  const abortRef = useRef(false);

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  // ── Tag helpers ───────────────────────────────────────────────────────────
  const commitTag = (raw: string) => {
    const val = raw.trim().toLowerCase().replace(/\s+/g, '-');
    if (val && !tags.includes(val) && tags.length < 10) {
      setTags(prev => [...prev, val]);
    }
    setTagInput('');
  };

  const handleTagKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commitTag(tagInput);
    } else if (e.key === 'Backspace' && tagInput === '' && tags.length > 0) {
      setTags(prev => prev.slice(0, -1));
    }
  };

  const removeTag = (tag: string) => setTags(prev => prev.filter(t => t !== tag));

  // ── File drop ─────────────────────────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files?.[0] ?? null);
  };

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) setFile(dropped);
  }, []);

  // ── Reset & close ─────────────────────────────────────────────────────────
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
    setDragOver(false);
    setTags([]);
    setTagInput('');
    abortRef.current = false;
    onClose();
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const onSubmit = async (data: FormData) => {
    if (!file) return;
    abortRef.current = false;
    setPhase('uploading');
    setProgress(0);
    setPartsDone(0);
    setErrorMsg(null);

    try {
      const token = await getToken();

      const init = await initUpload(token, {
        title:           data.title,
        description:     data.description,
        category:        data.category,
        age_rating:      data.age_rating,
        tags,
        file_size_bytes: file.size,
      });

      setTotalParts(init.total_parts);

      const CHUNK_SIZE = 5 * 1024 * 1024;
      const partEtags: PartEtag[] = [];
      let bytesUploaded = 0;

      for (const part of init.presigned_parts) {
        if (abortRef.current) throw new Error('Upload cancelled');
        const start = (part.part_number - 1) * CHUNK_SIZE;
        const end   = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);

        const etag = await uploadPartToS3(part.url, chunk, (loaded) => {
          setProgress(Math.round(((bytesUploaded + loaded) / file.size) * 100));
        });

        bytesUploaded += chunk.size;
        partEtags.push({ part_number: part.part_number, etag });
        setPartsDone(part.part_number);
        setProgress(Math.round((bytesUploaded / file.size) * 100));
      }

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

  const formatBytes = (b: number) =>
    b < 1024 * 1024 ? `${(b / 1024).toFixed(0)} KB` : `${(b / (1024 * 1024)).toFixed(1)} MB`;

  const isSubmitting = phase === 'uploading' || phase === 'completing';

  const fieldSx = {
    '& .MuiOutlinedInput-root': {
      borderRadius: 2,
    },
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ px: 3, pt: 3, pb: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>Upload Video</Typography>
            <Typography variant="caption" color="text.secondary">
              Fill in the details and select your video file
            </Typography>
          </Box>
          <IconButton
            size="small"
            onClick={handleClose}
            disabled={isSubmitting}
            sx={{ color: 'text.secondary', '&:hover': { bgcolor: isDark ? alpha('#94A3B8', 0.1) : '#F1F5F9' } }}
          >
            <CloseRoundedIcon fontSize="small" />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ px: 3, pt: 2.5 }}>
        {phase === 'done' ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Box sx={{ width: 72, height: 72, borderRadius: '50%', bgcolor: 'rgba(16,185,129,0.1)', border: '2px solid rgba(16,185,129,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 2 }}>
              <CheckCircleRoundedIcon sx={{ fontSize: 36, color: '#10B981' }} />
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>Upload Complete!</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2, maxWidth: 320, mx: 'auto' }}>
              Your video is now in the processing queue. It will be available once transcoding finishes.
            </Typography>
            {videoId && (
              <Box sx={{ display: 'inline-flex', px: 1.5, py: 0.5, borderRadius: 2, bgcolor: isDark ? alpha('#94A3B8', 0.08) : '#F8FAFC', border: `1px solid ${isDark ? alpha('#94A3B8', 0.12) : '#E2E8F0'}` }}>
                <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
                  ID: {videoId}
                </Typography>
              </Box>
            )}
          </Box>
        ) : (
          <Box component="form" id="upload-form" onSubmit={handleSubmit(onSubmit)} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>

            {/* Drop zone */}
            <Box
              onClick={!isSubmitting ? () => fileInputRef.current?.click() : undefined}
              onDrop={!isSubmitting ? handleDrop : undefined}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              sx={{
                border: '2px dashed',
                borderColor: dragOver ? 'primary.main' : file ? '#10B981' : (isDark ? alpha('#94A3B8', 0.2) : '#E2E8F0'),
                borderRadius: 3,
                p: 3,
                textAlign: 'center',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                bgcolor: dragOver ? alpha(theme.palette.primary.main, 0.05) : file ? 'rgba(16,185,129,0.04)' : (isDark ? alpha('#94A3B8', 0.03) : '#FAFAFA'),
                transition: 'all 0.2s ease',
              }}
            >
              <input ref={fileInputRef} type="file" accept="video/*" style={{ display: 'none' }} onChange={handleFileChange} disabled={isSubmitting} />
              {file ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, justifyContent: 'center', minWidth: 0 }}>
                  <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <InsertDriveFileRoundedIcon sx={{ fontSize: 22, color: '#10B981' }} />
                  </Box>
                  <Box sx={{ textAlign: 'left', minWidth: 0, overflow: 'hidden' }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#10B981', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{file.name}</Typography>
                    <Typography variant="caption" color="text.secondary">{formatBytes(file.size)}</Typography>
                  </Box>
                </Box>
              ) : (
                <>
                  <CloudUploadRoundedIcon sx={{ fontSize: 40, color: dragOver ? 'primary.main' : 'text.secondary', opacity: dragOver ? 1 : 0.4, mb: 1 }} />
                  <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                    {dragOver ? 'Drop to upload' : 'Drag & drop your video here'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">or click to browse</Typography>
                </>
              )}
            </Box>

            {/* Title */}
            <TextField
              label="Title *"
              {...register('title')}
              error={!!errors.title}
              helperText={errors.title?.message}
              size="small"
              fullWidth
              disabled={isSubmitting}
              sx={fieldSx}
            />

            {/* Description */}
            <TextField
              label="Description"
              {...register('description')}
              size="small"
              fullWidth
              multiline
              rows={2}
              disabled={isSubmitting}
              sx={fieldSx}
            />

            {/* Category + Age Rating dropdowns */}
            <Box sx={{ display: 'flex', gap: 2 }}>
              <FormControl size="small" fullWidth disabled={isSubmitting}>
                <InputLabel>Category</InputLabel>
                <Controller
                  name="category"
                  control={control}
                  defaultValue=""
                  render={({ field }) => (
                    <Select {...field} label="Category" sx={{ borderRadius: 2 }}>
                      <MenuItem value=""><em>Select category</em></MenuItem>
                      {CATEGORIES.map(c => (
                        <MenuItem key={c} value={c}>{c}</MenuItem>
                      ))}
                    </Select>
                  )}
                />
              </FormControl>

              <FormControl size="small" fullWidth disabled={isSubmitting}>
                <InputLabel>Age Rating</InputLabel>
                <Controller
                  name="age_rating"
                  control={control}
                  defaultValue=""
                  render={({ field }) => (
                    <Select {...field} label="Age Rating" sx={{ borderRadius: 2 }}>
                      <MenuItem value=""><em>Select rating</em></MenuItem>
                      {AGE_RATINGS.map(r => (
                        <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>
                      ))}
                    </Select>
                  )}
                />
              </FormControl>
            </Box>

            {/* Tags chip input */}
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
                  cursor: isSubmitting ? 'not-allowed' : 'text',
                  transition: 'border-color 0.15s',
                  '&:focus-within': {
                    borderColor: theme.palette.primary.main,
                    boxShadow: `0 0 0 2px ${alpha(theme.palette.primary.main, 0.15)}`,
                  },
                }}
                onClick={() => !isSubmitting && document.getElementById('tag-input')?.focus()}
              >
                <LocalOfferRoundedIcon sx={{ fontSize: 15, color: 'text.secondary', flexShrink: 0 }} />
                {tags.map(tag => (
                  <Chip
                    key={tag}
                    label={tag}
                    size="small"
                    onDelete={isSubmitting ? undefined : () => removeTag(tag)}
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
                  id="tag-input"
                  component="input"
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={handleTagKeyDown}
                  onBlur={() => tagInput && commitTag(tagInput)}
                  disabled={isSubmitting || tags.length >= 10}
                  placeholder={tags.length === 0 ? 'Add tags…' : ''}
                  sx={{
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    color: 'text.primary',
                    fontSize: '0.875rem',
                    minWidth: 80,
                    flex: 1,
                    p: 0,
                    '&::placeholder': { color: isDark ? '#4B5563' : '#9CA3AF' },
                    '&:disabled': { cursor: 'not-allowed' },
                  }}
                />
              </Box>
              <FormHelperText sx={{ mx: 1.5, mt: 0.5 }}>
                Press Enter or comma to add · {tags.length}/10 tags
              </FormHelperText>
            </Box>

            {/* Progress */}
            {isSubmitting && (
              <Box sx={{ bgcolor: isDark ? alpha('#94A3B8', 0.05) : '#F8FAFC', border: `1px solid ${isDark ? alpha('#94A3B8', 0.1) : '#E2E8F0'}`, borderRadius: 2, p: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="caption" sx={{ fontWeight: 600 }}>
                    {phase === 'completing' ? 'Finalising upload…' : `Part ${partsDone} / ${totalParts}`}
                  </Typography>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: 'primary.main' }}>
                    {progress}%
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={phase === 'completing' ? 100 : progress}
                  sx={{ '& .MuiLinearProgress-bar': { background: 'linear-gradient(90deg, #6366F1, #8B5CF6)' } }}
                />
              </Box>
            )}

            {errorMsg && (
              <Alert severity="error" onClose={() => { setPhase('idle'); setErrorMsg(null); }} sx={{ borderRadius: 2 }}>
                {errorMsg}
              </Alert>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3, pt: 1, gap: 1 }}>
        {phase === 'done' ? (
          <>
            <Button
              onClick={() => { onUploaded(videoId!); handleClose(); }}
              variant="contained"
              startIcon={<OpenInNewRoundedIcon />}
              sx={{ background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)' }}
            >
              View Video
            </Button>
            <Button onClick={handleClose} sx={{ color: 'text.secondary' }}>Close</Button>
          </>
        ) : (
          <>
            <Button onClick={handleClose} disabled={isSubmitting} sx={{ color: 'text.secondary' }}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="upload-form"
              variant="contained"
              disabled={!file || isSubmitting}
              startIcon={isSubmitting ? <CircularProgress size={14} color="inherit" /> : <CloudUploadRoundedIcon />}
              sx={{
                background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
                '&:hover': { background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)' },
                '&.Mui-disabled': { background: isDark ? alpha('#6366F1', 0.2) : alpha('#6366F1', 0.15) },
              }}
            >
              {isSubmitting ? 'Uploading…' : 'Upload'}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
