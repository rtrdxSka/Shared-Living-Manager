import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../src/index';
import { connectTestMongo, dropDatabase, disconnectMongoose } from '../helpers/db';
import { authService } from '../../src/services/auth.service';
import { Household } from '../../src/models/household.model';

describe('Test-only routes (__test__)', () => {
  beforeAll(async () => {
    await connectTestMongo();
  });

  beforeEach(async () => {
    await dropDatabase();
  });

  afterAll(async () => {
    await disconnectMongoose();
  });

  describe('POST /api/__test__/reset', () => {
    it('drops all non-system collections', async () => {
      await authService.register({
        email: 'reset@example.com',
        password: 'Password123!',
        firstName: 'R',
        lastName: 'T',
      });
      const before = await mongoose.connection.db!.collection('users').countDocuments();
      expect(before).toBe(1);

      const res = await request(app).post('/api/__test__/reset');
      expect(res.status).toBe(200);

      const after = await mongoose.connection.db!.collection('users').countDocuments();
      expect(after).toBe(0);
    });
  });

  describe('GET /api/__test__/last-token', () => {
    it('returns the latest verify token for a registered user', async () => {
      await authService.register({
        email: 'token@example.com',
        password: 'Password123!',
        firstName: 'T',
        lastName: 'U',
      });

      const res = await request(app)
        .get('/api/__test__/last-token')
        .query({ email: 'token@example.com', type: 'verify' });

      expect(res.status).toBe(200);
      expect(res.body.token).toEqual(expect.any(String));
      expect(res.body.token.length).toBeGreaterThan(20);
    });

    it('returns 404 if no token exists', async () => {
      const res = await request(app)
        .get('/api/__test__/last-token')
        .query({ email: 'nobody@example.com', type: 'verify' });
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/__test__/email-status', () => {
    it('returns booleans for verify/reset email status', async () => {
      await authService.register({
        email: 'status@example.com',
        password: 'Password123!',
        firstName: 'S',
        lastName: 'T',
      });

      const res = await request(app)
        .get('/api/__test__/email-status')
        .query({ email: 'status@example.com' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        verifyEmailSent: expect.any(Boolean),
        resetEmailSent: expect.any(Boolean),
      });
    });
  });

  describe('POST /api/__test__/fast-forward-rotation', () => {
    it('backdates startedAt on a household taskRotationConfig', async () => {
      // Arrange: create user + household with rotation config.
      // Service-first arrange is impossible here: no public service method
      // exposes the rotation-config startedAt setup shape we need to backdate.
      const { user } = await authService.register({
        email: 'rot@example.com',
        password: 'Password123!',
        firstName: 'R',
        lastName: 'O',
      });
      const memberId = new mongoose.Types.ObjectId();
      const household = await Household.create({
        name: 'TestHousehold',
        livingArrangement: 'couple',
        totalMembers: 1,
        uiMode: 'couple',
        createdBy: user._id,
        inviteCode: 'TST123',
        members: [
          {
            _id: memberId,
            userId: user._id,
            nickname: 'Rot',
            ageGroup: 'adult',
            role: 'owner',
            participatesInFinances: true,
            participatesInTasks: true,
            isCreator: true,
          },
        ],
        settings: {
          financeMode: 'split',
          currency: 'BGN',
          taskManagementEnabled: 'full',
          taskDistributionMethod: 'rotation',
          taskRotationConfig: {
            orderedMemberIds: [memberId],
            startedAt: new Date(),
            periodDays: 7,
          },
        },
      });

      const res = await request(app)
        .post('/api/__test__/fast-forward-rotation')
        .send({ householdId: household._id.toString(), daysBack: 8 });

      expect(res.status).toBe(200);
      const fresh = await Household.findById(household._id).lean();
      const startedAt = new Date(fresh!.settings!.taskRotationConfig!.startedAt);
      const ageMs = Date.now() - startedAt.getTime();
      expect(ageMs).toBeGreaterThan(7 * 86400_000);
    });
  });
});
