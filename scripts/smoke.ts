import express from 'express';
import request from 'supertest';
import userRoutes from '../src/routes/user.routes';
import urlRoutes from '../src/routes/url.routes';

function randomEmail() {
  return `tester_${Date.now()}@example.com`;
}

async function main() {
  const app = express();
  app.use(express.json());
  app.use('/api/users', userRoutes);
  app.use('/api/urls', urlRoutes);
  app.use('/', urlRoutes); // to enable redirect route

  const email = randomEmail();
  const password = 'test123';

  // Signup
  const signupRes = await request(app)
    .post('/api/users/signup')
    .send({ firstName: 'Test', lastName: 'User', email, password })
    .expect(201);

  const userId = signupRes.body?.data?.userId;
  if (!userId) throw new Error('Signup failed: missing userId');

  // Login
  const loginRes = await request(app)
    .post('/api/users/login')
    .send({ email, password })
    .expect(200);

  const token = loginRes.body?.token;
  if (!token) throw new Error('Login failed: missing token');

  // Create URL
  const createRes = await request(app)
    .post('/api/urls/create')
    .set('Authorization', `Bearer ${token}`)
    .send({ originalUrl: 'https://example.com' })
    .expect(201);

  const shortCode = createRes.body?.data?.shortCode;
  const urlId = createRes.body?.data?.id;
  const shortUrl = createRes.body?.data?.shortUrl;
  if (!shortCode || !urlId) throw new Error('Create URL failed: missing id or shortCode');

  // List URLs
  const listRes = await request(app)
    .get('/api/urls/list')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);

  // Analytics
  const analyticsRes = await request(app)
    .get(`/api/urls/${urlId}/analytics`)
    .set('Authorization', `Bearer ${token}`)
    .expect(200);

  // Redirect
  const redirectRes = await request(app)
    .get(`/${shortCode}`)
    .expect(301);

  // Summary
  const summary = {
    signup: { userId },
    login: { ok: true },
    create: { id: urlId, shortCode, shortUrl },
    list: { count: Array.isArray(listRes.body?.data) ? listRes.body.data.length : null },
    analytics: { ok: !!analyticsRes.body?.data },
    redirect: { status: redirectRes.status, location: redirectRes.headers['location'] },
  };

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error('Smoke test failed:', err);
  process.exit(1);
});

