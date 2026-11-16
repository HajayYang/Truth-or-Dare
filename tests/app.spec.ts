import { test, expect, type Page } from '@playwright/test'

async function draw(page: Page, first = false) {
  await page.getByRole('button', { name: first ? '抽取今晚的第一题' : '再抽一道', exact: true }).click()
  await expect(page.locator('.question-content')).toBeVisible()
  return (await page.locator('.question-meta').innerText()).match(/#[TD]\d{3}/)![0]
}

test('必须先选执行者，真心话按性别抽取、去重并保存记录', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
  await page.getByRole('button', { name: '抽取今晚的第一题', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('先选一位执行者')
  await expect(page.locator('.question-content')).toHaveCount(0)
  await page.getByRole('button', { name: '男生', exact: true }).click()
  await page.getByRole('group', { name: '选择题目类型' }).getByRole('button', { name: '真心话', exact: true }).click()
  const ids = [await draw(page, true), await draw(page), await draw(page)]
  expect(new Set(ids).size).toBe(3)
  ids.forEach(id => expect(id).toMatch(/^#T/))
  await expect(page.locator('.question-meta')).toContainText('男生执行')
  const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem('after-hours-state')!))
  expect(persisted.seen).toHaveLength(3)
  expect(persisted.history).toHaveLength(3)
  await page.reload()
  await page.getByRole('button', { name: '男生', exact: true }).click()
  await page.getByRole('group', { name: '选择题目类型' }).getByRole('button', { name: '真心话', exact: true }).click()
  expect(ids).not.toContain(await draw(page, true))
  await page.getByRole('button', { name: /本局记录/ }).click()
  await expect(page.getByRole('dialog')).toContainText('已经抽过 4 道题')
  await expect(page.locator('.history-list article')).toHaveCount(4)
  await page.getByRole('button', { name: '关闭弹窗' }).click()
  await page.getByRole('button', { name: '换下一位' }).click()
  await expect(page.getByRole('button', { name: '男生', exact: true })).toHaveAttribute('aria-pressed', 'false')
  await page.getByRole('button', { name: '女生', exact: true }).click()
  await page.getByRole('group', { name: '选择题目类型' }).getByRole('button', { name: '大冒险', exact: true }).click()
  expect(await draw(page, true)).toMatch(/^#D/)
  await expect(page.locator('.question-meta')).toContainText('女生执行')
  expect(errors).toEqual([])
})

test('题库500题可分类、搜索、收藏；收藏刷新后保留', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '探索题库', exact: true }).click()
  await expect(page.locator('.results-count')).toContainText('500')
  await page.getByRole('button', { name: '真心话', exact: true }).click()
  await expect(page.locator('.results-count')).toContainText('200')
  await page.getByRole('button', { name: '大冒险', exact: true }).click()
  await expect(page.locator('.results-count')).toContainText('300')
  await page.getByRole('searchbox').fill('D300')
  await expect(page.locator('.library-card')).toHaveCount(1)
  await page.getByRole('button', { name: '收藏 D300', exact: true }).click()
  await expect(page.getByRole('button', { name: '取消收藏 D300' })).toBeVisible()
  await page.getByRole('searchbox').fill('不存在的题目关键词123')
  await expect(page.getByRole('heading', { name: '没有找到这道题' })).toBeVisible()
  await page.reload()
  await page.getByRole('button', { name: '探索题库', exact: true }).click()
  await page.getByRole('button', { name: '我的收藏 1' }).click()
  await expect(page.locator('.library-card')).toHaveCount(1)
  await expect(page.locator('.library-card')).toContainText('#D300')
  await page.getByRole('button', { name: '取消收藏 D300', exact: true }).click()
  await expect(page.getByRole('heading', { name: '还没有收藏到合适的题目' })).toBeVisible()
})

test('数据库包含500题；禁用IndexedDB和localStorage后仍能游戏', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: '抽取今晚的第一题', exact: true })).toBeEnabled()
  const counts = await page.evaluate(async () => new Promise<Record<string, number>>((resolve, reject) => {
    const open = indexedDB.open('after-hours-questions', 1)
    open.onerror = () => reject(open.error)
    open.onsuccess = () => {
      const read = open.result.transaction('questions').objectStore('questions').getAll()
      read.onsuccess = () => { resolve({ total: read.result.length, truth: read.result.filter(q => q.type === 'truth').length, dare: read.result.filter(q => q.type === 'dare').length }); open.result.close() }
    }
  }))
  expect(counts).toEqual({ total: 500, truth: 200, dare: 300 })
  await page.addInitScript(() => {
    Object.defineProperty(window, 'indexedDB', { get() { throw new DOMException('Storage disabled', 'SecurityError') } })
    Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Storage disabled', 'SecurityError') } })
  })
  await page.reload()
  await page.getByRole('button', { name: '女生', exact: true }).click()
  await draw(page, true)
  await expect(page.locator('.question-content')).toBeVisible()
})

test('动画期间重开取消旧结果，设置开关与键盘弹窗正常', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '男生', exact: true }).click()
  await page.clock.install()
  await page.clock.pauseAt(new Date(Date.now() + 1000))
  await page.getByRole('button', { name: '抽取今晚的第一题', exact: true }).click()
  await expect(page.getByRole('button', { name: '正在抽取…' })).toBeDisabled()
  await page.getByRole('button', { name: '游戏设置' }).click()
  await page.getByRole('switch', { name: '本轮题目不重复' }).click()
  await expect(page.getByRole('switch', { name: '本轮题目不重复' })).toHaveAttribute('aria-checked', 'false')
  await page.getByRole('button', { name: '重开一局' }).click()
  await page.clock.runFor(1000)
  await expect(page.locator('.question-content')).toHaveCount(0)
  await expect(page.locator('.history-count')).toHaveText('0')
  await expect(page.getByRole('button', { name: '男生', exact: true })).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByRole('button', { name: '抽取今晚的第一题', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: '游戏设置' }).click()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('button', { name: '怎么玩', exact: true }).click()
  await expect(page.getByRole('heading', { name: '很简单，开心就好。' })).toBeVisible()
  await page.getByRole('button', { name: '知道了，开局' }).click()
  await expect(page.getByRole('heading', { name: '谁是这一轮的主角？' })).toBeVisible()
})

test('窄屏无横向溢出', async ({ page }) => {
  await page.goto('/')
  for (const width of [360, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
})
