import AxeBuilder from '@axe-core/playwright';
import { expect, Page, test } from '@playwright/test';

async function openSetup(page: Page) {
  await page.goto('/role-assigner');
  await expect(page.getByRole('heading', { name: '역할 뽑기', exact: true })).toBeVisible();
}

async function assignGeneralRoles(
  page: Page,
  names = ['Alice', '철수'],
  role = '시민',
  revealMode: 'public' | 'individual' = 'individual',
) {
  await openSetup(page);
  await page.getByRole('radio', {
    name: revealMode === 'public' ? '전체 공개' : '개별 공개',
  }).click();
  await page.getByLabel('참가자 1', { exact: true }).fill(names[0]);
  await page.getByLabel('참가자 2', { exact: true }).fill(names[1]);
  await page.getByLabel('역할 1', { exact: true }).fill(role);
  await page.getByLabel('인원', { exact: true }).fill('0');
  await page.getByRole('button', { name: '역할 배정하기' }).click();
  await expect(page.getByRole('heading', {
    name: revealMode === 'public' ? '역할 배정 완료!' : '역할 배정이 끝났습니다',
  })).toBeVisible();
}

async function copyShareLink(page: Page, scope: ReturnType<Page['locator']>): Promise<string> {
  await scope.getByRole('button', { name: /링크 공유/u }).click();
  await scope.getByRole('button', { name: '링크 복사' }).click();
  await expect(scope.getByText('링크를 복사했습니다.')).toBeVisible();
  return page.evaluate(() => navigator.clipboard.readText());
}

