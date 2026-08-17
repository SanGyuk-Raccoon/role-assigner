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
  const copyButton = scope.locator('.ra-share-buttons button');
  await expect(copyButton).toHaveAccessibleName(/링크 복사/u);
  await copyButton.click();
  await expect(copyButton).toHaveAccessibleName('복사 완료');
  await expect(copyButton).toContainText('✓ 복사 완료');
  return page.evaluate(() => navigator.clipboard.readText());
}

async function expectResultOnlyCopy(page: Page) {
  await expect(page.getByText('전체 결과는 이 브라우저 메모리에만 있습니다.', { exact: false })).toHaveCount(0);
  await expect(page.getByText('링크는 암호화되거나 잠기지 않습니다.', { exact: false })).toHaveCount(0);
  await expect(page.getByText('한 명씩 건네보기', { exact: true })).toHaveCount(0);
  await expect(page.getByText('참가자 목록은 표시하지 않습니다.', { exact: true })).toHaveCount(0);
}

test.describe('브라우저 전용 배정 흐름', () => {
  test.beforeEach(async ({ context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
      origin: 'http://127.0.0.1:3100',
    });
  });

  test('전역 레이아웃은 DarakBox 복귀 링크를 노출하지 않는다', async ({ page }) => {
    await openSetup(page);
    await expect(page.getByRole('link', { name: 'DARAKBOX' })).toHaveCount(0);
  });

  test('설정 화면은 링크 안내를 하단에 유지하고 20명 제한·마니또 전환을 제공한다', async ({ page }) => {
    await openSetup(page);
    await expect(page.getByRole('radio', { name: '전체 공개' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByRole('radio', { name: '개별 공개' })).toBeVisible();
    await expect(page.getByText('0명', { exact: true })).toBeVisible();
    await expect(page.getByText(/남은 \d+자|\d+\/80B/u)).toHaveCount(0);

    const participantHeading = page.getByRole('heading', { name: /참가자/u });
    const participantHeadingBefore = await participantHeading.boundingBox();
    const individualGuide = page.locator('.ra-guide-individual');
    await expect(page.getByRole('heading', { name: '만든 이유' })).toHaveCount(0);
    await expect(page.getByText('팁', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: '주요 기능' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '사용 방법' })).toBeVisible();
    await expect(page.locator('.ra-reveal-description')).toHaveCount(0);
    await expect(individualGuide).toBeVisible();
    await expect(individualGuide).toContainText('전체 결과 링크');
    await expect(individualGuide).toContainText('다른 참가자의 이름을 입력하면 그 참가자의 결과도 볼 수 있습니다.');
    await expect(individualGuide).toContainText('개별 결과 링크');
    await expect(individualGuide).toContainText('해당 참가자의 결과만 볼 수 있습니다.');

    await page.getByRole('radio', { name: '개별 공개' }).click();
    const participantHeadingAfter = await participantHeading.boundingBox();
    expect(participantHeadingBefore).not.toBeNull();
    expect(participantHeadingAfter).not.toBeNull();
    expect(participantHeadingAfter!.y).toBe(participantHeadingBefore!.y);
    await expect(page.locator('.ra-reveal-description')).toHaveCount(0);
    await expect(individualGuide).toBeVisible();

    const manitoToggle = page.getByRole('switch', { name: '마니또 모드' });
    const manitoTrack = manitoToggle.locator('span[aria-hidden="true"]').last();
    const manitoThumb = manitoTrack.locator('span');
    const thumbOffsets = async () => {
      const [trackBox, thumbBox] = await Promise.all([
        manitoTrack.boundingBox(),
        manitoThumb.boundingBox(),
      ]);

      if (!trackBox || !thumbBox) return null;
      return {
        left: Math.round(thumbBox.x - trackBox.x),
        right: Math.round(trackBox.x + trackBox.width - thumbBox.x - thumbBox.width),
      };
    };

    await expect(manitoToggle).toHaveAttribute('aria-checked', 'false');
    await expect.poll(thumbOffsets).toEqual({ left: 2, right: 26 });
    await manitoToggle.click();
    await expect(manitoToggle).toHaveAttribute('aria-checked', 'true');
    await expect.poll(thumbOffsets).toEqual({ left: 26, right: 2 });
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

  test('전체 공개는 결과를 바로 표시하고 복사한 링크도 모든 결과를 즉시 연다', async ({ page, context }) => {
    await assignGeneralRoles(page, ['Alice', '철수'], '시민', 'public');
    await expect(page.locator('.ra-public-results-grid')).toBeVisible();
    await expect(page.getByText('시민', { exact: true })).toHaveCount(2);
    await expect(page.locator('.ra-participant-result-row')).toHaveCount(0);
    await expect(page.getByRole('button', { name: '결과 링크 복사' })).toBeVisible();
    await expectResultOnlyCopy(page);

    const url = await copyShareLink(page, page.locator('.ra-public-share'));
    const receiver = await context.newPage();
    await receiver.goto(url);
    await expect(receiver.getByRole('heading', { name: '역할 전체 결과' })).toBeVisible();
    await expect(receiver.getByText('시민', { exact: true })).toHaveCount(2);
    await expect(receiver.getByLabel('참가자 이름')).toHaveCount(0);
    await expectResultOnlyCopy(receiver);
    await receiver.reload();
    await expect(receiver.getByText('시민', { exact: true })).toHaveCount(2);
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

  test('참가자별 승인 결과는 목록에 누적되고 다시 숨긴 행만 제거된다', async ({ page }) => {
    await assignGeneralRoles(page);
    await expect(page.getByText('시민', { exact: true })).toHaveCount(0);
    await expectResultOnlyCopy(page);

    const aliceRow = page.locator('.ra-participant-result-row').filter({ hasText: 'Alice' });
    const otherRow = page.locator('.ra-participant-result-row').filter({ hasText: '철수' });
    await aliceRow.getByRole('button', { name: '결과 보기' }).click();

    const dialog = page.getByRole('dialog', { name: 'Alice님의 결과를 공개할까요?' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('시민', { exact: true })).toHaveCount(0);
    await dialog.getByRole('button', { name: '결과 공개' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(aliceRow.getByText('시민', { exact: true })).toBeVisible();
    await expect(aliceRow.getByRole('button', { name: '다시 숨기기' })).toBeFocused();

    await otherRow.getByRole('button', { name: '결과 보기' }).click();
    await page.getByRole('dialog').getByRole('button', { name: '취소' }).click();
    await expect(aliceRow.getByText('시민', { exact: true })).toBeVisible();
    await expect(otherRow.getByText('시민', { exact: true })).toHaveCount(0);

    await otherRow.getByRole('button', { name: '결과 보기' }).click();
    await page.getByRole('dialog').getByRole('button', { name: '결과 공개' }).click();
    await expect(page.getByText('시민', { exact: true })).toHaveCount(2);

    await aliceRow.getByRole('button', { name: '다시 숨기기' }).click();
    await expect(aliceRow.getByText('시민', { exact: true })).toHaveCount(0);
    await expect(otherRow.getByText('시민', { exact: true })).toBeVisible();
  });

  test('전체 결과는 기존 목록을 모두 공개하고 개별·전체 숨기기를 지원한다', async ({ page }) => {
    await assignGeneralRoles(page);
    const resultActions = page.locator('.ra-result-actions');
    const sharedResultLink = page.locator('.ra-shared-result-link');
    await expect(resultActions.getByRole('button', { name: /링크 복사/u })).toHaveCount(0);
    await expect(sharedResultLink.getByRole('heading', { name: '전체 결과 링크' })).toBeVisible();
    await expect(sharedResultLink).toContainText('다른 참가자의 이름을 입력해도 해당 결과를 볼 수 있습니다.');
    const [showAllBox, sharedLinkBox] = await Promise.all([
      page.getByRole('button', { name: '전체 결과 보기' }).boundingBox(),
      sharedResultLink.boundingBox(),
    ]);
    expect(showAllBox).not.toBeNull();
    expect(sharedLinkBox).not.toBeNull();
    expect(sharedLinkBox!.y).toBeGreaterThanOrEqual(showAllBox!.y + showAllBox!.height);

    await page.getByRole('button', { name: '전체 결과 보기' }).click();
    const dialog = page.getByRole('dialog', { name: '전체 결과를 공개할까요?' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: '전체 결과 공개' }).click();

    await expect(page.getByText('시민', { exact: true })).toHaveCount(2);
    await expect(page.locator('.ra-participant-result-row').getByRole('button', { name: '다시 숨기기' })).toHaveCount(2);

    await page.locator('.ra-participant-result-row').first().getByRole('button', { name: '다시 숨기기' }).click();
    await expect(page.getByText('시민', { exact: true })).toHaveCount(1);
    await expect(page.getByRole('button', { name: '전체 결과 보기' })).toBeVisible();

    await page.getByRole('button', { name: '전체 결과 보기' }).click();
    await page.getByRole('dialog').getByRole('button', { name: '전체 결과 공개' }).click();
    await expect(page.getByText('시민', { exact: true })).toHaveCount(2);
    await page.getByRole('button', { name: '모두 숨기기' }).click();
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

  test('개별 결과 링크에는 해당 참가자만 있고 새로고침 뒤에도 봉인 상태로 복원된다', async ({ page, context }) => {
    await assignGeneralRoles(page);
    const row = page.locator('.ra-participant-result-row').filter({ hasText: 'Alice' });
    const url = await copyShareLink(page, row);

    const receiver = await context.newPage();
    await receiver.goto(url);
    await expect(receiver.getByRole('heading', { name: 'Alice님께 전달된 결과' })).toBeVisible();
    await expectResultOnlyCopy(receiver);
    await expect(receiver.getByText('철수', { exact: true })).toHaveCount(0);
    await expect(receiver.getByText('시민', { exact: true })).toHaveCount(0);
    await receiver.reload();
    await expect(receiver.getByText('시민', { exact: true })).toHaveCount(0);
    await receiver.getByRole('button', { name: '역할 확인하기' }).click();
    await expect(receiver.getByText('시민', { exact: true })).toBeVisible();
    await receiver.getByRole('button', { name: '새 역할 뽑기' }).click();
    await expect(receiver).toHaveURL(/\/role-assigner$/u);
  });

  test('전체 결과 링크는 목록 없이 NFKC·소문자 정규화한 이름으로 한 명씩 찾는다', async ({ page, context }) => {
    await assignGeneralRoles(page);
    const url = await copyShareLink(page, page.locator('.ra-shared-result-link'));

    const receiver = await context.newPage();
    await receiver.goto(url);
    await expectResultOnlyCopy(receiver);
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
    await dialog.getByRole('button', { name: '결과 공개' }).click();
    await expect(row.getByText('B', { exact: true })).toBeVisible();
  });

  test('배정과 개별 결과 공개 과정에서 API·데이터베이스 요청을 보내지 않는다', async ({ page }) => {
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
    await page.locator('.ra-participant-result-row').first().getByRole('button', { name: '결과 보기' }).click();
    await page.getByRole('dialog').getByRole('button', { name: '결과 공개' }).click();
    await expect(page.getByText('시민', { exact: true })).toHaveCount(1);
    expect(roleDataRequests).toEqual([]);
  });

  test('링크 복사는 시스템 공유를 호출하지 않고 한 번에 클립보드에 쓴다', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        value: () => Promise.reject(new Error('시스템 공유를 호출하면 안 됩니다.')),
      });
    });
    await assignGeneralRoles(page);
    const scope = page.locator('.ra-shared-result-link');
    await scope.getByRole('button', { name: '전체 결과 링크 복사' }).click();
    await expect(scope.getByRole('button', { name: '복사 완료' })).toContainText('✓ 복사 완료');
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toMatch(/#result=/u);
  });

  test('링크 복사 성공은 버튼 크기를 유지하고 참가자별로 2초 뒤 복구된다', async ({ page }) => {
    await assignGeneralRoles(page);
    const aliceRow = page.locator('.ra-participant-result-row').filter({ hasText: 'Alice' });
    const otherRow = page.locator('.ra-participant-result-row').filter({ hasText: '철수' });
    const aliceCopy = aliceRow.locator('.ra-share-buttons button');
    const otherCopy = otherRow.locator('.ra-share-buttons button');
    const [buttonBefore, rowBefore] = await Promise.all([
      aliceCopy.boundingBox(),
      aliceRow.boundingBox(),
    ]);
    expect(buttonBefore).not.toBeNull();
    expect(rowBefore).not.toBeNull();

    await aliceCopy.click();
    await expect(aliceCopy).toHaveAccessibleName('복사 완료');
    await expect(aliceCopy).toContainText('✓ 복사 완료');
    await expect(aliceRow.locator('.ra-live-message')).toHaveCount(0);
    await expect(otherCopy).toHaveAccessibleName('개별 결과 링크 복사');

    const [buttonAfter, rowAfter] = await Promise.all([
      aliceCopy.boundingBox(),
      aliceRow.boundingBox(),
    ]);
    expect(buttonAfter).not.toBeNull();
    expect(rowAfter).not.toBeNull();
    expect(buttonAfter!.width).toBe(buttonBefore!.width);
    expect(buttonAfter!.height).toBe(buttonBefore!.height);
    expect(rowAfter!.height).toBe(rowBefore!.height);

    await expect(aliceCopy).toHaveAccessibleName('개별 결과 링크 복사', { timeout: 3_000 });
    await expect(aliceCopy).toContainText('개별 결과 링크 복사');
  });

  test('클립보드 쓰기 실패 시 결과 링크를 선택해 수동 복사할 수 있다', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: () => Promise.reject(new DOMException('denied', 'NotAllowedError')) },
      });
    });
    await assignGeneralRoles(page);
    const scope = page.locator('.ra-shared-result-link');
    await scope.getByRole('button', { name: '전체 결과 링크 복사' }).click();
    await expect(scope.getByText(/클립보드 권한/u)).toBeVisible();
    const manual = scope.getByLabel('직접 복사할 결과 링크');
    await expect(manual).toBeVisible();
    await expect(manual).toHaveAttribute('readonly', '');
    await expect(manual).toBeFocused();
    await expect(manual).toHaveValue(/#result=/u);
  });

  test('클립보드 API 미지원 시 결과 링크를 선택해 수동 복사할 수 있다', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
    });
    await assignGeneralRoles(page);
    const scope = page.locator('.ra-shared-result-link');
    await scope.getByRole('button', { name: '전체 결과 링크 복사' }).click();
    await expect(scope.getByText(/지원하지 않는 브라우저/u)).toBeVisible();
    await expect(scope.getByLabel('직접 복사할 결과 링크')).toBeFocused();
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
    const oldUrl = await copyShareLink(page, page.locator('.ra-shared-result-link'));

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
    const newUrl = await copyShareLink(page, page.locator('.ra-shared-result-link'));
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
    await page.locator('.ra-participant-result-row').first().getByRole('button', { name: '결과 보기' }).click();
    await page.getByRole('dialog').getByRole('button', { name: '결과 공개' }).click();
    const resultOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(resultOverflow).toBeLessThanOrEqual(0);
    const resultA11y = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(resultA11y.violations).toEqual([]);
  });
});
