const { defineConfig } = require('eslint/config');
const js = require('@eslint/js');
const stylisticPlugin = require('@stylistic/eslint-plugin');
const globals = require('globals');
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const tsParser = require('@typescript-eslint/parser');
const importPlugin = require('eslint-plugin-import');
const vitestPlugin = require('@vitest/eslint-plugin');
const jsdocPlugin = require('eslint-plugin-jsdoc');
const reactPlugin = require('eslint-plugin-react');
const reactHooksPlugin = require('eslint-plugin-react-hooks');

const sharedFiles = [ 'src/**/*.ts', 'src/**/*.tsx', 'tests/**/*.ts', 'tests/**/*.tsx' ];
const testFiles = [ 'tests/**/*.test.ts', 'tests/**/*.test.tsx' ];
const frameworkFiles = [ 'src/framework/**/*.ts', 'src/framework/**/*.tsx' ];

// "src/framework" is the reusable scaffolding: it is meant to be lifted into another application as it is, so it must never
// reach back into Spiccioli. Everything it needs about Spiccioli arrives through its options.
const frameworkForbiddenImportPatterns = [
	{
		group: [ 'src/components/**', 'src/contexts/**', 'src/logic/**', 'src/main/**', 'src/types/**', 'src/utils/**', 'src/config/**', 'src/index*' ],
		message: 'src/framework must not import application code. Pass what it needs in through its options instead.'
	}
];
const importResolverExtensions = [ '.js', '.jsx', '.ts', '.tsx', '.d.ts', '.json', '.css', '.svg', '.png' ];

const warnifyRuleConfig = (ruleConfig) => {
	if(ruleConfig === 2 || ruleConfig === 'error') {
		return 'warn';
	}

	if(Array.isArray(ruleConfig) && ruleConfig.length > 0) {
		const [ severity, ...rest ] = ruleConfig;

		if(severity === 2 || severity === 'error') {
			return [ 'warn', ...rest ];
		}
	}

	return ruleConfig;
};

const warnifyRules = (rules) => {
	if(!rules) {
		return rules;
	}

	return Object.fromEntries(
		Object.entries(rules).map(([ ruleName, ruleConfig ]) => {
			return [ ruleName, warnifyRuleConfig(ruleConfig) ];
		})
	);
};

const warnifyConfig = (config) => {
	if(!config) {
		return config;
	}

	if(!config.rules) {
		return config;
	}

	return {
		...config,
		rules: warnifyRules(config.rules)
	};
};

const warnifyConfigs = (configs) => {
	if(Array.isArray(configs)) {
		return configs.map((config) => {
			return warnifyConfig(config);
		});
	}

	return warnifyConfig(configs);
};

