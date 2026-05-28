import { NextRequest, NextResponse } from 'next/server';

const GATEWAY = process.env.API_GATEWAY_URL ?? 'http://localhost:8100';
// Abort the upstream refresh call if it takes longer than this.
const REFRESH_TIMEOUT_MS = 5000;

// All /api/ routes are internal Next.js route handlers — never redirect them.
const API_PREFIX = '/api/';

// Uses atob (Edge-runtime safe) instead of Buffer.
function jwtExp(token: string): number {
  try {
    const [, b64] = token.split('.');
    const padded = b64.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(padded)) as { exp?: number };
    return payload.exp ?? 0;
  } catch {
    return 0;
  }
}

function isExpired(token: string): boolean {
  const exp = jwtExp(token);
  // 30-second buffer so we refresh slightly before the hard deadline.
  return exp === 0 || exp - Math.floor(Date.now() / 1000) < 30;
}

function cookieMaxAge(token: string, fallback: number): number {
  const exp = jwtExp(token);
  if (!exp) return fallback;
  return Math.max(1, exp - Math.floor(Date.now() / 1000) - 30);
}

function redirectToLogin(req: NextRequest, pathname: string) {
  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = '/login';
  loginUrl.search = `?next=${encodeURIComponent(pathname)}`;
  return NextResponse.redirect(loginUrl);
}

async function attemptRefresh(
  req: NextRequest,
  refreshToken: string,
  destination: 'next' | 'dashboard',
): Promise<NextResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REFRESH_TIMEOUT_MS);

  try {
    const upstream = await fetch(`${GATEWAY}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh: refreshToken }),
      signal: controller.signal,
    });

    if (!upstream.ok) {
      return redirectToLogin(req, req.nextUrl.pathname);
    }

    const data = await upstream.json() as { access: string; refresh?: string };

    const response =
      destination === 'dashboard'
        ? NextResponse.redirect(
            Object.assign(req.nextUrl.clone(), { pathname: '/dashboard', search: '' }),
          )
        : NextResponse.next();

    response.cookies.set('admin_access_token', data.access, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: cookieMaxAge(data.access, 900),
    });
    if (data.refresh) {
      response.cookies.set('admin_refresh_token', data.refresh, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: cookieMaxAge(data.refresh, 60 * 60 * 24 * 30),
      });
    }
    return response;
  } catch {
    return redirectToLogin(req, req.nextUrl.pathname);
  } finally {
    clearTimeout(timer);
  }
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const accessToken = req.cookies.get('admin_access_token')?.value;
  const refreshToken = req.cookies.get('admin_refresh_token')?.value;

  // API routes are never redirected — let Next.js handle them.
  if (pathname.startsWith(API_PREFIX)) {
    return NextResponse.next();
  }

  const accessValid = !!accessToken && !isExpired(accessToken);

  if (pathname === '/login') {
    if (accessValid) {
      // Logged-in user hitting /login → send to dashboard.
      const dashboardUrl = req.nextUrl.clone();
      dashboardUrl.pathname = '/dashboard';
      dashboardUrl.search = '';
      return NextResponse.redirect(dashboardUrl);
    }
    if (refreshToken && !isExpired(refreshToken)) {
      // Expired access but live refresh → silently restore and send to dashboard.
      return attemptRefresh(req, refreshToken, 'dashboard');
    }
    // No valid session — let them see the login page.
    return NextResponse.next();
  }

  if (accessValid) {
    return NextResponse.next();
  }

  if (!refreshToken || isExpired(refreshToken)) {
    return redirectToLogin(req, pathname);
  }

  // Access token expired but refresh token is still live — silent refresh.
  return attemptRefresh(req, refreshToken, 'next');
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
