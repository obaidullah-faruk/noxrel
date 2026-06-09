'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';
import Alert from '@mui/material/Alert';
import IconButton from '@mui/material/IconButton';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import { alpha, useTheme } from '@mui/material/styles';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import CreditCardRoundedIcon from '@mui/icons-material/CreditCardRounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import { getToken } from '@/lib/auth-client';
import {
  cancelSubscription,
  fetchInvoicePdfUrl,
  fetchInvoices,
  fetchMySubscription,
  fetchPaymentMethods,
  reactivateSubscription,
  removePaymentMethod,
} from '@/lib/billing';
import { formatDate, PLAN_DISPLAY_NAME, STATUS_CFG } from '@/lib/billing-display';
import type { Invoice, PaymentMethod, Subscription } from '@/types/billing';

export default function BillingPage() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [mutating, setMutating] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const load = useCallback(async () => {
    const token = await getToken();
    if (!token) {
      window.location.href = '/login?next=/billing';
      return;
    }
    try {
      const [sub, inv, pms] = await Promise.all([
        fetchMySubscription(token),
        fetchInvoices(token),
        fetchPaymentMethods(token),
      ]);
      setSubscription(sub);
      setInvoices(inv);
      setPaymentMethods(pms);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const runMutation = useCallback(async (fn: (token: string) => Promise<Subscription>) => {
    setActionError(null);
    setMutating(true);
    try {
      const token = await getToken();
      if (!token) { window.location.href = '/login?next=/billing'; return; }
      const updated = await fn(token);
      setSubscription(updated);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setMutating(false);
      setConfirmCancel(false);
    }
  }, []);

  const handleDownloadInvoice = useCallback(async (invoiceId: string) => {
    setActionError(null);
    try {
      const token = await getToken();
      if (!token) { window.location.href = '/login?next=/billing'; return; }
      const url = await fetchInvoicePdfUrl(token, invoiceId);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const handleRemovePaymentMethod = useCallback(async (pmId: string) => {
    setActionError(null);
    try {
      const token = await getToken();
      if (!token) { window.location.href = '/login?next=/billing'; return; }
      await removePaymentMethod(token, pmId);
      setPaymentMethods(prev => prev.filter(pm => pm.id !== pmId));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  if (loading) {
    return (
      <Box sx={{ maxWidth: 720, mx: 'auto', px: { xs: 2, sm: 3 }, py: 4 }}>
        <Skeleton variant="text" width={200} height={36} sx={{ mb: 3 }} />
        <Skeleton variant="rectangular" height={180} sx={{ borderRadius: 2, mb: 3 }} />
        <Skeleton variant="rectangular" height={160} sx={{ borderRadius: 2 }} />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 720, mx: 'auto', px: { xs: 2, sm: 3 }, py: 4 }}>
      <Button
        startIcon={<ArrowBackRoundedIcon />}
        component={Link}
        href="/account"
        size="small"
        sx={{ mb: 3, color: 'text.secondary', fontWeight: 500 }}
      >
        Back to Account
      </Button>

      <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: '-0.02em', mb: 3 }}>
        Billing & Subscription
      </Typography>

      {error && <Alert severity="error" sx={{ borderRadius: 2, mb: 3 }}>{error}</Alert>}
      {actionError && (
        <Alert severity="error" sx={{ borderRadius: 2, mb: 3 }} onClose={() => setActionError(null)}>
          {actionError}
        </Alert>
      )}

      {/* Current subscription */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: '24px !important' }}>
          {subscription ? (
            <>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    {PLAN_DISPLAY_NAME[subscription.plan.name] ?? subscription.plan.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    ${Number(subscription.plan.price_usd).toFixed(2)}/{subscription.plan.billing_interval}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    px: 1.5,
                    py: 0.4,
                    borderRadius: 2,
                    bgcolor: alpha(STATUS_CFG[subscription.status]?.color ?? '#64748B', 0.12),
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{ fontWeight: 700, color: STATUS_CFG[subscription.status]?.color ?? '#64748B', fontSize: '0.75rem' }}
                  >
                    {STATUS_CFG[subscription.status]?.label ?? subscription.status}
                  </Typography>
                </Box>
              </Box>

              <Divider sx={{ borderColor: isDark ? alpha('#94A3B8', 0.1) : '#F1F5F9', mb: 2 }} />

              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5, mb: 2.5 }}>
                {subscription.status === 'trialing' && subscription.trial_end && (
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Trial ends</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>{formatDate(subscription.trial_end)}</Typography>
                  </Box>
                )}
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    {subscription.cancel_at_period_end ? 'Access until' : 'Renews on'}
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>{formatDate(subscription.current_period_end)}</Typography>
                </Box>
              </Box>

              {subscription.cancel_at_period_end && (
                <Alert severity="warning" sx={{ borderRadius: 2, mb: 2 }}>
                  Your subscription is set to cancel on {formatDate(subscription.current_period_end)}.
                </Alert>
              )}

              <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                <Button component={Link} href="/subscriptions" variant="outlined" sx={{ borderRadius: 2, fontWeight: 600 }}>
                  Change Plan
                </Button>
                {subscription.cancel_at_period_end ? (
                  <Button
                    variant="contained"
                    disabled={mutating}
                    onClick={() => runMutation(reactivateSubscription)}
                    sx={{ borderRadius: 2, fontWeight: 600 }}
                  >
                    Resume Subscription
                  </Button>
                ) : (
                  subscription.status !== 'cancelled' && (
                    <Button
                      variant="text"
                      color="error"
                      disabled={mutating}
                      onClick={() => setConfirmCancel(true)}
                      sx={{ borderRadius: 2, fontWeight: 600 }}
                    >
                      Cancel Subscription
                    </Button>
                  )
                )}
              </Box>
            </>
          ) : (
            <Box sx={{ textAlign: 'center', py: 2 }}>
              <Typography variant="body1" sx={{ fontWeight: 600, mb: 0.5 }}>No active subscription</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Subscribe to unlock higher quality and ad-free streaming.
              </Typography>
              <Button component={Link} href="/subscriptions" variant="contained" sx={{ borderRadius: 2, fontWeight: 600 }}>
                View Plans
              </Button>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Payment methods */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: '24px !important' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <CreditCardRoundedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Payment Methods</Typography>
          </Box>
          {paymentMethods.length === 0 ? (
            <Typography variant="body2" color="text.secondary">No saved payment methods.</Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {paymentMethods.map(pm => (
                <Box
                  key={pm.id}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    p: 1.5,
                    borderRadius: 2,
                    border: `1px solid ${isDark ? alpha('#94A3B8', 0.1) : '#E2E8F0'}`,
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, textTransform: 'capitalize' }}>
                      {pm.card_brand || pm.type}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">•••• {pm.last4}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Exp {String(pm.exp_month).padStart(2, '0')}/{pm.exp_year}
                    </Typography>
                    {pm.is_default && (
                      <Box sx={{ px: 1, py: 0.2, borderRadius: 1.5, bgcolor: alpha('#6366F1', 0.12) }}>
                        <Typography variant="caption" sx={{ fontWeight: 700, color: '#6366F1', fontSize: '0.68rem' }}>DEFAULT</Typography>
                      </Box>
                    )}
                  </Box>
                  <IconButton
                    size="small"
                    onClick={() => handleRemovePaymentMethod(pm.id)}
                    sx={{ color: 'text.secondary', '&:hover': { color: theme.palette.error.main, bgcolor: alpha(theme.palette.error.main, 0.08) } }}
                  >
                    <DeleteOutlineRoundedIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </Box>
              ))}
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Invoices */}
      <Card>
        <CardContent sx={{ p: '24px !important' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <ReceiptLongRoundedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Billing History</Typography>
          </Box>
          {invoices.length === 0 ? (
            <Typography variant="body2" color="text.secondary">No invoices yet.</Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
              {invoices.map((inv, idx) => (
                <Box key={inv.id}>
                  {idx > 0 && <Divider sx={{ borderColor: isDark ? alpha('#94A3B8', 0.08) : '#F1F5F9' }} />}
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1.5 }}>
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        ${Number(inv.amount_usd).toFixed(2)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatDate(inv.paid_at ?? inv.created_at)} · {inv.status}
                      </Typography>
                    </Box>
                    {inv.invoice_pdf_url && (
                      <IconButton
                        size="small"
                        onClick={() => handleDownloadInvoice(inv.id)}
                        sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main', bgcolor: alpha(theme.palette.primary.main, 0.08) } }}
                      >
                        <DownloadRoundedIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    )}
                  </Box>
                </Box>
              ))}
            </Box>
          )}
        </CardContent>
      </Card>

      <Dialog open={confirmCancel} onClose={() => setConfirmCancel(false)}>
        <DialogTitle sx={{ fontWeight: 700 }}>Cancel subscription?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Your plan stays active until {formatDate(subscription?.current_period_end ?? null)}. You can resume any time before then.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmCancel(false)} disabled={mutating}>Keep Subscription</Button>
          <Button
            color="error"
            variant="contained"
            disabled={mutating}
            onClick={() => runMutation(cancelSubscription)}
            sx={{ borderRadius: 2 }}
          >
            Cancel Subscription
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