const stylisticRules = {
	'@stylistic/indent': [ 'warn', 'tab', { SwitchCase: 1 }],
	'@stylistic/comma-dangle': [ 'warn', 'never' ],
	'@stylistic/no-extra-parens': [ 'warn', 'all', {
		conditionalAssign: false,
		ignoreJSX: 'all',
		nestedBinaryExpressions: false,
		returnAssign: false
	}],
	'@stylistic/no-extra-semi': 'warn',
	'@stylistic/no-floating-decimal': 'warn',
	'@stylistic/block-spacing': [ 'warn', 'always' ],
	'@stylistic/brace-style': [ 'warn', 'stroustrup', { allowSingleLine: false }],
	'@stylistic/comma-spacing': [ 'warn', { before: false, after: true }],
	'@stylistic/comma-style': [ 'warn', 'last' ],
	'@stylistic/computed-property-spacing': [ 'warn', 'never' ],
	'@stylistic/eol-last': 'warn',
	'@stylistic/function-call-spacing': [ 'warn', 'never' ],
	'@stylistic/function-paren-newline': [ 'warn', 'consistent' ],
	'@stylistic/generator-star-spacing': [ 'warn', { before: true, after: true }],
	'@stylistic/jsx-quotes': [ 'warn', 'prefer-single' ],
	'@stylistic/key-spacing': [ 'warn', { beforeColon: false, afterColon: true, mode: 'strict' }],
	'@stylistic/keyword-spacing': [ 'warn', {
		before: true,
		after: true,
		overrides: {
			if: { after: false },
			for: { after: false },
			switch: { after: false },
			while: { after: false }
		}
	}],
	'@stylistic/line-comment-position': [ 'warn', { position: 'above' }],
	'@stylistic/lines-around-comment': [ 'warn', {
		beforeBlockComment: false,
		afterBlockComment: false,
		beforeLineComment: true,
		afterLineComment: false,
		allowBlockStart: true,
		allowBlockEnd: true,
		allowObjectStart: true,
		allowObjectEnd: true,
		allowArrayStart: true,
		allowArrayEnd: true
	}],
	'@stylistic/lines-between-class-members': [ 'warn', 'always', { exceptAfterSingleLine: true }],
	'@stylistic/max-statements-per-line': [ 'warn', { max: 1 }],
	'@stylistic/multiline-comment-style': [ 'warn', 'separate-lines' ],
	'@stylistic/multiline-ternary': [ 'warn', 'always-multiline' ],
	'@stylistic/new-parens': 'warn',
	'@stylistic/newline-per-chained-call': [ 'warn', { ignoreChainWithDepth: 4 }],
	'@stylistic/no-confusing-arrow': 'warn',
	'@stylistic/no-mixed-spaces-and-tabs': [ 'warn' ],
	'@stylistic/no-multi-spaces': 'warn',
	'@stylistic/no-multiple-empty-lines': [ 'warn', { max: 1 }],
	'@stylistic/no-trailing-spaces': [ 'warn', {
		ignoreComments: false,
		skipBlankLines: true
	}],
	'@stylistic/no-whitespace-before-property': 'warn',
	'@stylistic/object-curly-newline': [ 'warn', {
		ObjectExpression: { consistent: true },
		ObjectPattern: { consistent: true }
	}],
	'@stylistic/object-curly-spacing': [ 'warn', 'always' ],
	'@stylistic/object-property-newline': [ 'warn', { allowAllPropertiesOnSameLine: true }],
	'@stylistic/one-var-declaration-per-line': [ 'warn', 'always' ],
	'@stylistic/operator-linebreak': [ 'warn', 'after' ],
	'@stylistic/quote-props': [ 'warn', 'as-needed' ],
	'@stylistic/quotes': [ 'warn', 'single', { avoidEscape: false, allowTemplateLiterals: 'always' }],
	'@stylistic/semi': [ 'warn', 'always' ],
	'@stylistic/semi-spacing': [ 'warn', { before: false, after: true }],
	'@stylistic/semi-style': [ 'warn', 'last' ],
	'@stylistic/space-before-blocks': [ 'warn', 'always' ],
	'@stylistic/space-before-function-paren': [ 'warn', 'never' ],
	'@stylistic/space-in-parens': [ 'warn', 'never' ],
	'@stylistic/space-infix-ops': [ 'warn', { int32Hint: false }],
	'@stylistic/space-unary-ops': [ 'warn', { words: true, nonwords: false }],
	'@stylistic/spaced-comment': [ 'warn', 'always' ],
	'@stylistic/switch-colon-spacing': [ 'warn', { after: true, before: false }],
	'@stylistic/template-curly-spacing': [ 'warn', 'never' ],
	'@stylistic/wrap-iife': [ 'warn', 'inside' ],
	'@stylistic/yield-star-spacing': [ 'warn', { before: true, after: true }]
};

const vitestRules = {
	'vitest/no-commented-out-tests': 'warn',
	'vitest/no-disabled-tests': 'warn',
	'vitest/no-focused-tests': 'warn',
	'vitest/no-identical-title': 'warn',
	'vitest/no-test-prefixes': 'warn',
	'vitest/valid-describe-callback': 'warn',
	'vitest/valid-expect': 'warn'
};

const reactSafetyRules = {
	'react/jsx-key': 'warn',
	'react/jsx-no-duplicate-props': 'warn',
	'react/jsx-no-target-blank': 'warn',
	'react/jsx-no-undef': 'warn',
	'react/no-children-prop': 'warn',
	'react/no-danger-with-children': 'warn',
	'react/no-deprecated': 'warn',
	'react/no-direct-mutation-state': 'warn',
	'react/no-find-dom-node': 'warn',
	'react/no-is-mounted': 'warn',
	'react/no-render-return-value': 'warn',
	'react/no-string-refs': 'warn',
	'react/no-unescaped-entities': 'warn',
	'react/no-unknown-property': 'warn',
	'react/require-render-return': 'warn'
};

const reactHooksRules = {
	'react-hooks/rules-of-hooks': 'warn',
	'react-hooks/exhaustive-deps': 'warn'
};

