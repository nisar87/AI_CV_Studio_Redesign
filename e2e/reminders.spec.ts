import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './support/test';

/** R9.6: reminders on jobs and the daily reminder email. */
type Outbox = {
  to: string;
  subject: string;
  text: string;
  html: string;
  headers?: Record<string, string>;
}[];

const outbox = async (request: import('@playwright/test').APIRequestContext) =>
  ((await (await request.get('/api/test/setup')).json()) as { outbox: Outbox }).outbox;

const addJob = async (
  request: import('@playwright/test').APIRequestContext,
  title = 'Van Driver',
) =>
  (
    (await (
      await request.post('/api/jobs', {
        data: { title, company: 'Swift Logistics', stage: 'applied' },
      })
    ).json()) as { job: { id: string } }
  ).job.id;

const today = (tz: string) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

test('set reminders on a job; they show on the job, the board and Home', async ({ page }) => {
  await page.goto('/jobs');
  const id = await addJob(page.request);
  await page.goto(`/jobs/${id}`);
  const card = page.getByTestId('reminders');
  // Applied with no reminder: one-click follow-up in a week.
  await card.getByRole('button', { name: 'Remind me to follow up in a week' }).click();
  await expect(card.getByTestId('reminder')).toHaveCount(1);
  await expect(card.getByTestId('reminder')).toContainText('Follow up with Swift Logistics');
  // A preset with a note of your own.
  await card.getByLabel('Remind me to…').fill('Call Sara about the shift pattern');
  await card.getByRole('button', { name: 'In 3 days' }).click();
  await expect(card.getByTestId('reminder')).toHaveCount(2);
  await expect(card.getByTestId('reminder').first()).toContainText(
    'Call Sara about the shift pattern',
  );
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual(
    [],
  );

  // Done and undone; delete.
  await card.getByRole('checkbox', { name: 'Call Sara about the shift pattern' }).click();
  await expect(card.getByTestId('reminder')).toHaveCount(1);
  await card.getByText('Done (1)').click();
  await card.getByRole('button', { name: 'Not done' }).click();
  await expect(card.getByTestId('reminder')).toHaveCount(2);
  await card
    .getByRole('button', { name: 'Delete reminder “Call Sara about the shift pattern”' })
    .click();
  await expect(card.getByTestId('reminder')).toHaveCount(1);

  // On the board card and Home.
  await page.goto('/jobs');
  await expect(page.getByTestId('card-reminder')).toContainText('Follow up with Swift Logistics');
  await page.goto('/studio');
  await expect(page.getByTestId('next-reminder')).toContainText('Follow up with Swift Logistics');

  // A day in the past is refused.
  const r = await page.request.post(`/api/jobs/${id}/reminders`, {
    data: { on: '2020-01-01', note: 'x', tz: 'UTC' },
  });
  expect(r.status()).toBe(400);
});

