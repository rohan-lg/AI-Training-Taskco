import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { SignJWT } from 'jose';
import { buildApp } from '../src/app.js';
import { prisma } from '../src/lib/db.js';

// All emails used in these tests — cleaned before each test and after the suite.
const TEST_EMAILS = [
  'reg-ok@test.taskco',
  'dup@test.taskco',
  'login-ok@test.taskco',
  'me@test.taskco',
];

const app = buildApp();

beforeEach(async () => {
  await prisma.user.deleteMany({ where: { email: { in: TEST_EMAILS } } });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { in: TEST_EMAILS } } });
  await app.close();
});

// ---------------------------------------------------------------------------
// POST /auth/register
// ---------------------------------------------------------------------------
describe('POST /auth/register', () => {
  it('registers a user and returns token + user (no passwordHash)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'reg-ok@test.taskco', password: 'password123', name: 'Alice' },
    });

    expect(res.statusCode).toBe(201);
    const { data } = res.json();

    // token
    expect(typeof data.token).toBe('string');
    expect(data.token.length).toBeGreaterThan(0);

    // user shape
    expect(data.user.id).toBeTruthy();
    expect(data.user.email).toBe('reg-ok@test.taskco');
    expect(data.user.name).toBe('Alice');
    expect(data.user.createdAt).toBeTruthy();

    // sensitive fields must never appear
    expect(data.user.passwordHash).toBeUndefined();
    expect(data.user.password).toBeUndefined();
  });

  it('returns 409 CONFLICT on duplicate email', async () => {
    const payload = { email: 'dup@test.taskco', password: 'password123', name: 'Bob' };

    await app.inject({ method: 'POST', url: '/auth/register', payload });
    const res = await app.inject({ method: 'POST', url: '/auth/register', payload });

    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('CONFLICT');
  });

  it('returns 400 VALIDATION_ERROR on invalid email', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'not-an-email', password: 'password123', name: 'Test' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 VALIDATION_ERROR when password is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'reg-ok@test.taskco', name: 'Test' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 VALIDATION_ERROR when name is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'reg-ok@test.taskco', password: 'password123' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });
});

// ---------------------------------------------------------------------------
// POST /auth/login
// ---------------------------------------------------------------------------
describe('POST /auth/login', () => {
  // Seed the login user before each login test (outer beforeEach already wiped it).
  beforeEach(async () => {
    await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'login-ok@test.taskco', password: 'password123', name: 'Carol' },
    });
  });

  it('logs in and returns token + user (no passwordHash)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'login-ok@test.taskco', password: 'password123' },
    });

    expect(res.statusCode).toBe(200);
    const { data } = res.json();

    expect(typeof data.token).toBe('string');
    expect(data.token.length).toBeGreaterThan(0);
    expect(data.user.email).toBe('login-ok@test.taskco');
    expect(data.user.name).toBe('Carol');
    expect(data.user.createdAt).toBeTruthy();
    expect(data.user.passwordHash).toBeUndefined();
    expect(data.user.password).toBeUndefined();
  });

  it('returns 401 UNAUTHORIZED on wrong password', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'login-ok@test.taskco', password: 'wrongpassword' },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 UNAUTHORIZED on unknown email', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'nobody@test.taskco', password: 'password123' },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('UNAUTHORIZED');
  });

  it('returns 400 VALIDATION_ERROR on malformed input', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'bad-email', password: '' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });
});

// ---------------------------------------------------------------------------
// GET /auth/me
// ---------------------------------------------------------------------------
describe('GET /auth/me', () => {
  let validToken: string;

  beforeEach(async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'me@test.taskco', password: 'password123', name: 'Dave' },
    });
    validToken = res.json().data.token;
  });

  it('returns the authenticated user profile (no passwordHash)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { Authorization: `Bearer ${validToken}` },
    });

    expect(res.statusCode).toBe(200);
    const { data } = res.json();
    expect(data.id).toBeTruthy();
    expect(data.email).toBe('me@test.taskco');
    expect(data.name).toBe('Dave');
    expect(data.createdAt).toBeTruthy();
    expect(data.passwordHash).toBeUndefined();
    expect(data.password).toBeUndefined();
  });

  it('returns 401 when Authorization header is missing', async () => {
    const res = await app.inject({ method: 'GET', url: '/auth/me' });

    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 when token is malformed', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { Authorization: 'Bearer this.is.not.a.jwt' },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 when token is expired', async () => {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const expiredToken = await new SignJWT({ userId: 'test-id', email: 'me@test.taskco' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(new Date(Date.now() - 1000))
      .sign(secret);

    const res = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { Authorization: `Bearer ${expiredToken}` },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('UNAUTHORIZED');
  });
});
