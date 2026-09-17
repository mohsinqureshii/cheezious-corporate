'use client';

/**
 * Password guidance.
 *
 * A mirror of the server's policy, shown while typing so nobody discovers the
 * rules by being rejected. The server remains the only authority: this is a
 * hint, and a password that passes here can still be refused (for containing
 * the account's own name, for example, which is checked against values the
 * browser should not be reasoning about).
 */

export interface PasswordStrengthProps {
  value: string;
  /** Rendered as met/unmet so the requirements are legible before typing starts. */
  id?: string;
}

interface Requirement {
  label: string;
  met: boolean;
}

/** The subset of the server policy that can be evaluated in the browser. */
export function evaluatePassword(value: string): { requirements: Requirement[]; score: number } {
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((pattern) => pattern.test(value)).length;

  const requirements: Requirement[] = [
    { label: 'At least 12 characters', met: value.length >= 12 },
    {
      label: 'A mix of cases, numbers or symbols — or 16 characters and longer',
      met: value.length >= 16 || classes >= 3,
    },
  ];

  let score = 0;
  if (value.length >= 12) score += 1;
  if (value.length >= 16) score += 1;
  if (value.length >= 20) score += 1;
  if (classes >= 3) score += 1;
  if (requirements.some((requirement) => !requirement.met)) score = Math.min(score, 1);

  return { requirements, score: Math.min(4, score) };
}

const LABELS = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong'];

export function PasswordStrength({ value, id }: PasswordStrengthProps) {
  const { requirements, score } = evaluatePassword(value);

  return (
    <div id={id} className="mt-03">
      <div className="flex items-center gap-02" aria-hidden="true">
        {[0, 1, 2, 3].map((index) => (
          <span
            key={index}
            className={[
              'h-[3px] flex-1 transition-colors duration-fast',
              value.length === 0
                ? 'bg-border-subtle'
                : index < score
                  ? score <= 1
                    ? 'bg-status-danger'
                    : score <= 2
                      ? 'bg-status-warning'
                      : 'bg-status-success'
                  : 'bg-border-subtle',
            ].join(' ')}
          />
        ))}
      </div>

      <p className="mt-02 text-helper-01 text-content-secondary" aria-live="polite">
        {value.length === 0 ? 'Choose a password you do not use anywhere else.' : LABELS[score]}
      </p>

      <ul className="mt-02 space-y-01">
        {requirements.map((requirement) => (
          <li
            key={requirement.label}
            className={[
              'flex items-start gap-02 text-helper-01',
              requirement.met ? 'text-status-success' : 'text-content-secondary',
            ].join(' ')}
          >
            <span aria-hidden="true" className="mt-[2px] leading-none">
              {requirement.met ? '✓' : '·'}
            </span>
            <span>
              <span className="sr-only">{requirement.met ? 'Met: ' : 'Not yet met: '}</span>
              {requirement.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
