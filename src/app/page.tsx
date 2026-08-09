'use client';

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AccessibleDialog } from '@/components/accessible-dialog';
import { ShareControl } from '@/components/share-control';
import {
  PayloadError,
  ResultPayload,
  buildResultUrl,
  createPersonalPayload,
  createSharedPayload,
  readResultHash,
} from '@/result-link';
import {
  Assignment,
  AssignmentMode,
  LIMITS,
  ParticipantInput,
  RoleInput,
  ValidationField,
  ValidationIssue,
  assign,
  codePointLength,
  createCryptoRandomIndex,
  createLookupKey,
  normalizeDisplayValue,
  utf8ByteLength,
  validateSetup,
} from '@/utils';

type ViewState =
  | 'setup'
  | 'shuffling'
  | 'results'
  | 'personal-link'
  | 'shared-link'
  | 'invalid-link';

type Confirmation = 'reassign' | 'new-game' | null;

interface ParticipantDraft extends ParticipantInput {}

interface RoleDraft {
  id: string;
  name: string;
  count: string;
}

interface InvalidLinkState {
  title: string;
  message: string;
}

interface LinkBuildResult {
  url: string | null;
  error?: string;
}

const initialParticipants = (): ParticipantDraft[] => [
  { id: 'participant-1', name: '' },
  { id: 'participant-2', name: '' },
];

const initialRoles = (): RoleDraft[] => [
  { id: 'role-1', name: '', count: '0' },
];

function textMeasure(value: string, maxCodePoints: number, maxBytes: number) {
  const normalized = normalizeDisplayValue(value);
  const points = codePointLength(normalized);
  const bytes = utf8ByteLength(normalized);
  return {
    text: `남은 ${Math.max(0, maxCodePoints - points)}자 · ${bytes}/${maxBytes}B`,
    over: points > maxCodePoints || bytes > maxBytes,
  };
}

function linkErrorState(error: unknown): InvalidLinkState {
  if (error instanceof PayloadError && error.code === 'too-long') {
    return {
      title: '너무 긴 링크입니다',
      message: '결과 데이터가 허용된 8,192자를 넘었습니다. 링크를 만든 사람에게 새 링크를 요청해주세요.',
    };
  }
  if (error instanceof PayloadError && error.code === 'unsupported-version') {
    return {
      title: '지원하지 않는 링크입니다',
      message: '현재 버전에서 열 수 없는 결과 링크입니다. 최신 화면에서 링크를 다시 만들어주세요.',
    };
  }
  return {
    title: '손상된 링크입니다',
    message: '결과 링크가 완전하지 않거나 올바른 형식이 아닙니다. 주소 전체를 다시 받아주세요.',
  };
}

function resultLabel(mode: AssignmentMode): string {
  return mode === 'manito' ? '마니또' : '역할';
}

function PrivacyNotice({ shared = false }: { shared?: boolean }) {
  return (
    <div className="ra-privacy-note">
      <span className="ra-privacy-icon" aria-hidden="true">⌁</span>
      <div>
        <p className="font-bold text-slate-100">링크는 암호화되거나 잠기지 않습니다.</p>
        <p className="mt-1 text-sm leading-6 text-slate-300">
          {shared
            ? '공용 링크에는 전체 결과가 들어 있어, 링크를 가진 사람을 기술적으로 구분하지 못합니다. 서로 신뢰하는 모임에서만 사용해주세요.'
            : '개인 링크에는 이 사람의 결과 하나만 들어 있지만, 링크를 받은 사람은 누구나 그 결과를 볼 수 있습니다.'}
          {' '}링크는 방문 기록·클립보드·공유 대상에 남을 수 있고 만료하거나 회수할 수 없습니다.
        </p>
      </div>
    </div>
  );
}

function LinkPageFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="ra-page-shell ra-link-shell">
      <div className="ra-brand-lockup" aria-hidden="true">
        <span className="ra-brand-mark">🎭</span>
        <span>역할 뽑기</span>
      </div>
      {children}
    </div>
  );
}

