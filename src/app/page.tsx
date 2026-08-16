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
  createCryptoRandomIndex,
  createLookupKey,
  limitDisplayInput,
  normalizeDisplayValue,
  validateSetup,
} from '@/utils';

type ViewState =
  | 'setup'
  | 'shuffling'
  | 'results'
  | 'personal-link'
  | 'shared-link'
  | 'invalid-link';

type RevealMode = 'public' | 'individual';

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

interface InputLimitWarning {
  message: string;
  sequence: number;
}

const initialParticipants = (): ParticipantDraft[] => [
  { id: 'participant-1', name: '' },
  { id: 'participant-2', name: '' },
];

const initialRoles = (): RoleDraft[] => [
  { id: 'role-1', name: '', count: '1' },
];

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
  const [revealMode, setRevealMode] = useState<RevealMode>('public');
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
  const [inputLimitWarnings, setInputLimitWarnings] = useState<Record<string, InputLimitWarning>>({});

  const participantIdRef = useRef(3);
  const roleIdRef = useRef(2);
  const shuffleTimerRef = useRef<number | null>(null);
  const inputLimitSequencesRef = useRef(new Map<ValidationField, number>());
  const inputLimitTimersRef = useRef(new Map<ValidationField, number>());
  const composingFieldsRef = useRef(new Set<ValidationField>());
  const fieldRefs = useRef(new Map<ValidationField, HTMLElement>());
  const sharedNameRef = useRef<HTMLInputElement>(null);

  const clearInputLimitWarning = useCallback((field: ValidationField) => {
    const timer = inputLimitTimersRef.current.get(field);
    if (timer !== undefined) window.clearTimeout(timer);
    inputLimitTimersRef.current.delete(field);
    inputLimitSequencesRef.current.delete(field);
    setInputLimitWarnings((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }, []);

  const clearAllInputLimitWarnings = useCallback(() => {
    inputLimitTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    inputLimitTimersRef.current.clear();
    inputLimitSequencesRef.current.clear();
    composingFieldsRef.current.clear();
    setInputLimitWarnings({});
  }, []);

  const triggerInputLimitWarning = useCallback((field: ValidationField, maxCodePoints: number) => {
    const existingTimer = inputLimitTimersRef.current.get(field);
    if (existingTimer !== undefined) window.clearTimeout(existingTimer);

    const sequence = (inputLimitSequencesRef.current.get(field) ?? 0) + 1;
    inputLimitSequencesRef.current.set(field, sequence);
    setInputLimitWarnings((current) => ({
      ...current,
      [field]: {
        message: `최대 ${maxCodePoints}자까지 입력할 수 있어요.`,
        sequence,
      },
    }));

    const timer = window.setTimeout(() => {
      inputLimitTimersRef.current.delete(field);
      inputLimitSequencesRef.current.delete(field);
      setInputLimitWarnings((current) => {
        if (current[field]?.sequence !== sequence) return current;
        const next = { ...current };
        delete next[field];
        return next;
      });
    }, 1_800);
    inputLimitTimersRef.current.set(field, timer);
  }, []);

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
    inputLimitTimersRef.current.forEach((timer) => window.clearTimeout(timer));
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

  const applyBoundedNameInput = (
    field: ValidationField,
    value: string,
    maxCodePoints: number,
    maxBytes: number,
    commit: (nextValue: string) => void,
    composing = false,
    clearValidation = true,
  ) => {
    if (clearValidation) clearIssuesFor(field, 'participants', 'roles');
    if (composing) {
      clearInputLimitWarning(field);
      commit(value);
      return;
    }

    const limited = limitDisplayInput(value, maxCodePoints, maxBytes);
    commit(limited.value);
    if (limited.exceeded) triggerInputLimitWarning(field, maxCodePoints);
    else clearInputLimitWarning(field);
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
    const field: ValidationField = `participant:${id}`;
    clearInputLimitWarning(field);
    composingFieldsRef.current.delete(field);
    setParticipants((current) => current.filter((participant) => participant.id !== id));
    clearIssuesFor(field, 'participants', 'roles');
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
    const nameField: ValidationField = `role-name:${id}`;
    clearInputLimitWarning(nameField);
    composingFieldsRef.current.delete(nameField);
    setRoles((current) => current.filter((role) => role.id !== id));
    clearIssuesFor(nameField, `role-count:${id}`, 'roles');
  };

  const resetSetup = useCallback(() => {
    if (shuffleTimerRef.current !== null) window.clearTimeout(shuffleTimerRef.current);
    shuffleTimerRef.current = null;
    setRevealMode('public');
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
    clearAllInputLimitWarnings();
    clearHostRevealState();
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    setViewState('setup');
    setHashChecked(true);
  }, [clearAllInputLimitWarnings, clearHostRevealState]);

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
      <div className="ra-page-shell flex min-h-[400px] flex-col items-center justify-center" role="status" aria-live="polite">
        <div className="relative">
          <div className="mb-8 flex gap-4" aria-hidden="true">
            {[0, 1, 2].map((index) => (
              <div
                key={index}
                className="h-28 w-20 animate-float rounded-xl bg-gradient-to-br from-pink-500 via-purple-500 to-cyan-500 shadow-2xl"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="flex h-full w-full items-center justify-center rounded-xl bg-slate-900/50 backdrop-blur">
                  <span className="text-3xl">🎴</span>
                </div>
              </div>
            ))}
          </div>
          <div className="text-center">
            <p className="animate-pulse text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-purple-400 to-cyan-400">
              섞는 중...
            </p>
            <p className="sr-only">결과는 이 브라우저 안에서만 만들어집니다.</p>
            <div className="mt-4 flex justify-center gap-1" aria-hidden="true">
              {[0, 1, 2].map((index) => (
                <span
                  key={index}
                  className="h-3 w-3 animate-bounce rounded-full bg-pink-500"
                  style={{ animationDelay: `${index * 0.1}s` }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (viewState === 'results') {
    const label = resultLabel(mode);

    if (revealMode === 'public') {
      return (
        <div className="ra-page-shell">
          <header className="mb-8 text-center">
            <span className="inline-block animate-bounce-in text-6xl drop-shadow-lg" aria-hidden="true">🎉</span>
            <h1 className="mt-4 text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-pink-500 to-purple-500">
              {label} 배정 완료!
            </h1>
          </header>

          <section className={`ra-public-results-grid mb-8 grid gap-3 ${
            assignments.length <= 4
              ? 'grid-cols-1'
              : assignments.length <= 8
                ? 'grid-cols-1 sm:grid-cols-2'
                : 'grid-cols-2 sm:grid-cols-3'
          }`} aria-label="전체 결과">
            {assignments.map((assignment, index) => (
              <article
                key={createLookupKey(assignment.name)}
                className="relative overflow-hidden rounded-2xl animate-reveal"
                style={{ animationDelay: `${index * 0.08}s` }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-pink-500/20 via-purple-500/20 to-cyan-500/20" />
                <div className={`relative rounded-2xl border border-white/10 bg-slate-800/90 backdrop-blur-sm ${assignments.length > 4 ? 'p-3' : 'p-4'}`}>
                  <div className="mb-2 flex min-w-0 items-center gap-3">
                    <span className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-purple-600 font-bold text-white shadow-lg shadow-pink-500/30 ${assignments.length > 4 ? 'h-8 w-8 text-sm' : 'h-10 w-10 text-base'}`} aria-hidden="true">
                      {[...assignment.name][0]?.toUpperCase() ?? '?'}
                    </span>
                    <h2 className={`min-w-0 break-words font-bold text-white ${assignments.length > 4 ? 'text-sm' : 'text-base'}`}>
                      {assignment.name}
                    </h2>
                  </div>
                  <p className={`break-words rounded-xl bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 text-center font-black text-white shadow-lg shadow-orange-500/30 ${assignments.length > 4 ? 'px-3 py-1.5 text-sm' : 'px-4 py-2 text-base'}`}>
                    <span className="sr-only">{label}: </span>
                    <span>{assignment.role}</span>
                  </p>
                </div>
              </article>
            ))}
          </section>

          <div className="ra-public-share mb-4">
            <ShareControl
              url={shareLinks.shared.url}
              disabledReason={shareLinks.shared.error}
              label="결과 공유하기"
              shareTitle={`${label} 배정 공용 결과`}
            />
          </div>

          <div className="ra-memory-warning" role="note">
            <span aria-hidden="true">⌛</span>
            <p>
              전체 결과는 이 브라우저 메모리에만 있습니다. 새로고침하거나 페이지를 떠나면 복구할 수 없습니다.
            </p>
          </div>

          <PrivacyNotice shared />

          <div className="mt-7 flex gap-4">
            <button type="button" onClick={() => setConfirmation('new-game')} className="ra-btn-secondary flex-1">
              <span aria-hidden="true">🔄</span>
              새 게임
            </button>
            <button type="button" onClick={() => setConfirmation('reassign')} className="ra-btn-primary flex-1">
              <span aria-hidden="true">🎲</span>
              다시 배정
            </button>
          </div>

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
      <header className="ra-hero mb-8">
        <h1 className="text-4xl font-black sm:text-5xl">
          <span className="mr-2" aria-hidden="true">🎭</span>
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-purple-400 to-cyan-400">
            역할 뽑기
          </span>
        </h1>
        <p className="mt-2 text-sm text-slate-400 sm:text-base">
          마피아, 마니또 역할을 간편하고 몰래 뽑아보세요!
        </p>
      </header>

      <div className="ra-reveal-switch" role="radiogroup" aria-label="공개 방식">
        <button
          type="button"
          role="radio"
          aria-checked={revealMode === 'public'}
          onClick={() => setRevealMode('public')}
          className={revealMode === 'public' ? 'ra-reveal-option ra-reveal-option-active' : 'ra-reveal-option'}
        >
          전체 공개
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={revealMode === 'individual'}
          onClick={() => setRevealMode('individual')}
          className={revealMode === 'individual' ? 'ra-reveal-option ra-reveal-option-active' : 'ra-reveal-option'}
        >
          개별 공개
        </button>
      </div>
      <p className="sr-only" aria-live="polite">
        {revealMode === 'public'
          ? '배정이 끝나면 모든 결과를 한 화면에 바로 표시합니다.'
          : '서버 연결 없이 배정하고, 모든 결과를 숨긴 상태에서 한 명씩 확인합니다.'}
      </p>

      <form onSubmit={handleAssign} noValidate>
        <section
          ref={setFieldRef('participants')}
          tabIndex={-1}
          className="mb-8"
          aria-labelledby="participants-title"
          aria-describedby={participantSectionError ? 'participants-error' : 'participants-help'}
        >
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl" aria-hidden="true">👥</span>
              <h2 id="participants-title" className="text-xl font-black text-white">
                참가자
                <span className="ml-2 rounded-lg bg-pink-500/20 px-2 py-1 text-sm text-pink-400">
                  {participants.filter((participant) => normalizeDisplayValue(participant.name)).length}명
                </span>
              </h2>
            </div>
            <button
              type="button"
              onClick={() => {
                setParticipants(initialParticipants());
                participantIdRef.current = 3;
                setIssues([]);
                clearAllInputLimitWarnings();
              }}
              className="ra-icon-button ra-setup-reset hover:text-pink-400"
              aria-label="참가자 입력 초기화"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
          <p id="participants-help" className="sr-only">참가자는 최소 2명, 최대 20명입니다.</p>
          {participantSectionError && (
            <p id="participants-error" className="ra-field-error" role="alert">{participantSectionError}</p>
          )}

          <div className={`grid gap-3 ${
            participants.length <= 4
              ? 'grid-cols-1'
              : participants.length <= 8
                ? 'grid-cols-1 sm:grid-cols-2'
                : 'grid-cols-2 sm:grid-cols-3'
          }`}>
            {participants.map((participant, index) => {
              const field: ValidationField = `participant:${participant.id}`;
              const error = issueFor(field);
              const warning = inputLimitWarnings[field];
              const inputId = `participant-input-${participant.id}`;
              const warningId = `participant-limit-${participant.id}`;
              const errorId = `participant-error-${participant.id}`;
              const describedBy = [warning ? warningId : '', error ? errorId : '']
                .filter(Boolean)
                .join(' ') || undefined;
              const warningMotionClass = warning
                ? ` ra-input-limit-warning ra-input-limit-warning-${warning.sequence % 2 === 0 ? 'even' : 'odd'}`
                : '';
              return (
                <div
                  key={participant.id}
                  className={`ra-input-row group min-w-0 ${index > 1 ? 'animate-pop' : ''}`}
                >
                  <div className="flex min-w-0 gap-2">
                    <div className="min-w-0 flex-1">
                    <input
                      ref={setFieldRef(field) as (element: HTMLInputElement | null) => void}
                      id={inputId}
                      type="text"
                      value={participant.name}
                      placeholder={`참가자 ${index + 1}`}
                      onChange={(event) => {
                        applyBoundedNameInput(
                          field,
                          event.currentTarget.value,
                          LIMITS.maxParticipantCodePoints,
                          LIMITS.maxParticipantBytes,
                          (nextValue) => setParticipants((current) => current.map((item) => (
                            item.id === participant.id ? { ...item, name: nextValue } : item
                          ))),
                          composingFieldsRef.current.has(field),
                        );
                      }}
                      onCompositionStart={() => {
                        composingFieldsRef.current.add(field);
                        clearInputLimitWarning(field);
                      }}
                      onCompositionEnd={(event) => {
                        composingFieldsRef.current.delete(field);
                        applyBoundedNameInput(
                          field,
                          event.currentTarget.value,
                          LIMITS.maxParticipantCodePoints,
                          LIMITS.maxParticipantBytes,
                          (nextValue) => setParticipants((current) => current.map((item) => (
                            item.id === participant.id ? { ...item, name: nextValue } : item
                          ))),
                        );
                      }}
                      onBlur={(event) => {
                        composingFieldsRef.current.delete(field);
                        applyBoundedNameInput(
                          field,
                          normalizeDisplayValue(event.currentTarget.value),
                          LIMITS.maxParticipantCodePoints,
                          LIMITS.maxParticipantBytes,
                          (nextValue) => setParticipants((current) => current.map((item) => (
                            item.id === participant.id ? { ...item, name: nextValue } : item
                          ))),
                          false,
                          false,
                        );
                      }}
                      aria-invalid={Boolean(error)}
                      aria-describedby={describedBy}
                      aria-label={`참가자 ${index + 1}`}
                      autoComplete="off"
                      className={`ra-input w-full shadow-inner ${participants.length > 4 ? 'min-h-11 py-2.5 text-sm' : ''}${warningMotionClass}`}
                    />
                    {(warning || error) && <div className="ra-input-feedback">
                      {warning && (
                        <span
                          key={warning.sequence}
                          id={warningId}
                          className="ra-input-limit-message"
                          role="status"
                          aria-live="polite"
                        >
                          {warning.message}
                        </span>
                      )}
                      {error && <span id={errorId} className="ra-field-error" role="alert">{error}</span>}
                    </div>}
                    </div>
                    {participants.length > LIMITS.minParticipants && (
                      <button
                        type="button"
                        onClick={() => removeParticipant(participant.id)}
                        className={`flex shrink-0 items-center justify-center rounded-xl bg-red-500/20 font-bold text-red-400 transition-all duration-300 hover:bg-red-500 hover:text-white active:scale-90 ${
                          participants.length > 4 ? 'h-11 w-11 text-base' : 'h-12 w-12 text-xl'
                        }`}
                        aria-label={`참가자 ${index + 1} 삭제`}
                      >
                        <span aria-hidden="true">×</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={addParticipant}
            disabled={participants.length >= LIMITS.maxParticipants}
            className="ra-add-button ra-add-participant"
          >
            <span aria-hidden="true">＋</span>
            참가자 추가
          </button>
        </section>

        <section
            ref={setFieldRef('roles')}
            tabIndex={-1}
            className="mb-8"
            aria-labelledby="roles-title"
            aria-describedby={roleSectionError ? 'roles-error' : 'roles-help'}
          >
            <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl" aria-hidden="true">🎭</span>
                <h2 id="roles-title" className="text-xl font-black text-white">역할 설정</h2>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  role="switch"
                  aria-checked={mode === 'manito'}
                  aria-label="마니또 모드"
                  onClick={() => {
                    setMode((current) => current === 'manito' ? 'role' : 'manito');
                    setIssues([]);
                    setRuntimeError('');
                  }}
                  className="flex min-h-11 items-center gap-2 text-sm text-slate-400"
                >
                  <span aria-hidden="true">🎁 마니또</span>
                  <span className={`relative h-6 w-12 rounded-full transition-colors ${
                    mode === 'manito' ? 'bg-gradient-to-r from-pink-500 to-purple-500' : 'bg-slate-600'
                  }`} aria-hidden="true">
                    <span
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-md transition-transform ${
                        mode === 'manito' ? 'translate-x-6' : 'translate-x-0.5'
                      }`}
                    />
                  </span>
                </button>
              <button
                type="button"
                onClick={() => {
                  setRoles(initialRoles());
                  roleIdRef.current = 2;
                  setIssues([]);
                  clearAllInputLimitWarnings();
                }}
                className="ra-icon-button ra-setup-reset"
                aria-label="역할 입력 초기화"
                disabled={mode === 'manito'}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
              </div>
            </div>
            <p id="roles-help" className="sr-only">
              일반 역할은 역할별 인원수를 설정합니다. 마니또는 자기 자신을 제외하고 한 명씩 배정합니다.
            </p>
            {roleSectionError && (
              <p id="roles-error" className="ra-field-error" role="alert">{roleSectionError}</p>
            )}

            {mode === 'role' ? <>
            <div className={`grid gap-3 ${roles.length <= 3 ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
              {roles.map((role, index) => {
                const nameField: ValidationField = `role-name:${role.id}`;
                const countField: ValidationField = `role-count:${role.id}`;
                const nameError = issueFor(nameField);
                const countError = issueFor(countField);
                const warning = inputLimitWarnings[nameField];
                const nameId = `role-name-${role.id}`;
                const warningId = `role-name-limit-${role.id}`;
                const nameErrorId = `role-name-error-${role.id}`;
                const countId = `role-count-${role.id}`;
                const describedBy = [warning ? warningId : '', nameError ? nameErrorId : '']
                  .filter(Boolean)
                  .join(' ') || undefined;
                const warningMotionClass = warning
                  ? ` ra-input-limit-warning ra-input-limit-warning-${warning.sequence % 2 === 0 ? 'even' : 'odd'}`
                  : '';
                const numericCount = Number.isFinite(Number(role.count)) ? Number(role.count) : 0;
                return (
                  <div key={role.id} className={`ra-role-row min-w-0 ${index > 0 ? 'animate-pop' : ''}`}>
                    <div className="flex min-w-0 gap-2">
                      <div className="min-w-0 flex-1">
                      <input
                        ref={setFieldRef(nameField) as (element: HTMLInputElement | null) => void}
                        id={nameId}
                        type="text"
                        value={role.name}
                        placeholder="역할 이름"
                        onChange={(event) => {
                          applyBoundedNameInput(
                            nameField,
                            event.currentTarget.value,
                            LIMITS.maxRoleCodePoints,
                            LIMITS.maxRoleBytes,
                            (nextValue) => setRoles((current) => current.map((item) => (
                              item.id === role.id ? { ...item, name: nextValue } : item
                            ))),
                            composingFieldsRef.current.has(nameField),
                          );
                        }}
                        onCompositionStart={() => {
                          composingFieldsRef.current.add(nameField);
                          clearInputLimitWarning(nameField);
                        }}
                        onCompositionEnd={(event) => {
                          composingFieldsRef.current.delete(nameField);
                          applyBoundedNameInput(
                            nameField,
                            event.currentTarget.value,
                            LIMITS.maxRoleCodePoints,
                            LIMITS.maxRoleBytes,
                            (nextValue) => setRoles((current) => current.map((item) => (
                              item.id === role.id ? { ...item, name: nextValue } : item
                            ))),
                          );
                        }}
                        onBlur={(event) => {
                          composingFieldsRef.current.delete(nameField);
                          applyBoundedNameInput(
                            nameField,
                            normalizeDisplayValue(event.currentTarget.value),
                            LIMITS.maxRoleCodePoints,
                            LIMITS.maxRoleBytes,
                            (nextValue) => setRoles((current) => current.map((item) => (
                              item.id === role.id ? { ...item, name: nextValue } : item
                            ))),
                            false,
                            false,
                          );
                        }}
                        aria-invalid={Boolean(nameError)}
                        aria-describedby={describedBy}
                        aria-label={`역할 ${index + 1}`}
                        className={`ra-input w-full shadow-inner ${roles.length > 3 ? 'min-h-11 py-2.5 text-sm' : ''}${warningMotionClass}`}
                      />
                      {(warning || nameError) && <div className="ra-input-feedback">
                        {warning && (
                          <span
                            key={warning.sequence}
                            id={warningId}
                            className="ra-input-limit-message"
                            role="status"
                            aria-live="polite"
                          >
                            {warning.message}
                          </span>
                        )}
                        {nameError && (
                          <span id={nameErrorId} className="ra-field-error" role="alert">{nameError}</span>
                        )}
                      </div>}
                      </div>
                      <div className="shrink-0">
                      <div className="flex items-center overflow-hidden rounded-2xl border-2 border-slate-800 bg-slate-900">
                        <button
                          type="button"
                          onClick={() => {
                            setRoles((current) => current.map((item) => item.id === role.id
                              ? { ...item, count: String(Math.max(0, numericCount - 1)) }
                              : item));
                            clearIssuesFor(countField, 'roles');
                          }}
                          className={`min-w-11 bg-slate-900 font-bold text-slate-400 transition-colors hover:bg-slate-800 hover:text-white ${roles.length > 3 ? 'h-11' : 'h-12 text-lg'}`}
                          aria-label={`${index + 1}번째 역할 인원 줄이기`}
                        >
                          −
                        </button>
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
                          aria-label="인원"
                          className={`ra-count-stepper-input border-x-2 border-slate-800/50 bg-slate-900 text-center font-bold text-white outline-none ${roles.length > 3 ? 'h-11 w-10' : 'h-12 w-12 text-lg'}`}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setRoles((current) => current.map((item) => item.id === role.id
                              ? { ...item, count: String(Math.min(LIMITS.maxParticipants, numericCount + 1)) }
                              : item));
                            clearIssuesFor(countField, 'roles');
                          }}
                          className={`min-w-11 bg-slate-900 font-bold text-slate-400 transition-colors hover:bg-slate-800 hover:text-white ${roles.length > 3 ? 'h-11' : 'h-12 text-lg'}`}
                          aria-label={`${index + 1}번째 역할 인원 늘리기`}
                        >
                          +
                        </button>
                      </div>
                      <p id={`role-count-help-${role.id}`} className="sr-only">0명은 나머지 인원을 뜻합니다.</p>
                      {countError && (
                        <p id={`role-count-error-${role.id}`} className="ra-field-error" role="alert">{countError}</p>
                      )}
                      </div>
                      {roles.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeRole(role.id)}
                          className={`flex shrink-0 items-center justify-center rounded-xl bg-red-500/20 font-bold text-red-400 transition-all duration-300 hover:bg-red-500 hover:text-white active:scale-90 ${roles.length > 3 ? 'h-11 w-11 text-base' : 'h-12 w-12 text-xl'}`}
                          aria-label={`역할 ${index + 1} 삭제`}
                        >
                          <span aria-hidden="true">×</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="mt-3 flex items-center gap-2 pl-1 text-xs text-slate-400">
              <span aria-hidden="true">💡</span>
              * 0명으로 설정하면 나머지 인원이 해당 역할로 배정됩니다
            </p>
            <button
              type="button"
              onClick={addRole}
              disabled={roles.length >= LIMITS.maxRoles}
              className="ra-add-button"
            >
              <span aria-hidden="true">＋</span>
              역할 추가
            </button>
            </> : (
              <p className="rounded-xl bg-pink-500/10 px-4 py-3 text-sm leading-6 text-pink-100">
                🎁 참가자끼리 한 명씩 이어지며, 자기 자신은 배정되지 않습니다.
              </p>
            )}
          </section>

        {runtimeError && (
          <p className="ra-runtime-error" role="alert" tabIndex={-1}>{runtimeError}</p>
        )}

        <button type="submit" className="ra-btn-primary w-full py-5 text-lg">
          <span className="mr-3 text-2xl" aria-hidden="true">🎲</span>
          {mode === 'manito' ? '마니또 배정하기' : '역할 배정하기'}
          <span className="ml-3 text-2xl" aria-hidden="true">🎲</span>
        </button>
      </form>

      <section className="ra-guide" aria-labelledby="guide-title">
        <div>
          <h2 id="guide-title" className="mb-2 flex items-center gap-2 text-lg font-bold text-white">
            <span aria-hidden="true">💭</span> 만든 이유
          </h2>
          <p className="leading-relaxed text-slate-300">
            마피아 게임할 때 역할 정하기가 너무 귀찮았어요. 쪽지 쓰고, 접고, 섞고... 이제 폰 하나로 역할 배정을 끝낼 수 있습니다.
          </p>
        </div>
        <div>
          <h3 className="mb-3 flex items-center gap-2 text-lg font-bold text-white">
            <span aria-hidden="true">✨</span> 주요 기능
          </h3>
          <ul className="space-y-2 text-slate-300">
            <li>🤫 숨김 공개 - 한 기기에서 한 명씩 몰래 확인</li>
            <li>🔗 결과 링크 - 개인 또는 공용 링크로 전달</li>
            <li>🎯 스마트 자동 배정 - 0명 역할에 나머지 인원 배정</li>
          </ul>
        </div>
        <div>
          <h3 className="mb-3 flex items-center gap-2 text-lg font-bold text-white">
            <span aria-hidden="true">🎮</span> 사용 방법
          </h3>
          <div className="space-y-3">
            <div className="rounded-xl bg-slate-700/50 p-3">
              <p className="mb-1 font-medium text-cyan-400">🌐 전체 공개</p>
              <p className="text-sm text-slate-400">배정 직후 한 화면에서 모든 결과를 확인합니다.</p>
            </div>
            <div className="rounded-xl bg-slate-700/50 p-3">
              <p className="mb-1 font-medium text-pink-400">🤫 개별 공개</p>
              <p className="text-sm text-slate-400">서버 연결 없이 결과를 숨기고, 한 명씩 확인하거나 링크로 공유합니다.</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-4">
          <p className="mb-1 font-medium text-cyan-400">💡 팁</p>
          <p className="text-sm text-cyan-300/80">
            결과는 서버나 데이터베이스에 저장되지 않습니다. 공유한 링크는 만료하거나 회수할 수 없습니다.
          </p>
        </div>
      </section>
    </div>
  );
}
