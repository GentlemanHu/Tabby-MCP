#!/usr/bin/env node
// Unit tests for src/tools/execDrivers.ts (Issue #18). The module is pure, so it is
// transpiled in memory with the project's TypeScript and run directly.

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const sourcePath = path.join(root, 'src/tools/execDrivers.ts');
const compiled = ts.transpileModule(fs.readFileSync(sourcePath, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
}).outputText;
const mod = { exports: {} };
new Function('require', 'module', 'exports', compiled)(require, mod, mod.exports);
const d = mod.exports;

const START = '__MCP_START_1732000000000__';
const END = '__MCP_END_1732000000000__';
const tests = [];
const test = (name, fn) => tests.push([name, fn]);

test('POSIX and fish wrappers are unchanged', () => {
    assert.equal(
        d.buildPosixWrapper("echo 'hi'", START, END, 'bash'),
        `echo "${START}" && eval 'echo '\\''hi'\\''' ; echo "${END} $?"`
    );
    assert.equal(
        d.buildPosixWrapper('echo "a\\b"', START, END, 'fish'),
        `echo "${START}"; eval "echo \\"a\\\\b\\""; set -l __mcp_exit $status; echo "${END} $__mcp_exit"`
    );
});

test('prompt classification', () => {
    const cases = [
        ['PS C:\\Users\\me> ', 'powershell'],
        ['[srv01]: PS C:\\> ', 'powershell'],
        ['PS /home/me> ', 'powershell'],
        ['C:\\Users\\User>', 'cmd'],
        ['user@HOST C:\\Users\\User>', 'cmd'],
        ['[admin@MikroTik] > ', 'routeros'],
        ['[admin@MikroTik] /ip address> ', 'routeros'],
        ['me@box:~$ ', 'posix'],
        ['root@box:/# ', 'posix'],
        ['~/src ❯', 'posix'],
        ['Router>', 'unknown'],
        ['', 'unknown']
    ];
    for (const [line, kind] of cases) {
        assert.equal(d.classifyPromptLine(line), kind, line);
    }
});