export default function RoleAssigner() {
  const [viewState, setViewState] = useState<ViewState>('setup');
  const [hashChecked, setHashChecked] = useState(false);
  const [mode, setMode] = useState<AssignmentMode>('role');
  const [participants, setParticipants] = useState<ParticipantDraft[]>(initialParticipants);
  const [roles, setRoles] = useState<RoleDraft[]>(initialRoles);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [runtimeError, setRuntimeError] = useState('');
  const [showAllConfirm, setShowAllConfirm] = useState(false);
  const [showAllResults, setShowAllResults] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [participantRevealed, setParticipantRevealed] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation>(null);
  const [linkPayload, setLinkPayload] = useState<ResultPayload | null>(null);
  const [invalidLink, setInvalidLink] = useState<InvalidLinkState | null>(null);
  const [personalLinkRevealed, setPersonalLinkRevealed] = useState(false);
  const [sharedName, setSharedName] = useState('');
  const [sharedError, setSharedError] = useState('');
  const [sharedMatch, setSharedMatch] = useState<Assignment | null>(null);
  const [sharedRevealed, setSharedRevealed] = useState(false);

  const participantIdRef = useRef(3);
  const roleIdRef = useRef(2);
  const shuffleTimerRef = useRef<number | null>(null);
  const fieldRefs = useRef(new Map<ValidationField, HTMLElement>());
  const sharedNameRef = useRef<HTMLInputElement>(null);

  const closeParticipantDialog = useCallback(() => {
    setParticipantRevealed(false);
    setSelectedAssignment(null);
  }, []);

  const clearHostRevealState = useCallback(() => {
    setShowAllConfirm(false);
    setShowAllResults(false);
    setParticipantRevealed(false);
    setSelectedAssignment(null);
  }, []);

  const loadHash = useCallback(() => {
    try {
      const payload = readResultHash(window.location.hash);
      if (!payload) {
        setLinkPayload(null);
        setInvalidLink(null);
        setViewState((current) => (
          current === 'personal-link' || current === 'shared-link' || current === 'invalid-link'
            ? 'setup'
            : current
        ));
      } else {
        clearHostRevealState();
        setAssignments([]);
        setLinkPayload(payload);
        setInvalidLink(null);
        setPersonalLinkRevealed(false);
        setSharedName('');
        setSharedError('');
        setSharedMatch(null);
        setSharedRevealed(false);
        setViewState(payload.kind === 'personal' ? 'personal-link' : 'shared-link');
      }
    } catch (error) {
      clearHostRevealState();
      setAssignments([]);
      setLinkPayload(null);
      setInvalidLink(linkErrorState(error));
      setViewState('invalid-link');
    } finally {
      setHashChecked(true);
    }
  }, [clearHostRevealState]);

  useEffect(() => {
    loadHash();
    window.addEventListener('hashchange', loadHash);
    window.addEventListener('popstate', loadHash);
    return () => {
      window.removeEventListener('hashchange', loadHash);
      window.removeEventListener('popstate', loadHash);
    };
  }, [loadHash]);

  useEffect(() => () => {
    if (shuffleTimerRef.current !== null) window.clearTimeout(shuffleTimerRef.current);
  }, []);

  useEffect(() => {
    if (assignments.length === 0 || viewState !== 'results') return undefined;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => window.removeEventListener('beforeunload', warnBeforeUnload);
  }, [assignments.length, viewState]);

  const setFieldRef = (field: ValidationField) => (element: HTMLElement | null) => {
    if (element) fieldRefs.current.set(field, element);
    else fieldRefs.current.delete(field);
  };

  const issueFor = (field: ValidationField): string | undefined =>
    issues.find((issue) => issue.field === field)?.message;

  const clearIssuesFor = (...fields: ValidationField[]) => {
    setIssues((current) => current.filter((issue) => !fields.includes(issue.field)));
    setRuntimeError('');
  };

  const focusFirstIssue = (nextIssues: ValidationIssue[]) => {
    const first = nextIssues[0];
    if (!first) return;
    window.requestAnimationFrame(() => fieldRefs.current.get(first.field)?.focus());
  };

  const toRoleInputs = useCallback((): RoleInput[] => roles.map((role) => ({
    id: role.id,
    name: role.name,
    count: role.count.trim() === '' ? Number.NaN : Number(role.count),
  })), [roles]);

  const startAssignment = useCallback((
    nextMode: AssignmentMode,
    normalizedParticipants: string[],
    normalizedRoles: { name: string; count: number }[],
  ) => {
    try {
      const randomIndex = createCryptoRandomIndex();
      const nextAssignments = assign(nextMode, normalizedParticipants, normalizedRoles, randomIndex);
      clearHostRevealState();
      setRuntimeError('');
      setViewState('shuffling');
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (shuffleTimerRef.current !== null) window.clearTimeout(shuffleTimerRef.current);
      shuffleTimerRef.current = window.setTimeout(() => {
        setAssignments(nextAssignments);
        setViewState('results');
        shuffleTimerRef.current = null;
      }, reduceMotion ? 0 : 650);
      return true;
    } catch (error) {
      setRuntimeError(error instanceof Error
        ? error.message
        : '역할을 섞지 못했습니다. 최신 브라우저에서 다시 시도해주세요.');
      return false;
    }
  }, [clearHostRevealState]);

  const handleAssign = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validation = validateSetup(mode, participants, toRoleInputs());
    setIssues(validation.issues);
    if (!validation.valid) {
      focusFirstIssue(validation.issues);
      return;
    }

    setParticipants((current) => current.map((participant, index) => ({
      ...participant,
      name: validation.participants[index],
    })));
    if (mode === 'role') {
      setRoles((current) => current.map((role, index) => ({
        ...role,
        name: validation.roles[index].name,
        count: String(validation.roles[index].count),
      })));
    }
    startAssignment(mode, validation.participants, validation.roles);
  };

  const addParticipant = () => {
    if (participants.length >= LIMITS.maxParticipants) return;
    const id = `participant-${participantIdRef.current}`;
    participantIdRef.current += 1;
    setParticipants((current) => [...current, { id, name: '' }]);
    clearIssuesFor('participants');
  };

  const removeParticipant = (id: string) => {
    if (participants.length <= LIMITS.minParticipants) return;
    setParticipants((current) => current.filter((participant) => participant.id !== id));
    clearIssuesFor(`participant:${id}`, 'participants', 'roles');
  };

  const addRole = () => {
    if (roles.length >= LIMITS.maxRoles) return;
    const id = `role-${roleIdRef.current}`;
    roleIdRef.current += 1;
    setRoles((current) => [...current, { id, name: '', count: '0' }]);
    clearIssuesFor('roles');
  };

  const removeRole = (id: string) => {
    if (roles.length <= 1) return;
    setRoles((current) => current.filter((role) => role.id !== id));
    clearIssuesFor(`role-name:${id}`, `role-count:${id}`, 'roles');
  };

  const resetSetup = useCallback(() => {
    if (shuffleTimerRef.current !== null) window.clearTimeout(shuffleTimerRef.current);
    shuffleTimerRef.current = null;
    setMode('role');
    setParticipants(initialParticipants());
    setRoles(initialRoles());
    participantIdRef.current = 3;
    roleIdRef.current = 2;
    setAssignments([]);
    setIssues([]);
    setRuntimeError('');
    setConfirmation(null);
    setLinkPayload(null);
    setInvalidLink(null);
    setPersonalLinkRevealed(false);
    setSharedName('');
    setSharedError('');
    setSharedMatch(null);
    setSharedRevealed(false);
    clearHostRevealState();
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    setViewState('setup');
    setHashChecked(true);
  }, [clearHostRevealState]);

  const confirmReassign = () => {
    setConfirmation(null);
    const validation = validateSetup(mode, participants, toRoleInputs());
    if (!validation.valid) {
      setIssues(validation.issues);
      setViewState('setup');
      focusFirstIssue(validation.issues);
      return;
    }
    startAssignment(mode, validation.participants, validation.roles);
  };

  const shareLinks = useMemo(() => {
    const unavailable: LinkBuildResult = { url: null, error: '링크를 준비하는 중입니다.' };
    const personal = new Map<string, LinkBuildResult>();
    if (!hashChecked || assignments.length === 0 || typeof window === 'undefined') {
      return { shared: unavailable, personal };
    }

    const build = (payload: ResultPayload): LinkBuildResult => {
      try {
        return { url: buildResultUrl(window.location, payload) };
      } catch (error) {
        return {
          url: null,
          error: error instanceof PayloadError && error.code === 'too-long'
            ? '공유 링크가 8,192자를 넘었습니다. 이름이나 역할 길이를 줄여주세요.'
            : '공유 링크를 만들 수 없습니다. 입력 내용을 확인해주세요.',
        };
      }
    };

    assignments.forEach((assignment) => {
      personal.set(createLookupKey(assignment.name), build(createPersonalPayload(mode, assignment)));
    });
    return {
      shared: build(createSharedPayload(mode, assignments)),
      personal,
    };
  }, [assignments, hashChecked, mode]);

  const handleSharedLookup = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!linkPayload || linkPayload.kind !== 'shared') return;
    const key = createLookupKey(sharedName);
    const match = linkPayload.assignments.find((assignment) => createLookupKey(assignment.name) === key);
    if (!key || !match) {
      setSharedError('이름을 다시 확인해주세요');
      setSharedMatch(null);
      setSharedRevealed(false);
      sharedNameRef.current?.focus();
      return;
    }
    setSharedError('');
    setSharedName(normalizeDisplayValue(sharedName));
    setSharedMatch(match);
    setSharedRevealed(false);
  };

  if (!hashChecked) {
    return (
      <div className="ra-page-shell flex min-h-[420px] items-center justify-center" role="status">
        <div className="ra-loading-seal" aria-hidden="true">🎴</div>
        <span className="sr-only">결과 링크를 확인하는 중입니다.</span>
      </div>
    );
  }

  if (viewState === 'invalid-link' && invalidLink) {
    return (
      <LinkPageFrame>
        <section className="ra-link-panel text-center" aria-labelledby="invalid-link-title">
          <div className="ra-status-symbol ra-status-symbol-error" aria-hidden="true">!</div>
          <h1 id="invalid-link-title" className="mt-5 text-3xl font-black text-white">{invalidLink.title}</h1>
          <p className="mx-auto mt-3 max-w-lg leading-7 text-slate-300">{invalidLink.message}</p>
          <button type="button" onClick={resetSetup} className="ra-btn-primary mt-8 w-full">
            새 역할 뽑기
          </button>
        </section>
      </LinkPageFrame>
    );
  }

  if (viewState === 'personal-link' && linkPayload?.kind === 'personal') {
    const label = resultLabel(linkPayload.mode);
    return (
      <LinkPageFrame>
        <section className="ra-link-panel" aria-labelledby="personal-link-title">
          <p className="ra-section-kicker">개인 결과 링크</p>
          <h1 id="personal-link-title" className="mt-2 break-words text-3xl font-black text-white">
            {linkPayload.assignment.name}님께 전달된 결과
          </h1>

          <div className="ra-secret-stage mt-8">
            {!personalLinkRevealed ? (
              <>
                <span className="ra-secret-seal" aria-hidden="true">봉인</span>
                <p className="text-sm font-bold text-pink-200">주변에 화면을 볼 사람이 없는지 확인해주세요.</p>
                <button
                  type="button"
                  onClick={() => setPersonalLinkRevealed(true)}
                  className="ra-btn-primary mt-5 w-full"
                >
                  {label} 확인하기
                </button>
              </>
            ) : (
              <div aria-live="polite">
                <p className="text-sm font-bold text-cyan-200">나의 {label}</p>
                <p className="mt-3 break-words text-3xl font-black leading-tight text-white">
                  {linkPayload.assignment.role}
                </p>
                <button
                  type="button"
                  onClick={() => setPersonalLinkRevealed(false)}
                  className="ra-btn-secondary mt-6 w-full"
                >
                  결과 숨기기
                </button>
              </div>
            )}
          </div>

          <PrivacyNotice />
          <button type="button" onClick={resetSetup} className="ra-btn-tertiary mt-6 w-full">
            새 역할 뽑기
          </button>
        </section>
      </LinkPageFrame>
    );
  }

  if (viewState === 'shared-link' && linkPayload?.kind === 'shared') {
    const label = resultLabel(linkPayload.mode);
    return (
      <LinkPageFrame>
        <section className="ra-link-panel" aria-labelledby="shared-link-title">
          <p className="ra-section-kicker">공용 결과 링크</p>
          <h1 id="shared-link-title" className="mt-2 text-3xl font-black text-white">내 결과 찾기</h1>
          <p className="mt-3 leading-7 text-slate-300">
            배정할 때 사용한 이름을 정확히 입력하세요. 참가자 목록은 표시하지 않습니다.
          </p>

          {!sharedMatch ? (
            <form onSubmit={handleSharedLookup} className="mt-7" noValidate>
              <label htmlFor="shared-name" className="ra-label">참가자 이름</label>
              <input
                ref={sharedNameRef}
                id="shared-name"
                type="text"
                value={sharedName}
                onChange={(event) => {
                  setSharedName(event.target.value);
                  setSharedError('');
                }}
                aria-invalid={Boolean(sharedError)}
                aria-describedby={sharedError ? 'shared-name-error' : undefined}
                autoComplete="off"
                className="ra-input mt-2"
              />
              {sharedError && (
                <p id="shared-name-error" className="ra-field-error" role="alert">{sharedError}</p>
              )}
              <button type="submit" className="ra-btn-primary mt-4 w-full">내 결과 찾기</button>
            </form>
          ) : (
            <div className="ra-secret-stage mt-8">
              {!sharedRevealed ? (
                <>
                  <span className="ra-secret-seal" aria-hidden="true">봉인</span>
                  <p className="break-words text-xl font-black text-white">{sharedMatch.name}님</p>
                  <p className="mt-2 text-sm text-slate-300">본인이라면 아래 버튼을 눌러주세요.</p>
                  <button
                    type="button"
                    onClick={() => setSharedRevealed(true)}
                    className="ra-btn-primary mt-5 w-full"
                  >
                    {label} 확인하기
                  </button>
                </>
              ) : (
                <div aria-live="polite">
                  <p className="text-sm font-bold text-cyan-200">{sharedMatch.name}님의 {label}</p>
                  <p className="mt-3 break-words text-3xl font-black leading-tight text-white">
                    {sharedMatch.role}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSharedRevealed(false);
                      setSharedMatch(null);
                      setSharedName('');
                      window.requestAnimationFrame(() => sharedNameRef.current?.focus());
                    }}
                    className="ra-btn-secondary mt-6 w-full"
                  >
                    확인 완료
                  </button>
                </div>
              )}
            </div>
          )}

          <PrivacyNotice shared />
          <button type="button" onClick={resetSetup} className="ra-btn-tertiary mt-6 w-full">
            새 역할 뽑기
          </button>
        </section>
      </LinkPageFrame>
    );
  }

  if (viewState === 'shuffling') {
    return (
      <div className="ra-page-shell ra-shuffle-screen" role="status" aria-live="polite">
        <div className="ra-shuffle-stage" aria-hidden="true">
          <div className="ra-shuffle-card ra-shuffle-card-left">?</div>
          <div className="ra-shuffle-card ra-shuffle-card-center">🎴</div>
          <div className="ra-shuffle-card ra-shuffle-card-right">?</div>
        </div>
        <p className="mt-10 text-2xl font-black text-white">결과를 안전하게 섞는 중</p>
        <p className="mt-2 text-sm text-slate-300">결과는 이 브라우저 안에서만 만들어집니다.</p>
      </div>
    );
  }

  if (viewState === 'results') {
    const label = resultLabel(mode);
    return (
      <div className="ra-page-shell">
        <header className="ra-results-header">
          <div className="ra-status-symbol" aria-hidden="true">✓</div>
          <div>
            <p className="ra-section-kicker">배정 완료</p>
            <h1 className="mt-1 text-3xl font-black text-white">{label} 배정이 끝났습니다</h1>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              아직 어떤 결과도 공개하지 않았습니다. 확인할 방법을 선택해주세요.
            </p>
          </div>
        </header>

        <div className="ra-memory-warning" role="note">
          <span aria-hidden="true">⌛</span>
          <p>
            전체 결과는 이 브라우저 메모리에만 있습니다. 새로고침하거나 페이지를 떠나면 복구할 수 없습니다.
          </p>
        </div>

        <div className="ra-result-actions">
          <button
            type="button"
            onClick={() => {
              closeParticipantDialog();
              if (showAllResults) setShowAllResults(false);
              else setShowAllConfirm(true);
            }}
            className="ra-btn-primary"
          >
            <span aria-hidden="true">{showAllResults ? '◉' : '◎'}</span>
            {showAllResults ? '모두 숨기기' : '전체 결과 보기'}
          </button>
          <ShareControl
            url={shareLinks.shared.url}
            disabledReason={shareLinks.shared.error}
            label="공용 링크 공유"
            shareTitle={`${label} 배정 공용 결과`}
          />
        </div>

        {showAllResults && (
          <section className="ra-all-results" aria-labelledby="all-results-title">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="ra-section-kicker">같은 화면에 공개 중</p>
                <h2 id="all-results-title" className="mt-1 text-xl font-black text-white">전체 결과</h2>
              </div>
              <button type="button" onClick={() => setShowAllResults(false)} className="ra-btn-tertiary">
                모두 숨기기
              </button>
            </div>
            <ul className="mt-5 divide-y divide-slate-700/70">
              {assignments.map((assignment) => (
                <li key={createLookupKey(assignment.name)} className="ra-revealed-row">
                  <span className="break-words font-bold text-slate-200">{assignment.name}</span>
                  <span className="break-words text-right font-black text-cyan-200">{assignment.role}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-10" aria-labelledby="participant-results-title">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="ra-section-kicker">한 명씩 건네보기</p>
              <h2 id="participant-results-title" className="mt-1 text-xl font-black text-white">참가자 결과</h2>
            </div>
            <span className="text-sm font-bold text-pink-200">{assignments.length}명</span>
          </div>
          <ul className="ra-participant-results mt-4">
            {assignments.map((assignment) => {
              const personalLink = shareLinks.personal.get(createLookupKey(assignment.name));
              return (
                <li key={createLookupKey(assignment.name)} className="ra-participant-result-row">
                  <div className="ra-participant-identity">
                    <span className="ra-avatar" aria-hidden="true">
                      {[...assignment.name][0]?.toUpperCase() ?? '?'}
                    </span>
                    <span className="min-w-0 break-words font-black text-white">{assignment.name}</span>
                  </div>
                  <div className="ra-row-actions">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAllResults(false);
                        setParticipantRevealed(false);
                        setSelectedAssignment(assignment);
                      }}
                      className="ra-btn-tertiary"
                    >
                      결과 보기
                    </button>
                    <ShareControl
                      compact
                      url={personalLink?.url ?? null}
                      disabledReason={personalLink?.error ?? '개인 링크를 준비하지 못했습니다.'}
                      label="개인 링크 공유"
                      shareTitle={`${assignment.name}님의 ${label} 결과`}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <PrivacyNotice shared />

        <div className="ra-bottom-actions">
          <button type="button" onClick={() => setConfirmation('new-game')} className="ra-btn-secondary">
            새 게임
          </button>
          <button type="button" onClick={() => setConfirmation('reassign')} className="ra-btn-tertiary">
            다시 배정
          </button>
        </div>

        <AccessibleDialog
          open={showAllConfirm}
          onClose={() => setShowAllConfirm(false)}
          title="전체 결과를 공개할까요?"
          description="같은 화면에 모든 참가자의 결과가 한꺼번에 표시됩니다. 주변 사람이 함께 봐도 괜찮을 때만 계속해주세요."
        >
          <div className="ra-dialog-actions">
            <button type="button" onClick={() => setShowAllConfirm(false)} className="ra-btn-secondary">
              취소
            </button>
            <button
              type="button"
              onClick={() => {
                closeParticipantDialog();
                setShowAllConfirm(false);
                setShowAllResults(true);
              }}
              className="ra-btn-primary"
            >
              전체 결과 공개
            </button>
          </div>
        </AccessibleDialog>

        <AccessibleDialog
          open={Boolean(selectedAssignment)}
          onClose={closeParticipantDialog}
          title={selectedAssignment ? `${selectedAssignment.name}님의 결과` : '참가자 결과'}
          description="기기를 해당 참가자에게 건넨 뒤 본인이 직접 확인하게 해주세요."
        >
          {selectedAssignment && (
            <div className="ra-secret-stage mt-6">
              {!participantRevealed ? (
                <>
                  <span className="ra-secret-seal" aria-hidden="true">봉인</span>
                  <p className="break-words text-2xl font-black text-white">{selectedAssignment.name}님</p>
                  <p className="mt-2 text-sm text-slate-300">본인이라면 아래 버튼을 눌러주세요.</p>
                  <button
                    type="button"
                    onClick={() => setParticipantRevealed(true)}
                    className="ra-btn-primary mt-5 w-full"
                  >
                    {label} 확인하기
                  </button>
                </>
              ) : (
                <div aria-live="polite">
                  <p className="text-sm font-bold text-cyan-200">{selectedAssignment.name}님의 {label}</p>
                  <p className="mt-3 break-words text-3xl font-black leading-tight text-white">
                    {selectedAssignment.role}
                  </p>
                  <button type="button" onClick={closeParticipantDialog} className="ra-btn-secondary mt-6 w-full">
                    확인 완료
                  </button>
                </div>
              )}
            </div>
          )}
        </AccessibleDialog>

        <AccessibleDialog
          open={confirmation !== null}
          onClose={() => setConfirmation(null)}
          title={confirmation === 'reassign' ? '결과를 다시 배정할까요?' : '새 게임을 시작할까요?'}
          description="이미 복사하거나 공유한 링크는 취소되지 않으며, 이전 결과를 계속 보여줍니다."
        >
          <div className="ra-dialog-actions">
            <button type="button" onClick={() => setConfirmation(null)} className="ra-btn-secondary">취소</button>
            <button
              type="button"
              onClick={confirmation === 'reassign' ? confirmReassign : resetSetup}
              className="ra-btn-primary"
            >
              {confirmation === 'reassign' ? '다시 배정' : '새 게임 시작'}
            </button>
          </div>
        </AccessibleDialog>
      </div>
    );
  }

  const participantSectionError = issueFor('participants');
  const roleSectionError = issueFor('roles');

  return (
    <div className="ra-page-shell">
      <header className="ra-hero">
        <div className="ra-hero-mark" aria-hidden="true">🎭</div>
        <div>
          <h1 className="text-4xl font-black tracking-[-0.03em] text-white sm:text-5xl">역할 뽑기</h1>
          <p className="mt-3 max-w-xl text-base leading-7 text-slate-300">
            참가자와 역할을 입력하면 이 브라우저 안에서 바로 섞습니다. 결과는 한 명씩 보여주거나 링크로 나눌 수 있어요.
          </p>
        </div>
      </header>

      <form onSubmit={handleAssign} noValidate className="mt-10">
        <fieldset
          ref={setFieldRef('participants')}
          tabIndex={-1}
          className="ra-form-section"
          aria-describedby={participantSectionError ? 'participants-error' : 'participants-help'}
        >
          <legend className="ra-form-legend">
            <span>참가자</span>
            <span className="ra-count-badge">{participants.length}/{LIMITS.maxParticipants}명</span>
          </legend>
          <div className="ra-section-heading-row">
            <p id="participants-help" className="text-sm leading-6 text-slate-300">
              2–20명, 이름은 20자·UTF-8 80바이트까지 입력할 수 있습니다.
            </p>
            <button
              type="button"
              onClick={() => {
                setParticipants(initialParticipants());
                participantIdRef.current = 3;
                setIssues([]);
              }}
              className="ra-icon-button"
              aria-label="참가자 입력 초기화"
            >
              <span aria-hidden="true">↺</span>
            </button>
          </div>
          {participantSectionError && (
            <p id="participants-error" className="ra-field-error" role="alert">{participantSectionError}</p>
          )}

          <div className="ra-input-list">
            {participants.map((participant, index) => {
              const field: ValidationField = `participant:${participant.id}`;
              const error = issueFor(field);
              const measure = textMeasure(
                participant.name,
                LIMITS.maxParticipantCodePoints,
                LIMITS.maxParticipantBytes,
              );
              const inputId = `participant-input-${participant.id}`;
              const helpId = `participant-help-${participant.id}`;
              const errorId = `participant-error-${participant.id}`;
              return (
                <div key={participant.id} className="ra-input-row">
                  <div className="min-w-0 flex-1">
                    <label htmlFor={inputId} className="ra-label">참가자 {index + 1}</label>
                    <input
                      ref={setFieldRef(field) as (element: HTMLInputElement | null) => void}
                      id={inputId}
                      type="text"
                      value={participant.name}
                      onChange={(event) => {
                        const value = event.target.value;
                        setParticipants((current) => current.map((item) => (
                          item.id === participant.id ? { ...item, name: value } : item
                        )));
                        clearIssuesFor(field, 'participants', 'roles');
                      }}
                      onBlur={() => {
                        setParticipants((current) => current.map((item) => (
                          item.id === participant.id
                            ? { ...item, name: normalizeDisplayValue(item.name) }
                            : item
                        )));
                      }}
                      aria-invalid={Boolean(error) || measure.over}
                      aria-describedby={`${helpId}${error ? ` ${errorId}` : ''}`}
                      autoComplete="off"
                      className="ra-input mt-2"
                    />
                    <div className="ra-input-meta">
                      <span id={helpId} className={measure.over ? 'text-red-300' : undefined}>{measure.text}</span>
                      {error && <span id={errorId} className="ra-field-error" role="alert">{error}</span>}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeParticipant(participant.id)}
                    disabled={participants.length <= LIMITS.minParticipants}
                    className="ra-remove-button"
                    aria-label={`참가자 ${index + 1} 삭제`}
                  >
                    <span aria-hidden="true">×</span>
                  </button>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={addParticipant}
            disabled={participants.length >= LIMITS.maxParticipants}
            className="ra-add-button"
          >
            <span aria-hidden="true">＋</span>
            {participants.length >= LIMITS.maxParticipants ? '최대 20명입니다' : '참가자 추가'}
          </button>
        </fieldset>

        <fieldset className="ra-form-section">
          <legend className="ra-form-legend">배정 종류</legend>
          <p className="text-sm leading-6 text-slate-300">공개 방법과 관계없이 어떤 결과를 뽑을지 선택합니다.</p>
          <div className="ra-mode-switch" role="radiogroup" aria-label="배정 종류">
            <button
              type="button"
              role="radio"
              aria-checked={mode === 'role'}
              onClick={() => {
                setMode('role');
                setIssues([]);
              }}
              className={mode === 'role' ? 'ra-mode-option ra-mode-option-active' : 'ra-mode-option'}
            >
              <span className="font-black">일반 역할</span>
              <span className="text-xs">역할과 인원수를 직접 구성</span>
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={mode === 'manito'}
              onClick={() => {
                setMode('manito');
                setIssues([]);
              }}
              className={mode === 'manito' ? 'ra-mode-option ra-mode-option-active' : 'ra-mode-option'}
            >
              <span className="font-black">마니또</span>
              <span className="text-xs">자기 자신 없이 하나의 순환으로 배정</span>
            </button>
          </div>
        </fieldset>

        {mode === 'role' ? (
          <fieldset
            ref={setFieldRef('roles')}
            tabIndex={-1}
            className="ra-form-section"
            aria-describedby={roleSectionError ? 'roles-error' : 'roles-help'}
          >
            <legend className="ra-form-legend">
              <span>역할 설정</span>
              <span className="ra-count-badge">{roles.length}/{LIMITS.maxRoles}개</span>
            </legend>
            <div className="ra-section-heading-row">
              <p id="roles-help" className="text-sm leading-6 text-slate-300">
                역할 이름은 30자·120바이트까지, 인원은 0–20명으로 설정합니다.
              </p>
              <button
                type="button"
                onClick={() => {
                  setRoles(initialRoles());
                  roleIdRef.current = 2;
                  setIssues([]);
                }}
                className="ra-icon-button"
                aria-label="역할 입력 초기화"
              >
                <span aria-hidden="true">↺</span>
              </button>
            </div>
            {roleSectionError && (
              <p id="roles-error" className="ra-field-error" role="alert">{roleSectionError}</p>
            )}

            <div className="ra-input-list">
              {roles.map((role, index) => {
                const nameField: ValidationField = `role-name:${role.id}`;
                const countField: ValidationField = `role-count:${role.id}`;
                const nameError = issueFor(nameField);
                const countError = issueFor(countField);
                const measure = textMeasure(role.name, LIMITS.maxRoleCodePoints, LIMITS.maxRoleBytes);
                const nameId = `role-name-${role.id}`;
                const countId = `role-count-${role.id}`;
                return (
                  <div key={role.id} className="ra-role-row">
                    <div className="min-w-0 flex-1">
                      <label htmlFor={nameId} className="ra-label">역할 {index + 1}</label>
                      <input
                        ref={setFieldRef(nameField) as (element: HTMLInputElement | null) => void}
                        id={nameId}
                        type="text"
                        value={role.name}
                        onChange={(event) => {
                          const value = event.target.value;
                          setRoles((current) => current.map((item) => (
                            item.id === role.id ? { ...item, name: value } : item
                          )));
                          clearIssuesFor(nameField, 'roles');
                        }}
                        onBlur={() => {
                          setRoles((current) => current.map((item) => (
                            item.id === role.id
                              ? { ...item, name: normalizeDisplayValue(item.name) }
                              : item
                          )));
                        }}
                        aria-invalid={Boolean(nameError) || measure.over}
                        aria-describedby={`role-name-help-${role.id}${nameError ? ` role-name-error-${role.id}` : ''}`}
                        className="ra-input mt-2"
                      />
                      <div className="ra-input-meta">
                        <span id={`role-name-help-${role.id}`} className={measure.over ? 'text-red-300' : undefined}>
                          {measure.text}
                        </span>
                        {nameError && (
                          <span id={`role-name-error-${role.id}`} className="ra-field-error" role="alert">{nameError}</span>
                        )}
                      </div>
                    </div>
                    <div className="ra-count-field">
                      <label htmlFor={countId} className="ra-label">인원</label>
                      <div className="relative mt-2">
                        <input
                          ref={setFieldRef(countField) as (element: HTMLInputElement | null) => void}
                          id={countId}
                          type="number"
                          min="0"
                          max="20"
                          step="1"
                          inputMode="numeric"
                          value={role.count}
                          onChange={(event) => {
                            const value = event.target.value;
                            setRoles((current) => current.map((item) => (
                              item.id === role.id ? { ...item, count: value } : item
                            )));
                            clearIssuesFor(countField, 'roles');
                          }}
                          aria-invalid={Boolean(countError)}
                          aria-describedby={`role-count-help-${role.id}${countError ? ` role-count-error-${role.id}` : ''}`}
                          className="ra-input ra-count-input"
                        />
                        <span className="ra-count-unit" aria-hidden="true">명</span>
                      </div>
                      <p id={`role-count-help-${role.id}`} className="mt-2 text-xs leading-5 text-slate-400">
                        0명 = 나머지
                      </p>
                      {countError && (
                        <p id={`role-count-error-${role.id}`} className="ra-field-error" role="alert">{countError}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeRole(role.id)}
                      disabled={roles.length <= 1}
                      className="ra-remove-button ra-role-remove"
                      aria-label={`역할 ${index + 1} 삭제`}
                    >
                      <span aria-hidden="true">×</span>
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="ra-inline-tip">
              <span aria-hidden="true">💡</span>
              <p>0명 역할은 하나만 둘 수 있고, 지정 인원 뒤 남은 참가자를 모두 채웁니다.</p>
            </div>
            <button
              type="button"
              onClick={addRole}
              disabled={roles.length >= LIMITS.maxRoles}
              className="ra-add-button"
            >
              <span aria-hidden="true">＋</span>
              {roles.length >= LIMITS.maxRoles ? '최대 20개입니다' : '역할 추가'}
            </button>
          </fieldset>
        ) : (
          <section className="ra-form-section" aria-labelledby="manito-title">
            <p className="ra-section-kicker">마니또 배정</p>
            <h2 id="manito-title" className="mt-1 text-xl font-black text-white">한 사람도 자기 자신을 뽑지 않습니다</h2>
            <p className="mt-3 leading-7 text-slate-300">
              참가자 모두가 한 번씩 주고받는 단일 순환으로 섞습니다. 역할 입력은 필요하지 않습니다.
            </p>
          </section>
        )}

        {runtimeError && (
          <p className="ra-runtime-error" role="alert" tabIndex={-1}>{runtimeError}</p>
        )}

        <button type="submit" className="ra-btn-primary ra-assign-button">
          <span aria-hidden="true">🎲</span>
          {mode === 'manito' ? '마니또 배정하기' : '역할 배정하기'}
        </button>
      </form>

      <section className="ra-guide" aria-labelledby="guide-title">
        <div>
          <p className="ra-section-kicker">어떻게 공개하나요?</p>
          <h2 id="guide-title" className="mt-1 text-xl font-black text-white">배정 뒤에 원하는 방법을 고릅니다</h2>
        </div>
        <ol className="ra-guide-steps">
          <li><strong>같은 기기</strong><span>전체를 확인하거나 폰을 한 명씩 건넵니다.</span></li>
          <li><strong>개인 링크</strong><span>한 참가자의 결과 하나만 담아 보냅니다.</span></li>
          <li><strong>공용 링크</strong><span>전체 결과를 담고 각자 이름으로 찾습니다.</span></li>
        </ol>
        <p className="text-sm leading-6 text-slate-300">
          결과는 서버나 데이터베이스에 저장하지 않습니다. 링크는 암호화되지 않으며, 이미 보낸 링크는 다시 배정해도 만료되거나 바뀌지 않습니다.
        </p>
      </section>
    </div>
  );
}
