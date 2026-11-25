/**
 * Shell-aware execution helpers for exec_command (Issue #18).
 *
 * Execution is layered so new shells and devices do not need code changes:
 *   1. Semantic prompt marks (OSC 133 / OSC 633) emitted by the remote shell
 *   2. Built-in drivers: POSIX family, fish, PowerShell, cmd.exe
 *   3. Raw mode: send the command as typed and wait for the prompt to return
 *   4. User rules in Settings → MCP (template wrappers, prompt patterns, line endings)
 *
 * Everything in this file is pure (no Angular/Tabby imports) so it can be unit tested.
 */

export type PosixShell = 'bash' | 'zsh' | 'fish' | 'sh';
export type BuiltinShell = PosixShell | 'powershell' | 'cmd';
export type ExecMode = BuiltinShell | 'osc133' | 'raw' | 'template';
export type ShellOverride = 'auto' | BuiltinShell | 'osc133' | 'raw';
export type LineEndingSetting = 'auto' | 'lf' | 'cr' | 'crlf';
export type TemplateEscape = 'none' | 'posix-single' | 'powershell-single' | 'double-quote';
export type PromptKind = 'powershell' | 'cmd' | 'routeros' | 'posix' | 'unknown';

export const SHELL_OVERRIDES: ShellOverride[] = ['auto', 'bash', 'zsh', 'fish', 'sh', 'powershell', 'cmd', 'osc133', 'raw'];
export const RULE_MODES: Array<ShellOverride | 'template'> = [...SHELL_OVERRIDES, 'template'];
export const LINE_ENDINGS: LineEndingSetting[] = ['auto', 'lf', 'cr', 'crlf'];
export const TEMPLATE_ESCAPES: TemplateEscape[] = ['none', 'posix-single', 'powershell-single', 'double-quote'];

export const DEFAULT_IDLE_MS = 1200;
export const MIN_IDLE_MS = 200;
export const MAX_IDLE_MS = 60000;
/** Minimum quiet time before a missing end marker is treated as a rejected wrapper */
export const WRAPPER_REJECT_IDLE_MS = 3000;

/** User-defined execution rule (Settings → MCP → Command execution) */
export interface ExecRule {
    id: string;
    enabled: boolean;
    /** Case-insensitive substring of the tab title, profile name or profile id; `/regex/flags`; or `*` */
    match: string;
    mode: ShellOverride | 'template';
    /** Lines sent for mode=template. Placeholders: {start} {end} {command} */
    template?: string;
    escape?: TemplateEscape;
    lineEnding?: LineEndingSetting;
    /** Regex matching the prompt line, used by raw mode and the prompt-return fallback */
    promptPattern?: string;
    idleMs?: number;
}

export interface SessionIdentity {
    title: string;
    profileName: string;
    profileId: string;
}

// ============== Text helpers ==============

const ANSI_PATTERN = new RegExp([
    '\\u001b\\][^\\u0007\\u001b]*(?:\\u0007|\\u001b\\\\)',   // OSC ... BEL / ST
    '\\u001b[P^_X][^\\u001b]*\\u001b\\\\',                    // DCS / PM / APC / SOS
    '\\u001b\\[[0-?]*[ -/]*[@-~]',                            // CSI
    '\\u009b[0-?]*[ -/]*[@-~]',                               // 8-bit CSI
    '\\u001b[ -/]*[0-~]'                                      // other ESC sequences
].join('|'), 'g');

export function stripAnsi(text: string): string {
    return text.replace(ANSI_PATTERN, '');
}

/** Normalize terminal text: strip escapes, CRLF → LF, apply bare carriage returns per line */
export function normalizeTerminalText(text: string): string {
    return stripAnsi(text)
        .replace(/\r\n/g, '\n')
        .split('\n')
        .map(line => {
            const parts = line.split('\r');
            return parts[parts.length - 1];
        })
        .join('\n');
}

export function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function splitLines(text: string): string[] {
    return text.replace(/\r\n/g, '\n').split('\n');
}

export function trimTrailingEmptyLines(lines: string[]): string[] {
    let end = lines.length;
    while (end > 0 && lines[end - 1].trim() === '') {
        end--;
    }
    return lines.slice(0, end);
}

export function lastNonEmptyLine(text: string): string {
    const lines = trimTrailingEmptyLines(splitLines(text));
    return lines.length > 0 ? lines[lines.length - 1].trimEnd() : '';
}

export function clampIdleMs(value: number | undefined): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return DEFAULT_IDLE_MS;
    }
    return Math.min(MAX_IDLE_MS, Math.max(MIN_IDLE_MS, Math.round(value)));
}