test('auto mode keeps POSIX detection unless evidence is clear', () => {
    const base = { recentText: '', shellPath: '', osc133Seen: false };
    assert.equal(d.resolveAutoMode({ ...base, promptLine: 'me@box:~$' }).mode, null);
    assert.equal(d.resolveAutoMode({ ...base, promptLine: 'some custom >' }).mode, null);
    assert.equal(d.resolveAutoMode({ ...base, promptLine: 'user@HOST C:\\Users\\User>' }).mode, 'cmd');
    assert.equal(d.resolveAutoMode({ ...base, promptLine: 'PS C:\\> ' }).mode, 'powershell');
    assert.equal(d.resolveAutoMode({ ...base, promptLine: '[admin@MikroTik] > ' }).mode, 'raw');
    assert.equal(d.resolveAutoMode({ ...base, promptLine: '', shellPath: 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe ' }).mode, 'powershell');
    assert.equal(d.resolveAutoMode({ ...base, promptLine: '', shellPath: 'C:\\Windows\\system32\\cmd.exe' }).mode, 'cmd');
    assert.equal(d.resolveAutoMode({ ...base, promptLine: 'me@box:~$', shellPath: 'powershell.exe' }).mode, null,
        'a POSIX prompt wins over the profile executable (e.g. WSL started from PowerShell)');
    assert.equal(d.resolveAutoMode({ ...base, promptLine: 'Router#', learnedRawPrompt: 'Router#' }).mode, 'raw');
    assert.equal(d.resolveAutoMode({ ...base, promptLine: 'me@box:~$', learnedRawPrompt: 'Router#' }).mode, null);
    assert.equal(d.resolveAutoMode({ ...base, promptLine: 'PS C:\\> ', osc133Seen: true }).mode, 'osc133');
    assert.equal(d.resolveAutoMode({ ...base, promptLine: 'me@box:~$', osc133Seen: true }).mode, null,
        'POSIX shells keep their driver even when OSC 133 is present');
});

test('PowerShell wrapper escapes every single-quote form and encodes multi-line input', () => {
    const wrapped = d.buildPowerShellWrapper("Write-Host 'it''s' ‘x’ ‚y‛", START, END);
    assert.ok(wrapped.includes("Invoke-Expression 'Write-Host ''it''''s'' ‘‘x’’ ‚‚y‛‛'"), wrapped);
    assert.ok(wrapped.startsWith(`Write-Output '${START}'`));
    assert.ok(wrapped.endsWith(`Write-Output ('${END} ' + $__mcp_code)`));
    assert.equal(/[\r\n]/.test(wrapped), false);
    const multi = d.buildPowerShellWrapper('Get-Date\n"done"', START, END);
    assert.equal(/[\r\n]/.test(multi), false);
    const b64 = /FromBase64String\('([^']+)'\)/.exec(multi)[1];
    assert.equal(Buffer.from(b64, 'base64').toString('utf8'), 'Get-Date\n"done"');
    assert.equal(d.findEndMarker(wrapped, END, false), null, 'echoed wrapper must not look like a finished marker');
});

test('cmd wrapper resets and late-expands ERRORLEVEL', () => {
    assert.equal(
        d.buildCmdWrapper('dir C:\\nope', START, END),
        `echo ${START}& (call )& dir C:\\nope & call echo ${END} %^errorlevel%`
    );
    assert.ok(d.buildCmdWrapper('ver\r\nhostname', START, END).includes('& ver & hostname &'));
    assert.ok(d.buildCmdWrapper('', START, END).includes('& rem &'));
    assert.equal(d.findEndMarker(d.buildCmdWrapper('ver', START, END), END, false), null);
});

test('end markers: negative codes, echo safety, anchored templates', () => {
    assert.deepEqual(d.findEndMarker(`x\n${END} -1073741819\n`, END, false).exitCode, -1073741819);
    assert.equal(d.findEndMarker(`out${END} 0`, END, false).exitCode, 0, 'unanchored keeps POSIX no-newline output working');
    const echoed = `[admin@MikroTik] > :put "${START}"; /system identity print; :put "${END} 0"\n`;
    assert.equal(d.findEndMarker(echoed, END, true), null, 'template echo must not count as finished');
    const screen = `${echoed}${START}\n  name: MikroTik\n${END} 0\n[admin@MikroTik] > `;
    const end = d.findEndMarker(screen, END, true);
    assert.equal(end.exitCode, 0);
    assert.equal(d.extractMarkedOutput(screen, START, end).output, '  name: MikroTik');
    assert.equal(d.findEndMarker(`${START}\nok\n${END}\nprompt>`, END, true).exitCode, null);
    assert.equal(d.findEndMarker(`${START}\nok\n${END}`, END, true), null, 'a marker still being written is not final');
});

test('PowerShell screen extraction', () => {
    const wrapped = d.buildPowerShellWrapper('Get-Item missing', START, END);
    const screen = [
        `PS C:\\Users\\me> ${wrapped}`,
        START,
        'Get-Item: Cannot find path',
        `${END} 1`,
        'PS C:\\Users\\me> '
    ].join('\n');
    const end = d.findEndMarker(screen, END, false);
    assert.equal(end.exitCode, 1);
    assert.equal(d.extractMarkedOutput(screen, START, end).output, 'Get-Item: Cannot find path');
});

test('printed start marker ignores the echoed command line', () => {
    const echo = `me@box:~$ echo "${START}" && eval 'ls' ; echo "${END} $?"`;
    assert.equal(d.findPrintedStartMarker(echo, START), -1);
    assert.ok(d.findPrintedStartMarker(`${echo}\n${START}\nfile`, START) > 0);
});

test('prompt return and pager detection', () => {
    assert.equal(d.samePromptShape('C:\\a>', 'C:\\b\\c>'), true);
    assert.equal(d.samePromptShape('[admin@MikroTik] /ip address>', '[admin@MikroTik] >'), true);
    assert.equal(d.samePromptShape('me@box:~$', 'Router#'), false);
    assert.equal(d.isPromptReturned('[admin@MikroTik] > ', '[admin@MikroTik] > ', 1300, 1200), true);
    assert.equal(d.isPromptReturned('[admin@MikroTik] > ', '[admin@MikroTik] > ', 500, 1200), false);
    assert.equal(d.isPromptReturned('Router(config)#', 'Router#', 1300, 1200), true);
    assert.equal(d.isPromptReturned('weird>', 'Router#', 1300, 1200), false, 'unfamiliar prompt needs a longer idle');
    assert.equal(d.isPromptReturned('weird>', 'Router#', 2500, 1200), true);
    assert.equal(d.isPromptReturned('anything', '', 1300, 1200, /^anything$/), true);
    assert.equal(d.isPagerLine(' --More-- '), true);
    assert.equal(d.isPagerLine('<--- More --->'), true);
    assert.equal(d.isEchoLine('[admin@MikroTik] > /ip address print', '/ip address print'), true);
    assert.equal(d.isEchoLine('[admin@MikroTik] > ', '/ip address print'), false);
});

test('raw output extraction', () => {
    const before = 'banner\n[admin@MikroTik] > ';
    const after = 'banner\n[admin@MikroTik] > /ip address print\nFlags: X - disabled\n 0 192.168.88.1/24\n[admin@MikroTik] > ';
    assert.deepEqual(d.extractRawOutput(before, after, '/ip address print'),
        { output: 'Flags: X - disabled\n 0 192.168.88.1/24', method: 'echo' });
    const scrolled = 'x\n[admin@MikroTik] > /ip address print\nrow\n[admin@MikroTik] > ';
    assert.equal(d.extractRawOutput('a\nb\nc\nd\n[admin@MikroTik] > ', scrolled, '/ip address print').output, 'row');
    assert.equal(d.extractRawOutput(before, `${after.trimEnd()}\nstill running`, '/ip address print', false).output,
        'Flags: X - disabled\n 0 192.168.88.1/24\n[admin@MikroTik] >\nstill running');
});

test('OSC 133 parsing', () => {
    const C = '\u001b]133;C\u0007';
    const D = (code) => `\u001b]133;D;${code}\u0007`;
    assert.deepEqual(d.parseSemanticCommand(`dir\r\n${C}a.txt\r\n${D(0)}\u001b]133;A\u0007PS> `),
        { done: true, output: 'a.txt', exitCode: 0 });
    assert.deepEqual(d.parseSemanticCommand(`bad\r\nnot found\r\n\u001b]633;D;127\u001b\\`),
        { done: true, output: 'not found', exitCode: 127 });
    assert.equal(d.parseSemanticCommand(`${D(0)}dir`).done, false, 'a D before Enter belongs to the previous prompt');
    assert.equal(d.parseSemanticCommand(`dir\r\n${C}partial`).done, false);
    assert.equal(d.parseSemanticCommand(`x\r\n${C}\u001b]133;D\u0007`).exitCode, null);
    assert.equal(d.containsCommandFinishedMark(`\u001b]133;A\u0007`), false);
    assert.equal(d.containsCommandFinishedMark(D(1)), true);
});

test('rules, templates, escapes and line endings', () => {
    const identity = { title: 'MikroTik core', profileName: 'RouterOS edge', profileId: 'ssh:custom:abc' };
    const rule = (match, extra = {}) => ({ id: '1', enabled: true, match, mode: 'raw', ...extra });
    assert.equal(d.ruleMatches(rule('mikrotik'), identity), true);
    assert.equal(d.ruleMatches(rule('/^RouterOS/'), identity), true);
    assert.equal(d.ruleMatches(rule('*'), identity), true);
    assert.equal(d.ruleMatches(rule(''), identity), false);
    assert.equal(d.ruleMatches(rule('mikrotik', { enabled: false }), identity), false);
    assert.equal(d.ruleMatches(rule('/[/'), identity), false);
    assert.equal(d.findMatchingRule([rule('nope'), rule('edge', { id: '2' })], identity).id, '2');

    assert.equal(d.validateTemplate(':put "{start}"; {command}'), 'Template must contain {end}');
    assert.equal(d.validateTemplate(':put "{start}"; {command}; :put "{end} 0"'), null);
    assert.deepEqual(
        d.buildTemplateLines(':put "{start}"\n\n{command}\n:put "{end} 0"', 'say "$&"', START, END, 'double-quote'),
        [`:put "${START}"`, 'say \\"$&\\"', `:put "${END} 0"`]
    );
    assert.equal(d.applyEscape("a'b", 'posix-single'), "a'\\''b");
    assert.equal(d.lineEndingFor('bash', 'auto'), '\n');
    assert.equal(d.lineEndingFor('powershell', undefined), '\r');
    assert.equal(d.lineEndingFor('raw', 'crlf'), '\r\n');
    assert.equal(d.clampIdleMs(5), 200);
    assert.equal(d.clampIdleMs(undefined), 1200);
    assert.ok(d.compilePromptPattern('[').error);
});

test('terminal text normalization', () => {
    assert.equal(d.stripAnsi('\u001b[32mok\u001b[0m \u001b]0;title\u0007done'), 'ok done');
    assert.equal(d.normalizeTerminalText('progress 10%\rprogress 100%\r\nnext'), 'progress 100%\nnext');
    assert.equal(d.lastNonEmptyLine('a\nb  \n\n  \n'), 'b');
});

for (const [name, fn] of tests) {
    fn();
    process.stdout.write(`✓ ${name}\n`);
}
process.stdout.write(`All ${tests.length} exec driver checks passed.\n`);
