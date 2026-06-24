import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const TEST_PREFIX = '[TEST]'

async function clearTestHabits() {
  await supabase.from('habits').delete().like('name', `${TEST_PREFIX}%`)
}

test.beforeEach(async () => {
  await clearTestHabits()
})

test.afterEach(async () => {
  await clearTestHabits()
})

test('shows page header and add form', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Habit Tracker' })).toBeVisible()
  await expect(page.getByPlaceholder('Add a new habit…')).toBeVisible()
})

test('can add a habit', async ({ page }) => {
  await page.goto('/')
  await page.fill('input[placeholder="Add a new habit…"]', `${TEST_PREFIX} Drink water`)
  await page.click('button[type="submit"]')
  await expect(page.getByText(`${TEST_PREFIX} Drink water`)).toBeVisible()
})

test('can check off a habit and see streak', async ({ page }) => {
  await page.goto('/')
  await page.fill('input[placeholder="Add a new habit…"]', `${TEST_PREFIX} Exercise`)
  await page.click('button[type="submit"]')

  const habitRow = page.locator('li').filter({ hasText: `${TEST_PREFIX} Exercise` })
  await expect(habitRow).toBeVisible()

  await habitRow.locator('button[aria-label="Mark complete"]').click()
  await expect(habitRow.getByText('🔥')).toBeVisible()
  await expect(habitRow.locator('button[aria-label="Mark incomplete"]')).toBeVisible()
})

test('can uncheck a completed habit', async ({ page }) => {
  await page.goto('/')
  await page.fill('input[placeholder="Add a new habit…"]', `${TEST_PREFIX} Meditate`)
  await page.click('button[type="submit"]')

  const habitRow = page.locator('li').filter({ hasText: `${TEST_PREFIX} Meditate` })
  await habitRow.locator('button[aria-label="Mark complete"]').click()
  await expect(habitRow.locator('button[aria-label="Mark incomplete"]')).toBeVisible()

  await habitRow.locator('button[aria-label="Mark incomplete"]').click()
  await expect(habitRow.locator('button[aria-label="Mark complete"]')).toBeVisible()
  await expect(habitRow.getByText('🔥')).not.toBeVisible()
})

test('can delete a habit', async ({ page }) => {
  await page.goto('/')
  await page.fill('input[placeholder="Add a new habit…"]', `${TEST_PREFIX} Read`)
  await page.click('button[type="submit"]')

  const habitRow = page.locator('li').filter({ hasText: `${TEST_PREFIX} Read` })
  await expect(habitRow).toBeVisible()

  await habitRow.locator('button[aria-label="Delete habit"]').click()
  await expect(page.getByText(`${TEST_PREFIX} Read`)).not.toBeVisible()
})

test('completion summary increments when checking a habit', async ({ page }) => {
  await page.goto('/')
  await page.fill('input[placeholder="Add a new habit…"]', `${TEST_PREFIX} Habit A`)
  await page.click('button[type="submit"]')
  await expect(page.getByText(`${TEST_PREFIX} Habit A`)).toBeVisible()

  // Capture the summary before checking
  const summaryBefore = await page.locator('p.text-center').last().textContent() ?? ''
  const [doneBefore] = summaryBefore.match(/\d+/) ?? ['0']

  const habitRow = page.locator('li').filter({ hasText: `${TEST_PREFIX} Habit A` })
  await habitRow.locator('button[aria-label="Mark complete"]').click()

  // Summary should show one more completion
  const expectedDone = parseInt(doneBefore) + 1
  await expect(page.locator('p.text-center').last()).toContainText(`${expectedDone} /`)
})
