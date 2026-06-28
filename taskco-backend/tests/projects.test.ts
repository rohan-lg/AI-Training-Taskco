import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { buildApp } from '../src/app.js';
import { prisma } from '../src/lib/db.js';

const TEST_EMAILS = [
  'proj-a@test.taskco',
  'proj-b@test.taskco',
];

const app = buildApp();

async function registerAndGetToken(email: string, name: string): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/auth/register',
    payload: { email, password: 'password123', name },
  });
  return res.json().data.token;
}

beforeEach(async () => {
  // Delete projects first (FK constraint), then users
  const users = await prisma.user.findMany({ where: { email: { in: TEST_EMAILS } } });
  const userIds = users.map((u) => u.id);
  if (userIds.length > 0) {
    await prisma.project.deleteMany({ where: { ownerId: { in: userIds } } });
  }
  await prisma.user.deleteMany({ where: { email: { in: TEST_EMAILS } } });
});

afterAll(async () => {
  const users = await prisma.user.findMany({ where: { email: { in: TEST_EMAILS } } });
  const userIds = users.map((u) => u.id);
  if (userIds.length > 0) {
    await prisma.project.deleteMany({ where: { ownerId: { in: userIds } } });
  }
  await prisma.user.deleteMany({ where: { email: { in: TEST_EMAILS } } });
  await app.close();
});

