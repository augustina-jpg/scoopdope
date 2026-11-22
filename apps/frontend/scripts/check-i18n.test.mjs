import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeSource } from './check-i18n.mjs';

describe('i18n hardcoded text check', () => {
  it('detects hardcoded JSX text and visible string attributes', () => {
    const violations = analyzeSource('<button aria-label="Start course">Start now</button>');
    assert.equal(violations.length, 2);
  });

  it('allows translation calls in JSX', () => {
    const violations = analyzeSource('<button aria-label={t("start")}>{t("start")}</button>');
    assert.equal(violations.length, 0);
  });
});
