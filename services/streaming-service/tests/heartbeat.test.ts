import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/services/redis.service.js', () => ({
  savePosition: vi.fn().mockResolvedValue(undefined),
  getPosition:  vi.fn().mockResolvedValue(0),
  closeRedis:   vi.fn().mockResolvedValue(undefined),
}));

import { savePosition, getPosition } from '../src/services/redis.service.js';
import { heartbeatHandler } from '../src/handlers/heartbeat.handler.js';
import { resumeHandler } from '../src/handlers/resume.handler.js';
import type { FastifyRequest, FastifyReply } from 'fastify';

function makeReply() {
  const reply = {
    _status: 200,
    _body: null as unknown,
    status(code: number) { this._status = code; return this; },
    send(body: unknown) { this._body = body; return Promise.resolve(); },
  };
  return reply;
}

describe('heartbeatHandler', () => {
  beforeEach(() => vi.clearAllMocks());

  it('saves position and returns { ok: true }', async () => {
    const req = {
      params: { videoId: 'v1' },
      headers: { 'x-user-id': 'u1' },
      body: { position: 42.5 },
    } as unknown as FastifyRequest<{ Params: { videoId: string }; Body: { position: number } }>;
    const reply = makeReply();

    await heartbeatHandler(req, reply as unknown as FastifyReply);

    expect(savePosition).toHaveBeenCalledWith('u1', 'v1', 42.5);
    expect(reply._body).toEqual({ ok: true });
  });

  it('returns 400 for negative position', async () => {
    const req = {
      params: { videoId: 'v1' },
      headers: {},
      body: { position: -1 },
    } as unknown as FastifyRequest<{ Params: { videoId: string }; Body: { position: number } }>;
    const reply = makeReply();

    await heartbeatHandler(req, reply as unknown as FastifyReply);

    expect(reply._status).toBe(400);
    expect(savePosition).not.toHaveBeenCalled();
  });

  it('returns 400 for non-finite position', async () => {
    const req = {
      params: { videoId: 'v1' },
      headers: {},
      body: { position: Infinity },
    } as unknown as FastifyRequest<{ Params: { videoId: string }; Body: { position: number } }>;
    const reply = makeReply();

    await heartbeatHandler(req, reply as unknown as FastifyReply);

    expect(reply._status).toBe(400);
  });

  it('uses anonymous when x-user-id header missing', async () => {
    const req = {
      params: { videoId: 'v1' },
      headers: {},
      body: { position: 10 },
    } as unknown as FastifyRequest<{ Params: { videoId: string }; Body: { position: number } }>;
    const reply = makeReply();

    await heartbeatHandler(req, reply as unknown as FastifyReply);

    expect(savePosition).toHaveBeenCalledWith('anonymous', 'v1', 10);
  });
});

describe('resumeHandler', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns saved position', async () => {
    vi.mocked(getPosition).mockResolvedValueOnce(123.4);
    const req = {
      params: { videoId: 'v1' },
      headers: { 'x-user-id': 'u1' },
    } as unknown as FastifyRequest<{ Params: { videoId: string } }>;
    const reply = makeReply();

    await resumeHandler(req, reply as unknown as FastifyReply);

    expect(getPosition).toHaveBeenCalledWith('u1', 'v1');
    expect(reply._body).toEqual({ position: 123.4 });
  });

  it('returns 0 when no history', async () => {
    vi.mocked(getPosition).mockResolvedValueOnce(0);
    const req = {
      params: { videoId: 'v1' },
      headers: {},
    } as unknown as FastifyRequest<{ Params: { videoId: string } }>;
    const reply = makeReply();

    await resumeHandler(req, reply as unknown as FastifyReply);

    expect(reply._body).toEqual({ position: 0 });
  });
});
