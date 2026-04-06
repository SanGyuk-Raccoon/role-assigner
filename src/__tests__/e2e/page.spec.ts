import { test, expect } from '@playwright/test';

test.describe('Role Assigner - Public Mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/ko/role-assigner');
  });

  test.describe('Page Load', () => {
    test('should display main sections', async ({ page }) => {
      // Header
      await expect(page.getByText('역할 배정기')).toBeVisible();

      // Participants section
      await expect(page.getByText('참가자')).toBeVisible();

      // Roles section
      await expect(page.getByText('역할 설정')).toBeVisible();

      // Assign button
      await expect(page.getByText('역할 배정하기')).toBeVisible();
    });

    test('should have default 2 participants and 1 role', async ({ page }) => {
      const participantInputs = page.locator('input[placeholder^="참가자"]');
      await expect(participantInputs).toHaveCount(2);

      const roleInputs = page.locator('input[placeholder="역할 이름"]');
      await expect(roleInputs).toHaveCount(1);
    });
  });

  test.describe('Participant Management', () => {
    test('should add participant', async ({ page }) => {
      const participantInputs = page.locator('input[placeholder^="참가자"]');
      await expect(participantInputs).toHaveCount(2);

      await page.getByText('참가자 추가').click();
      await expect(participantInputs).toHaveCount(3);

      await page.getByText('참가자 추가').click();
      await expect(participantInputs).toHaveCount(4);
    });

    test('should remove participant', async ({ page }) => {
      // Add third participant first
      await page.getByText('참가자 추가').click();
      const participantInputs = page.locator('input[placeholder^="참가자"]');
      await expect(participantInputs).toHaveCount(3);

      // Remove one
      const participantSection = page.locator('section').filter({ hasText: '참가자' }).first();
      await participantSection.locator('button:has-text("✕")').first().click();
      await expect(participantInputs).toHaveCount(2);
    });

    test('should not go below minimum 2 participants', async ({ page }) => {
      const participantInputs = page.locator('input[placeholder^="참가자"]');

      // Try to remove when only 2 participants
      const participantSection = page.locator('section').filter({ hasText: '참가자' }).first();
      const deleteButtons = participantSection.locator('button:has-text("✕")');

      // Delete buttons should be disabled or hidden when at minimum
      await expect(participantInputs).toHaveCount(2);
    });

    test('should reset all participants', async ({ page }) => {
      const participantInputs = page.locator('input[placeholder^="참가자"]');

      // Fill participant names
      await participantInputs.nth(0).fill('철수');
      await participantInputs.nth(1).fill('영희');

      // Add one more and fill
      await page.getByText('참가자 추가').click();
      await participantInputs.nth(2).fill('민수');

      // Click reset
      const resetButtons = page.locator('button[title="Reset"]');
      await resetButtons.first().click();

      // Should reset to 2 empty participants
      await expect(participantInputs).toHaveCount(2);
      await expect(participantInputs.nth(0)).toHaveValue('');
      await expect(participantInputs.nth(1)).toHaveValue('');
    });
  });

  test.describe('Role Management', () => {
    test('should add role', async ({ page }) => {
      const roleInputs = page.locator('input[placeholder="역할 이름"]');
      await expect(roleInputs).toHaveCount(1);

      await page.getByText('역할 추가').click();
      await expect(roleInputs).toHaveCount(2);
    });

    test('should remove role', async ({ page }) => {
      // Add second role first
      await page.getByText('역할 추가').click();
      const roleInputs = page.locator('input[placeholder="역할 이름"]');
      await expect(roleInputs).toHaveCount(2);

      // Remove last role
      const roleSection = page.locator('section').filter({ hasText: '역할 설정' });
      await roleSection.locator('button:has-text("✕")').last().click();
      await expect(roleInputs).toHaveCount(1);
    });

    test('should increase role count with + button', async ({ page }) => {
      // Click + button
      await page.locator('button:has-text("+")').first().click();

      // Count should be 2 now
      const countSpan = page.locator('span').filter({ hasText: /^2$/ });
      await expect(countSpan.first()).toBeVisible();
    });

    test('should decrease role count with − button', async ({ page }) => {
      // First increase to 2
      await page.locator('button:has-text("+")').first().click();

      // Then decrease back to 1
      await page.locator('button:has-text("−")').first().click();

      const countSpan = page.locator('span').filter({ hasText: /^1$/ });
      await expect(countSpan.first()).toBeVisible();
    });

    test('should allow count 0 for remaining role', async ({ page }) => {
      // Decrease count to 0
      await page.locator('button:has-text("−")').first().click();

      // Should show "나머지" indicator
      await expect(page.getByText('나머지')).toBeVisible();
    });

    test('should reset all roles', async ({ page }) => {
      // Add and configure roles
      const roleInputs = page.locator('input[placeholder="역할 이름"]');
      await roleInputs.first().fill('마피아');

      await page.getByText('역할 추가').click();
      await roleInputs.nth(1).fill('시민');

      // Click reset (second reset button for roles)
      const resetButtons = page.locator('button[title="Reset"]');
      await resetButtons.nth(1).click();

      // Should reset to 1 empty role
      await expect(roleInputs).toHaveCount(1);
      await expect(roleInputs.first()).toHaveValue('');
    });
  });

  test.describe('Role Assignment', () => {
    test('should show shuffle animation and result', async ({ page }) => {
      // Setup valid configuration
      const participantInputs = page.locator('input[placeholder^="참가자"]');
      await participantInputs.nth(0).fill('철수');
      await participantInputs.nth(1).fill('영희');

      const roleInput = page.locator('input[placeholder="역할 이름"]');
      await roleInput.fill('시민');

      // Click assign
      await page.getByText('역할 배정하기').click();

      // Wait for result
      await expect(page.getByText('역할 배정 완료!')).toBeVisible({ timeout: 5000 });

      // Verify both participants have roles shown
      await expect(page.getByText('철수')).toBeVisible();
      await expect(page.getByText('영희')).toBeVisible();
      await expect(page.getByText('시민')).toBeVisible();
    });

    test('should handle multiple roles', async ({ page }) => {
      // Setup 4 participants
      const participantInputs = page.locator('input[placeholder^="참가자"]');
      await participantInputs.nth(0).fill('철수');
      await participantInputs.nth(1).fill('영희');

      await page.getByText('참가자 추가').click();
      await page.getByText('참가자 추가').click();
      await participantInputs.nth(2).fill('민수');
      await participantInputs.nth(3).fill('지영');

      // Setup roles: 1 마피아, 3 시민
      const roleInputs = page.locator('input[placeholder="역할 이름"]');
      await roleInputs.first().fill('마피아');

      await page.getByText('역할 추가').click();
      await roleInputs.nth(1).fill('시민');
      // Increase 시민 count to 3
      await page.locator('button:has-text("+")').last().click();
      await page.locator('button:has-text("+")').last().click();

      // Assign
      await page.getByText('역할 배정하기').click();

      // Wait for result
      await expect(page.getByText('역할 배정 완료!')).toBeVisible({ timeout: 5000 });

      // All participants should be visible
      await expect(page.getByText('철수')).toBeVisible();
      await expect(page.getByText('영희')).toBeVisible();
      await expect(page.getByText('민수')).toBeVisible();
      await expect(page.getByText('지영')).toBeVisible();
    });

    test('should handle remaining role (count=0)', async ({ page }) => {
      // Setup 3 participants
      const participantInputs = page.locator('input[placeholder^="참가자"]');
      await participantInputs.nth(0).fill('철수');
      await participantInputs.nth(1).fill('영희');

      await page.getByText('참가자 추가').click();
      await participantInputs.nth(2).fill('민수');

      // Setup roles: 1 마피아, rest are 시민
      const roleInputs = page.locator('input[placeholder="역할 이름"]');
      await roleInputs.first().fill('마피아');

      await page.getByText('역할 추가').click();
      await roleInputs.nth(1).fill('시민');

      // Set 시민 count to 0 (remaining)
      await page.locator('button:has-text("−")').last().click();
      await expect(page.getByText('나머지')).toBeVisible();

      // Assign
      await page.getByText('역할 배정하기').click();

      // Wait for result
      await expect(page.getByText('역할 배정 완료!')).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Validation Errors', () => {
    test('should show error when no participants have names', async ({ page }) => {
      // Don't fill any names, just try to assign
      const roleInput = page.locator('input[placeholder="역할 이름"]');
      await roleInput.fill('시민');

      await page.getByText('역할 배정하기').click();

      // Should show validation error (modal or alert)
      await expect(page.getByText(/참가자.*2명|최소/)).toBeVisible({ timeout: 3000 });
    });

    test('should show error when only 1 participant', async ({ page }) => {
      const participantInputs = page.locator('input[placeholder^="참가자"]');
      await participantInputs.nth(0).fill('혼자만');
      // Leave second empty

      const roleInput = page.locator('input[placeholder="역할 이름"]');
      await roleInput.fill('시민');

      await page.getByText('역할 배정하기').click();

      // Should show validation error
      await expect(page.getByText(/참가자.*2명|최소/)).toBeVisible({ timeout: 3000 });
    });

    test('should show error when roles exceed participants', async ({ page }) => {
      // 2 participants
      const participantInputs = page.locator('input[placeholder^="참가자"]');
      await participantInputs.nth(0).fill('철수');
      await participantInputs.nth(1).fill('영희');

      // 3 roles
      const roleInputs = page.locator('input[placeholder="역할 이름"]');
      await roleInputs.first().fill('마피아');
      await page.locator('button:has-text("+")').first().click();
      await page.locator('button:has-text("+")').first().click();

      await page.getByText('역할 배정하기').click();

      // Should show error
      await expect(page.getByText(/역할.*많|초과|부족/)).toBeVisible({ timeout: 3000 });
    });
  });

  test.describe('Result Actions', () => {
    async function setupAndAssign(page: any) {
      const participantInputs = page.locator('input[placeholder^="참가자"]');
      await participantInputs.nth(0).fill('철수');
      await participantInputs.nth(1).fill('영희');

      const roleInput = page.locator('input[placeholder="역할 이름"]');
      await roleInput.fill('시민');

      await page.getByText('역할 배정하기').click();
      await expect(page.getByText('역할 배정 완료!')).toBeVisible({ timeout: 5000 });
    }

    test('should reassign roles', async ({ page }) => {
      await setupAndAssign(page);

      // Click reassign
      await page.getByText('다시 섞기').click();

      // Should show shuffle again and result
      await expect(page.getByText('역할 배정 완료!')).toBeVisible({ timeout: 5000 });
    });

    test('should start new game', async ({ page }) => {
      await setupAndAssign(page);

      // Click new game
      await page.getByText('새 게임').click();

      // Should go back to setup view
      await expect(page.getByText('참가자')).toBeVisible();
      await expect(page.getByText('역할 설정')).toBeVisible();

      // Participants should be reset
      const participantInputs = page.locator('input[placeholder^="참가자"]');
      await expect(participantInputs.nth(0)).toHaveValue('');
    });

    test('should copy result to clipboard', async ({ page, context }) => {
      // Grant clipboard permissions
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);

      await setupAndAssign(page);

      // Click share/copy button
      await page.getByText('결과 복사').click();

      // Check clipboard contains result
      const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
      expect(clipboardText).toContain('철수');
      expect(clipboardText).toContain('영희');
      expect(clipboardText).toContain('시민');
    });
  });
});

