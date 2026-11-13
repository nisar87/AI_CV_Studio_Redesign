import AxeBuilder from '@axe-core/playwright';
import { request as pwRequest } from '@playwright/test';
import { apiSignUp } from './support/auth';
import { expect, test } from './support/test';
import { seedDocument } from './support/seed';
import { driver } from '../src/modules/resume/fixtures';

/** R9.3: story bank — STAR stories written once, used in mock interviews, the coach and letters. */
const ADVERT = [
  'Multi-drop Delivery Driver, Leicester.',
  'You will plan delivery routes each morning to meet timed delivery slots.',
  'Essential: a forklift licence and two years of cold-chain experience are required.',
].join('\n');

const axeClean = async (page: import('@playwright/test').Page) => {
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual(
    [],
  );
};

test('Premium: draft a story from a CV point, edit, save, and find it from Coach', async ({
  page,
}) => {
  await seedDocument(page, driver);
  await page.goto('/coach');
  await page.getByRole('link', { name: 'Open my stories' }).click();
  await expect(page).toHaveURL(/\/stories$/);
  await expect(page.getByText('Your first story')).toBeVisible();
  await page.getByRole('button', { name: 'New story' }).click();
  const editor = page.getByTestId('story-editor');
  await axeClean(page);

  // Draft from the first point of the CV (an AI action).
  await editor.getByLabel('Anything to add?').fill('The depot manager thanked me for it.');
  await editor.getByRole('button', { name: 'Draft with AI' }).click();
  await expect(editor.getByLabel('Action')).not.toHaveValue('', { timeout: 30_000 });
  await expect(editor.getByLabel('Action')).toHaveValue(/thanked me/);
  await expect(editor.getByLabel('Title')).not.toHaveValue('');
  // Edit it: a new title and a skill tag; the tag list offers the CV's skills.
  await editor.getByLabel('Title').fill('Kept every slot after a depot closed');
  await editor.getByLabel('Add a skill').fill('Problem solving');
  await editor.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(editor.getByRole('button', { name: 'Remove Problem solving' })).toBeVisible();
  await editor.getByRole('button', { name: 'Save story' }).click();
  const story = page.getByTestId('story');
  await expect(story).toHaveCount(1);
  await expect(story).toContainText('Kept every slot after a depot closed');
  await expect(story).toContainText('Problem solving');
  await expect(page.getByTestId('story-count')).toHaveText('1 of 50 stories');

  // Kept after a reload; editing keeps it one story.
  await page.reload();
  await page.getByRole('button', { name: 'Edit “Kept every slot after a depot closed”' }).click();
  await page.getByTestId('story-editor').getByLabel('Result').fill('Every timed slot was met.');
  await page.getByRole('button', { name: 'Save story' }).click();
  await expect(page.getByTestId('story')).toHaveCount(1);
  await expect(page.getByTestId('story')).toContainText('Every timed slot was met.');

  const ent = (await (await page.request.get('/api/me/entitlements')).json()) as {
    usage: Record<string, number>;
  };
  expect(ent.usage['ai.action']).toBe(1);

  // Delete.
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Delete “Kept every slot after a depot closed”' }).click();
  await expect(page.getByTestId('story')).toHaveCount(0);
});