/** Parse a user regex; returns an error message instead of throwing */
export function compilePromptPattern(pattern: string | undefined): { regex?: RegExp; error?: string } {
    if (!pattern || !pattern.trim()) {
        return {};
    }
    try {
        return { regex: new RegExp(pattern) };
    } catch (error: any) {
        return { error: `Invalid promptPattern: ${error?.message || error}` };
    }
}

// ============== Detection ==============

const POWERSHELL_PROMPT = /(?:^|\]: )PS [^\n]*>\s*$/;
const CMD_PROMPT = /(?:^|\s)(?:[A-Za-z]:\\|\\\\[^\\\s]+\\)[^\n<>|"]*>\s*$/;
const ROUTEROS_PROMPT = /^\[[^\]\s]+@[^\]]+\]\s*(?:\/[^>]*)?>\s*$/;
const POSIX_PROMPT = /[$#%❯➜]\s*$/;
const GENERIC_PROMPT = /[$#%>❯➜\]:]\s*$/;
const PAGER_PROMPT = /--\s?More\s?--|<--- More --->|\(more\)|Press any key to continue|-- ?More ?\(\d+%\)/i;

/** Classify a single prompt line (ANSI already stripped) */
export function classifyPromptLine(line: string): PromptKind {
    const text = (line || '').trimEnd();
    if (!text) {
        return 'unknown';
    }
    if (POWERSHELL_PROMPT.test(text)) {
        return 'powershell';
    }
    if (ROUTEROS_PROMPT.test(text)) {
        return 'routeros';
    }
    if (CMD_PROMPT.test(text)) {
        return 'cmd';
    }
    if (POSIX_PROMPT.test(text)) {
        return 'posix';
    }
    return 'unknown';
}

/** Hint from a local profile's shell executable */
export function classifyShellPath(shellPath: string): 'powershell' | 'cmd' | null {
    const value = (shellPath || '').trim().toLowerCase();
    if (!value) {
        return null;
    }
    if (/(^|[\\/\s])(pwsh|powershell)(\.exe)?(\s|$)/.test(value)) {
        return 'powershell';
    }
    if (/(^|[\\/\s])cmd(\.exe)?(\s|$)/.test(value)) {
        return 'cmd';
    }
    return null;
}

/** Hint from recent banner text when the prompt line is ambiguous */
export function classifyBanner(recentText: string): 'powershell' | 'cmd' | 'routeros' | null {
    const text = recentText || '';
    if (/MikroTik RouterOS/i.test(text)) {
        return 'routeros';
    }
    if (/Windows PowerShell|PowerShell \d+\.\d+/i.test(text)) {
        return 'powershell';
    }
    if (/Microsoft Windows \[Version/i.test(text)) {
        return 'cmd';
    }
    return null;
}

/** Two prompts look alike if they end with the same prompt character and share their first characters */
export function samePromptShape(a: string, b: string): boolean {
    const left = (a || '').trim();
    const right = (b || '').trim();
    if (!left || !right) {
        return false;
    }
    if (left === right) {
        return true;
    }
    if (left[left.length - 1] !== right[right.length - 1]) {
        return false;
    }
    const prefix = Math.min(3, left.length, right.length);
    return left.slice(0, prefix) === right.slice(0, prefix);
}

/** The line still shows the typed command (the echo), not a new prompt */
export function isEchoLine(line: string, command: string): boolean {
    const first = splitLines(command)[0].trim();
    return first.length > 0 && (line || '').trimEnd().endsWith(first);
}

/** Last `count` non-trailing-empty lines, as produced by the terminal tail reader */
export function tailLines(text: string, count: number): string {
    return trimTrailingEmptyLines(splitLines(text)).slice(-count).join('\n');
}

export function isPagerLine(line: string): boolean {
    return PAGER_PROMPT.test(line || '');
}

/**
 * Has the prompt come back?
 * - With a user pattern, only the pattern decides.
 * - Otherwise a prompt shaped like the one before the command is accepted at normal idle,
 *   and any generic prompt-looking line only after a doubled idle period.
 */
export function isPromptReturned(
    line: string,
    learnedPrompt: string,
    idleForMs: number,
    idleMs: number,
    pattern?: RegExp
): boolean {
    const text = (line || '').trimEnd();
    if (!text) {
        return false;
    }
    if (pattern) {
        return idleForMs >= idleMs && pattern.test(text);
    }
    if (learnedPrompt && samePromptShape(text, learnedPrompt)) {
        return idleForMs >= idleMs;
    }
    return idleForMs >= idleMs * 2 && GENERIC_PROMPT.test(text);
}

export interface AutoModeInput {
    promptLine: string;
    recentText: string;
    shellPath: string;
    learnedRawPrompt?: string;
    osc133Seen: boolean;
}

export interface AutoModeResult {
    /** Non-POSIX decision, or null when the caller should use its POSIX shell detection */
    mode: 'powershell' | 'cmd' | 'raw' | 'osc133' | null;
    reason: string;
}

/**
 * Decide the execution mode for auto detection.
 * POSIX-family shells keep their existing drivers; only clear non-POSIX evidence changes the mode.
 */
export function resolveAutoMode(input: AutoModeInput): AutoModeResult {
    const prompt = (input.promptLine || '').trimEnd();
    let candidate: 'powershell' | 'cmd' | 'raw' | null = null;
    let reason = '';

    if (input.learnedRawPrompt && samePromptShape(prompt, input.learnedRawPrompt)) {
        candidate = 'raw';
        reason = 'learned: this prompt previously rejected the shell wrapper';
    } else {
        const kind = classifyPromptLine(prompt);
        if (kind === 'powershell' || kind === 'cmd') {
            candidate = kind;
            reason = `prompt looks like ${kind}`;
        } else if (kind === 'routeros') {
            candidate = 'raw';
            reason = 'prompt looks like RouterOS';
        } else if (kind === 'unknown') {
            const fromPath = classifyShellPath(input.shellPath);
            const fromBanner = classifyBanner(input.recentText);
            if (fromPath) {
                candidate = fromPath;
                reason = `profile shell is ${fromPath}`;
            } else if (fromBanner === 'routeros') {
                candidate = 'raw';
                reason = 'banner mentions RouterOS';
            } else if (fromBanner) {
                candidate = fromBanner;
                reason = `banner mentions ${fromBanner}`;
            }
        }
    }

    if (!candidate) {
        return { mode: null, reason: 'POSIX shell detection' };
    }
    if (input.osc133Seen) {
        return { mode: 'osc133', reason: `${reason}; shell emits semantic prompt marks (OSC 133)` };
    }
    return { mode: candidate, reason };
}

// ============== Rules ==============

export function ruleMatches(rule: ExecRule, identity: SessionIdentity): boolean {
    if (!rule || rule.enabled === false) {
        return false;
    }
    const match = (rule.match || '').trim();
    if (!match) {
        return false;
    }
    if (match === '*') {
        return true;
    }
    const fields = [identity.title, identity.profileName, identity.profileId].map(value => value || '');
    const regexMatch = /^\/(.+)\/([a-z]*)$/i.exec(match);
    if (regexMatch) {
        try {
            const regex = new RegExp(regexMatch[1], regexMatch[2]);
            return fields.some(value => regex.test(value));
        } catch {
            return false;
        }
    }
    const needle = match.toLowerCase();
    return fields.some(value => value.toLowerCase().includes(needle));
}

export function findMatchingRule(rules: ExecRule[] | undefined, identity: SessionIdentity): ExecRule | undefined {
    return (Array.isArray(rules) ? rules : []).find(rule => ruleMatches(rule, identity));
}

// ============== Wrappers ==============

export function escapePosixSingle(command: string): string {
    return command.replace(/'/g, "'\\''");
}

/** PowerShell treats ' ‘ ’ ‚ ‛ as single quotes; each is escaped by doubling it */
export function escapePowerShellSingle(command: string): string {
    return command.replace(/['‘’‚‛]/g, quote => quote + quote);
}

export function escapeDoubleQuote(command: string): string {
    return command.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export function applyEscape(command: string, escape: TemplateEscape | undefined): string {
    switch (escape) {
        case 'posix-single': return escapePosixSingle(command);
        case 'powershell-single': return escapePowerShellSingle(command);
        case 'double-quote': return escapeDoubleQuote(command);
        default: return command;
    }
}

/** Existing POSIX / fish wrappers, unchanged */
export function buildPosixWrapper(command: string, startMarker: string, endMarker: string, shell: PosixShell): string {
    if (shell === 'fish') {
        const fishEscaped = command
            .replace(/\\/g, '\\\\')
            .replace(/"/g, '\\"');
        return `echo "${startMarker}"; eval "${fishEscaped}"; set -l __mcp_exit $status; echo "${endMarker} $__mcp_exit"`;
    }
    return `echo "${startMarker}" && eval '${escapePosixSingle(command)}' ; echo "${endMarker} $?"`;
}

/**
 * PowerShell 5.1+ wrapper. Invoke-Expression keeps parse errors inside the line, so the end
 * marker is always printed. Multi-line commands are base64-encoded to stay on one input line.
 */
export function buildPowerShellWrapper(command: string, startMarker: string, endMarker: string): string {
    const body = /[\r\n]/.test(command)
        ? `([System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${Buffer.from(command, 'utf8').toString('base64')}')))`
        : `'${escapePowerShellSingle(command)}'`;
    return [
        `Write-Output '${startMarker}'`,
        `$global:LASTEXITCODE = 0`,
        `$__mcp_ok = $true`,
        `try { Invoke-Expression ${body}; $__mcp_ok = $? } catch { Write-Output ($_ | Out-String); $__mcp_ok = $false }`,
        `$__mcp_code = if ($global:LASTEXITCODE) { $global:LASTEXITCODE } elseif ($__mcp_ok) { 0 } else { 1 }`,
        `Write-Output ('${endMarker} ' + $__mcp_code)`
    ].join('; ');
}

/**
 * cmd.exe wrapper on one line. `(call )` resets ERRORLEVEL; `call echo %^errorlevel%` delays the
 * expansion until the user command has run (at the interactive prompt %var% expands when the line is parsed).
 * Multi-line input is joined with `&`.
 */
export function buildCmdWrapper(command: string, startMarker: string, endMarker: string): string {
    const body = splitLines(command).map(line => line.trim()).filter(Boolean).join(' & ') || 'rem';
    return `echo ${startMarker}& (call )& ${body} & call echo ${endMarker} %^errorlevel%`;
}

export function buildBuiltinWrapper(command: string, startMarker: string, endMarker: string, shell: BuiltinShell): string {
    if (shell === 'powershell') {
        return buildPowerShellWrapper(command, startMarker, endMarker);
    }
    if (shell === 'cmd') {
        return buildCmdWrapper(command, startMarker, endMarker);
    }
    return buildPosixWrapper(command, startMarker, endMarker, shell);
}

export function validateTemplate(template: string | undefined): string | null {
    if (!template || !template.trim()) {
        return 'Template is empty';
    }
    for (const placeholder of ['{command}', '{start}', '{end}']) {
        if (!template.includes(placeholder)) {
            return `Template must contain ${placeholder}`;
        }
    }
    return null;
}

/** Expand a user template into the input lines to send */
export function buildTemplateLines(
    template: string,
    command: string,
    startMarker: string,
    endMarker: string,
    escape: TemplateEscape | undefined
): string[] {
    const escaped = applyEscape(command, escape);
    return splitLines(template)
        .filter(line => line.trim().length > 0)
        .map(line => line
            .split('{start}').join(startMarker)
            .split('{end}').join(endMarker)
            .split('{command}').join(escaped));
}

export function lineEndingFor(mode: ExecMode, setting: LineEndingSetting | undefined): string {
    switch (setting) {
        case 'lf': return '\n';
        case 'cr': return '\r';
        case 'crlf': return '\r\n';
        default:
            return mode === 'bash' || mode === 'zsh' || mode === 'fish' || mode === 'sh' ? '\n' : '\r';
    }
}

export function isPosixMode(mode: ExecMode): mode is PosixShell {
    return mode === 'bash' || mode === 'zsh' || mode === 'fish' || mode === 'sh';
}

// ============== Marker parsing ==============

export interface EndMatch {
    index: number;
    length: number;
    exitCode: number | null;
}

/**
 * Find the printed end marker.
 * - Built-in drivers: marker followed by a (possibly negative) exit code anywhere, as before.
 *   The echoed input never has a digit right after the marker.
 * - Templates: marker must start its own line and be followed by a newline, because the echoed
 *   template line may contain the marker and a literal number.
 */
export function findEndMarker(text: string, endMarker: string, anchored: boolean): EndMatch | null {
    const marker = escapeRegExp(endMarker);
    if (!anchored) {
        const match = new RegExp(`${marker}\\s+(-?\\d+)`).exec(text);
        return match ? { index: match.index, length: match[0].length, exitCode: parseInt(match[1], 10) } : null;
    }
    const match = new RegExp(`(^|\\n)[ \\t]*${marker}(?:[ \\t]+(-?\\d+))?[ \\t]*(?=\\r?\\n)`).exec(text);
    if (!match) {
        return null;
    }
    const offset = match[1].length;
    return {
        index: match.index + offset,
        length: match[0].length - offset,
        exitCode: match[2] !== undefined ? parseInt(match[2], 10) : null
    };
}

/** Index just after a start marker printed on its own line (not the echoed input), or -1 */
export function findPrintedStartMarker(text: string, startMarker: string, before?: number): number {
    const region = before === undefined ? text : text.slice(0, before);
    const regex = new RegExp(`(^|\\n)[ \\t]*${escapeRegExp(startMarker)}[ \\t]*(?=\\r?\\n|$)`, 'g');
    let found = -1;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(region)) !== null) {
        found = match.index + match[0].length;
    }
    return found;
}

/** Output between a printed start marker and the end marker */
export function extractMarkedOutput(text: string, startMarker: string, end: EndMatch): { output: string; truncated: boolean } {
    const startIndex = findPrintedStartMarker(text, startMarker, end.index);
    if (startIndex === -1) {
        return { output: text.slice(0, end.index).trim(), truncated: true };
    }
    return { output: text.slice(startIndex, end.index).replace(/^\r?\n/, '').trimEnd(), truncated: false };
}

// ============== Raw mode ==============

/**
 * Output of a raw command: the lines after the echoed command line and before the returned prompt.
 * `before` is the plain screen text captured right before the command was sent.
 */
export function extractRawOutput(
    before: string,
    after: string,
    command: string,
    promptAtEnd = true
): { output: string; method: 'echo' | 'tail' } {
    const beforeLines = trimTrailingEmptyLines(splitLines(before));
    const afterLines = trimTrailingEmptyLines(splitLines(after));
    const promptIndex = promptAtEnd ? afterLines.length - 1 : afterLines.length;
    const firstCommandLine = splitLines(command)[0].trim();
    const learnedPrompt = beforeLines.length > 0 ? beforeLines[beforeLines.length - 1].trim() : '';
    const anchor = beforeLines.length - 1;

    const slice = (from: number) => afterLines.slice(from, Math.max(from, promptIndex)).join('\n').trimEnd();

    if (anchor >= 0 && anchor < promptIndex && learnedPrompt && afterLines[anchor].trim().startsWith(learnedPrompt)) {
        let echoIndex = anchor;
        if (firstCommandLine) {
            for (let i = anchor; i < Math.min(promptIndex, anchor + 5); i++) {
                if (afterLines[i].includes(firstCommandLine)) {
                    echoIndex = i;
                    break;
                }
            }
        }
        return { output: slice(echoIndex + 1), method: 'echo' };
    }

    if (firstCommandLine) {
        for (let i = promptIndex - 1; i >= 0; i--) {
            if (afterLines[i].includes(firstCommandLine) && (!learnedPrompt || samePromptShape(afterLines[i].slice(0, learnedPrompt.length), learnedPrompt))) {
                return { output: slice(i + 1), method: 'echo' };
            }
        }
    }

    const tailStart = Math.max(0, promptIndex - 200);
    return { output: slice(tailStart), method: 'tail' };
}

// ============== Semantic prompt marks (OSC 133 / 633) ==============

const SEMANTIC_MARK = /\u001b\](?:133|633);([A-Za-z])(?:;([^\u0007\u001b]*))?(?:\u0007|\u001b\\)/g;

/** True when the data contains a command-finished mark (D), i.e. the shell reports exit codes */
export function containsCommandFinishedMark(data: string): boolean {
    return /\u001b\](?:133|633);D(?:;[^\u0007\u001b]*)?(?:\u0007|\u001b\\)/.test(data);
}

export interface SemanticResult {
    done: boolean;
    output: string;
    exitCode: number | null;
}

/**
 * Parse stream data received after the command was sent.
 * Output runs from the command-executed mark (C), or the first newline when C is absent,
 * to the command-finished mark (D).
 */
export function parseSemanticCommand(data: string): SemanticResult {
    SEMANTIC_MARK.lastIndex = 0;
    let outputStart = -1;
    let match: RegExpExecArray | null;
    while ((match = SEMANTIC_MARK.exec(data)) !== null) {
        const kind = match[1].toUpperCase();
        if (kind === 'C' && outputStart === -1) {
            outputStart = match.index + match[0].length;
        } else if (kind === 'D') {
            const newline = data.indexOf('\n');
            if (outputStart === -1 && (newline === -1 || newline > match.index)) {
                // A D mark before the command line was even submitted belongs to the previous prompt
                continue;
            }
            const from = outputStart !== -1 ? outputStart : newline + 1;
            const code = (match[2] || '').split(';')[0].trim();
            const parsed = /^-?\d+$/.test(code) ? parseInt(code, 10) : null;
            return {
                done: true,
                output: normalizeTerminalText(data.slice(from, match.index)).trim(),
                exitCode: parsed
            };
        }
    }
    return { done: false, output: '', exitCode: null };
}