test.describe('브라우저 전용 배정 흐름', () => {
  test.beforeEach(async ({ context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
      origin: 'http://127.0.0.1:3100',
    });
  });

  test('설정 화면은 20명 제한·마니또 전환을 제공하고 상시 글자 수를 숨긴다', async ({ page }) => {
    await openSetup(page);
    await expect(page.getByRole('radio', { name: '전체 공개' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByRole('radio', { name: '개별 공개' })).toBeVisible();
    await expect(page.getByText('0명', { exact: true })).toBeVisible();
    await expect(page.getByText(/남은 \d+자|\d+\/80B/u)).toHaveCount(0);

    const manitoToggle = page.getByRole('switch', { name: '마니또 모드' });
    await expect(manitoToggle).toHaveAttribute('aria-checked', 'false');
    await manitoToggle.click();
    await expect(manitoToggle).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByText(/자기 자신은 배정되지 않습니다/u)).toBeVisible();
    await expect(page.getByLabel('역할 1', { exact: true })).toHaveCount(0);

    await manitoToggle.click();
    await expect(page.getByLabel('역할 1', { exact: true })).toBeVisible();
  });

  test('이름 상한은 초과분만 막고 반복 경고를 다시 시작한다', async ({ page }) => {
    await openSetup(page);
    const participantRow = page.locator('.ra-input-row').first();
    const participantInput = page.getByLabel('참가자 1', { exact: true });
    const participantLimit = '😀'.repeat(20);

    await participantInput.fill(participantLimit);
    await expect(participantInput).toHaveValue(participantLimit);
    await expect(participantRow.getByRole('status')).toHaveCount(0);

    await participantInput.press('A');
    await expect(participantInput).toHaveValue(participantLimit);
    await expect(participantRow.getByRole('status')).toHaveText('최대 20자까지 입력할 수 있어요.');
    const firstWarningClass = await participantInput.getAttribute('class');

    await participantInput.press('B');
    await expect.poll(() => participantInput.getAttribute('class')).not.toBe(firstWarningClass);
    await expect(participantRow.getByRole('status')).toHaveCount(1);

    await participantInput.fill('가'.repeat(25));
    await expect(participantInput).toHaveValue('가'.repeat(20));
    await expect(participantRow.getByRole('status')).toHaveCount(1);

    const roleRow = page.locator('.ra-role-row').first();
    const roleInput = page.getByLabel('역할 1', { exact: true });
    await roleInput.fill('역'.repeat(31));
    await expect(roleInput).toHaveValue('역'.repeat(30));
    await expect(roleRow.getByRole('status')).toHaveText('최대 30자까지 입력할 수 있어요.');
    await expect(roleRow.getByRole('status')).toHaveCount(0, { timeout: 2_500 });
  });

  test('한글 조합 완료 후 제한하고 reduced-motion에서는 흔들림을 생략한다', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openSetup(page);
    const participantRow = page.locator('.ra-input-row').first();
    const participantInput = page.getByLabel('참가자 1', { exact: true });
    const composingValue = '가'.repeat(21);
    await participantInput.focus();

    await participantInput.evaluate((element, value) => {
      element.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      valueSetter?.call(element, value);
      element.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        data: '가',
        inputType: 'insertCompositionText',
        isComposing: true,
      }));
    }, composingValue);

    await expect(participantInput).toHaveValue(composingValue);
    await participantInput.evaluate((element) => {
      element.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '가' }));
    });

    await expect(participantInput).toHaveValue('가'.repeat(20));
    await expect(participantRow.getByRole('status')).toHaveText('최대 20자까지 입력할 수 있어요.');
    await expect.poll(() => participantInput.evaluate(
      (element) => window.getComputedStyle(element).animationName,
    )).toBe('none');
  });

  test('전체 공개는 배정 직후 모든 결과를 기존 카드 흐름으로 표시한다', async ({ page }) => {
    await assignGeneralRoles(page, ['Alice', '철수'], '시민', 'public');
    await expect(page.locator('.ra-public-results-grid')).toBeVisible();
    await expect(page.getByText('시민', { exact: true })).toHaveCount(2);
    await expect(page.locator('.ra-participant-result-row')).toHaveCount(0);
  });

  test('정규화 중복 오류를 입력에 연결하고 첫 오류로 초점을 이동한다', async ({ page }) => {
    await openSetup(page);
    await page.getByLabel('참가자 1', { exact: true }).fill('Alice');
    await page.getByLabel('참가자 2', { exact: true }).fill(' ＡＬＩＣＥ ');
    await page.getByLabel('역할 1', { exact: true }).fill('시민');
    await page.getByRole('button', { name: '역할 배정하기' }).click();

    await expect(page.getByText(/이름이 중복됩니다/u)).toBeVisible();
    await expect(page.getByLabel('참가자 2', { exact: true })).toBeFocused();
    await expect(page.getByLabel('참가자 2', { exact: true })).toHaveAttribute('aria-invalid', 'true');
    await page.getByLabel('참가자 1', { exact: true }).focus();
    await expect(page.getByText(/이름이 중복됩니다/u)).toBeVisible();
  });

  test('배정 직후 역할은 DOM에 없고 참가자 확인 뒤 다시 제거된다', async ({ page }) => {
    await assignGeneralRoles(page);
    await expect(page.getByText('시민', { exact: true })).toHaveCount(0);

    const row = page.locator('.ra-participant-result-row').filter({ hasText: 'Alice' });
    const opener = row.getByRole('button', { name: '결과 보기' });
    await opener.click();

    const dialog = page.getByRole('dialog', { name: 'Alice님의 결과' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('시민', { exact: true })).toHaveCount(0);
    await dialog.getByRole('button', { name: '역할 확인하기' }).click();
    await expect(dialog.getByText('시민', { exact: true })).toBeVisible();
    await dialog.getByRole('button', { name: '확인 완료' }).click();

    await expect(dialog).toHaveCount(0);
    await expect(page.getByText('시민', { exact: true })).toHaveCount(0);
    await expect(opener).toBeFocused();
  });

  test('전체 결과 확인은 확인 dialog를 거치고 즉시 모두 숨길 수 있다', async ({ page }) => {
    await assignGeneralRoles(page);
    await page.getByRole('button', { name: '전체 결과 보기' }).click();
    const dialog = page.getByRole('dialog', { name: '전체 결과를 공개할까요?' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: '전체 결과 공개' }).click();

    await expect(page.getByRole('heading', { name: '전체 결과' })).toBeVisible();
    await expect(page.getByText('시민', { exact: true })).toHaveCount(2);
    await page.getByRole('button', { name: '모두 숨기기' }).first().click();
    await expect(page.getByText('시민', { exact: true })).toHaveCount(0);
  });

  test('참가자 dialog는 Escape·초점 복귀를 지원한다', async ({ page }) => {
    await assignGeneralRoles(page);
    const opener = page.locator('.ra-participant-result-row').first().getByRole('button', { name: '결과 보기' });
    await opener.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.locator(':focus')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(opener).toBeFocused();
  });

  test('개인 링크에는 해당 참가자만 있고 새로고침 뒤에도 봉인 상태로 복원된다', async ({ page, context }) => {
    await assignGeneralRoles(page);
    const row = page.locator('.ra-participant-result-row').filter({ hasText: 'Alice' });
    const url = await copyShareLink(page, row);

    const receiver = await context.newPage();
    await receiver.goto(url);
    await expect(receiver.getByRole('heading', { name: 'Alice님께 전달된 결과' })).toBeVisible();
    await expect(receiver.getByText('철수', { exact: true })).toHaveCount(0);
    await expect(receiver.getByText('시민', { exact: true })).toHaveCount(0);
    await receiver.reload();
    await expect(receiver.getByText('시민', { exact: true })).toHaveCount(0);
    await receiver.getByRole('button', { name: '역할 확인하기' }).click();
    await expect(receiver.getByText('시민', { exact: true })).toBeVisible();
    await receiver.getByRole('button', { name: '새 역할 뽑기' }).click();
    await expect(receiver).toHaveURL(/\/role-assigner$/u);
  });

  test('공용 링크는 목록 없이 NFKC·소문자 정규화한 정확한 이름만 찾는다', async ({ page, context }) => {
    await assignGeneralRoles(page);
    const url = await copyShareLink(page, page.locator('.ra-result-actions'));

    const receiver = await context.newPage();
    await receiver.goto(url);
    await expect(receiver.getByText('철수', { exact: true })).toHaveCount(0);
    await receiver.getByLabel('참가자 이름').fill('없는 이름');
    await receiver.getByRole('button', { name: '내 결과 찾기' }).click();
    await expect(receiver.getByText('이름을 다시 확인해주세요')).toBeVisible();
    await expect(receiver.getByLabel('참가자 이름')).toHaveValue('없는 이름');

    await receiver.getByLabel('참가자 이름').fill(' ＡＬＩＣＥ ');
    await receiver.getByRole('button', { name: '내 결과 찾기' }).click();
    await expect(receiver.getByText('Alice님', { exact: true })).toBeVisible();
    await expect(receiver.getByText('시민', { exact: true })).toHaveCount(0);
    await receiver.getByRole('button', { name: '역할 확인하기' }).click();
    await expect(receiver.getByText('시민', { exact: true })).toBeVisible();
  });

  test('마니또는 역할 입력 없이 자기 자신이 아닌 결과를 봉인해 배정한다', async ({ page }) => {
    await openSetup(page);
    await page.getByRole('radio', { name: '개별 공개' }).click();
    await page.getByLabel('참가자 1', { exact: true }).fill('A');
    await page.getByLabel('참가자 2', { exact: true }).fill('B');
    await page.getByRole('switch', { name: '마니또 모드' }).click();
    await page.getByRole('button', { name: '마니또 배정하기' }).click();
    await expect(page.getByRole('heading', { name: '마니또 배정이 끝났습니다' })).toBeVisible();

    const row = page.locator('.ra-participant-result-row').filter({ hasText: 'A' });
    await row.getByRole('button', { name: '결과 보기' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('B', { exact: true })).toHaveCount(0);
    await dialog.getByRole('button', { name: '마니또 확인하기' }).click();
    await expect(dialog.getByText('B', { exact: true })).toBeVisible();
  });

  test('배정 과정에서 API·데이터베이스 요청을 보내지 않는다', async ({ page }) => {
    const roleDataRequests: string[] = [];
    let monitoring = false;
    page.on('request', (request) => {
      if (!monitoring) return;
      if (['fetch', 'xhr'].includes(request.resourceType())) roleDataRequests.push(request.url());
    });

    await openSetup(page);
    monitoring = true;
    await page.getByRole('radio', { name: '개별 공개' }).click();
    await page.getByLabel('참가자 1', { exact: true }).fill('A');
    await page.getByLabel('참가자 2', { exact: true }).fill('B');
    await page.getByLabel('역할 1', { exact: true }).fill('시민');
    await page.getByLabel('인원', { exact: true }).fill('0');
    await page.getByRole('button', { name: '역할 배정하기' }).click();
    await expect(page.getByRole('heading', { name: '역할 배정이 끝났습니다' })).toBeVisible();
    expect(roleDataRequests).toEqual([]);
  });

  test('공유 취소는 오류나 자동 복사로 바꾸지 않는다', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        value: () => Promise.reject(new DOMException('cancelled', 'AbortError')),
      });
    });
    await assignGeneralRoles(page);
    const scope = page.locator('.ra-result-actions');
    await scope.getByRole('button', { name: '공용 링크 공유' }).click();
    await expect(scope.getByRole('button', { name: '링크 복사' })).toHaveCount(0);
    await expect(scope.getByText(/실패|오류|권한/u)).toHaveCount(0);
  });

  test('시스템 공유 성공을 참가자 행과 섞이지 않는 상태로 알린다', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        value: () => Promise.resolve(),
      });
    });
    await assignGeneralRoles(page);
    const aliceRow = page.locator('.ra-participant-result-row').filter({ hasText: 'Alice' });
    const otherRow = page.locator('.ra-participant-result-row').filter({ hasText: '철수' });
    await aliceRow.getByRole('button', { name: '개인 링크 공유' }).click();
    await expect(aliceRow.getByText('공유를 완료했습니다.')).toBeVisible();
    await expect(otherRow.getByText('공유를 완료했습니다.')).toHaveCount(0);
  });

  test('공유·클립보드 실패 시 전체 링크를 선택해 수동 복사할 수 있다', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        value: () => Promise.reject(new DOMException('denied', 'NotAllowedError')),
      });
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: () => Promise.reject(new DOMException('denied', 'NotAllowedError')) },
      });
    });
    await assignGeneralRoles(page);
    const scope = page.locator('.ra-result-actions');
    await scope.getByRole('button', { name: '공용 링크 공유' }).click();
    await expect(scope.getByText(/공유 권한/u)).toBeVisible();
    await scope.getByRole('button', { name: '링크 복사' }).click();
    const manual = scope.getByLabel('직접 복사할 전체 링크');
    await expect(manual).toBeVisible();
    await expect(manual).toHaveAttribute('readonly', '');
    await expect(manual).toBeFocused();
    await expect(manual).toHaveValue(/#result=/u);
  });

  test('손상·버전·길이 오류를 구분하고 payload는 표시하지 않는다', async ({ page }) => {
    await page.goto('/role-assigner#result=a');
    await expect(page.getByRole('heading', { name: '손상된 링크입니다' })).toBeVisible();

    const unsupported = Buffer.from(JSON.stringify({
      v: 2,
      kind: 'personal',
      mode: 'role',
      assignment: { name: 'A', role: 'B' },
    })).toString('base64url');
    await page.goto(`/role-assigner#result=${unsupported}`);
    await expect(page.getByRole('heading', { name: '지원하지 않는 링크입니다' })).toBeVisible();

    await page.goto(`/role-assigner#result=${'A'.repeat(8_193)}`);
    await expect(page.getByRole('heading', { name: '너무 긴 링크입니다' })).toBeVisible();
    await expect(page.getByText('A'.repeat(100))).toHaveCount(0);
  });

  test('새 게임 뒤 만든 링크와 이전 링크가 각자의 결과를 계속 보여준다', async ({ page, context }) => {
    await assignGeneralRoles(page, ['Alice', '철수'], '이전 역할');
    const oldUrl = await copyShareLink(page, page.locator('.ra-result-actions'));

    await page.getByRole('button', { name: '다시 배정' }).click();
    await expect(page.getByRole('dialog')).toContainText('이전 결과를 계속 보여줍니다');
    await page.getByRole('dialog').getByRole('button', { name: '취소' }).click();

    await page.getByRole('button', { name: '새 게임' }).click();
    await page.getByRole('dialog').getByRole('button', { name: '새 게임 시작' }).click();
    await page.getByRole('radio', { name: '개별 공개' }).click();
    await page.getByLabel('참가자 1', { exact: true }).fill('Alice');
    await page.getByLabel('참가자 2', { exact: true }).fill('철수');
    await page.getByLabel('역할 1', { exact: true }).fill('새 역할');
    await page.getByLabel('인원', { exact: true }).fill('0');
    await page.getByRole('button', { name: '역할 배정하기' }).click();
    await expect(page.getByRole('heading', { name: '역할 배정이 끝났습니다' })).toBeVisible();
    const newUrl = await copyShareLink(page, page.locator('.ra-result-actions'));
    expect(newUrl).not.toBe(oldUrl);

    for (const [url, expectedRole] of [[oldUrl, '이전 역할'], [newUrl, '새 역할']] as const) {
      const receiver = await context.newPage();
      await receiver.goto(url);
      await receiver.getByLabel('참가자 이름').fill('Alice');
      await receiver.getByRole('button', { name: '내 결과 찾기' }).click();
      await receiver.getByRole('button', { name: '역할 확인하기' }).click();
      await expect(receiver.getByText(expectedRole, { exact: true })).toBeVisible();
      await receiver.close();
    }
  });

  test('320px 화면에서 가로 스크롤이 없고 주요 화면에 자동 접근성 위반이 없다', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 760 });
    await openSetup(page);
    const setupOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(setupOverflow).toBeLessThanOrEqual(0);
    const setupA11y = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(setupA11y.violations).toEqual([]);

    await page.getByRole('radio', { name: '개별 공개' }).click();
    await page.getByLabel('참가자 1', { exact: true }).fill('긴 한글 이름 참가자');
    await page.getByLabel('참가자 2', { exact: true }).fill('مرحبا');
    await page.getByLabel('역할 1', { exact: true }).fill('아주 긴 역할 이름도 줄바꿈');
    await page.getByLabel('인원', { exact: true }).fill('0');
    await page.getByRole('button', { name: '역할 배정하기' }).click();
    await expect(page.getByRole('heading', { name: '역할 배정이 끝났습니다' })).toBeVisible();
    const resultOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(resultOverflow).toBeLessThanOrEqual(0);
    const resultA11y = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(resultA11y.violations).toEqual([]);
  });
});
