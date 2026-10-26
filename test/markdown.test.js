import { test, before } from 'node:test';
import assert from 'node:assert/strict';

/**
 * A tiny stand-in for the browser's document: enough for el() to build nodes, so the preview formatter
 * can be checked without a browser. Each node prints itself as compact pseudo-HTML.
 */
class FakeNode {
    constructor(tag) {
        this.tag = tag;
        this.children = [];
        this.className = '';
        this.style = {};
        this.dataset = {};
        this.attributes = {};
        this._text = '';
    }
    set textContent(value) {
        this._text = String(value);
        this.children = [];
    }
    get textContent() {
        return this._text + this.children.map((child) => child.textContent).join('');
    }
    append(...nodes) {
        for (const node of nodes) this.children.push(typeof node === 'string' ? new FakeText(node) : node);
    }
    setAttribute(key, value) {
        this.attributes[key] = value;
    }
    toString() {
        const cls = this.className ? `.${this.className.split(' ').join('.')}` : '';
        return `<${this.tag}${cls}>${this._text}${this.children.join('')}</${this.tag}>`;
    }
}
class FakeText {
    constructor(text) {
        this.textContent = text;
    }
    toString() {
        return this.textContent;
    }
}

let markdown;
let inline;
before(async () => {
    // forms.js (imported by the emoji helper) listens for leaving the page
    globalThis.window = /** @type {any} */ ({ addEventListener() {} });
    globalThis.document = /** @type {any} */ ({
        createElement: (tag) => new FakeNode(tag),
        createTextNode: (text) => new FakeText(text),
    });
    ({ markdown, inline } = await import('../src/dashboard/public/markdown.js'));
});

const render = (text, ctx) => markdown(text, ctx).join('');
const renderInline = (text, ctx) => inline(text, ctx).join('');

test('bold, italic, underline, strikethrough and their combinations', () => {
    assert.equal(renderInline('**bold**'), '<strong>bold</strong>');
    assert.equal(renderInline('*italic* and _also_'), '<em>italic</em> and <em>also</em>');
    assert.equal(renderInline('***both***'), '<strong><em>both</em></strong>');
    assert.equal(renderInline('__under__ ~~gone~~'), '<u>under</u> <s>gone</s>');
    assert.equal(renderInline('**bold _inside_**'), '<strong>bold <em>inside</em></strong>');
});

test("text that isn't formatting stays as typed", () => {
    assert.equal(renderInline('2 * 3 * 4'), '2 * 3 * 4');
    assert.equal(renderInline('snake_case_name'), 'snake_case_name');
    assert.equal(renderInline('\\*not italic\\*'), '*not italic*');
    assert.equal(renderInline('`**code**`'), '<code.md-code>**code**</code>');
});

test('mentions show names, emojis show images, and spoilers and links are styled', () => {
    const ctx = {
        roles: new Map([['111', { name: 'Admin', color: '#ff0000' }]]),
        channels: new Map([['222', 'general']]),
    };
    assert.equal(renderInline('<@&111>', ctx), '<span.preview-mention>@Admin</span>');
    assert.equal(
        renderInline('<#222> <@333>', ctx),
        '<span.preview-mention>#general</span> <span.preview-mention>@user</span>'
    );
    assert.equal(renderInline('@everyone'), '<span.preview-mention>@everyone</span>');
    assert.equal(renderInline('<:wave:444444444444444444>'), '<img.emoji-image></img>');
    assert.equal(renderInline('||secret||'), '<span.md-spoiler>secret</span>');
    assert.equal(renderInline('[site](https://ovxbot.com)'), '<span.md-link>site</span>');
    assert.equal(renderInline('https://ovxbot.com.'), '<span.md-link>https://ovxbot.com</span>.');
});

test('timestamps show as dates', () => {
    const out = renderInline('<t:0:D>');
    assert.match(out, /^<span\.md-timestamp>.*(1970|1969).*<\/span>$/);
    assert.match(renderInline(`<t:${Math.floor(Date.now() / 1000) - 7200}:R>`), /hours ago/);
});

test('headings, small text, quotes, lists and code blocks', () => {
    assert.equal(
        render('# Big\n## Medium\n-# small'),
        '<div.md-h1>Big</div><div.md-h2>Medium</div><div.md-subtext>small</div>'
    );
    assert.equal(
        render('> one\n> two\nafter'),
        '<div.md-quote><div.md-line>one</div><div.md-line>two</div></div><div.md-line>after</div>'
    );
    assert.equal(render('>>> all\nof this'), '<div.md-quote><div.md-line>all</div><div.md-line>of this</div></div>');
    assert.match(
        render('- a\n- **b**'),
        /<div\.md-li><span\.md-bullet>•<\/span><span>a<\/span><\/div><div\.md-li>.*<strong>b<\/strong>/
    );
    assert.equal(render('```js\nconst a = **1**;\n```'), '<pre.md-codeblock><code>const a = **1**;</code></pre>');
    assert.equal(render('line\n\nline'), '<div.md-line>line</div><div.md-line><br></br></div><div.md-line>line</div>');
});

test('text is only ever set as text, so typed HTML is shown, not run', () => {
    assert.equal(renderInline('<img src=x onerror=alert(1)>'), '<img src=x onerror=alert(1)>');
    const [node] = markdown('<b>hi</b>');
    assert.equal(node.textContent, '<b>hi</b>');
    assert.equal(node.children.length, 1, 'one text node, not a <b> element');
});
