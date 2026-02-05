# MML React Types
#### `@mml-io/mml-react-types`

[![npm version](https://img.shields.io/npm/v/@mml-io/mml-react-types.svg?style=flat)](https://www.npmjs.com/package/@mml-io/mml-react-types)

This package contains TypeScript types for MML React components to allow for type checking and suggestions of MML elements and attributes in TypeScript projects.

## Usage

### Installation

```bash
  npm install @mml-io/mml-react-types --save-dev
```

Add `"@mml-io/mml-react-types"` to the `types` field in the `compilerOptions` group of your `tsconfig.json` file:

```json
{
  [...]
  "compilerOptions": {
    [...]
    "types": ["react", "react-dom", "@mml-io/mml-react-types"]
  }

```

### Example

```tsx
import React from 'react';

export function MyComponent() {
  return (
    <m-group>
      <m-cube width={1} height={2} depth={3} color={"red"}  />
    </m-group>
  );
}
```
