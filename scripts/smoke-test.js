#!/usr/bin/env node

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

function testToolCount() {
    const files = [
        'src/tools/terminal.ts',
        'src/tools/tabManagement.ts',
        'src/tools/sftp.ts'
    ];
    const counts = files.map(file => (read(file).match(/this\.registerTool\(/g) || []).length);
    assert.deepEqual(counts, [9, 15, 12], 'Unexpected tool count per category');
    assert.equal(counts.reduce((sum, count) => sum + count, 0), 36, 'Expected 36 registered MCP tools');
}

function testNoBlockingBrowserDialogs() {
    const sourceFiles = [
        'src/components/mcpSettingsTab.component.ts',
        'src/services/dialog.service.ts',
        'src/tools/terminal.ts',
        'src/tools/sftp.ts'
    ];
    for (const file of sourceFiles) {
        const executableLines = read(file)
            .split('\n')
            .filter(line => {
                const trimmed = line.trimStart();
                return !trimmed.startsWith('//') && !trimmed.startsWith('*');
            })
            .join('\n');
        assert.equal(/\bconfirm\s*\(/.test(executableLines), false, `${file} must not use native confirm()`);
        assert.equal(/\balert\s*\(/.test(executableLines), false, `${file} must not use native alert()`);
    }
}

function testLegacySseParsedBody() {
    const source = read('src/services/mcpService.ts');
    assert.match(
        source,
        /handlePostMessage\(req,\s*res,\s*req\.body\)/,
        'Legacy SSE must pass the body already parsed by express.json()'
    );
    assert.match(source, /listen\(serverPort,\s*'127\.0\.0\.1'/, 'Server must bind to loopback only');
    assert.match(source, /this\.checkOrigin\(req,\s*res\)/, 'MCP endpoints must validate Origin');
}

function testTransportAndLifecycleGuards() {
    const source = read('src/services/mcpService.ts');
    assert.match(
        source,
        /req\.method === 'GET' \|\| req\.method === 'DELETE'[\s\S]*transport\.handleRequest\(req, res\)/,
        'Streamable HTTP GET and DELETE must be delegated to the SDK transport'
    );
    assert.match(source, /this\.checkHost\(req, res\)/, 'All HTTP routes must validate the Host header');
    assert.match(source, /private startPromise\?: Promise<void>/, 'Concurrent starts must share one pending promise');
    assert.match(source, /private lifecycleGeneration = 0/, 'Stop must be able to cancel an in-flight start');
}

function testApprovalAndCancellationGuards() {
    const dialog = read('src/services/dialog.service.ts');
    assert.equal(dialog.includes('preview.slice(0, 2000)'), false, 'Approval previews must not hide payload suffixes');

    const terminal = read('src/tools/terminal.ts');
    const sendInput = terminal.slice(
        terminal.indexOf("name: 'send_input'"),
        terminal.indexOf("name: 'submit_keyboard_interactive_response'")
    );
    assert.equal(sendInput.includes('confirmFileOperations'), false, 'send_input approval must not depend on the SFTP confirmation option');
    assert.match(sendInput, /JSON\.stringify\(processedInput\)/, 'send_input must show the decoded terminal input');
    const keyboardInteractive = terminal.slice(
        terminal.indexOf("name: 'submit_keyboard_interactive_response'"),
        terminal.indexOf('private parseEnvironmentFromBuffer')
    );
    assert.match(
        keyboardInteractive,
        /showOperationConfirmation\([\s\S]*'submit_keyboard_interactive_response'/,
        'keyboard-interactive authentication must require Pair Programming confirmation'
    );
    assert.match(
        keyboardInteractive,
        /`\$\{providedResponses\.length\} keyboard-interactive response\(s\)`/,
        'keyboard-interactive confirmation must show only the response count'
    );
    assert.equal(
        keyboardInteractive.includes('submit:'),
        false,
        'keyboard-interactive responses must not remain staged without submission'
    );
    assert.equal(/else; printf 'shell'; end; end/.test(terminal), false, 'fish probe must close its if chain exactly once');

    const sftp = read('src/tools/sftp.ts');
    assert.match(sftp, /cancelRequested: boolean/, 'Transfers must retain cancellation requested during setup');
    assert.equal(sftp.includes('sftpSession.end()'), false, 'Cancelling one transfer must not close the shared SFTP session');
}

function testTranslations() {
    const en = JSON.parse(read('src/i18n/en-US.json'));
    const zh = JSON.parse(read('src/i18n/zh-CN.json'));
    assert.deepEqual(Object.keys(zh).sort(), Object.keys(en).sort(), 'English and Chinese translation keys must match');

    const translatedSources = [
        read('src/components/mcpSettingsTab.component.ts'),
        read('src/services/dialog.service.ts')
    ].join('\n');
    const usedKeys = new Set(Array.from(translatedSources.matchAll(/\bt\('([^']+)'/g), match => match[1]));
    for (const key of usedKeys) {
        assert.ok(en[key], `Missing English translation: ${key}`);
        assert.ok(zh[key], `Missing Chinese translation: ${key}`);
    }

    const i18nService = read('src/services/i18n.service.ts');
    assert.match(
        i18nService,
        /config\.store\?\.language/,
        'i18n initialization must tolerate ConfigService.store not being ready yet'
    );
}

function testPinnedSdkAndLockfile() {
    const packageJson = JSON.parse(read('package.json'));
    const lockfile = JSON.parse(read('package-lock.json'));
    assert.equal(packageJson.devDependencies['@modelcontextprotocol/sdk'], '1.25.2', 'MCP SDK must be pinned');
    assert.equal(
        lockfile.packages['node_modules/@modelcontextprotocol/sdk'].version,
        '1.25.2',
        'Lockfile MCP SDK version must match package.json'
    );
    const sdkDependencies = lockfile.packages['node_modules/@modelcontextprotocol/sdk'].dependencies;
    for (const dependency of Object.keys(sdkDependencies)) {
        assert.ok(lockfile.packages[`node_modules/${dependency}`], `Missing SDK dependency lock entry: ${dependency}`);
    }
    assert.ok(packageJson.files.includes('scripts/stdio-bridge.js'), 'The published package must include the STDIO bridge');
}

function testBridgeSyntax() {
    new vm.Script(read('scripts/stdio-bridge.js'), { filename: 'scripts/stdio-bridge.js' });
}

const tests = [
    ['tool count', testToolCount],
    ['non-blocking dialogs', testNoBlockingBrowserDialogs],
    ['legacy SSE parsed body', testLegacySseParsedBody],
    ['transport and lifecycle guards', testTransportAndLifecycleGuards],
    ['approval and cancellation guards', testApprovalAndCancellationGuards],
    ['translation parity', testTranslations],
    ['pinned MCP SDK', testPinnedSdkAndLockfile],
    ['stdio bridge syntax', testBridgeSyntax]
];

for (const [name, test] of tests) {
    test();
    process.stdout.write(`✓ ${name}\n`);
}

process.stdout.write(`All ${tests.length} smoke checks passed.\n`);
