import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    viewport: { width: 390, height: 844 },
    trace: 'on-first-retry'
  },
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
        launchOptions: {
          args: [
            '--host-resolver-rules=MAP soli.vondiego.com 127.0.0.1,MAP tele.vondiego.com 127.0.0.1',
            '--no-proxy-server'
          ]
        }
      }
    },
    {
      name: 'webkit',
      testIgnore: [
        '**/gamepad-config.spec.ts',
        '**/gamepad-nav.spec.ts',
        '**/gamepad.spec.ts',
        '**/micro-gamepad.spec.ts'
      ],
      use: { browserName: 'webkit' }
    }
  ],
  webServer: {
    command: 'npm run preview',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000
  }
});
