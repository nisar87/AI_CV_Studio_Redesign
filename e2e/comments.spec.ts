import AxeBuilder from '@axe-core/playwright';
import type { Browser, Page } from '@playwright/test';
import { expect, test } from './support/test';
import { seedDocument } from './support/seed';
import { driver } from '../src/modules/resume/fixtures';

/** R9.7: comments for reviewers on share links (complete-studio-spec §9.1). */
type Outbox = { to: string; subject: string; text: string; html: string }[];

const job = driver.sections.find((s) => s.kind === 'experience')!.items[0] as {
  id: string;
  role: string;
  bullets: string[];
};
const bullet = job.bullets[0]!;

const serious = async (page: Page) =>
  (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  );

/** A reviewer: a separate browser with no account, on its own network address. */
const reviewer = async (browser: Browser) => {
  const ctx = await browser.newContext({
    extraHTTPHeaders: {
      'x-forwarded-for': `10.9.${Math.floor(Math.random() * 250)}.${Date.now() % 250}`,
    },
  });
  return { ctx, page: await ctx.newPage() };
};

/** Seeds the driver CV into a signed-in account and creates its share link. */
async function shareLink(page: Page) {
  await seedDocument(page, driver);
  await page.goto('/cv');
  await expect
    .poll(async () => (await page.request.get(`/api/documents/${driver.id}`)).status(), {
      timeout: 15_000,
    })
    .toBe(200);
  await page.goto(`/cv/${driver.id}/download`);
  const panel = page.getByTestId('share-panel');
  await panel.getByRole('button', { name: 'Create a link' }).click();
  return panel.getByLabel('Link to your CV').inputValue();
}

