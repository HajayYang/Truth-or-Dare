import { chromium, expect } from '@playwright/test'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
  args: ['--no-sandbox'],
})
try {
  const html = await readFile(new URL('../dist/微醺时刻.html', import.meta.url), 'utf8')
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, offline: true })
    const page = await context.newPage()
    const errors = []
    const networkRequests = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('request', request => { if (/^https?:/.test(request.url())) networkRequests.push(request.url()) })
    // Managed Chrome blocks file:// navigation. Load the exact exported document
    // into an offline, opaque-origin page instead; no development server is used.
    await page.setContent(html, { waitUntil: 'load' })
    await expect(page.getByRole('heading', { name: '谁是这一轮的主角？' })).toBeVisible()
    await page.getByRole('button', { name: '女生', exact: true }).click()
    await page.getByRole('button', { name: '抽取今晚的第一题', exact: true }).click()
    await expect(page.locator('.question-content')).toBeVisible()
    await expect(page.locator('.question-meta')).toContainText('女生执行')
    await page.getByRole('button', { name: '探索题库', exact: true }).click()
    await expect(page.locator('.results-count')).toContainText('500')
    await page.getByRole('button', { name: '真心话', exact: true }).click()
    await expect(page.locator('.results-count')).toContainText('200')
    await page.getByRole('button', { name: '大冒险', exact: true }).click()
    await expect(page.locator('.results-count')).toContainText('300')
    await page.getByRole('searchbox').fill('D300')
    await expect(page.locator('.library-card')).toHaveCount(1)
    await page.getByRole('button', { name: '收藏 D300', exact: true }).click()
    await expect(page.getByRole('button', { name: '取消收藏 D300', exact: true })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    expect(errors).toEqual([])
    expect(networkRequests).toEqual([])
    console.log(`PASS ${viewport.width}px: exported HTML renders offline; draw, 500/200/300 bank, search, favorites; zero network requests/errors.`)
    await context.close()
  }
} finally {
  await browser.close()
}