test('the hourly sender emails due reminders once, in one digest, with a way to stop', async ({
  page,
}) => {
  await page.goto('/jobs');
  const request = page.request;
  const a = await addJob(request, 'Van Driver');
  const b = await addJob(request, 'Night Driver');
  const day = today('Asia/Karachi');
  for (const [id, note] of [
    [a, 'Follow up with Swift'],
    [b, 'Send the references'],
  ])
    expect(
      (
        await request.post(`/api/jobs/${id}/reminders`, {
          data: { on: day, note, tz: 'Asia/Karachi' },
        })
      ).status(),
    ).toBe(200);
  // A later one and a done one are not sent.
  await request.post(`/api/jobs/${a}/reminders`, {
    data: { on: addDays(day, 5), note: 'Later', tz: 'Asia/Karachi' },
  });
  const me = (await (await request.get('/api/me')).json()) as { user: { email: string } };

  // Before 8:00 Karachi time nothing is due; after it, one digest with both.
  const before = new Date(`${day}T02:00:00Z`).toISOString(); // 07:00 in Karachi
  const after = new Date(`${day}T03:30:00Z`).toISOString(); // 08:30 in Karachi
  const n0 = (await outbox(request)).length;
  await request.post(`/api/cron/reminders?force=1&now=${before}`);
  expect((await outbox(request)).length).toBe(n0);
  const run = (await (await request.post(`/api/cron/reminders?force=1&now=${after}`)).json()) as {
    emails: number;
  };
  expect(run.emails).toBeGreaterThanOrEqual(1);
  const mine = (await outbox(request)).filter((m) => m.to === me.user.email);
  expect(mine).toHaveLength(1);
  const mail = mine[0]!;
  expect(mail.subject).toBe('2 reminders for today');
  expect(mail.text).toContain(`Follow up with Swift — Van Driver at Swift Logistics\n  `);
  expect(mail.text).toContain(`/jobs/${a}`);
  expect(mail.text).toContain(`/jobs/${b}`);
  expect(mail.text).not.toContain('Later');
  expect(mail.headers?.['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');

  // Sent once: a second run sends nothing more to this person.
  await request.post(`/api/cron/reminders?force=1&now=${after}`);
  expect((await outbox(request)).filter((m) => m.to === me.user.email)).toHaveLength(1);
  // The job page shows it was emailed.
  await page.goto(`/jobs/${a}`);
  await expect(page.getByTestId('reminder').first()).toContainText('emailed');

  // The stop link: GET only asks; POST turns emails off; another token is refused.
  const stop = /Stop reminder emails: (\S+)/.exec(mail.text)![1]!.replace(/^https?:\/\/[^/]+/, '');
  await page.goto(stop);
  await expect(page.getByRole('heading', { name: 'Stop reminder emails?' })).toBeVisible();
  expect(
    ((await (await request.get('/api/me/reminders')).json()) as { emails: boolean }).emails,
  ).toBe(true);
  await page.getByRole('button', { name: 'Stop reminder emails' }).click();
  await expect(page.getByRole('heading', { name: 'Reminder emails are off' })).toBeVisible();
  expect(
    ((await (await request.get('/api/me/reminders')).json()) as { emails: boolean }).emails,
  ).toBe(false);
  const forged = stop.replace(/t=[^&]+/, 't=forged');
  expect(await (await request.post(forged)).text()).toContain('Link not recognised');

  // With emails off, a new due reminder is not emailed; the Account page turns them back on.
  await request.post(`/api/jobs/${b}/reminders`, {
    data: { on: day, note: 'Quiet one', tz: 'Asia/Karachi' },
  });
  await request.post(`/api/cron/reminders?force=1&now=${after}`);
  expect((await outbox(request)).filter((m) => m.to === me.user.email)).toHaveLength(1);
  await page.goto('/account#reminders');
  const box = page.getByLabel(/Email me my job reminders/);
  await expect(box).not.toBeChecked();
  await box.check();
  await expect(box).toBeChecked();
  expect(
    ((await (await request.get('/api/me/reminders')).json()) as { emails: boolean }).emails,
  ).toBe(true);
});

test('another account cannot touch my reminders', async ({ request, browser }) => {
  const id = await addJob(request);
  const r = (await (
    await request.post(`/api/jobs/${id}/reminders`, {
      data: { on: addDays(today('UTC'), 2), note: 'Mine', tz: 'UTC' },
    })
  ).json()) as { job: { reminders: { id: string }[] } };
  const rid = r.job.reminders[0]!.id;
  const ctx = await browser.newContext();
  const { apiSignUp } = await import('./support/auth');
  await apiSignUp(ctx.request);
  expect(
    (await ctx.request.post(`/api/jobs/${id}/reminders`, { data: { on: '2030-01-01' } })).status(),
  ).toBe(404);
  expect(
    (await ctx.request.put(`/api/jobs/${id}/reminders/${rid}`, { data: { done: true } })).status(),
  ).toBe(404);
  expect((await ctx.request.delete(`/api/jobs/${id}/reminders/${rid}`)).status()).toBe(404);
  await ctx.close();
});

test.describe('visitor', () => {
  test.use({ as: 'visitor' });
  test('is asked to sign in', async ({ request }) => {
    expect((await request.get('/api/me/reminders')).status()).toBe(401);
    expect(
      (await request.post('/api/jobs/x/reminders', { data: { on: '2030-01-01' } })).status(),
    ).toBe(401);
  });
});

function addDays(on: string, n: number) {
  const [y, m, d] = on.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
