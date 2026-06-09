import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/index';
import { signTestJwt } from '../helpers/auth';
import { FIXTURES } from '../seed/fixtures';
import { VoteBallot } from '../../src/models/vote-ballot.model';
import { HouseRule } from '../../src/models/house-rule.model';

const auth = (uid: string): string => `Bearer ${signTestJwt(uid)}`;

/**
 * Integration coverage for the Vote route surface.
 *
 * Uses the seeded `flatshare` household (roommates uiMode) — Carol is owner,
 * Eve is admin, Frank is a regular member. Votes are open to any member but
 * `close` is restricted to admin/owner; tally math is exercised end-to-end.
 */
describe('Vote routes', () => {
  it('POST /votes → 201 creates a vote and returns formatted shape with tally', async () => {
    const carol = FIXTURES.user('carol');
    const flatshare = FIXTURES.household('flatshare');
    const res = await request(app)
      .post(`/api/households/${flatshare._id}/votes`)
      .set('Authorization', auth(carol._id.toString()))
      .send({
        proposedRuleTitle: 'No loud music after 22:00',
        proposedRuleText: 'Music must be at a reasonable level after 22:00.',
        deadlineDays: 7,
      });
    expect(res.status).toBe(201);
    expect(res.body.data.vote.proposedRuleTitle).toBe(
      'No loud music after 22:00'
    );
    expect(res.body.data.vote.status).toBe('open');
    expect(res.body.data.vote.threshold).toBe('simple_majority');
    expect(res.body.data.vote.tally).toEqual({
      yes: 0,
      no: 0,
      abstain: 0,
      total: 0,
      eligibleVoters: 3,
      requiredYes: 2, // simple majority of 3 members
    });
  });

  it('POST /votes → 400 on invalid threshold', async () => {
    const carol = FIXTURES.user('carol');
    const flatshare = FIXTURES.household('flatshare');
    const res = await request(app)
      .post(`/api/households/${flatshare._id}/votes`)
      .set('Authorization', auth(carol._id.toString()))
      .send({
        proposedRuleTitle: 'T',
        proposedRuleText: 'B',
        threshold: 'half',
      });
    expect(res.status).toBe(400);
  });

  it('POST /votes → 400 on invalid deadlineDays', async () => {
    const carol = FIXTURES.user('carol');
    const flatshare = FIXTURES.household('flatshare');
    const res = await request(app)
      .post(`/api/households/${flatshare._id}/votes`)
      .set('Authorization', auth(carol._id.toString()))
      .send({
        proposedRuleTitle: 'T',
        proposedRuleText: 'B',
        deadlineDays: 99,
      });
    expect(res.status).toBe(400);
  });

  it('GET /votes → 200 lists votes (with status filter)', async () => {
    const carol = FIXTURES.user('carol');
    const flatshare = FIXTURES.household('flatshare');
    // Seed one so the list is non-empty.
    await request(app)
      .post(`/api/households/${flatshare._id}/votes`)
      .set('Authorization', auth(carol._id.toString()))
      .send({
        proposedRuleTitle: 'List me',
        proposedRuleText: 'List body',
      });
    const res = await request(app)
      .get(`/api/households/${flatshare._id}/votes?status=open`)
      .set('Authorization', auth(carol._id.toString()));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.items)).toBe(true);
    expect(res.body.data.items.length).toBeGreaterThan(0);
    for (const v of res.body.data.items) {
      expect(v.status).toBe('open');
    }
  });

  it('GET /votes → 400 on invalid status query', async () => {
    const carol = FIXTURES.user('carol');
    const flatshare = FIXTURES.household('flatshare');
    const res = await request(app)
      .get(`/api/households/${flatshare._id}/votes?status=not-real`)
      .set('Authorization', auth(carol._id.toString()));
    expect(res.status).toBe(400);
  });

  it('POST /ballot — cast yes then no (change-vote) — only one ballot stored', async () => {
    const carol = FIXTURES.user('carol');
    const eve = FIXTURES.user('eve');
    const flatshare = FIXTURES.household('flatshare');

    const created = await request(app)
      .post(`/api/households/${flatshare._id}/votes`)
      .set('Authorization', auth(carol._id.toString()))
      .send({
        proposedRuleTitle: 'Change-vote test',
        proposedRuleText: 'See if change is recorded.',
      });
    expect(created.status).toBe(201);
    const voteId = created.body.data.vote._id;

    // Eve casts yes.
    const yes = await request(app)
      .post(`/api/households/${flatshare._id}/votes/${voteId}/ballot`)
      .set('Authorization', auth(eve._id.toString()))
      .send({ choice: 'yes' });
    expect(yes.status).toBe(200);
    expect(yes.body.data.vote.tally.yes).toBe(1);
    expect(yes.body.data.vote.myBallot).toBe('yes');

    // Eve changes to no.
    const no = await request(app)
      .post(`/api/households/${flatshare._id}/votes/${voteId}/ballot`)
      .set('Authorization', auth(eve._id.toString()))
      .send({ choice: 'no' });
    expect(no.status).toBe(200);
    expect(no.body.data.vote.tally.yes).toBe(0);
    expect(no.body.data.vote.tally.no).toBe(1);
    expect(no.body.data.vote.myBallot).toBe('no');

    // Exactly one ballot in the collection for (vote, user).
    const ballots = await VoteBallot.find({ voteId, userId: eve._id });
    expect(ballots.length).toBe(1);
    expect(ballots[0].choice).toBe('no');
  });

  it('POST /ballot → 400 on bad choice', async () => {
    const carol = FIXTURES.user('carol');
    const flatshare = FIXTURES.household('flatshare');
    const created = await request(app)
      .post(`/api/households/${flatshare._id}/votes`)
      .set('Authorization', auth(carol._id.toString()))
      .send({ proposedRuleTitle: 'X', proposedRuleText: 'Y' });
    const voteId = created.body.data.vote._id;

    const res = await request(app)
      .post(`/api/households/${flatshare._id}/votes/${voteId}/ballot`)
      .set('Authorization', auth(carol._id.toString()))
      .send({ choice: 'maybe' });
    expect(res.status).toBe(400);
  });

  it('GET /votes/:voteId → 200 returns tally + myBallot relative to caller', async () => {
    const carol = FIXTURES.user('carol');
    const eve = FIXTURES.user('eve');
    const frank = FIXTURES.user('frank');
    const flatshare = FIXTURES.household('flatshare');

    // Use a unanimous vote so all three ballots are recorded — a simple-majority
    // vote would auto-pass on the 2nd yes before Frank's ballot lands.
    const created = await request(app)
      .post(`/api/households/${flatshare._id}/votes`)
      .set('Authorization', auth(carol._id.toString()))
      .send({
        proposedRuleTitle: 'Tally check',
        proposedRuleText: 'Confirm tally + myBallot.',
        threshold: 'unanimous',
      });
    const voteId = created.body.data.vote._id;

    // Carol: yes, Eve: yes, Frank: no (the no auto-rejects but is still recorded).
    await request(app)
      .post(`/api/households/${flatshare._id}/votes/${voteId}/ballot`)
      .set('Authorization', auth(carol._id.toString()))
      .send({ choice: 'yes' });
    await request(app)
      .post(`/api/households/${flatshare._id}/votes/${voteId}/ballot`)
      .set('Authorization', auth(eve._id.toString()))
      .send({ choice: 'yes' });
    await request(app)
      .post(`/api/households/${flatshare._id}/votes/${voteId}/ballot`)
      .set('Authorization', auth(frank._id.toString()))
      .send({ choice: 'no' });

    // Carol's perspective.
    const carolView = await request(app)
      .get(`/api/households/${flatshare._id}/votes/${voteId}`)
      .set('Authorization', auth(carol._id.toString()));
    expect(carolView.status).toBe(200);
    expect(carolView.body.data.vote.tally).toMatchObject({
      yes: 2,
      no: 1,
      abstain: 0,
      total: 3,
      eligibleVoters: 3,
    });
    expect(carolView.body.data.vote.myBallot).toBe('yes');

    // Frank's perspective — same tally, different myBallot.
    const frankView = await request(app)
      .get(`/api/households/${flatshare._id}/votes/${voteId}`)
      .set('Authorization', auth(frank._id.toString()));
    expect(frankView.status).toBe(200);
    expect(frankView.body.data.vote.myBallot).toBe('no');
  });

  it('POST /close → 403 for non-admin member', async () => {
    const carol = FIXTURES.user('carol');
    const frank = FIXTURES.user('frank'); // role=member
    const flatshare = FIXTURES.household('flatshare');

    const created = await request(app)
      .post(`/api/households/${flatshare._id}/votes`)
      .set('Authorization', auth(carol._id.toString()))
      .send({
        proposedRuleTitle: 'Owner-only close',
        proposedRuleText: 'Only owner/admin may close early.',
      });
    const voteId = created.body.data.vote._id;

    const res = await request(app)
      .post(`/api/households/${flatshare._id}/votes/${voteId}/close`)
      .set('Authorization', auth(frank._id.toString()));
    expect(res.status).toBe(403);
  });

  it('POST /ballot → majority yes auto-passes the vote and creates a HouseRule', async () => {
    const carol = FIXTURES.user('carol');
    const eve = FIXTURES.user('eve');
    const flatshare = FIXTURES.household('flatshare'); // 3 members → needs 2 yes

    const created = await request(app)
      .post(`/api/households/${flatshare._id}/votes`)
      .set('Authorization', auth(carol._id.toString()))
      .send({
        proposedRuleTitle: 'Quiet hours rule',
        proposedRuleText: 'No noise after 22:00.',
      });
    const voteId = created.body.data.vote._id;

    // 1st yes: still open (1 of 3, majority needs 2).
    const first = await request(app)
      .post(`/api/households/${flatshare._id}/votes/${voteId}/ballot`)
      .set('Authorization', auth(carol._id.toString()))
      .send({ choice: 'yes' });
    expect(first.body.data.vote.status).toBe('open');

    // 2nd yes reaches >50% of the household → vote auto-passes, no admin close.
    const second = await request(app)
      .post(`/api/households/${flatshare._id}/votes/${voteId}/ballot`)
      .set('Authorization', auth(eve._id.toString()))
      .send({ choice: 'yes' });
    expect(second.body.data.vote.status).toBe('passed');
    expect(typeof second.body.data.vote.closedAt).toBe('string');

    // The HouseRule exists immediately, before any /close call.
    const rules = await HouseRule.find({ sourceVoteId: voteId });
    expect(rules.length).toBe(1);
    expect(rules[0].title).toBe('Quiet hours rule');

    // The vote is already closed — a follow-up /close is a 400.
    const closeRes = await request(app)
      .post(`/api/households/${flatshare._id}/votes/${voteId}/close`)
      .set('Authorization', auth(carol._id.toString()));
    expect(closeRes.status).toBe(400);
  });

  it('POST /ballot → majority no auto-rejects the vote', async () => {
    const carol = FIXTURES.user('carol');
    const eve = FIXTURES.user('eve');
    const flatshare = FIXTURES.household('flatshare'); // 3 members

    const created = await request(app)
      .post(`/api/households/${flatshare._id}/votes`)
      .set('Authorization', auth(carol._id.toString()))
      .send({
        proposedRuleTitle: 'No pets',
        proposedRuleText: 'No pets allowed.',
      });
    const voteId = created.body.data.vote._id;

    await request(app)
      .post(`/api/households/${flatshare._id}/votes/${voteId}/ballot`)
      .set('Authorization', auth(carol._id.toString()))
      .send({ choice: 'no' });
    // 2 of 3 no → a yes-majority (2) is no longer reachable → auto-reject.
    const second = await request(app)
      .post(`/api/households/${flatshare._id}/votes/${voteId}/ballot`)
      .set('Authorization', auth(eve._id.toString()))
      .send({ choice: 'no' });
    expect(second.body.data.vote.status).toBe('rejected');
    expect(await HouseRule.find({ sourceVoteId: voteId })).toHaveLength(0);
  });

  it('GET /votes → 401 when not authenticated', async () => {
    const flatshare = FIXTURES.household('flatshare');
    const res = await request(app).get(
      `/api/households/${flatshare._id}/votes`
    );
    expect(res.status).toBe(401);
  });
});
