/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const postcss = require('postcss');
const createPlugin = require('../src/plugin');

describe('postcss-react-strict-dom', () => {
  const fixturesDir = path.resolve(__dirname, '__fixtures__');

  async function runPlugin(options = {}, inputCSS = '@react-strict-dom;') {
    // Create a new instance for each test as the plugin is stateful
    const postcssPlugin = createPlugin();

    const plugin = postcssPlugin({
      cwd: fixturesDir,
      include: ['**/*.js'],
      babelConfig: {
        configFile: path.join(fixturesDir, '.babelrc.js')
      },
      ...options
    });

    const processor = postcss([plugin]);
    const result = await processor.process(inputCSS, {
      from: path.join(fixturesDir, 'input.css')
    });

    return result;
  }

  test('extracts CSS from files', async () => {
    const result = await runPlugin();

    expect(result.css).toMatchInlineSnapshot(`
"
@layer priority1, priority2, priority3, priority4;
@layer priority1{
.x1ghz6dp{margin:0}
.x1717udv{padding:0}
}
@layer priority2{
.xng3xce{border-style:none}
.x1y0btm7{border-style:solid}
.xc342km{border-width:0}
.xmkeg23{border-width:1px}
.xe8uvvx{list-style:none}
.xysyzu8{overflow:auto}
.x1hl2dhg{text-decoration:none}
}
@layer priority3{
.xuw900x{aspect-ratio:attr(width)  / attr(height)}
.x42x0ya{background-color:black}
.x1u857p9{background-color:green}
.xrkmrrc{background-color:red}
.x9f619{box-sizing:border-box}
.x1lxnp44{font-family:monospace,"monospace"}
.xngnso2{font-size:1.5rem}
.xrv4cvt{font-size:1em}
.x117nqv4{font-weight:bold}
.x288g5{resize:vertical}
.x16tdsg8{text-align:inherit}
.x1vvkbs{word-wrap:break-word}
}
@layer priority4{
.xjm9jq1{height:1px}
.xt7dq6l{height:auto}
.x193iq5w{max-width:100%}
}"
`);

    // Check that messages contain dependency information
    expect(result.messages.length).toBeGreaterThan(0);
    expect(result.messages.some((m) => m.type === 'dir-dependency')).toBe(true);
  });

  test('handles empty CSS input without @-rule', async () => {
    const result = await runPlugin({}, '/* No @-rule here */');

    expect(result.css).toMatchInlineSnapshot('"/* No @-rule here */"');
    expect(result.messages.length).toBe(0);
  });

  test('handles exclude patterns', async () => {
    const result = await runPlugin({
      exclude: ['**/styles-second.js']
    });

    // Should not contain styles-second.js styles
    expect(result.css).not.toContain('green');

    expect(result.css).toMatchInlineSnapshot(`
"
@layer priority1, priority2, priority3, priority4;
@layer priority1{
.x1ghz6dp{margin:0}
.x1717udv{padding:0}
}
@layer priority2{
.xng3xce{border-style:none}
.x1y0btm7{border-style:solid}
.xc342km{border-width:0}
.xmkeg23{border-width:1px}
.xe8uvvx{list-style:none}
.xysyzu8{overflow:auto}
.x1hl2dhg{text-decoration:none}
}
@layer priority3{
.xuw900x{aspect-ratio:attr(width)  / attr(height)}
.x42x0ya{background-color:black}
.xrkmrrc{background-color:red}
.x9f619{box-sizing:border-box}
.x1lxnp44{font-family:monospace,"monospace"}
.xngnso2{font-size:1.5rem}
.xrv4cvt{font-size:1em}
.x117nqv4{font-weight:bold}
.x288g5{resize:vertical}
.x16tdsg8{text-align:inherit}
.x1vvkbs{word-wrap:break-word}
}
@layer priority4{
.xjm9jq1{height:1px}
.xt7dq6l{height:auto}
.x193iq5w{max-width:100%}
}"
`);
  });

  test('skips files that do not match include/exclude patterns', async () => {
    const result = await runPlugin({
      include: ['**/styles-second.js']
    });

    // Should contain styles-second.js styles but not styles.js
    expect(result.css).not.toContain('red');

    expect(result.css).toMatchInlineSnapshot(`
"
@layer priority1, priority2, priority3, priority4;
@layer priority1{
.x1ghz6dp{margin:0}
.x1717udv{padding:0}
}
@layer priority2{
.xng3xce{border-style:none}
.x1y0btm7{border-style:solid}
.xc342km{border-width:0}
.xmkeg23{border-width:1px}
.xe8uvvx{list-style:none}
.xysyzu8{overflow:auto}
.x1hl2dhg{text-decoration:none}
}
@layer priority3{
.xuw900x{aspect-ratio:attr(width)  / attr(height)}
.x42x0ya{background-color:black}
.x1u857p9{background-color:green}
.x9f619{box-sizing:border-box}
.x1lxnp44{font-family:monospace,"monospace"}
.xngnso2{font-size:1.5rem}
.xrv4cvt{font-size:1em}
.x117nqv4{font-weight:bold}
.x288g5{resize:vertical}
.x16tdsg8{text-align:inherit}
.x1vvkbs{word-wrap:break-word}
}
@layer priority4{
.xjm9jq1{height:1px}
.xt7dq6l{height:auto}
.x193iq5w{max-width:100%}
}"
`);
  });

  test('skips files that Babel ignores', async () => {
    const result = await runPlugin({
      babelConfig: {
        configFile: path.join(fixturesDir, '.babelrc.js'),
        ignore: [path.join(fixturesDir, 'styles-second.js')]
      }
    });

    expect(result.css).toContain('red');
    expect(result.css).not.toContain('green');
  });

  describe('incremental builds', () => {
    const RED = `import { css } from 'react-strict-dom';
export const styles = css.create({ box: { color: 'red' } });
`;

    const NO_STYLES = `import { css } from 'react-strict-dom';
export const styles = {};
`;

    let tempDir;
    let mtime;

    beforeEach(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'postcss-rsd-'));
      mtime = Date.now() / 1000;
    });

    afterEach(() => {
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    // Gives each write a different mtime, because the builder uses the mtime
    // to find changed files.
    function writeFile(name, contents) {
      const file = path.join(tempDir, name);
      fs.writeFileSync(file, contents);
      mtime += 1;
      fs.utimesSync(file, mtime, mtime);
    }

    // Returns a function that runs the same plugin instance on each call,
    // like a bundler in watch mode.
    function createWatcher() {
      const plugin = createPlugin()({
        cwd: tempDir,
        include: ['*.js'],
        babelConfig: {
          configFile: path.join(fixturesDir, '.babelrc.js')
        }
      });
      const processor = postcss([plugin]);
      return async () => {
        const result = await processor.process('@react-strict-dom;', {
          from: path.join(tempDir, 'input.css')
        });
        return result.css;
      };
    }

    test('removes the styles of deleted files', async () => {
      writeFile('a.js', RED);
      const build = createWatcher();
      expect(await build()).toContain('color:red');

      fs.rmSync(path.join(tempDir, 'a.js'));
      expect(await build()).not.toContain('color:red');
    });

    test('handles a file that is deleted during a build', async () => {
      writeFile('a.js', RED);
      const file = path.join(tempDir, 'a.js');
      const { readFileSync } = fs;
      // Delete the file after the glob finds it, but before the builder
      // reads it
      const spy = jest
        .spyOn(fs, 'readFileSync')
        .mockImplementation((name, ...args) => {
          if (name === file) {
            fs.rmSync(file, { force: true });
          }
          return readFileSync(name, ...args);
        });
      try {
        expect(await createWatcher()()).not.toContain('color:red');
      } finally {
        spy.mockRestore();
      }
    });

    test('removes the styles of a file that no longer creates styles', async () => {
      writeFile('a.js', RED);
      const build = createWatcher();
      expect(await build()).toContain('color:red');

      writeFile('a.js', NO_STYLES);
      expect(await build()).not.toContain('color:red');
    });

    test('removes the styles of a file that no longer uses react-strict-dom', async () => {
      writeFile('a.js', RED);
      const build = createWatcher();
      expect(await build()).toContain('color:red');

      writeFile('a.js', 'export const styles = {};\n');
      expect(await build()).not.toContain('color:red');
    });

    test('keeps the styles of a file that fails to transform', async () => {
      writeFile('a.js', RED);
      const build = createWatcher();
      expect(await build()).toContain('color:red');

      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        writeFile('a.js', `${RED}export const broken = ;\n`);
        expect(await build()).toContain('color:red');
        expect(warn).toHaveBeenCalledTimes(1);
      } finally {
        warn.mockRestore();
      }
    });
  });
});
