module.exports = {
  env: {
    node: true,
    browser: false,
  },
  parserOptions: {
    sourceType: 'script',
  },
  rules: {
    'no-console': 'off',
    'no-underscore-dangle': ['error', { allow: ['__ow_headers', '__ow_path', '__ow_method'] }],
  },
};
