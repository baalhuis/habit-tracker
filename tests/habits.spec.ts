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

// ── Core CRUD ─────────────────────────────────────────────────────────────

// Helper: add a habit via the UI
async function addHabitViaUI(page: import('@playwright/test').Page, name: string) {
  await page.fill('input[placeholder="Add a new habit…"]', name)
  await page.click('button[type="submit"]')
  await expect(page.locator('li').filter({ hasText: name })).toBeVisible()
}

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
  await expect(habitRow.getByTestId('streak')).toBeVisible()
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

test('progress bar increments when checking a habit', async ({ page }) => {
  await page.goto('/')
  await page.fill('input[placeholder="Add a new habit…"]', `${TEST_PREFIX} Habit A`)
  await page.click('button[type="submit"]')
  await expect(page.getByText(`${TEST_PREFIX} Habit A`)).toBeVisible()

  // Read the current done count before checking
  const counterBefore = await page.getByTestId('progress-counter').textContent() ?? '0/0'
  const doneBefore = parseInt(counterBefore.split('/')[0])

  const habitRow = page.locator('li').filter({ hasText: `${TEST_PREFIX} Habit A` })
  await habitRow.locator('button[aria-label="Mark complete"]').click()

  // Done count should increase by 1
  await expect(page.getByTestId('progress-counter')).toContainText(`${doneBefore + 1}/`)
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

// ── Edit & emoji ───────────────────────────────────────────────────────────

test('can edit a habit name and frequency', async ({ page }) => {
  await page.goto('/')
  await page.fill('input[placeholder="Add a new habit…"]', `${TEST_PREFIX} Original`)
  await page.click('button[type="submit"]')
  await expect(page.locator('li').filter({ hasText: `${TEST_PREFIX} Original` })).toBeVisible()

  await page.locator('li').filter({ hasText: `${TEST_PREFIX} Original` })
    .locator('button[aria-label="Edit habit"]').click()

  // After clicking edit the li's visible text changes to the input value,
  // so find the form fields directly (only one edit form is open at a time)
  const nameInput = page.locator('input[aria-label="Edit habit name"]')
  await expect(nameInput).toBeVisible()
  await nameInput.fill(`${TEST_PREFIX} Renamed`)

  await page.getByRole('button', { name: 'Save' }).click()

  await expect(page.getByText(`${TEST_PREFIX} Renamed`)).toBeVisible()
  await expect(page.getByText(`${TEST_PREFIX} Original`)).not.toBeVisible()
})

test('can set an emoji on a habit', async ({ page }) => {
  await page.goto('/')
  await page.locator('button[aria-label="Pick emoji"]').click()
  await page.locator('button:has-text("💧")').click()
  await page.fill('input[placeholder="Add a new habit…"]', `${TEST_PREFIX} Emoji`)
  await page.click('button[type="submit"]')

  const habitRow = page.locator('li').filter({ hasText: `${TEST_PREFIX} Emoji` })
  await expect(habitRow.getByText('💧')).toBeVisible()
})


// ── Calendar tab ───────────────────────────────────────────────────────────

test('can switch to calendar tab', async ({ page }) => {
  await page.goto('/')
  await page.click('button:has-text("Calendar")')
  await expect(page.getByRole('button', { name: 'Week' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Month' })).toBeVisible()
})

test('calendar weekly view shows habits as rows with day columns', async ({ page }) => {
  await page.goto('/')
  await addHabitViaUI(page, `${TEST_PREFIX} Calendar Test`)

  await page.click('button:has-text("Calendar")')
  await expect(page.getByText(`${TEST_PREFIX} Calendar Test`)).toBeVisible()

  // Should show 7 day columns (Mon–Sun)
  for (const day of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']) {
    await expect(page.getByText(day, { exact: true }).first()).toBeVisible()
  }
})

test('can mark a habit complete from the calendar weekly view', async ({ page }) => {
  await page.goto('/')
  await addHabitViaUI(page, `${TEST_PREFIX} Retro`)

  await page.click('button:has-text("Calendar")')
  await expect(page.getByText(`${TEST_PREFIX} Retro`)).toBeVisible()

  // Click today's cell for this habit
  const today = new Date()
  const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const cell = page.locator(`button[aria-label*="${TEST_PREFIX} Retro"][aria-label*="${dateStr}"]`)
  await cell.click()
  // Cell should now show a checkmark (aria-label changes to "Unmark")
  await expect(page.locator(`button[aria-label*="Unmark"][aria-label*="${TEST_PREFIX} Retro"]`)).toBeVisible()
})

test('can switch calendar to month view', async ({ page }) => {
  await page.goto('/')
  await addHabitViaUI(page, `${TEST_PREFIX} Monthly`)

  await page.click('button:has-text("Calendar")')
  await page.click('button:has-text("Month")')

  // Should show per-habit mini calendar with the habit name
  await expect(page.getByText(`${TEST_PREFIX} Monthly`)).toBeVisible()
  // Month day headers should appear
  await expect(page.getByText('Mo').first()).toBeVisible()
})

test('calendar month view places dates in correct weekday columns', async ({ page }) => {
  await page.goto('/')
  await addHabitViaUI(page, `${TEST_PREFIX} GridCheck`)

  await page.click('button:has-text("Calendar")')
  await page.click('button:has-text("Month")')

  // Wait for the mini calendar to finish loading (loading spinner disappears)
  await expect(page.getByText('Loading…')).not.toBeVisible({ timeout: 10000 })
  // Wait for at least one cell button to appear
  await expect(page.locator('button[aria-label*="GridCheck"]').first()).toBeVisible()

  // Navigate to June 2026 if not already there
  const getLabel = () => page.locator('span.font-medium.text-gray-700').textContent()
  let label = await getLabel()
  while (label && !label.includes('June 2026')) {
    const now = new Date()
    const direction = now > new Date(2026, 5, 1) ? 'Previous' : 'Next'
    await page.click(`button[aria-label="${direction}"]`)
    await expect(page.getByText('Loading…')).not.toBeVisible({ timeout: 5000 })
    label = await getLabel()
  }

  const colOf = async (dateStr: string): Promise<number> =>
    page.evaluate((sel) => {
      const btn = document.querySelector(sel)
      const td = btn?.closest('td')
      const tr = td?.closest('tr')
      if (!tr || !td) return -1
      return Array.from(tr.querySelectorAll('td')).indexOf(td)
    }, `button[aria-label*="${dateStr}"]`)

  // June 2026: June 1 = Monday (col 0), June 30 = Tuesday (col 1 = last day)
  expect(await colOf('2026-06-01')).toBe(0)  // Monday → col 0 (Mo)
  expect(await colOf('2026-06-30')).toBe(1)  // Tuesday → col 1 (Tu) — last day
  expect(await colOf('2026-06-07')).toBe(6)  // Sunday → col 6 (Su)
})

// ── Progress bar ───────────────────────────────────────────────────────────

test('progress bar shows scheduled habit count', async ({ page }) => {
  await page.goto('/')

  // Record baseline total
  const counterBase = await page.getByTestId('progress-counter').textContent() ?? '0/0'
  const totalBase = parseInt(counterBase.split('/')[1])

  await page.fill('input[placeholder="Add a new habit…"]', `${TEST_PREFIX} Bar A`)
  await page.click('button[type="submit"]')
  await page.fill('input[placeholder="Add a new habit…"]', `${TEST_PREFIX} Bar B`)
  await page.click('button[type="submit"]')
  await expect(page.getByText(`${TEST_PREFIX} Bar B`)).toBeVisible()

  // Total should have increased by 2 (both are daily)
  await expect(page.getByTestId('progress-counter')).toContainText(`/${totalBase + 2}`)
})

// ── All-done celebration ───────────────────────────────────────────────────

test('shows celebration when all scheduled habits done', async ({ page }) => {
  await page.goto('/')
  await page.fill('input[placeholder="Add a new habit…"]', `${TEST_PREFIX} Only Habit`)
  await page.click('button[type="submit"]')
  await expect(page.getByText(`${TEST_PREFIX} Only Habit`)).toBeVisible()

  // Mark every unchecked habit complete (including pre-existing ones)
  const markComplete = page.locator('button[aria-label="Mark complete"]')
  while ((await markComplete.count()) > 0) {
    await markComplete.first().click()
    await page.waitForTimeout(300)
  }

  await expect(page.getByText('All done for today!')).toBeVisible()
})

// ── Habit reordering ───────────────────────────────────────────────────────

test('can reorder habits with up/down buttons', async ({ page }) => {
  await page.goto('/')
  await page.fill('input[placeholder="Add a new habit…"]', `${TEST_PREFIX} First`)
  await page.click('button[type="submit"]')
  await page.fill('input[placeholder="Add a new habit…"]', `${TEST_PREFIX} Second`)
  await page.click('button[type="submit"]')
  await expect(page.getByText(`${TEST_PREFIX} Second`)).toBeVisible()

  // Compare vertical positions: First should appear above Second initially
  const firstRow = page.locator('li').filter({ hasText: `${TEST_PREFIX} First` })
  const secondRow = page.locator('li').filter({ hasText: `${TEST_PREFIX} Second` })
  const topBefore = await firstRow.boundingBox()
  const topSecondBefore = await secondRow.boundingBox()
  expect(topBefore!.y).toBeLessThan(topSecondBefore!.y)

  // Move Second up until it's above First
  await secondRow.locator('button[aria-label="Move up"]').click()

  // Now Second should be above First
  const topAfter = await firstRow.boundingBox()
  const topSecondAfter = await secondRow.boundingBox()
  expect(topSecondAfter!.y).toBeLessThan(topAfter!.y)
})


test('calendar navigation moves to previous week', async ({ page }) => {
  await page.goto('/')
  await page.click('button:has-text("Calendar")')

  const labelBefore = await page.locator('span.text-sm.font-medium.text-gray-700').textContent()
  await page.click('button[aria-label="Previous"]')
  const labelAfter = await page.locator('span.text-sm.font-medium.text-gray-700').textContent()

  expect(labelAfter).not.toBe(labelBefore)
})
