import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser', fullyParallel: false, workers: 1, timeout: 30_000,
  use: { baseURL: 'http://127.0.0.1:8000', viewport: { width: 390, height: 844 }, timezoneId: 'Europe/Paris', locale: 'fr-FR',
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || '/usr/bin/chromium', args: ['--no-sandbox'] } },
  webServer: { command: 'python3 -m http.server 8000 --bind 127.0.0.1 --directory ..', url: 'http://127.0.0.1:8000/X2/', reuseExistingServer: !process.env.CI },
});