// ---------------------------------------------------------------------------
// POST /projects
// ---------------------------------------------------------------------------
describe('POST /projects', () => {
  it('creates a project and returns it', async () => {
    const token = await registerAndGetToken('proj-a@test.taskco', 'Alice');
    const res = await app.inject({
      method: 'POST',
      url: '/projects',
      headers: { Authorization: `Bearer ${token}` },
      payload: { name: 'My Project', description: 'A test project', color: '#ff0000' },
    });

    expect(res.statusCode).toBe(201);
    const { data } = res.json();
    expect(data.project.id).toBeTruthy();
    expect(data.project.name).toBe('My Project');
    expect(data.project.description).toBe('A test project');
    expect(data.project.color).toBe('#ff0000');
    expect(data.project.createdAt).toBeTruthy();
  });

  it('uses default color when color is omitted', async () => {
    const token = await registerAndGetToken('proj-a@test.taskco', 'Alice');
    const res = await app.inject({
      method: 'POST',
      url: '/projects',
      headers: { Authorization: `Bearer ${token}` },
      payload: { name: 'No Color Project' },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().data.project.color).toBe('#3b82f6');
  });

  it('returns 400 VALIDATION_ERROR when name is missing', async () => {
    const token = await registerAndGetToken('proj-a@test.taskco', 'Alice');
    const res = await app.inject({
      method: 'POST',
      url: '/projects',
      headers: { Authorization: `Bearer ${token}` },
      payload: { description: 'No name' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 401 when not authenticated', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/projects',
      payload: { name: 'Unauthorized' },
    });

    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// GET /projects
// ---------------------------------------------------------------------------
describe('GET /projects', () => {
  it('returns only projects owned by the authenticated user', async () => {
    const tokenA = await registerAndGetToken('proj-a@test.taskco', 'Alice');
    const tokenB = await registerAndGetToken('proj-b@test.taskco', 'Bob');

    // User A creates 2 projects
    await app.inject({
      method: 'POST',
      url: '/projects',
      headers: { Authorization: `Bearer ${tokenA}` },
      payload: { name: 'Alice Project 1' },
    });
    await app.inject({
      method: 'POST',
      url: '/projects',
      headers: { Authorization: `Bearer ${tokenA}` },
      payload: { name: 'Alice Project 2' },
    });

    // User B creates 1 project
    await app.inject({
      method: 'POST',
      url: '/projects',
      headers: { Authorization: `Bearer ${tokenB}` },
      payload: { name: 'Bob Project 1' },
    });

    const resA = await app.inject({
      method: 'GET',
      url: '/projects',
      headers: { Authorization: `Bearer ${tokenA}` },
    });

    expect(resA.statusCode).toBe(200);
    const { data } = resA.json();
    expect(data.projects).toHaveLength(2);
    expect(data.projects.every((p: { name: string }) => p.name.startsWith('Alice'))).toBe(true);
  });

  it('returns empty array when user has no projects', async () => {
    const token = await registerAndGetToken('proj-a@test.taskco', 'Alice');
    const res = await app.inject({
      method: 'GET',
      url: '/projects',
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.projects).toEqual([]);
  });

  it('returns 401 when not authenticated', async () => {
    const res = await app.inject({ method: 'GET', url: '/projects' });
    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// GET /projects/:id
// ---------------------------------------------------------------------------
describe('GET /projects/:id', () => {
  it('returns a project with taskCount', async () => {
    const token = await registerAndGetToken('proj-a@test.taskco', 'Alice');
    const createRes = await app.inject({
      method: 'POST',
      url: '/projects',
      headers: { Authorization: `Bearer ${token}` },
      payload: { name: 'Detail Project' },
    });
    const projectId = createRes.json().data.project.id;

    const res = await app.inject({
      method: 'GET',
      url: `/projects/${projectId}`,
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const { data } = res.json();
    expect(data.project.id).toBe(projectId);
    expect(data.project.taskCount).toBe(0);
  });

  it('returns 404 when project does not exist', async () => {
    const token = await registerAndGetToken('proj-a@test.taskco', 'Alice');
    const res = await app.inject({
      method: 'GET',
      url: '/projects/nonexistent-id',
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('NOT_FOUND');
  });

  it('returns 404 when project belongs to another user (ownership isolation)', async () => {
    const tokenA = await registerAndGetToken('proj-a@test.taskco', 'Alice');
    const tokenB = await registerAndGetToken('proj-b@test.taskco', 'Bob');

    const createRes = await app.inject({
      method: 'POST',
      url: '/projects',
      headers: { Authorization: `Bearer ${tokenA}` },
      payload: { name: 'Alice Only Project' },
    });
    const projectId = createRes.json().data.project.id;

    // User B tries to get User A's project — must get 404, not 403
    const res = await app.inject({
      method: 'GET',
      url: `/projects/${projectId}`,
      headers: { Authorization: `Bearer ${tokenB}` },
    });

    expect(res.statusCode).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// PATCH /projects/:id
// ---------------------------------------------------------------------------
describe('PATCH /projects/:id', () => {
  it('updates a project field', async () => {
    const token = await registerAndGetToken('proj-a@test.taskco', 'Alice');
    const createRes = await app.inject({
      method: 'POST',
      url: '/projects',
      headers: { Authorization: `Bearer ${token}` },
      payload: { name: 'Original Name' },
    });
    const projectId = createRes.json().data.project.id;

    const res = await app.inject({
      method: 'PATCH',
      url: `/projects/${projectId}`,
      headers: { Authorization: `Bearer ${token}` },
      payload: { name: 'Updated Name' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.project.name).toBe('Updated Name');
  });

  it('returns 404 when project belongs to another user (ownership isolation)', async () => {
    const tokenA = await registerAndGetToken('proj-a@test.taskco', 'Alice');
    const tokenB = await registerAndGetToken('proj-b@test.taskco', 'Bob');

    const createRes = await app.inject({
      method: 'POST',
      url: '/projects',
      headers: { Authorization: `Bearer ${tokenA}` },
      payload: { name: 'Alice Project' },
    });
    const projectId = createRes.json().data.project.id;

    const res = await app.inject({
      method: 'PATCH',
      url: `/projects/${projectId}`,
      headers: { Authorization: `Bearer ${tokenB}` },
      payload: { name: 'Bob Hijacking' },
    });

    expect(res.statusCode).toBe(404);
  });

  it('returns 400 VALIDATION_ERROR on empty string name', async () => {
    const token = await registerAndGetToken('proj-a@test.taskco', 'Alice');
    const createRes = await app.inject({
      method: 'POST',
      url: '/projects',
      headers: { Authorization: `Bearer ${token}` },
      payload: { name: 'Valid Name' },
    });
    const projectId = createRes.json().data.project.id;

    const res = await app.inject({
      method: 'PATCH',
      url: `/projects/${projectId}`,
      headers: { Authorization: `Bearer ${token}` },
      payload: { name: '' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 401 when not authenticated', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/projects/any-id',
      payload: { name: 'Test' },
    });
    expect(res.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// DELETE /projects/:id
// ---------------------------------------------------------------------------
describe('DELETE /projects/:id', () => {
  it('deletes a project', async () => {
    const token = await registerAndGetToken('proj-a@test.taskco', 'Alice');
    const createRes = await app.inject({
      method: 'POST',
      url: '/projects',
      headers: { Authorization: `Bearer ${token}` },
      payload: { name: 'To Delete' },
    });
    const projectId = createRes.json().data.project.id;

    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/projects/${projectId}`,
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(deleteRes.statusCode).toBe(204);

    // Verify it's gone
    const getRes = await app.inject({
      method: 'GET',
      url: `/projects/${projectId}`,
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(getRes.statusCode).toBe(404);
  });

  it('returns 404 when project belongs to another user (ownership isolation)', async () => {
    const tokenA = await registerAndGetToken('proj-a@test.taskco', 'Alice');
    const tokenB = await registerAndGetToken('proj-b@test.taskco', 'Bob');

    const createRes = await app.inject({
      method: 'POST',
      url: '/projects',
      headers: { Authorization: `Bearer ${tokenA}` },
      payload: { name: 'Alice Protected Project' },
    });
    const projectId = createRes.json().data.project.id;

    // User B cannot delete User A's project
    const res = await app.inject({
      method: 'DELETE',
      url: `/projects/${projectId}`,
      headers: { Authorization: `Bearer ${tokenB}` },
    });

    expect(res.statusCode).toBe(404);

    // Confirm it still exists for User A
    const getRes = await app.inject({
      method: 'GET',
      url: `/projects/${projectId}`,
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    expect(getRes.statusCode).toBe(200);
  });

  it('returns 404 when project does not exist', async () => {
    const token = await registerAndGetToken('proj-a@test.taskco', 'Alice');
    const res = await app.inject({
      method: 'DELETE',
      url: '/projects/nonexistent-id',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it('returns 401 when not authenticated', async () => {
    const res = await app.inject({ method: 'DELETE', url: '/projects/any-id' });
    expect(res.statusCode).toBe(401);
  });
});
