import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const bundle = join(dirname(require.resolve('playwright/package.json')), 'lib/transform/babelBundle.js');
const { babelParse } = require(bundle);
if (typeof babelParse !== 'function') throw new Error('Installed Playwright does not expose the required Babel parser');

export function parsePublicScript(script) {
  if (typeof script !== 'string' || script.length > 4 * 1024 * 1024) throw new Error('Invalid public script size');
  return babelParse(script, 'public-career-asset.js', false);
}

export function walkScript(ast, visit) {
  const pending = [ast];
  let count = 0;
  while (pending.length) {
    const node = pending.pop();
    if (++count > 500_000) throw new Error('Public script AST size limit');
    visit(node);
    for (const [key, value] of Object.entries(node)) {
      if (['loc', 'tokens', 'comments', 'leadingComments', 'trailingComments', 'innerComments'].includes(key)) continue;
      if (Array.isArray(value)) pending.push(...value.filter((child) => child && typeof child.type === 'string'));
      else if (value && typeof value.type === 'string') pending.push(value);
    }
  }
}

// Decode only Nuxt's literal IIFE data format. Never evaluate source JavaScript.
export function parseNuxtLiteral(script) {
  if (typeof script !== 'string' || script.length > 4 * 1024 * 1024) throw new Error('Invalid Nuxt data size');
  const ast = babelParse(script, 'official-careers-data.js', false);
  const statements = ast.program.body.filter((node) => node.type !== 'EmptyStatement');
  if (statements.length !== 1 || statements[0].type !== 'ExpressionStatement') throw new Error('Unexpected Nuxt program');
  const assignment = statements[0].expression;
  const target = assignment.left;
  if (assignment.type !== 'AssignmentExpression' || assignment.operator !== '=' ||
      target?.type !== 'MemberExpression' || target.computed ||
      target.object?.name !== 'window' || target.property?.name !== '__NUXT__') {
    throw new Error('Not a window.__NUXT__ data assignment');
  }
  let nodes = 0;
  const decode = (node, bindings, depth = 0) => {
    if (!node || depth > 64 || ++nodes > 100_000) throw new Error('Nuxt literal limits exceeded');
    switch (node.type) {
      case 'StringLiteral': case 'BooleanLiteral': case 'NumericLiteral':
        if (node.type === 'NumericLiteral' && !Number.isFinite(node.value)) throw new Error('Nonfinite number');
        return node.value;
      case 'NullLiteral': return null;
      case 'Identifier':
        if (!bindings.has(node.name)) throw new Error('Unbound Nuxt identifier');
        return bindings.get(node.name);
      case 'ArrayExpression': return node.elements.map((item) => decode(item, bindings, depth + 1));
      case 'ObjectExpression': {
        const result = Object.create(null);
        for (const property of node.properties) {
          if (property.type !== 'ObjectProperty' || property.computed || property.method) throw new Error('Nonliteral object property');
          const key = property.key.type === 'Identifier' ? property.key.name : property.key.value;
          if (typeof key !== 'string' || ['__proto__', 'prototype', 'constructor'].includes(key) || Object.hasOwn(result, key)) {
            throw new Error('Unsafe or duplicate object key');
          }
          result[key] = decode(property.value, bindings, depth + 1);
        }
        return result;
      }
      default: throw new Error(`Executable syntax rejected: ${node.type}`);
    }
  };
  const expression = assignment.right;
  if (expression.type === 'ObjectExpression') return decode(expression, new Map());
  const fn = expression.callee;
  if (expression.type !== 'CallExpression' || fn?.type !== 'FunctionExpression' || fn.async || fn.generator ||
      fn.body.body.length !== 1 || fn.body.body[0].type !== 'ReturnStatement' ||
      fn.params.length !== expression.arguments.length || fn.params.some((parameter) => parameter.type !== 'Identifier')) {
    throw new Error('Unsupported Nuxt wrapper; no script execution permitted');
  }
  const bindings = new Map(fn.params.map((parameter, index) => [parameter.name, decode(expression.arguments[index], new Map())]));
  return decode(fn.body.body[0].argument, bindings);
}
