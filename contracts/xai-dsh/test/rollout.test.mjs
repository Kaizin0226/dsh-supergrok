import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const rolloutPath = resolve(here, '..', 'scripts', 'rollout.ps1');

test('rollout script parses and carries transactional apply plus drift-safe manual rollback guards', () => {
  const source = readFileSync(rolloutPath, 'utf8');
  assert.match(source, /\[string\]\$DshRoot/);
  assert.match(source, /\[string\]\$RollbackRoot/);
  assert.match(source, /\[string\]\$LocalManifest/);
  assert.doesNotMatch(source, /\b[A-Za-z]:\\/);
  assert.match(source, /function Assert-DshStopped/);
  assert.match(source, /\.Port -eq 3080/);
  assert.match(source, /Get-CimInstance Win32_Process/);
  assert.match(source, /cannot complete DSH command-line process audit/);
  assert.match(source, /\.corepack\\v1\\pnpm\\11\.7\.0\\bin\\pnpm\.cjs/);
  assert.match(source, /pinned pnpm version drift: expected 11\.7\.0/);
  assert.match(source, /function Restore-BackupState/);
  assert.match(source, /function Assert-CompletedApplyState/);
  assert.match(source, /automatic rollback also failed/);
  assert.match(source, /Restore-BackupState \$Backup/);
  assert.match(source, /install --offline --ignore-scripts/);
  assert.match(source, /Assert-CompletedApplyState \$Backup \$true/);
  assert.match(source, /backup after\.json/);
  assert.match(source, /current pnpm-lock\.yaml after-state/);
  assert.match(source, /current openai-responses-shared\.js after-state/);
  assert.match(source, /backupDirectory/);
  assert.match(source, /productionRoot/);

  const command = [
    '$tokens=$null',
    '$errors=$null',
    `[void][System.Management.Automation.Language.Parser]::ParseFile('${rolloutPath.replaceAll("'", "''")}',[ref]$tokens,[ref]$errors)`,
    'if($errors.Count -ne 0){$errors | ForEach-Object {$_.Message}; exit 1}',
  ].join('; ');
  const parsed = spawnSync('powershell.exe', ['-NoProfile', '-Command', command], {
    encoding: 'utf8',
    windowsHide: true,
  });
  assert.equal(parsed.status, 0, `${parsed.stdout}\n${parsed.stderr}`);
});
