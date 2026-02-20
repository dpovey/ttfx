# @typesugar/mapper

Zero-cost compile-time object mapping and transformation for Typesugar.
Inspired by Scala's Chimney, but fully integrated into the TypeScript ecosystem with zero runtime overhead.

## Features

- **Zero-cost**: All transformations are evaluated at compile time and inlined as direct property access.
- **Type-safe**: Compile-time validation of all mappings. Fails the build if a target field is not mapped.
- **No decorators needed**: Works with plain interfaces and types.

## Usage

```typescript
import { transformInto } from "@typesugar/mapper";

interface User {
  first_name: string;
  last_name: string;
  age: number;
}

interface UserDTO {
  firstName: string;
  lastName: string;
  age: number;
  role: string;
}

const user: User = { first_name: "John", last_name: "Doe", age: 30 };

const dto = transformInto<User, UserDTO>(user, {
  rename: {
    firstName: "first_name",
    lastName: "last_name",
  },
  const: {
    role: "user",
  },
});

// dto is { firstName: "John", lastName: "Doe", age: 30, role: "user" }
// This compiles directly to an object literal with no function call overhead!
```
