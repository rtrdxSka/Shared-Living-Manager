import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/index';
import { signTestJwt } from '../helpers/auth';
import { FIXTURES } from '../seed/fixtures';

const auth = (uid: string) => `Bearer ${signTestJwt(uid)}`;

/**
 * Integration coverage for the Issue route surface.
 *
 * Uses the seeded `flatshare` household (roommates uiMode) since issues are a
 * roommates-only feature. Carol is owner (role=owner), Eve is admin, Frank is
 * a regular member — handy for exercising admin-vs-member authorization.
 */
describe('Issue routes', () => {
  it('POST /issues → 201 creates an issue', async () => {
    const carol = FIXTURES.user('carol');
    const flatshare = FIXTURES.household('flatshare');
    const res = await request(app)
      .post(`/api/households/${flatshare._id}/issues`)
      .set('Authorization', auth(carol._id.toString()))
      .send({
        title: 'Dishes piling up',
        body: 'The sink has been full for three days.',
        category: 'cleaning',
      });
    expect(res.status).toBe(201);
    expect(res.body.data.issue.title).toBe('Dishes piling up');
    expect(res.body.data.issue.status).toBe('open');
    expect(res.body.data.issue.isMine).toBe(true);
  });

  it('POST /issues → 400 on missing body', async () => {
    const carol = FIXTURES.user('carol');
    const flatshare = FIXTURES.household('flatshare');
    const res = await request(app)
      .post(`/api/households/${flatshare._id}/issues`)
      .set('Authorization', auth(carol._id.toString()))
      .send({ title: 'No body', category: 'cleaning' });
    expect(res.status).toBe(400);
  });

  it('POST /issues → 400 on invalid category', async () => {
    const carol = FIXTURES.user('carol');
    const flatshare = FIXTURES.household('flatshare');
    const res = await request(app)
      .post(`/api/households/${flatshare._id}/issues`)
      .set('Authorization', auth(carol._id.toString()))
      .send({ title: 'Bad cat', body: 'whatever', category: 'not-a-real-cat' });
    expect(res.status).toBe(400);
  });

  it('GET /issues → 200 returns paginated list', async () => {
    const carol = FIXTURES.user('carol');
    const flatshare = FIXTURES.household('flatshare');
    const res = await request(app)
      .get(`/api/households/${flatshare._id}/issues?limit=10`)
      .set('Authorization', auth(carol._id.toString()));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.items)).toBe(true);
    // The POST above created at least one issue.
    expect(res.body.data.items.length).toBeGreaterThan(0);
    expect(res.body.data).toHaveProperty('nextCursor');
  });

  it('POST /upvote → 200 toggles upvote on/off', async () => {
    const carol = FIXTURES.user('carol');
    const eve = FIXTURES.user('eve');
    const flatshare = FIXTURES.household('flatshare');

    // Create a fresh issue (carol authors).
    const created = await request(app)
      .post(`/api/households/${flatshare._id}/issues`)
      .set('Authorization', auth(carol._id.toString()))
      .send({
        title: 'Upvote me',
        body: 'Please.',
        category: 'other',
      });
    expect(created.status).toBe(201);
    const issueId = created.body.data.issue._id;

    // Eve upvotes → hasUpvoted true, count 1.
    const up1 = await request(app)
      .post(`/api/households/${flatshare._id}/issues/${issueId}/upvote`)
      .set('Authorization', auth(eve._id.toString()));
    expect(up1.status).toBe(200);
    expect(up1.body.data.hasUpvoted).toBe(true);
    expect(up1.body.data.upvoteCount).toBe(1);

    // Eve upvotes again → toggled off, count back to 0.
    const up2 = await request(app)
      .post(`/api/households/${flatshare._id}/issues/${issueId}/upvote`)
      .set('Authorization', auth(eve._id.toString()));
    expect(up2.status).toBe(200);
    expect(up2.body.data.hasUpvoted).toBe(false);
    expect(up2.body.data.upvoteCount).toBe(0);
  });

  it('POST /comments → 201 and GET /:issueId returns the comment', async () => {
    const carol = FIXTURES.user('carol');
    const eve = FIXTURES.user('eve');
    const flatshare = FIXTURES.household('flatshare');

    const created = await request(app)
      .post(`/api/households/${flatshare._id}/issues`)
      .set('Authorization', auth(carol._id.toString()))
      .send({
        title: 'Comment thread',
        body: 'Discuss.',
        category: 'noise',
      });
    const issueId = created.body.data.issue._id;

    const comment = await request(app)
      .post(`/api/households/${flatshare._id}/issues/${issueId}/comments`)
      .set('Authorization', auth(eve._id.toString()))
      .send({ body: 'I agree, the music is too loud.' });
    expect(comment.status).toBe(201);
    expect(comment.body.data.comment.body).toBe(
      'I agree, the music is too loud.'
    );
    expect(comment.body.data.comment.isMine).toBe(true);

    const detail = await request(app)
      .get(`/api/households/${flatshare._id}/issues/${issueId}`)
      .set('Authorization', auth(carol._id.toString()));
    expect(detail.status).toBe(200);
    expect(detail.body.data.issue.comments.length).toBe(1);
    expect(detail.body.data.issue.comments[0].body).toBe(
      'I agree, the music is too loud.'
    );
    // Carol is viewing — Eve's comment is not hers.
    expect(detail.body.data.issue.comments[0].isMine).toBe(false);
  });

  it('DELETE /:issueId → 204 by author', async () => {
    const carol = FIXTURES.user('carol');
    const flatshare = FIXTURES.household('flatshare');

    const created = await request(app)
      .post(`/api/households/${flatshare._id}/issues`)
      .set('Authorization', auth(carol._id.toString()))
      .send({ title: 'Delete me', body: 'bye', category: 'other' });
    const issueId = created.body.data.issue._id;

    const res = await request(app)
      .delete(`/api/households/${flatshare._id}/issues/${issueId}`)
      .set('Authorization', auth(carol._id.toString()));
    expect(res.status).toBe(204);
  });

  it('DELETE /:issueId → 403 by non-author non-admin', async () => {
    const carol = FIXTURES.user('carol');
    const frank = FIXTURES.user('frank'); // role=member in flatshare
    const flatshare = FIXTURES.household('flatshare');

    const created = await request(app)
      .post(`/api/households/${flatshare._id}/issues`)
      .set('Authorization', auth(carol._id.toString()))
      .send({ title: "Carol's issue", body: 'mine', category: 'other' });
    const issueId = created.body.data.issue._id;

    const res = await request(app)
      .delete(`/api/households/${flatshare._id}/issues/${issueId}`)
      .set('Authorization', auth(frank._id.toString()));
    expect(res.status).toBe(403);
  });

  it('POST /escalate → 200 returns vote id and transitions status', async () => {
    const carol = FIXTURES.user('carol');
    const flatshare = FIXTURES.household('flatshare');

    const created = await request(app)
      .post(`/api/households/${flatshare._id}/issues`)
      .set('Authorization', auth(carol._id.toString()))
      .send({
        title: 'Quiet hours',
        body: 'Need a rule.',
        category: 'noise',
      });
    const issueId = created.body.data.issue._id;

    const res = await request(app)
      .post(`/api/households/${flatshare._id}/issues/${issueId}/escalate`)
      .set('Authorization', auth(carol._id.toString()))
      .send({
        proposedRuleTitle: 'Quiet hours after 22:00',
        proposedRuleText: 'No loud music or appliances after 22:00 weekdays.',
        deadlineDays: 7,
      });
    expect(res.status).toBe(200);
    expect(typeof res.body.data.vote._id).toBe('string');

    // Issue should now report status=escalated and an escalatedToVoteId.
    const detail = await request(app)
      .get(`/api/households/${flatshare._id}/issues/${issueId}`)
      .set('Authorization', auth(carol._id.toString()));
    expect(detail.status).toBe(200);
    expect(detail.body.data.issue.status).toBe('escalated');
    expect(detail.body.data.issue.escalatedToVoteId).toBe(
      res.body.data.vote._id
    );
  });

  it('POST /escalate → 400 on invalid deadlineDays', async () => {
    const carol = FIXTURES.user('carol');
    const flatshare = FIXTURES.household('flatshare');

    const created = await request(app)
      .post(`/api/households/${flatshare._id}/issues`)
      .set('Authorization', auth(carol._id.toString()))
      .send({ title: 'Esc bad', body: 'x', category: 'other' });
    const issueId = created.body.data.issue._id;

    const res = await request(app)
      .post(`/api/households/${flatshare._id}/issues/${issueId}/escalate`)
      .set('Authorization', auth(carol._id.toString()))
      .send({
        proposedRuleTitle: 'T',
        proposedRuleText: 'Body',
        deadlineDays: 99, // exceeds max=30
      });
    expect(res.status).toBe(400);
  });

  it('GET /moderation → 200 for admin/owner, 403 for member', async () => {
    const carol = FIXTURES.user('carol'); // owner
    const frank = FIXTURES.user('frank'); // role=member
    const flatshare = FIXTURES.household('flatshare');

    const created = await request(app)
      .post(`/api/households/${flatshare._id}/issues`)
      .set('Authorization', auth(carol._id.toString()))
      .send({ title: 'Mod target', body: 'inspect me', category: 'other' });
    const issueId = created.body.data.issue._id;

    const okRes = await request(app)
      .get(`/api/households/${flatshare._id}/issues/${issueId}/moderation`)
      .set('Authorization', auth(carol._id.toString()));
    expect(okRes.status).toBe(200);
    expect(typeof okRes.body.data.issue.authorId).toBe('string');
    expect(typeof okRes.body.data.issue.authorNickname).toBe('string');

    const forbidden = await request(app)
      .get(`/api/households/${flatshare._id}/issues/${issueId}/moderation`)
      .set('Authorization', auth(frank._id.toString()));
    expect(forbidden.status).toBe(403);
  });

  it('GET /issues → 401 when not authenticated', async () => {
    const flatshare = FIXTURES.household('flatshare');
    const res = await request(app).get(
      `/api/households/${flatshare._id}/issues`
    );
    expect(res.status).toBe(401);
  });

  it('GET /issues → 400 on invalid status query', async () => {
    const carol = FIXTURES.user('carol');
    const flatshare = FIXTURES.household('flatshare');
    const res = await request(app)
      .get(`/api/households/${flatshare._id}/issues?status=not-a-status`)
      .set('Authorization', auth(carol._id.toString()));
    expect(res.status).toBe(400);
  });

  it('DELETE /comments/:commentId → 204 by comment author', async () => {
    const carol = FIXTURES.user('carol');
    const eve = FIXTURES.user('eve');
    const flatshare = FIXTURES.household('flatshare');

    const created = await request(app)
      .post(`/api/households/${flatshare._id}/issues`)
      .set('Authorization', auth(carol._id.toString()))
      .send({ title: 'Comment delete', body: 'thread', category: 'other' });
    const issueId = created.body.data.issue._id;

    const comment = await request(app)
      .post(`/api/households/${flatshare._id}/issues/${issueId}/comments`)
      .set('Authorization', auth(eve._id.toString()))
      .send({ body: 'Eve says hi' });
    expect(comment.status).toBe(201);
    const commentId = comment.body.data.comment._id;

    const del = await request(app)
      .delete(
        `/api/households/${flatshare._id}/issues/${issueId}/comments/${commentId}`
      )
      .set('Authorization', auth(eve._id.toString()));
    expect(del.status).toBe(204);
  });
});
