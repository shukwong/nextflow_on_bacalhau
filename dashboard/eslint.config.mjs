import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

const eslintConfig = [
  ...nextVitals,
  ...nextTypescript,
  {
    rules: {
      // The dashboard does not enable the React Compiler; keep lint focused on
      // correctness rules that match the current runtime.
      'react-hooks/purity': 'off',
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  {
    ignores: [
      '.next/**',
      'coverage/**',
      'node_modules/**',
      'out/**',
      'next-env.d.ts',
    ],
  },
];

export default eslintConfig;