test('Premium: the mock interview offers a fitting story and saves a good answer', async ({
  page,
}) => {
  await seedDocument(page, driver);
  await page.goto('/coach');
  await page.request.post('/api/stories', {
    data: {
      title: 'Re-planned routes when a depot closed',
      situation: 'Our depot closed for a week.',
      action: 'I re-planned forty drops a day across two vans.',
      result: 'Every timed slot was met.',
      skills: ['Problem solving'],
    },
  });
  const job = (await (
    await page.request.post('/api/jobs', {
      data: { title: 'Delivery Driver', company: 'Fresh Foods Ltd', advert: ADVERT },
    })
  ).json()) as { job: { id: string } };
  await page.goto(`/jobs/${job.job.id}#mock`);
  const mock = page.getByTestId('mock');
  await mock.getByRole('button', { name: 'Start the mock interview' }).click();
  await expect(mock.getByTestId('mock-question')).toBeVisible({ timeout: 30_000 });
  // Question 1 (motivation) has no fitting story.
  await expect(mock.getByTestId('mock-stories')).toHaveCount(0);
  await mock
    .getByLabel('Your answer')
    .fill(
      'When a colleague was off sick I re-planned both routes and as a result every parcel arrived on time.',
    );
  await mock.getByRole('button', { name: 'Send answer' }).click();
  await expect(mock.getByTestId('mock-feedback')).toHaveCount(1, { timeout: 30_000 });
  // Question 2: "Tell me about a time you solved a problem" → the problem-solving story.
  await expect(mock.getByTestId('mock-stories')).toContainText(
    'Re-planned routes when a depot closed',
  );
  await mock.getByRole('button', { name: 'Use this story' }).click();
  await expect(mock.getByLabel('Your answer')).toHaveValue(
    'Our depot closed for a week. I re-planned forty drops a day across two vans. Every timed slot was met.',
  );
  await axeClean(page);

  // The first answer was strong: save it to the story bank.
  await mock.getByRole('button', { name: 'Save to my story bank' }).first().click();
  await expect(mock.getByText('Saved to your')).toBeVisible();
  const list = (await (await page.request.get('/api/stories')).json()) as {
    stories: { title: string; source: { kind: string }; action: string }[];
  };
  expect(list.stories).toHaveLength(2);
  const saved = list.stories.find((s) => s.source.kind === 'mock')!;
  expect(saved.title).toBe('Why do you want this Delivery Driver role');
  expect(saved.action).toMatch(/^When a colleague was off sick/);
});

test.describe('free account', () => {
  test.use({ as: 'free' });
  test('keeps 3 stories written by hand; AI drafting is Premium', async ({ page }) => {
    await seedDocument(page, driver);
    await page.goto('/stories');
    for (const t of ['One', 'Two', 'Three']) {
      const r = await page.request.post('/api/stories', {
        data: { title: `Story ${t}`, action: 'I did the work myself.' },
      });
      expect(r.status()).toBe(200);
    }
    const fourth = await page.request.post('/api/stories', { data: { title: 'Story Four' } });
    expect(fourth.status()).toBe(402);
    await page.reload();
    await expect(page.getByTestId('story')).toHaveCount(3);
    await expect(page.getByTestId('story-count')).toHaveText('3 of 3 stories');
    await expect(page.getByRole('button', { name: 'New story' })).toBeDisabled();
    await expect(page.getByText('Your plan keeps up to 3 stories.')).toBeVisible();

    // Drafting with AI is refused for a free account, with a clear message.
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: 'Delete “Story Three”' }).click();
    await expect(page.getByTestId('story')).toHaveCount(2);
    await page.getByRole('button', { name: 'New story' }).click();
    await page.getByRole('button', { name: 'Draft with AI' }).click();
    await expect(page.getByText(/Premium/).first()).toBeVisible({ timeout: 15_000 });
    const r = await page.request.post('/api/stories/draft', {
      data: { document: driver, point: 'J1.B1' },
    });
    expect(r.status()).toBe(402);
  });
});

test.describe('visitor', () => {
  test.use({ as: 'visitor' });
  test('is asked to sign in', async ({ page, request }) => {
    expect((await request.get('/api/stories')).status()).toBe(401);
    expect((await request.post('/api/stories', { data: { title: 'x' } })).status()).toBe(401);
    await page.goto('/stories');
    await expect(page.getByText('Sign in to keep your stories')).toBeVisible();
  });
});

test('another account cannot read or change a story', async ({ request, baseURL }) => {
  const r = (await (
    await request.post('/api/stories', { data: { title: 'Mine', action: 'I did it.' } })
  ).json()) as { story: { id: string } };
  const other = await pwRequest.newContext({ baseURL });
  await apiSignUp(other);
  expect((await other.get(`/api/stories/${r.story.id}`)).status()).toBe(404);
  expect(
    (await other.put(`/api/stories/${r.story.id}`, { data: { title: 'Theirs' } })).status(),
  ).toBe(404);
  expect((await other.delete(`/api/stories/${r.story.id}`)).status()).toBe(404);
  await other.dispose();
});