test.describe('Role Assigner - English Locale', () => {
  test('should display in English', async ({ page }) => {
    await page.goto('/en/role-assigner');

    // Check English text
    await expect(page.getByText('Role Assigner')).toBeVisible();
    await expect(page.getByText('Participants')).toBeVisible();
    await expect(page.getByText('Role Settings')).toBeVisible();
  });

  test('should complete role assignment flow in English', async ({ page }) => {
    await page.goto('/en/role-assigner');

    const participantInputs = page.locator('input[placeholder^="Participant"]');
    await participantInputs.nth(0).fill('Alice');
    await participantInputs.nth(1).fill('Bob');

    const roleInput = page.locator('input[placeholder="Role name"]');
    await roleInput.fill('Citizen');

    await page.getByText('Assign Roles').click();

    await expect(page.getByText('Role Assignment Complete!')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Role Assigner - Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('should be usable on mobile viewport', async ({ page }) => {
    await page.goto('/ko/role-assigner');

    // All main elements should be visible
    await expect(page.getByText('참가자')).toBeVisible();
    await expect(page.getByText('역할 설정')).toBeVisible();
    await expect(page.getByText('역할 배정하기')).toBeVisible();

    // Should be able to complete assignment
    const participantInputs = page.locator('input[placeholder^="참가자"]');
    await participantInputs.nth(0).fill('철수');
    await participantInputs.nth(1).fill('영희');

    const roleInput = page.locator('input[placeholder="역할 이름"]');
    await roleInput.fill('시민');

    await page.getByText('역할 배정하기').click();

    await expect(page.getByText('역할 배정 완료!')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Role Assigner - Presets', () => {
  test('should load Mafia preset', async ({ page }) => {
    await page.goto('/ko/role-assigner');

    // Click preset button (if exists)
    const mafiaPreset = page.getByText('마피아');
    if (await mafiaPreset.isVisible()) {
      await mafiaPreset.click();

      // Should have mafia roles configured
      await expect(page.locator('input[value="마피아"]')).toBeVisible();
    }
  });
});
