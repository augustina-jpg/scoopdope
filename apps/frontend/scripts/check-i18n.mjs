import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(frontendRoot, '../..');
const localeDirectory = path.join(frontendRoot, 'messages');
const locales = ['en', 'es', 'fr', 'ar'];
const visibleAttributes = new Set([
  'alt',
  'aria-label',
  'aria-description',
  'placeholder',
  'title',
]);

function messageKeys(value, prefix = '') {
  return Object.entries(value).flatMap(([key, item]) => {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    return item && typeof item === 'object' ? messageKeys(item, fullKey) : [fullKey];
  });
}

function containsWords(value) {
  return /[A-Za-z]{2}/.test(value.trim());
}

function analyzeSource(sourceText, fileName = 'component.tsx') {
  const sourceFile = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  const violations = [];

  function report(node, value) {
    if (containsWords(value)) {
      const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
      violations.push({ line: line + 1, text: value.trim() });
    }
  }

  function isVisibleJsxExpression(node) {
    if (!node.parent || !ts.isJsxExpression(node.parent) || node.parent.expression !== node) {
      return false;
    }
    const owner = node.parent.parent;
    return (
      (ts.isJsxAttribute(owner) && visibleAttributes.has(owner.name.getText(sourceFile))) ||
      ts.isJsxElement(owner) ||
      ts.isJsxFragment(owner)
    );
  }

  function visit(node) {
    if (ts.isJsxText(node)) {
      report(node, node.text);
    } else if (
      ts.isStringLiteral(node) &&
      node.parent &&
      ts.isJsxAttribute(node.parent) &&
      visibleAttributes.has(node.parent.name.getText(sourceFile))
    ) {
      report(node, node.text);
    } else if (
      isVisibleJsxExpression(node) &&
      (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    ) {
      report(node, node.text);
    } else if (ts.isTemplateExpression(node) && isVisibleJsxExpression(node)) {
      report(node, node.head.text);
      node.templateSpans.forEach((span) => report(span.literal, span.literal.text));
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return violations;
}

function componentFiles(base, all) {
  if (all) {
    return execFileSync(
      'git',
      [
        'ls-files',
        '--cached',
        '--others',
        '--exclude-standard',
        '--',
        'apps/frontend/src/app',
        'apps/frontend/src/components',
      ],
      { cwd: repoRoot, encoding: 'utf8' }
    )
      .split(/\r?\n/)
      .filter((file) => file.endsWith('.tsx'));
  }

  const args = ['diff', '--name-only', '--diff-filter=ACMRT'];
  if (base) args.push(`${base}...HEAD`);
  else args.push('HEAD');
  args.push('--', 'apps/frontend/src/app', 'apps/frontend/src/components');

  const changed = execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' })
    .split(/\r?\n/)
    .filter(Boolean);
  if (!base) {
    const untracked = execFileSync(
      'git',
      [
        'ls-files',
        '--others',
        '--exclude-standard',
        '--',
        'apps/frontend/src/app',
        'apps/frontend/src/components',
      ],
      { cwd: repoRoot, encoding: 'utf8' }
    )
      .split(/\r?\n/)
      .filter(Boolean);
    changed.push(...untracked);
  }
  return [...new Set(changed)].filter((file) => file.endsWith('.tsx'));
}

function checkLocaleKeys() {
  const english = messageKeys(
    JSON.parse(readFileSync(path.join(localeDirectory, 'en.json'), 'utf8'))
  ).sort();
  const errors = [];
  for (const locale of locales.slice(1)) {
    const keys = messageKeys(
      JSON.parse(readFileSync(path.join(localeDirectory, `${locale}.json`), 'utf8'))
    ).sort();
    const missing = english.filter((key) => !keys.includes(key));
    const extra = keys.filter((key) => !english.includes(key));
    if (missing.length || extra.length) {
      errors.push(`${locale}: missing [${missing.join(', ')}], extra [${extra.join(', ')}]`);
    }
  }
  return errors;
}

export { analyzeSource };

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const baseIndex = process.argv.indexOf('--base');
  const base = baseIndex >= 0 ? process.argv[baseIndex + 1] : process.env.I18N_BASE_SHA;
  const all = process.argv.includes('--all');
  const errors = checkLocaleKeys();

  for (const file of componentFiles(base, all)) {
    const sourcePath = path.join(repoRoot, file);
    const violations = analyzeSource(readFileSync(sourcePath, 'utf8'), sourcePath);
    for (const violation of violations) {
      errors.push(
        `${file}:${violation.line}: hardcoded UI text "${violation.text}". Move it to the locale messages and use useTranslations().`
      );
    }
  }

  if (errors.length) {
    console.error(errors.join('\n'));
    process.exitCode = 1;
  } else {
    console.log(
      `Locale keys match and ${all ? 'all' : 'changed'} UI components contain no hardcoded JSX text.`
    );
  }
}