module.exports = defineConfig([
	warnifyConfigs(js.configs.recommended),
	...warnifyConfigs(tsPlugin.configs['flat/recommended-type-checked']),
	warnifyConfigs(importPlugin.flatConfigs.typescript),
	{
		files: sharedFiles,
		plugins: {
			'@stylistic': stylisticPlugin,
			jsdoc: jsdocPlugin,
			react: reactPlugin,
			'react-hooks': reactHooksPlugin
		},
		languageOptions: {
			parser: tsParser,
			ecmaVersion: 'latest',
			sourceType: 'module',
			globals: {
				...globals.browser,
				...globals.es2015,
				...globals.node,
				__DEV__: 'readonly'
			},
			parserOptions: {
				projectService: true,
				tsconfigRootDir: __dirname,
				ecmaFeatures: {
					jsx: true
				}
			}
		},
		settings: {
			jsdoc: {
				allowOverrideWithoutParam: true,
				allowImplementsWithoutParam: true,
				allowAugmentsExtendsWithoutParam: true,
				mode: 'typescript'
			},
			react: {
				version: 'detect'
			},
			'import/parsers': {
				'@typescript-eslint/parser': [ '.ts', '.tsx' ]
			},
			'import/resolver': {
				typescript: {
					alwaysTryTypes: true,
					project: './tsconfig.json'
				},
				node: {
					extensions: importResolverExtensions
				}
			}
		},
		rules: {

			/* ************* @typescript-eslint ************* */

			'@typescript-eslint/no-require-imports': [ 'off' ],
			'@typescript-eslint/prefer-interface': [ 'off' ],
			'@typescript-eslint/camelcase': [ 'off' ],
			'@typescript-eslint/no-parameter-properties': [ 'off' ],
			'@typescript-eslint/explicit-function-return-type': [ 'warn', { allowExpressions: true, allowTypedFunctionExpressions: true }],
			'@typescript-eslint/ban-types': 'off',
			'@typescript-eslint/no-empty-object-type': 'off',
			'@typescript-eslint/no-deprecated': 'warn',
			'@typescript-eslint/no-shadow': [ 'warn' ],
			'@typescript-eslint/no-unused-vars': [ 'warn', { vars: 'all', args: 'after-used' }],
			'@typescript-eslint/no-use-before-define': [ 'warn', { typedefs: false }],

			/* ************* @stylistic ************* */

			...stylisticRules,

			/* ************* eslint ************* */

			'for-direction': 'warn',
			'getter-return': [ 'warn', { allowImplicit: true }],
			'no-await-in-loop': 'off',
			'no-compare-neg-zero': 'warn',
			'no-cond-assign': [ 'warn', 'always' ],
			'no-console': 'off',
			'no-constant-condition': 'warn',
			'no-control-regex': 'warn',
			'no-debugger': 'warn',
			'no-dupe-args': 'warn',
			'no-dupe-keys': 'warn',
			'no-duplicate-case': 'warn',
			'no-empty': 'warn',
			'no-empty-character-class': 'warn',
			'no-ex-assign': 'warn',
			'no-extra-boolean-cast': 'warn',
			'no-func-assign': 'warn',
			'no-inner-declarations': [ 'warn', 'both' ],
			'no-invalid-regexp': 'warn',
			'no-irregular-whitespace': 'warn',
			'no-obj-calls': 'warn',
			'no-regex-spaces': 'warn',
			'no-sparse-arrays': 'warn',
			'no-unexpected-multiline': 'warn',
			'no-template-curly-in-string': 'warn',
			'no-unreachable': 'warn',
			'no-unsafe-finally': 'warn',
			'no-unsafe-negation': 'warn',
			'use-isnan': 'warn',
			'valid-jsdoc': 'off',
			'valid-typeof': 'warn',
			'accessor-pairs': [ 'warn', { getWithoutSet: false, setWithoutGet: true }],
			'array-callback-return': [ 'warn', { allowImplicit: true }],
			'block-scoped-var': 'warn',
			complexity: 'off',
			'consistent-return': 'off',
			curly: [ 'warn', 'all' ],
			'default-case': 'warn',
			'dot-notation': [ 'warn', { allowKeywords: true }],
			eqeqeq: 'warn',
			'no-alert': 'warn',
			'no-caller': 'warn',
			'no-case-declarations': 'warn',
			'no-div-regex': 'warn',
			'no-empty-function': [ 'warn', { allow: [ 'methods' ] }],
			'no-eq-null': 'warn',
			'no-eval': 'warn',
			'no-extend-native': 'warn',
			'no-extra-bind': 'warn',
			'no-extra-label': 'warn',
			'no-fallthrough': 'warn',
			'no-global-assign': 'warn',
			'no-implicit-coercion': 'warn',
			'no-implicit-globals': 'warn',
			'no-implied-eval': 'warn',
			'no-invalid-this': 'off',
			'no-iterator': 'warn',
			'no-labels': 'warn',
			'no-lone-blocks': 'warn',
			'no-loop-func': 'warn',
			'no-magic-numbers': 'off',
			'no-multi-str': 'warn',
			'no-new': 'warn',
			'no-new-func': 'warn',
			'no-new-wrappers': 'warn',
			'no-octal': 'warn',
			'no-octal-escape': 'warn',
			'no-object-constructor': 'warn',
			'no-param-reassign': 'off',
			'no-proto': 'warn',
			'no-redeclare': 'warn',
			'no-return-assign': [ 'warn', 'always' ],
			'no-script-url': 'warn',
			'no-self-assign': 'warn',
			'no-self-compare': 'warn',
			'no-sequences': 'warn',
			'no-throw-literal': 'warn',
			'no-unmodified-loop-condition': 'warn',
			'no-unused-expressions': 'warn',
			'no-unused-labels': 'warn',
			'no-useless-call': 'warn',
			'no-useless-concat': 'warn',
			'no-useless-escape': 'warn',
			'no-useless-return': 'warn',
			'no-void': [ 'warn', { allowAsStatement: true } ],
			'no-warning-comments': 'warn',
			'no-with': 'warn',
			radix: 'warn',
			'vars-on-top': 'warn',
			strict: [ 'warn', 'global' ],
			'init-declarations': 'off',
			'no-delete-var': 'warn',
			'no-label-var': 'warn',
			'no-restricted-globals': 'warn',
			'no-shadow': 'off',
			'no-shadow-restricted-names': 'warn',
			'no-undef': 'warn',
			'no-undef-init': 'warn',
			'no-undefined': 'off',
			'no-unused-vars': 'off',
			'no-use-before-define': 'off',
			'react/react-in-jsx-scope': 'off',
			'handle-callback-err': [ 'warn', 'err' ],
			'no-buffer-constructor': 'warn',
			'no-mixed-requires': [ 'warn', true ],
			'no-new-require': 'warn',
			'no-new-native-nonconstructor': 'warn',
			'no-path-concat': 'warn',
			'no-process-env': 'warn',
			'no-process-exit': 'warn',
			'no-sync': [ 'warn', { allowAtRootLevel: false }],
			'consistent-this': [ 'warn', 'that' ],
			'func-names': 'off',
			'func-name-matching': 'off',
			'func-style': [ 'warn', 'expression' ],
			'id-length': [ 'warn', {
				min: 1,
				max: Number.infinity,
				properties: 'always',
				exceptions: [ '_', 'i', 'j', 'x', 'y', 'z', 'q' ]
			}],
			'id-match': 'off',
			'max-depth': 'off',
			'max-nested-callbacks': 'off',
			'max-params': 'off',
			'max-statements': 'off',
			'no-array-constructor': 'warn',
			'no-bitwise': 'warn',
			'no-continue': 'off',
			'no-inline-comments': 'warn',
			'no-lonely-if': 'warn',
			'no-negated-condition': 'off',
			'no-nested-ternary': 'warn',
			'no-plusplus': [ 'warn', { allowForLoopAfterthoughts: true }],
			'no-restricted-syntax': 'off',
			'no-ternary': 'off',
			'no-unneeded-ternary': 'warn',
			'one-var': 'off',
			'operator-assignment': [ 'warn', 'always' ],
			'require-jsdoc': 'off',
			'sort-keys': [ 0 ],
			'sort-vars': [ 'warn', { ignoreCase: true }],
			'arrow-body-style': [ 'warn', 'always' ],
			'constructor-super': 'warn',
			'no-class-assign': 'warn',
			'no-const-assign': 'warn',
			'no-dupe-class-members': 'off',
			'no-duplicate-imports': 'warn',
			'no-restricted-imports': 'off',
			'no-this-before-super': 'warn',
			'no-useless-computed-key': 'warn',
			'no-var': 'warn',
			'prefer-arrow-callback': [ 'warn', { allowNamedFunctions: false, allowUnboundThis: true }],
			'prefer-const': [ 'warn', { destructuring: 'any', ignoreReadBeforeAssign: true }],
			'prefer-numeric-literals': 'warn',
			'prefer-rest-params': 'warn',
			'prefer-spread': 'warn',
			'prefer-template': 'warn',
			'require-yield': 'warn',
			'symbol-description': 'warn',
			'padded-blocks': [ 'warn', { blocks: 'never', switches: 'never', classes: 'never' } ],

			/* ************* eslint-plugin-jsdoc ************* */

			'jsdoc/check-alignment': 'warn',
			'jsdoc/check-examples': 'off',
			'jsdoc/check-indentation': 'warn',
			'jsdoc/check-param-names': 'warn',
			'jsdoc/check-syntax': 'warn',
			'jsdoc/check-tag-names': 'warn',
			'jsdoc/check-types': 'warn',
			'jsdoc/no-undefined-types': 'warn',
			'jsdoc/require-hyphen-before-param-description': [ 'warn', 'never' ],
			'jsdoc/require-param': 'warn',
			'jsdoc/require-param-description': 'warn',
			'jsdoc/require-param-name': 'warn',
			'jsdoc/require-returns': 'warn',
			'jsdoc/require-returns-check': 'warn',
			'jsdoc/require-returns-description': 'warn',
			'jsdoc/valid-types': 'warn',

			/* ************* eslint-plugin-import ************* */

			'import/no-unresolved': 'warn',
			'import/named': 'off',
			'import/default': 'warn',
			'import/namespace': 'off',
			'import/no-restricted-paths': 'warn',
			'import/no-absolute-path': 'off',
			'import/no-dynamic-require': 'warn',
			'import/no-internal-modules': [ 'warn', {
				allow: [
					'src/**',
					'tests/**',
					'@fontsource/inter/*.css',
					'react-dom/client'
				]
			}],
			'import/no-webpack-loader-syntax': 'off',
			'import/no-self-import': 'off',
			'import/no-cycle': 'off',
			'import/no-useless-path-segments': 'off',
			'import/no-relative-parent-imports': 'off',
			'import/no-unused-modules': 'off',

			'import/export': 'warn',
			'import/no-named-as-default': 'warn',
			'import/no-named-as-default-member': 'warn',
			'import/no-deprecated': 'warn',

			'import/no-mutable-exports': 'warn',

			'import/unambiguous': 'off',
			'import/no-commonjs': 'off',
			'import/no-amd': 'off',
			'import/no-nodejs-modules': 'off',

			'import/first': 'warn',
			'import/exports-last': 'off',
			'import/no-duplicates': 'warn',
			'import/no-namespace': 'warn',
			'import/extensions': [ 'warn', 'never', { png: 'off', svg: 'off', css: 'always', json: 'always' }],
			'import/order': 'warn',
			'import/newline-after-import': 'warn',
			'import/prefer-default-export': 'off',
			'import/max-dependencies': 'off',
			'import/no-unassigned-import': [ 'warn', { allow: [ '**/*.css' ] }],
			'import/no-named-default': 'warn',
			'import/no-default-export': 'warn',
			'import/no-named-export': 'off',
			'import/no-anonymous-default-export': 'warn',
			'import/group-exports': 'off',
			'import/dynamic-import-chunkname': 'off',

			/* ************* react ************* */

			...reactSafetyRules,
			...reactHooksRules,
			'react/display-name': 'off'
		}
	},
	{
		files: frameworkFiles,
		rules: {
			'no-restricted-imports': [ 'warn', { patterns: frameworkForbiddenImportPatterns }]
		}
	},
	{
		files: testFiles,
		plugins: {
			vitest: vitestPlugin
		},
		languageOptions: {
			globals: {
				...globals.vitest
			}
		},
		rules: {
			...vitestRules,
			'@typescript-eslint/explicit-function-return-type': 'off',
			'@typescript-eslint/no-deprecated': 'off',
			'@typescript-eslint/no-floating-promises': 'off',
			'@typescript-eslint/no-unnecessary-type-assertion': 'off',
			'@typescript-eslint/no-unsafe-assignment': 'off',
			'@typescript-eslint/no-unsafe-call': 'off',
			'@typescript-eslint/no-unsafe-member-access': 'off',
			'@typescript-eslint/require-await': 'off',
			'no-empty-function': 'off',
			'no-unsafe-optional-chaining': 'off'
		}
	}
]);
