/** Volatile, closed diagnostics. No message identifiers, mail, URLs or codes. */
export const stageText = {
  account: 'Checking your OTPGuard account',
  mailbox: 'Checking the connected Gmail mailbox',
  page: 'Checking the active login page',
  detection: 'Looking for an empty email-code field',
  polling: 'Waiting for Gmail delivery or indexing',
  listing: 'Searching Gmail for recent messages',
  fetching: 'Reading recent messages locally',
  decoding: 'Decoding an email locally',
  receipt: 'A recent message was excluded: outside this request’s time window',
  recipient: 'A recent message was excluded: recipient does not match the page',
  unrelated: 'A recent message was excluded: unrelated message',
  purpose: 'A recent message was excluded: unsupported code purpose',
  template: 'A recent message was excluded: code wording was not recognized',
  quoted: 'A recent message was excluded: quoted or forwarded code',
  length: 'A recent message was excluded: code length does not fit the field',
  selecting: 'Checking code candidates for ambiguity',
  'messages-ambiguous': 'Multiple recent emails contain plausible codes',
  'codes-ambiguous': 'One email contains multiple plausible numeric codes',
  'requests-ambiguous':
    'Competing login requests or code field groups were detected',
  'retrieval-incomplete':
    'Email retrieval did not return a complete candidate set',
  approval: 'Code found: waiting for your Fill click',
  preparing: 'Checking that the code field is still ready',
  replay: 'Checking that this email has not already been used',
  filling: 'Inserting the code and checking that it stays in the field',
} as const;
export type ProgressStage = keyof typeof stageText;
export type ProgressSnapshot = {
  stage: ProgressStage;
  elapsedSeconds: number;
  stageSeconds: number;
  steps: ProgressStage[];
};
export function createProgress(now = Date.now) {
  let start = 0;
  let changed = 0;
  let finished: number | undefined;
  let stage: ProgressStage | undefined;
  let steps: ProgressStage[] = [];
  return {
    reset() {
      finished = undefined;
      stage = undefined;
      steps = [];
      start = changed = now();
    },
    freeze() {
      finished ??= now();
    },
    update(next: ProgressStage) {
      if (finished !== undefined) return;
      if (!stage) start = now();
      if (stage !== next) {
        stage = next;
        changed = now();
        steps = [...steps, next].slice(-12);
      }
    },
    snapshot(): ProgressSnapshot | undefined {
      return stage
        ? {
            stage,
            elapsedSeconds: Math.max(
              0,
              Math.floor(((finished ?? now()) - start) / 1000),
            ),
            stageSeconds: Math.max(
              0,
              Math.floor(((finished ?? now()) - changed) / 1000),
            ),
            steps: [...steps],
          }
        : undefined;
    },
  };
}
