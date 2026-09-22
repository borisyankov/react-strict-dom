/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

const babel = require('@babel/core');
const stylexBabelPlugin = require('@stylexjs/babel-plugin');

// Creates a stateful bundler for processing styles using Babel.
module.exports = function createBundler() {
  const styleXRulesMap = new Map();

  // Determines if the source code should be transformed
  function shouldTransform(sourceCode) {
    return sourceCode.includes('react-strict-dom');
  }

  // Transforms the source code using Babel, extracting styles and storing them.
  async function transform(id, sourceCode, babelConfig, options) {
    const { isDev, shouldSkipTransformError } = options;
    let result;
    try {
      result = await babel.transformAsync(sourceCode, {
        filename: id,
        caller: {
          name: 'postcss-react-strict-dom',
          platform: 'web',
          isDev
        },
        ...babelConfig
      });
    } catch (error) {
      if (shouldSkipTransformError) {
        console.warn(
          `[postcss-react-strict-dom] Failed to transform "${id}": ${error.message}`
        );

        // Keep the old styles of the file. The error is often a temporary
        // syntax error during an edit.
        return { code: sourceCode, map: null, metadata: {} };
      }
      throw error;
    }

    if (result == null) {
      // Babel ignores the file (for example, with the `ignore` option), so
      // the file creates no styles
      result = { code: sourceCode, map: null, metadata: {} };
    }

    const { code, map, metadata } = result;
    const stylex = metadata.stylex;
    if (stylex != null && stylex.length > 0) {
      styleXRulesMap.set(id, stylex);
    } else {
      // The file no longer creates styles; remove its old styles
      styleXRulesMap.delete(id);
    }

    return { code, map, metadata };
  }

  // Removes the stored styles for the specified file.
  function remove(id) {
    styleXRulesMap.delete(id);
  }

  //  Bundles all collected styles into a single CSS string.
  function bundle({ useCSSLayers }) {
    const rules = Array.from(styleXRulesMap.values()).flat();

    const css = stylexBabelPlugin.processStylexRules(rules, {
      useLayers: useCSSLayers
    });

    return css;
  }

  return {
    shouldTransform,
    transform,
    remove,
    bundle
  };
};
