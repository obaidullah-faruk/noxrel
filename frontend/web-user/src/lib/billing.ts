import type {
  CheckoutSession,
  Invoice,
  PaymentMethod,
  Subscription,
  SubscriptionPlan,
} from '@/types/billing';

const GATEWAY = process.env.NEXT_PUBLIC_API_GATEWAY_URL ?? 'http://localhost:8100';

// billing-service returns 404 when a viewer has no subscription yet — that is a
// normal "not subscribed" state, not an error, so callers get null instead.
class BillingError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function billingFetch<T>(
  token: string,
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${GATEWAY}/api/v1/billing${path}`, {
    ...options,
    signal: AbortSignal.timeout(8000),
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const detail = (body.detail as string) ?? res.statusText;
    throw new BillingError(res.status, detail);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function fetchPlans(token: string): Promise<SubscriptionPlan[]> {
  return billingFetch<SubscriptionPlan[]>(token, '/plans');
}

export async function fetchMySubscription(token: string): Promise<Subscription | null> {
  try {
    return await billingFetch<Subscription>(token, '/subscription');
  } catch (err) {
    if (err instanceof BillingError && err.status === 404) return null;
    throw err;
  }
}

export async function createCheckout(token: string, planId: string): Promise<CheckoutSession> {
  return billingFetch<CheckoutSession>(token, '/checkout', {
    method: 'POST',
    body: JSON.stringify({ plan_id: planId }),
  });
}

export async function cancelSubscription(token: string): Promise<Subscription> {
  return billingFetch<Subscription>(token, '/subscription/cancel', { method: 'POST' });
}

export async function reactivateSubscription(token: string): Promise<Subscription> {
  return billingFetch<Subscription>(token, '/subscription/reactivate', { method: 'POST' });
}

export async function fetchInvoices(token: string): Promise<Invoice[]> {
  return billingFetch<Invoice[]>(token, '/invoices');
}

export async function fetchInvoicePdfUrl(token: string, invoiceId: string): Promise<string> {
  const body = await billingFetch<{ pdf_url: string }>(token, `/invoices/${invoiceId}/pdf`);
  return body.pdf_url;
}

export async function fetchPaymentMethods(token: string): Promise<PaymentMethod[]> {
  return billingFetch<PaymentMethod[]>(token, '/payment-methods');
}

export async function removePaymentMethod(token: string, pmId: string): Promise<void> {
  await billingFetch<void>(token, `/payment-methods/${pmId}`, { method: 'DELETE' });
}
