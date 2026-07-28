#!/usr/bin/env bun

/**
 * Generates CHANGELOG.md entries from conventional commits.
 * Usage: bun run scripts/generate-changelog.ts [since-tag]
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

interface Commit {
  hash: string;
  type: string;
  scope: string;
  description: string;
  breaking: boolean;
}

const CONVENTIONAL_RE = /^(\w+)(?:\(([^)]+)\))?!?:\s+(.+)$/;

function getCommits(since?: string): string[] {
  const range = since ? `${since}..HEAD` : 'HEAD~50..HEAD';
  try {
    const output = execSync(`git log ${range} --pretty=format:"%H|%s"`, {
      encoding: 'utf-8',
      cwd: process.cwd(),
    });
    return output.trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

function parseCommit(line: string): Commit | null {
  const [hash, subject] = line.split('|', 2);
  const match = subject.match(CONVENTIONAL_RE);
  if (!match) return null;

  return {
    hash: hash.slice(0, 8),
    type: match[1],
    scope: match[2] || '',
    description: match[3],
    breaking: subject.includes('!:'),
  };
}

function groupByType(commits: Commit[]): Record<string, Commit[]> {
  const groups: Record<string, Commit[]> = {};
  for (const c of commits) {
    const key = c.breaking ? 'Breaking Changes' : c.type;
    if (!groups[key]) groups[key] = [];
    groups[key].push(c);
  }
  return groups;
}

const TYPE_LABELS: Record<string, string> = {
  feat: 'Added',
  fix: 'Fixed',
  docs: 'Documentation',
  style: 'Style',
  refactor: 'Changed',
  perf: 'Performance',
  test: 'Testing',
  chore: 'Chore',
  ci: 'CI',
  'Breaking Changes': 'Breaking Changes',
};

function formatSection(groups: Record<string, Commit[]>): string {
  const lines: string[] = [];
  const order = ['Breaking Changes', 'feat', 'fix', 'refactor', 'perf', 'docs', 'test', 'chore', 'ci', 'style'];

  for (const type of order) {
    if (!groups[type]?.length) continue;
    const label = TYPE_LABELS[type] || type;
    lines.push(`### ${label}`);
    for (const c of groups[type]) {
      const scope = c.scope ? `**${c.scope}:** ` : '';
      lines.push(`- ${scope}${c.description} (${c.hash})`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

function main() {
  const since = process.argv[2];
  const commits = getCommits(since)
    .map(parseCommit)
    .filter((c): c is Commit => c !== null);

  if (commits.length === 0) {
    console.log('No conventional commits found.');
    return;
  }

  const groups = groupByType(commits);
  const section = formatSection(groups);
  const version = `v${JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf-8')).version}`;
  const date = new Date().toISOString().split('T')[0];

  const header = `## [${version}] - ${date}\n\n`;
  const entry = header + section;

  const changelogPath = join(process.cwd(), 'CHANGELOG.md');
  const existing = readFileSync(changelogPath, 'utf-8');
  const unreleasedIdx = existing.indexOf('## [Unreleased]');

  if (unreleasedIdx === -1) {
    writeFileSync(changelogPath, entry + '\n' + existing);
  } else {
    const insertAt = unreleasedIdx + '## [Unreleased]'.length;
    const before = existing.slice(0, insertAt);
    const after = existing.slice(insertAt);
    writeFileSync(changelogPath, `${before}\n\n${entry}${after}`);
  }

  console.log(`Added ${commits.length} entries to CHANGELOG.md for ${version}`);
}

main();
