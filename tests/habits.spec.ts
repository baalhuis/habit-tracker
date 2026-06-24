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

test.beforeEach(async () => { await clearTestHabits() })
test.afterEach(async () => { await clearTestHabits() })

// ── Core CRUD ──────────────────────────────────────────────────────────────

test('shows page header and add form', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Habit Tracker' })).toBeVisible()
  await expect(page.getByPlaceholder('Add a new habit…')).toBeVisible()
})

test('can add a daily habit', async ({ page }) => {
  await page.goto('/')
  await page.fill('input[placeholder="Add a new habit…"]', `${TEST_PREFIX} Drink water`)
  await page.click('button[type="submit"]')
  const habitRow = page.locator('li').filter({ hasText: `${TEST_PREFIX} Drink water` })
  await expect(habitRow).toBeVisible()
  await expect(habitRow.locator('span.text-gray-400').filter({ hasText: 'Daily' })).toBeVisible()
})

test('can check off a habit and see streak', async ({ page }) => {
  await page.goto('/')
  await page.fill('input[placeholder="Add a new habit…"]', `${TEST_PREFIX} Exercise`)
  await page.click('button[type="submit"]')

  const habitRow = page.locator('li').filter({ hasText: `${TEST_PREFIX} Exercise` })
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

  const summaryBefore = await page.locator('p.text-center').last().textContent() ?? ''
  const [doneBefore] = summaryBefore.match(/\d+/) ?? ['0']

  const habitRow = page.locator('li').filter({ hasText: `${TEST_PREFIX} Habit A` })
  await habitRow.locator('button[aria-label="Mark complete"]').click()

  await expect(page.locator('p.text-center').last()).toContainText(`${parseInt(doneBefore) + 1} /`)
})

// ── Frequency picker ───────────────────────────────────────────────────────

test('can add a specific-days habit', async ({ page }) => {
  await page.goto('/')
  await page.fill('input[placeholder="Add a new habit…"]', `${TEST_PREFIX} Run`)

  // Switch to specific days
  await page.click('button:has-text("Specific days")')

  // Deselect all weekdays (Mon–Fri are on by default), select Mon + Wed only
  // Default days are Mon(1)–Fri(5) — indices in the day picker buttons
  const dayButtons = page.locator('form button.rounded-full')
  // Deselect Tue(index 1), Thu(index 3), Fri(index 4) — toggle off
  await dayButtons.nth(2).click() // Tue
  await dayButtons.nth(4).click() // Thu
  await dayButtons.nth(5).click() // Fri

  await page.click('button[type="submit"]')
  await expect(page.getByText(`${TEST_PREFIX} Run`)).toBeVisible()
  // Should show Mon, Wed in the frequency label
  await expect(page.locator('li').filter({ hasText: `${TEST_PREFIX} Run` }).getByText('Mon')).toBeVisible()
})

test('can add a times-per-week habit', async ({ page }) => {
  await page.goto('/')
  await page.fill('input[placeholder="Add a new habit…"]', `${TEST_PREFIX} Gym`)

  await page.click('button:has-text("X per week")')

  // Select 4 times per week
  const countButtons = page.locator('form button.rounded-full')
  await countButtons.filter({ hasText: '4' }).click()

  await page.click('button[type="submit"]')
  await expect(page.getByText(`${TEST_PREFIX} Gym`)).toBeVisible()
  await expect(page.locator('li').filter({ hasText: `${TEST_PREFIX} Gym` }).getByText('4× per week')).toBeVisible()
})

test('times-per-week habit shows weekly progress', async ({ page }) => {
  await page.goto('/')
  await page.fill('input[placeholder="Add a new habit…"]', `${TEST_PREFIX} Swim`)
  await page.click('button:has-text("X per week")')

  // Default is 3 — keep it
  await page.click('button[type="submit"]')
  await expect(page.getByText(`${TEST_PREFIX} Swim`)).toBeVisible()

  const habitRow = page.locator('li').filter({ hasText: `${TEST_PREFIX} Swim` })
  // Should show weekly progress (0/3)
  await expect(habitRow.getByText(/\d+\/\dw/)).toBeVisible()

  // Check off once — progress should go to 1/3
  await habitRow.locator('button[aria-label="Mark complete"]').click()
  await expect(habitRow.getByText('1/3w')).toBeVisible()
})
