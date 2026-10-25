import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { createApp } from '../app.js';
import User from '../models/User.js';
import Zone from '../models/Zone.js';
import Sensor from '../models/Sensor.js';
import AuditLog from '../models/AuditLog.js';
import { RadiationReading, Alert, Inspection, Incident } from '../models/operations.js';
import { seedAdmin } from '../seed/admin.js';
import { classifyReading } from '../services/thresholds.js';
const password = randomBytes(20).toString('hex');
const config = {
  jwtSecret: randomBytes(48).toString('hex'),
  jwtExpiresIn: '1d',
  clientUrl: 'http://localhost:5173',
  thresholds: { warning: 2.5, critical: 5, unit: 'uSv/h', label: 'Demonstration thresholds' },
};
const app = createApp(config);
let repl,
  admin,
  officer,
  adminToken,
  officerToken,
  zone,
  sensor,
  reading,
  alert,
  inspection,
  incident;
const auth = (token) => ({ Authorization: 'Bearer ' + token });
const login = (email, pass = password) =>
  request(app).post('/api/auth/login').send({ email, password: pass });
const inspectionBody = (status) => ({
  zone: zone._id,
  checklist: [{ label: 'Demo signage check', passed: true, remarks: '' }],
  remarks: 'Academic inspection',
  correctiveAction: '',
  status,
});
const incidentBody = (status) => ({
  title: 'Synthetic elevated reading',
  description: 'Review of demonstration threshold event',
  zone: zone._id,
  relatedAlert: alert._id,
  severity: 'WARNING',
  status,
  correctiveAction: 'Demonstration review completed',
  resolutionNotes: status === 'RESOLVED' ? 'Academic exercise closed' : '',
});
describe('RadSafe Phase 1 API', { concurrency: false }, () => {
  before(
    async () => {
      repl = await MongoMemoryReplSet.create({
        replSet: { count: 1 },
        binary: {
          downloadDir: new URL('../../.cache/mongodb', import.meta.url).pathname.replace(
            /^\/(\w:)/,
            '$1',
          ),
        },
      });
      await mongoose.connect(repl.getUri());
      mongoose.set('sanitizeFilter', true);
      for (const Model of Object.values(mongoose.models)) await Model.init();
      const passwordHash = await bcrypt.hash(password, 12);
      [admin, officer] = await User.create([
        {
          name: 'Test Admin',
          email: 'admin@example.test',
          employeeId: 'ADM-TEST',
          department: 'Administration',
          role: 'ADMIN',
          passwordHash,
        },
        {
          name: 'Test Officer',
          email: 'officer@example.test',
          employeeId: 'SO-TEST',
          department: 'Safety',
          role: 'SAFETY_OFFICER',
          passwordHash,
        },
      ]);
    },
    { timeout: 240000 },
  );
  after(async () => {
    await mongoose.disconnect();
    await repl?.stop();
  });
  it('logs in successfully and never returns password hashes', async () => {
    const r = await login(admin.email);
    assert.equal(r.status, 200);
    adminToken = r.body.data.token;
    assert.equal(r.body.data.user.role, 'ADMIN');
    assert.ok(!JSON.stringify(r.body).includes('passwordHash'));
    const o = await login(officer.email);
    assert.equal(o.status, 200);
    officerToken = o.body.data.token;
    const me = await request(app).get('/api/auth/me').set(auth(adminToken));
    assert.equal(me.body.data.email, admin.email);
    assert.ok(!('sessionVersion' in me.body.data));
  });
  it('rejects incorrect passwords, unknown email, and inactive accounts', async () => {
    assert.equal((await login(admin.email, 'incorrect')).status, 401);
    assert.equal((await login('unknown@example.test')).status, 401);
    await User.updateOne({ _id: officer._id }, { active: false });
    assert.equal((await login(officer.email)).status, 401);
    assert.equal((await request(app).get('/api/dashboard').set(auth(officerToken))).status, 401);
    await User.updateOne({ _id: officer._id }, { active: true });
  });
  it('rejects missing, invalid, and expired JWTs', async () => {
    assert.equal((await request(app).get('/api/zones')).status, 401);
    assert.equal((await request(app).get('/api/zones').set(auth('invalid'))).status, 401);
    const expired = jwt.sign({ version: 0 }, config.jwtSecret, {
      subject: String(admin._id),
      expiresIn: -1,
      issuer: 'radsafe',
      audience: 'radsafe-client',
    });
    assert.equal((await request(app).get('/api/zones').set(auth(expired))).status, 401);
  });
  it('enforces admin RBAC and prevents admin officer-only mutations', async () => {
    for (const route of ['users', 'audit-logs'])
      assert.equal(
        (
          await request(app)
            .get('/api/' + route)
            .set(auth(officerToken))
        ).status,
        403,
      );
    for (const route of ['radiation', 'inspections', 'incidents'])
      assert.equal(
        (
          await request(app)
            .post('/api/' + route)
            .set(auth(adminToken))
            .send({})
        ).status,
        403,
      );
    assert.equal((await request(app).get('/api/users').set(auth(adminToken))).status, 200);
  });
  it('creates, reads, edits, deactivates, reactivates, and deletes users', async () => {
    const body = {
      name: 'New Officer',
      email: 'new@example.test',
      employeeId: 'SO-NEW',
      department: 'Safety',
      password,
    };
    const r = await request(app).post('/api/users').set(auth(adminToken)).send(body);
    assert.equal(r.status, 201);
    const id = r.body.data._id;
    assert.equal(
      (
        await request(app)
          .get('/api/users/' + id)
          .set(auth(adminToken))
      ).status,
      200,
    );
    assert.equal(
      (
        await request(app)
          .put('/api/users/' + id)
          .set(auth(adminToken))
          .send({ name: 'Updated Officer' })
      ).body.data.name,
      'Updated Officer',
    );
    assert.equal(
      (await request(app).post('/api/users').set(auth(adminToken)).send(body)).status,
      409,
    );
    assert.equal(
      (
        await request(app)
          .post('/api/users')
          .set(auth(adminToken))
          .send({ ...body, email: 'other@example.test' })
      ).status,
      409,
    );
    const token = (await login(body.email)).body.data.token;
    assert.equal(
      (
        await request(app)
          .patch('/api/users/' + id + '/status')
          .set(auth(adminToken))
          .send({ active: false })
      ).status,
      200,
    );
    assert.equal((await request(app).get('/api/auth/me').set(auth(token))).status, 401);
    await request(app)
      .patch('/api/users/' + id + '/status')
      .set(auth(adminToken))
      .send({ active: true });
    assert.equal((await request(app).get('/api/auth/me').set(auth(token))).status, 401);
    assert.equal(
      (
        await request(app)
          .delete('/api/users/' + id)
          .set(auth(adminToken))
      ).status,
      200,
    );
    assert.equal(
      (
        await request(app)
          .get('/api/users/' + id)
          .set(auth(adminToken))
      ).status,
      404,
    );
    assert.equal(
      (
        await request(app)
          .delete('/api/users/' + admin._id)
          .set(auth(adminToken))
      ).status,
      409,
    );
    assert.equal(
      (
        await request(app)
          .post('/api/users')
          .set(auth(adminToken))
          .send({ ...body, role: 'ADMIN' })
      ).status,
      400,
    );
  });
  it('supports zone CRUD and read-only officer access', async () => {
    const body = {
      name: 'Test Reactor',
      code: 'Z-TEST',
      description: 'Synthetic zone',
      status: 'ACTIVE',
    };
    const r = await request(app).post('/api/zones').set(auth(adminToken)).send(body);
    assert.equal(r.status, 201);
    zone = r.body.data;
    assert.equal(
      (
        await request(app)
          .get('/api/zones/' + zone._id)
          .set(auth(officerToken))
      ).status,
      200,
    );
    assert.equal(
      (
        await request(app)
          .put('/api/zones/' + zone._id)
          .set(auth(adminToken))
          .send({ ...body, description: 'Updated' })
      ).status,
      200,
    );
    assert.equal(
      (await request(app).post('/api/zones').set(auth(officerToken)).send(body)).status,
      403,
    );
    const temporary = await request(app)
      .post('/api/zones')
      .set(auth(adminToken))
      .send({ ...body, code: 'Z-TEMP' });
    assert.equal(
      (
        await request(app)
          .delete('/api/zones/' + temporary.body.data._id)
          .set(auth(adminToken))
      ).status,
      200,
    );
  });
  it('supports sensor CRUD and unique sensor codes', async () => {
    const body = {
      sensorCode: 'S-TEST',
      zone: zone._id,
      type: 'Demo monitor',
      status: 'ACTIVE',
      installedAt: new Date(Date.now() - 86400000).toISOString(),
    };
    const r = await request(app).post('/api/sensors').set(auth(adminToken)).send(body);
    assert.equal(r.status, 201);
    sensor = r.body.data;
    assert.equal(
      (await request(app).post('/api/sensors').set(auth(adminToken)).send(body)).status,
      409,
    );
    assert.equal(
      (
        await request(app)
          .get('/api/sensors/' + sensor._id)
          .set(auth(officerToken))
      ).status,
      200,
    );
    assert.equal(
      (
        await request(app)
          .put('/api/sensors/' + sensor._id)
          .set(auth(adminToken))
          .send({ ...body, type: 'Updated demo monitor' })
      ).status,
      200,
    );
    assert.equal(
      (
        await request(app)
          .delete('/api/sensors/' + sensor._id)
          .set(auth(officerToken))
      ).status,
      403,
    );
    const temporary = await request(app)
      .post('/api/sensors')
      .set(auth(adminToken))
      .send({ ...body, sensorCode: 'S-TEMP' });
    assert.equal(
      (
        await request(app)
          .delete('/api/sensors/' + temporary.body.data._id)
          .set(auth(adminToken))
      ).status,
      200,
    );
    assert.equal(
      (
        await request(app)
          .delete('/api/zones/' + zone._id)
          .set(auth(adminToken))
      ).status,
      409,
    );
  });
  it('validates inputs, ObjectIds, query dates, and enums', async () => {
    assert.equal(
      (await request(app).get('/api/zones/not-an-id').set(auth(adminToken))).status,
      400,
    );
    assert.equal(
      (await request(app).get('/api/alerts?status=INVALID').set(auth(adminToken))).status,
      400,
    );
    assert.equal(
      (await request(app).get('/api/radiation?from=2026-09-05&to=2026-01-01').set(auth(adminToken)))
        .status,
      400,
    );
    assert.equal(
      (await request(app).get('/api/users?search[$ne]=x').set(auth(adminToken))).status,
      400,
    );
    assert.equal(
      (
        await request(app).post('/api/users').set(auth(adminToken)).send({
          name: 'X',
          email: 'invalid',
          employeeId: 'X',
          department: 'X',
          password: 'short',
        })
      ).status,
      400,
    );
  });
  it('creates manual readings and automatic alerts at demo boundaries', async () => {
    assert.equal(classifyReading(2.49, config.thresholds), 'NORMAL');
    assert.equal(classifyReading(2.5, config.thresholds), 'WARNING');
    assert.equal(classifyReading(5, config.thresholds), 'CRITICAL');
    const body = {
      sensor: sensor._id,
      zone: zone._id,
      value: 0.4,
      recordedAt: new Date(Date.now() - 60000).toISOString(),
    };
    const normal = await request(app).post('/api/radiation').set(auth(officerToken)).send(body);
    assert.equal(normal.status, 201);
    assert.equal(normal.body.data.alert, null);
    const r = await request(app)
      .post('/api/radiation')
      .set(auth(officerToken))
      .send({ ...body, value: 2.5 });
    assert.equal(r.status, 201);
    reading = r.body.data.reading;
    alert = r.body.data.alert;
    assert.equal(alert.severity, 'WARNING');
    assert.equal(alert.status, 'OPEN');
    assert.equal(reading.demonstrationThresholds.warning, 2.5);
    const critical = await request(app)
      .post('/api/radiation')
      .set(auth(officerToken))
      .send({ ...body, value: 5 });
    assert.equal(critical.body.data.alert.severity, 'CRITICAL');
    assert.equal(
      (
        await request(app)
          .get('/api/radiation/' + reading._id)
          .set(auth(adminToken))
      ).status,
      200,
    );
    assert.equal(
      (
        await request(app)
          .get('/api/radiation/zone/' + zone._id)
          .set(auth(officerToken))
      ).body.data.total,
      3,
    );
    assert.equal(
      (
        await request(app)
          .post('/api/radiation')
          .set(auth(officerToken))
          .send({ ...body, value: -1 })
      ).status,
      400,
    );
    assert.equal(
      (
        await request(app)
          .post('/api/radiation')
          .set(auth(officerToken))
          .send({ ...body, value: '3' })
      ).status,
      400,
    );
    assert.equal(
      (
        await request(app)
          .post('/api/radiation')
          .set(auth(officerToken))
          .send({ ...body, recordedAt: new Date(Date.now() + 86400000).toISOString() })
      ).status,
      400,
    );
    assert.equal(
      (
        await request(app)
          .delete('/api/sensors/' + sensor._id)
          .set(auth(adminToken))
      ).status,
      409,
    );
  });
  it('rejects inactive sensors and zone/sensor mismatches without partial writes', async () => {
    const other = await Zone.create({ name: 'Other', code: 'OTHER' });
    const body = {
      sensor: sensor._id,
      zone: other.id,
      value: 3,
      recordedAt: new Date().toISOString(),
    };
    const count = await RadiationReading.countDocuments();
    assert.equal(
      (await request(app).post('/api/radiation').set(auth(officerToken)).send(body)).status,
      400,
    );
    await Sensor.updateOne({ _id: sensor._id }, { status: 'INACTIVE' });
    assert.equal(
      (
        await request(app)
          .post('/api/radiation')
          .set(auth(officerToken))
          .send({ ...body, zone: zone._id })
      ).status,
      409,
    );
    assert.equal(await RadiationReading.countDocuments(), count);
    await Sensor.updateOne({ _id: sensor._id }, { status: 'ACTIVE' });
  });
  it('acknowledges and resolves alerts with enforced transitions and actor timestamps', async () => {
    const path = '/api/alerts/' + alert._id;
    assert.equal(
      (
        await request(app)
          .patch(path + '/resolve')
          .set(auth(officerToken))
          .send({})
      ).status,
      409,
    );
    assert.equal(
      (
        await request(app)
          .patch(path + '/acknowledge')
          .set(auth(adminToken))
          .send({})
      ).status,
      403,
    );
    const ack = await request(app)
      .patch(path + '/acknowledge')
      .set(auth(officerToken))
      .send({});
    assert.equal(ack.body.data.status, 'ACKNOWLEDGED');
    assert.equal(ack.body.data.acknowledgedBy, String(officer._id));
    assert.ok(ack.body.data.acknowledgedAt);
    const resolved = await request(app)
      .patch(path + '/resolve')
      .set(auth(officerToken))
      .send({});
    assert.equal(resolved.body.data.status, 'RESOLVED');
    assert.ok(resolved.body.data.resolvedAt);
    assert.equal(
      (
        await request(app)
          .patch(path + '/acknowledge')
          .set(auth(officerToken))
          .send({})
      ).status,
      409,
    );
  });
  it('creates and completes inspections with failed-item validation', async () => {
    const r = await request(app)
      .post('/api/inspections')
      .set(auth(officerToken))
      .send(inspectionBody('PENDING'));
    assert.equal(r.status, 201);
    inspection = r.body.data;
    const path = '/api/inspections/' + inspection._id;
    assert.equal(
      (await request(app).put(path).set(auth(officerToken)).send(inspectionBody('COMPLETED')))
        .status,
      409,
    );
    assert.equal(
      (await request(app).put(path).set(auth(officerToken)).send(inspectionBody('IN_PROGRESS')))
        .status,
      200,
    );
    assert.equal(
      (
        await request(app)
          .put(path)
          .set(auth(officerToken))
          .send({
            ...inspectionBody('COMPLETED'),
            checklist: [{ label: 'Check', passed: null, remarks: '' }],
          })
      ).status,
      400,
    );
    const failed = {
      ...inspectionBody('COMPLETED'),
      checklist: [{ label: 'Check', passed: false, remarks: 'Synthetic defect' }],
    };
    assert.equal((await request(app).put(path).set(auth(officerToken)).send(failed)).status, 400);
    const completed = await request(app)
      .put(path)
      .set(auth(officerToken))
      .send({ ...failed, correctiveAction: 'Synthetic defect corrected' });
    assert.equal(completed.status, 200);
    assert.ok(completed.body.data.startedAt);
    assert.ok(completed.body.data.completedAt);
    assert.equal(
      (await request(app).put(path).set(auth(officerToken)).send(inspectionBody('IN_PROGRESS')))
        .status,
      409,
    );
  });
  it('creates, investigates, and resolves linked incidents', async () => {
    const r = await request(app)
      .post('/api/incidents')
      .set(auth(officerToken))
      .send(incidentBody('OPEN'));
    assert.equal(r.status, 201);
    incident = r.body.data;
    const path = '/api/incidents/' + incident._id;
    assert.equal(
      (await request(app).put(path).set(auth(officerToken)).send(incidentBody('RESOLVED'))).status,
      409,
    );
    assert.equal(
      (await request(app).put(path).set(auth(officerToken)).send(incidentBody('INVESTIGATING')))
        .status,
      200,
    );
    assert.equal(
      (
        await request(app)
          .put(path)
          .set(auth(officerToken))
          .send({ ...incidentBody('RESOLVED'), resolutionNotes: '' })
      ).status,
      400,
    );
    const resolved = await request(app)
      .put(path)
      .set(auth(officerToken))
      .send(incidentBody('RESOLVED'));
    assert.equal(resolved.status, 200);
    assert.ok(resolved.body.data.resolvedAt);
    assert.equal(
      (await request(app).put(path).set(auth(officerToken)).send(incidentBody('OPEN'))).status,
      409,
    );
  });
  it('returns dashboard counts, filtered summaries and personnel profiles', async () => {
    const d = await request(app).get('/api/dashboard').set(auth(adminToken));
    assert.equal(d.status, 200);
    assert.equal(d.body.data.counts.totalUsers, 2);
    assert.equal(d.body.data.counts.openAlerts, 1);
    assert.equal(d.body.data.overallStatus, 'CRITICAL');
    const s = await request(app)
      .get('/api/reports?kind=radiation&zone=' + zone._id + '&status=WARNING')
      .set(auth(adminToken));
    assert.equal(s.status, 200);
    assert.equal(s.body.data.totals.count, 1);
    assert.equal(s.body.data.totals.average, 2.5);
    const noMatches = await request(app)
      .get('/api/reports?kind=radiation&from=2000-01-01&to=2000-01-02')
      .set(auth(officerToken));
    assert.equal(noMatches.body.data.totals.count, 0);
    const p = await request(app)
      .get('/api/personnel?department=Safety&search=Officer')
      .set(auth(officerToken));
    assert.equal(p.status, 200);
    assert.equal(p.body.data.total, 1);
    assert.ok(!JSON.stringify(p.body).includes('passwordHash'));
    for (const kind of ['alerts', 'inspections', 'incidents'])
      assert.equal(
        (
          await request(app)
            .get('/api/reports?kind=' + kind)
            .set(auth(adminToken))
        ).status,
        200,
      );
  });
  it('records important audit events without secrets', async () => {
    const rows = await AuditLog.find().lean();
    const actions = rows.map((r) => r.action);
    for (const action of [
      'LOGIN',
      'CREATE_USER',
      'UPDATE_USER',
      'DELETE_USER',
      'CREATE_ZONE',
      'CREATE_SENSOR',
      'CREATE_READING',
      'ACKNOWLEDGE_ALERT',
      'RESOLVE_ALERT',
      'CREATE_INSPECTION',
      'COMPLETE_INSPECTION',
      'CREATE_INCIDENT',
      'RESOLVE_INCIDENT',
    ])
      assert.ok(actions.includes(action), action);
    const serialized = JSON.stringify(rows);
    assert.ok(!serialized.includes(password));
    assert.ok(!serialized.includes(adminToken));
    assert.ok(!serialized.includes('passwordHash'));
  });
  it('seeds the first admin idempotently without resetting passwords', async () => {
    process.env.SEED_ADMIN_NAME = 'Seed Admin';
    process.env.SEED_ADMIN_EMAIL = 'seed@example.test';
    process.env.SEED_ADMIN_PASSWORD = password;
    await seedAdmin();
    await seedAdmin();
    assert.equal(await User.countDocuments({ email: 'seed@example.test' }), 1);
  });
  it('revokes JWT sessions on logout', async () => {
    assert.equal((await request(app).post('/api/auth/logout').set(auth(officerToken))).status, 200);
    assert.equal((await request(app).get('/api/auth/me').set(auth(officerToken))).status, 401);
  });
});
