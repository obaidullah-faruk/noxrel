'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Card from '@mui/material/Card';
import TextField from '@mui/material/TextField';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import Snackbar from '@mui/material/Snackbar';
import { alpha, useTheme } from '@mui/material/styles';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded';
import { fetchAdminSubscriptions, refundSubscription } from '@/lib/api';
import { getToken } from '@/lib/auth-client';
import { PLAN_DISPLAY_NAME, STATUS_CFG } from '@/lib/billing-display';
import type { AdminSubscription } from '@/types/billing';

const PAGE_SIZE = 50;

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? { label: status, color: '#64748B' };
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.25, borderRadius: 1.5, bgcolor: alpha(cfg.color, 0.1) }}>
      <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: cfg.color }} />
      <Typography variant="caption" sx={{ fontWeight: 600, color: cfg.color, fontSize: '0.72rem' }}>
        {cfg.label}
      </Typography>
    </Box>
  );
}

export default function SubscriptionsPage() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<AdminSubscription[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [refundTarget, setRefundTarget] = useState<AdminSubscription | null>(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [refunding, setRefunding] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const token = await getToken();
      const data = await fetchAdminSubscriptions(token, { page: p + 1, page_size: PAGE_SIZE });
      setRows(data);
      setHasMore(data.length === PAGE_SIZE);
      setError(null);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(page); }, [load, page]);

  const handleRefund = useCallback(async () => {
    if (!refundTarget) return;
    setRefunding(true);
    try {
      const token = await getToken();
      const amount = refundAmount.trim() ? Number(refundAmount) : undefined;
      const refund = await refundSubscription(token, refundTarget.id, amount ? { amount_usd: amount } : {});
      setToast(`Refunded $${Number(refund.amount_usd).toFixed(2)} — ${refund.status}`);
      setRefundTarget(null);
      setRefundAmount('');
    } catch (err) {
      setError(String(err));
    } finally {
      setRefunding(false);
    }
  }, [refundTarget, refundAmount]);

  const columns = useMemo<GridColDef<AdminSubscription>[]>(() => [
    {
      field: 'plan',
      headerName: 'Plan',
      flex: 1,
      minWidth: 130,
      sortable: false,
      renderCell: ({ row }) => (
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {PLAN_DISPLAY_NAME[row.plan.name] ?? row.plan.name}
        </Typography>
      ),
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 130,
      renderCell: ({ value }) => <StatusBadge status={value as string} />,
    },
    {
      field: 'user_id',
      headerName: 'User',
      flex: 1.5,
      minWidth: 200,
      sortable: false,
      renderCell: ({ value }) => (
        <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
          {value as string}
        </Typography>
      ),
    },
    {
      field: 'current_period_end',
      headerName: 'Period End',
      width: 140,
      renderCell: ({ value }) => (
        <Typography variant="body2" color="text.secondary">
          {new Date(value as string).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </Typography>
      ),
    },
    {
      field: 'cancel_at_period_end',
      headerName: 'Cancelling',
      width: 110,
      renderCell: ({ value }) => (
        <Typography variant="body2" color={value ? 'warning.main' : 'text.secondary'} sx={{ fontWeight: value ? 600 : 400 }}>
          {value ? 'Yes' : 'No'}
        </Typography>
      ),
    },
    {
      field: 'actions',
      headerName: '',
      width: 130,
      sortable: false,
      disableColumnMenu: true,
      renderCell: ({ row }) => (
        <Button
          size="small"
          startIcon={<ReplayRoundedIcon sx={{ fontSize: 16 }} />}
          onClick={() => { setRefundTarget(row); setRefundAmount(''); }}
          sx={{ fontWeight: 600, fontSize: '0.75rem', color: 'text.secondary', '&:hover': { color: theme.palette.error.main } }}
        >
          Refund
        </Button>
      ),
    },
  ], [theme]);

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: '-0.02em' }}>
          Subscriptions
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Manage billing subscriptions and issue refunds
        </Typography>
      </Box>

      {error && (
        <Alert
          severity="warning"
          sx={{ mb: 2, borderRadius: 2, border: `1px solid ${alpha('#F59E0B', 0.3)}`, bgcolor: alpha('#F59E0B', 0.05) }}
          onClose={() => setError(null)}
        >
          {error}
        </Alert>
      )}

      <Card sx={{ borderRadius: 2 }}>
        <DataGrid
          rows={rows}
          columns={columns}
          loading={loading}
          hideFooterPagination
          hideFooter
          disableRowSelectionOnClick
          autoHeight
          rowHeight={56}
          sx={{
            border: 'none',
            '--DataGrid-overlayHeight': '300px',
            '& .MuiDataGrid-columnHeaders': {
              bgcolor: isDark ? alpha('#94A3B8', 0.04) : '#F8FAFC',
              borderBottom: `1px solid ${isDark ? alpha('#94A3B8', 0.1) : '#E2E8F0'}`,
            },
            '& .MuiDataGrid-columnHeaderTitle': {
              fontWeight: 600,
              fontSize: '0.75rem',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: 'text.secondary',
            },
            '& .MuiDataGrid-cell': {
              borderColor: isDark ? alpha('#94A3B8', 0.06) : '#F1F5F9',
              display: 'flex',
              alignItems: 'center',
            },
            '& .MuiDataGrid-row:hover': {
              bgcolor: isDark ? alpha('#6366F1', 0.06) : alpha('#6366F1', 0.03),
            },
          }}
        />
      </Card>

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1, mt: 2 }}>
        <Button
          size="small"
          variant="outlined"
          disabled={page === 0 || loading}
          onClick={() => setPage(p => Math.max(0, p - 1))}
          sx={{ borderRadius: 2 }}
        >
          Previous
        </Button>
        <Typography variant="body2" color="text.secondary">Page {page + 1}</Typography>
        <Button
          size="small"
          variant="outlined"
          disabled={!hasMore || loading}
          onClick={() => setPage(p => p + 1)}
          sx={{ borderRadius: 2 }}
        >
          Next
        </Button>
      </Box>

      <Dialog open={refundTarget !== null} onClose={() => !refunding && setRefundTarget(null)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 700 }}>Issue refund</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Refunds the most recent paid invoice for this subscription. Leave the amount blank for a full refund.
          </DialogContentText>
          <TextField
            label="Amount (USD)"
            placeholder="Full refund"
            value={refundAmount}
            onChange={e => setRefundAmount(e.target.value)}
            type="number"
            fullWidth
            size="small"
            slotProps={{ htmlInput: { min: 0, step: '0.01' } }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setRefundTarget(null)} disabled={refunding}>Cancel</Button>
          <Button color="error" variant="contained" onClick={handleRefund} disabled={refunding} sx={{ borderRadius: 2 }}>
            {refunding ? 'Processing…' : 'Issue Refund'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={toast !== null}
        autoHideDuration={5000}
        onClose={() => setToast(null)}
        message={toast}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  );
}