test.describe('free account', () => {
  test.use({ as: 'free' });

  test('reviewer comments on a line; owner is emailed once, reads, shows, marks done, deletes', async ({
    page,
    browser,
    isMobile,
  }) => {
    page.on('dialog', (d) => void d.accept());
    const link = await shareLink(page);
    const token = link.split('/').pop()!;
    const panel = page.getByTestId('share-panel');

    // Comments are off until the owner turns them on.
    const r1 = await reviewer(browser);
    await r1.page.goto(link);
    await expect(r1.page.getByRole('heading', { name: 'Imran Qureshi', level: 1 })).toBeVisible();
    await expect(r1.page.getByTestId('review-panel')).toHaveCount(0);
    expect(
      (
        await r1.page.request.post(`/api/s/${token}/comments`, {
          data: { text: 'Hi', author: 'X', key: 'k'.repeat(32) },
        })
      ).status(),
    ).toBe(404);

    await panel.getByLabel('Let people with the link leave comments').check();
    await expect(page.getByText('Comments are on for this link')).toBeVisible();
    await expect(panel.getByLabel(/Email me when someone comments/)).toBeChecked();

    // The reviewer clicks a bullet on the CV: the form points at that job and quotes the words.
    // (A dispatched click: Playwright mis-places pointer clicks inside a scaled preview frame.)
    await r1.page.reload();
    const review = r1.page.getByTestId('review-panel');
    await expect(review.getByRole('heading', { name: 'Leave a comment' })).toBeVisible();
    expect(await serious(r1.page)).toEqual([]);
    await r1.page
      .frameLocator('iframe[data-active]')
      .getByText(bullet, { exact: true })
      .dispatchEvent('click');
    await expect(review.getByTestId('review-quote')).toContainText(bullet);
    await expect(review.getByLabel('Which part?')).toHaveValue(/\//);
    await expect(review.getByLabel('Which part?').locator('option:checked')).toContainText(
      job.role,
    );
    await review
      .getByLabel('Your comment', { exact: true })
      .fill('Start this point with the result.');
    await review.getByLabel('Your name').fill('Sara Mentor');
    // Nothing wider than the screen (long line names in the list once widened the page).
    expect(
      await r1.page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
    ).toBeLessThanOrEqual(0);
    await review.getByRole('button', { name: 'Send comment' }).click();
    await expect(review.getByText(/Sent\. Imran will see it/)).toBeVisible();
    await expect(review.getByTestId('my-comments')).toContainText(
      'Start this point with the result.',
    );

    // A second note, about the whole CV, chosen from the list (the keyboard path). The name is remembered.
    await r1.page.reload();
    await expect(review.getByLabel('Your name')).toHaveValue('Sara Mentor');
    await expect(review.getByTestId('my-comments').getByRole('listitem')).toHaveCount(1);
    await review.getByLabel('Which part?').selectOption({ label: 'The whole CV' });
    await review.getByLabel('Your comment', { exact: true }).fill('Try a two-column design.');
    await review.getByRole('button', { name: 'Send comment' }).click();
    await expect(review.getByRole('heading', { name: 'Your comments (2)' })).toBeVisible();
    // A third, then taken back.
    await review.getByLabel('Your comment', { exact: true }).fill('Oops, wrong CV');
    await review.getByRole('button', { name: 'Send comment' }).click();
    await expect(review.getByRole('heading', { name: 'Your comments (3)' })).toBeVisible();
    await review
      .getByTestId('my-comments')
      .getByRole('listitem')
      .filter({ hasText: 'Oops, wrong CV' })
      .getByRole('button', { name: /Delete/ })
      .click();
    await expect(review.getByRole('heading', { name: 'Your comments (2)' })).toBeVisible();

    // Crafted input: a made-up place and words that aren't on the CV are not kept; a robot's
    // honeypot comment is not stored; another reviewer can't see or delete these comments.
    const crafted = (await (
      await r1.page.request.post(`/api/s/${token}/comments`, {
        data: {
          ref: 'basics/password',
          quote: 'Was fired for being late',
          text: 'Crafted',
          author: 'Eve',
          key: 'e'.repeat(32),
        },
      })
    ).json()) as { comment: { id: string; where: string; quote: string } };
    expect(crafted.comment.where).toBe('The whole CV');
    expect(crafted.comment.quote).toBe('');
    const bot = await r1.page.request.post(`/api/s/${token}/comments`, {
      data: { text: 'Buy now', author: 'Bot', key: 'b'.repeat(32), website: 'http://spam' },
    });
    expect(bot.status()).toBe(201);
    const r2 = await reviewer(browser);
    await r2.page.goto(link);
    await expect(r2.page.getByTestId('review-panel')).toBeVisible();
    await expect(r2.page.getByTestId('my-comments')).toHaveCount(0);
    const theirs = (await (
      await r2.page.request.get(`/api/s/${token}/comments`, {
        headers: { 'x-reviewer-key': 'e'.repeat(32) },
      })
    ).json()) as { comments: unknown[] };
    expect(theirs.comments).toHaveLength(1); // only Eve's own key sees Eve's comment
    expect(
      (
        await r2.page.request.delete(`/api/s/${token}/comments/${crafted.comment.id}`, {
          headers: { 'x-reviewer-key': 'z'.repeat(32) },
        })
      ).status(),
    ).toBe(404);
    expect(
      (
        await r2.page.request.delete(`/api/s/${token}/comments/${crafted.comment.id}`, {
          headers: { 'x-reviewer-key': 'e'.repeat(32) },
        })
      ).status(),
    ).toBe(200);
    // Empty or over-long comments are refused with a message.
    const empty = await r2.page.request.post(`/api/s/${token}/comments`, {
      data: { text: '   ', author: 'Sam', key: 's'.repeat(32) },
    });
    expect(empty.status()).toBe(400);

    // One email to the owner for the burst, with no reviewer words or names in it.
    const me = (await (await page.request.get('/api/me')).json()) as { user: { email: string } };
    const box = (await (await page.request.get('/api/test/setup')).json()) as { outbox: Outbox };
    const mails = box.outbox.filter((m) => m.to === me.user.email);
    expect(mails).toHaveLength(1);
    expect(mails[0]!.subject).toContain('New comment on');
    expect(mails[0]!.text).toContain(`/cv/${driver.id}?tab=check#comments`);
    expect(mails[0]!.text + mails[0]!.html).not.toContain('Start this point');
    expect(mails[0]!.text + mails[0]!.html).not.toContain('Sara');

    // The owner sees the count on the download page and on Presence.
    await page.reload();
    await expect(page.getByTestId('share-open-comments')).toHaveText('Read the 2 comments waiting');
    await page.goto('/presence');
    const links = page.getByRole('list', { name: 'Your share links' });
    await expect(links).toContainText('comments on');
    await links.getByRole('link', { name: /2 comments to read/ }).click();

    // The Check tab lists them, open first, with where they are.
    const comments = page.getByTestId('comments');
    await expect(comments.getByRole('heading', { name: 'Comments from reviewers' })).toBeVisible();
    await expect(comments).toContainText('2 to look at');
    const first = comments.locator('[data-comment]').filter({ hasText: 'Start this point' });
    await expect(first).toContainText('Sara Mentor');
    await expect(first).toContainText(job.role);
    await expect(first).toContainText(`“${bullet}”`);
    await expect(comments).not.toContainText('Buy now');
    expect(await serious(page)).toEqual([]);

    // Show me opens the job in the form.
    await first.getByRole('button', { name: 'Show me' }).click();
    await expect(page.locator(`#item-${job.id}`)).toBeInViewport();

    // Mark as done (kept after a reload), then delete the other one.
    await (
      isMobile
        ? page
            .getByRole('navigation', { name: 'Editor views' })
            .getByRole('button', { name: 'Check' })
        : page.getByRole('tab', { name: 'Check' })
    ).click();
    await first.getByRole('button', { name: /Mark as done/ }).click();
    await expect(comments).toContainText('1 to look at');
    await page.reload();
    await expect(comments).toContainText('1 to look at');
    await expect(comments.getByText('Done (1)')).toBeVisible();
    await comments
      .locator('[data-comment]')
      .filter({ hasText: 'Try a two-column design.' })
      .getByRole('button', { name: /Delete/ })
      .click();
    await expect(comments).toContainText('All done');

    // The reviewer sees theirs marked done; the deleted one is gone.
    await r1.page.reload();
    await expect(review.getByRole('heading', { name: 'Your comments (1)' })).toBeVisible();
    await expect(review.getByTestId('my-comments')).toContainText('marked done');

    // Comment emails off, then comments off: the panel goes and posting is refused.
    await page.goto(`/cv/${driver.id}/download`);
    await panel.getByLabel(/Email me when someone comments/).uncheck();
    await expect(page.getByText('Comment emails off')).toBeVisible();
    await panel.getByLabel('Let people with the link leave comments').uncheck();
    await expect(page.getByText('Comments are off for this link')).toBeVisible();
    await r1.page.reload();
    await expect(r1.page.getByTestId('review-panel')).toHaveCount(0);
    expect(
      (
        await r1.page.request.post(`/api/s/${token}/comments`, {
          data: { text: 'Hi', author: 'X', key: 'k'.repeat(32) },
        })
      ).status(),
    ).toBe(404);

    // Other people can't read or change the owner's comments.
    expect((await r1.page.request.get(`/api/documents/${driver.id}/comments`)).status()).toBe(401);

    // Deleting the CV deletes its comments.
    expect((await page.request.delete(`/api/documents/${driver.id}`)).ok()).toBe(true);
    expect((await page.request.get(`/api/documents/${driver.id}/comments`)).status()).toBe(404);
    await r1.ctx.close();
    await r2.ctx.close();
  });
});

test('another account cannot see or change comments on your CV', async ({ page, request }) => {
  // `page` and `request` are two different accounts.
  const link = await shareLink(page);
  await page
    .getByTestId('share-panel')
    .getByLabel('Let people with the link leave comments')
    .check();
  await expect(page.getByText('Comments are on for this link')).toBeVisible();
  const token = link.split('/').pop()!;
  const c = (await (
    await request.post(`/api/s/${token}/comments`, {
      data: { text: 'Nice', author: 'Ann', key: 'n'.repeat(32) },
    })
  ).json()) as { comment: { id: string } };
  expect((await request.get(`/api/documents/${driver.id}/comments`)).status()).toBe(404);
  expect(
    (
      await request.patch(`/api/documents/${driver.id}/comments/${c.comment.id}`, {
        data: { status: 'done' },
      })
    ).status(),
  ).toBe(404);
  expect(
    (await request.delete(`/api/documents/${driver.id}/comments/${c.comment.id}`)).status(),
  ).toBe(404);
  expect(
    (await request.patch(`/api/shares/${token}`, { data: { comments: false } })).status(),
  ).toBe(404);
  const own = (await (await page.request.get(`/api/documents/${driver.id}/comments`)).json()) as {
    comments: { id: string; status: string }[];
  };
  expect(own.comments.map((x) => x.status)).toEqual(['open']);
});
