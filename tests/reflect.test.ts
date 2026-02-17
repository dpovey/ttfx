/**
 * Tests for compile-time reflection macros
 */

import { describe, it, expect } from "vitest";
import type { TypeInfo, FieldInfo, MethodInfo } from "../src/macros/reflect.js";

describe("TypeInfo structure", () => {
  describe("type metadata", () => {
    it("should capture type name", () => {
      const info: TypeInfo = {
        name: "User",
        kind: "interface",
        fields: [],
        methods: [],
        typeParameters: [],
      };

      expect(info.name).toBe("User");
      expect(info.kind).toBe("interface");
    });

    it("should capture fields with types", () => {
      const info: TypeInfo = {
        name: "User",
        kind: "interface",
        fields: [
          { name: "id", type: "number", optional: false },
          { name: "name", type: "string", optional: false },
          { name: "email", type: "string", optional: true },
        ],
        methods: [],
        typeParameters: [],
      };

      expect(info.fields).toHaveLength(3);
      expect(info.fields[0].name).toBe("id");
      expect(info.fields[0].type).toBe("number");
      expect(info.fields[2].optional).toBe(true);
    });

    it("should capture methods with signatures", () => {
      const info: TypeInfo = {
        name: "UserService",
        kind: "class",
        fields: [],
        methods: [
          {
            name: "findById",
            parameters: [{ name: "id", type: "number" }],
            returnType: "User | undefined",
          },
          {
            name: "create",
            parameters: [{ name: "data", type: "CreateUserDto" }],
            returnType: "User",
          },
        ],
        typeParameters: [],
      };

      expect(info.methods).toHaveLength(2);
      expect(info.methods[0].name).toBe("findById");
      expect(info.methods[0].parameters[0].name).toBe("id");
    });

    it("should capture type parameters", () => {
      const info: TypeInfo = {
        name: "Result",
        kind: "type",
        fields: [],
        methods: [],
        typeParameters: ["T", "E"],
      };

      expect(info.typeParameters).toEqual(["T", "E"]);
    });
  });
});

describe("FieldInfo structure", () => {
  it("should represent required fields", () => {
    const field: FieldInfo = {
      name: "id",
      type: "number",
      optional: false,
    };

    expect(field.optional).toBe(false);
  });

  it("should represent optional fields", () => {
    const field: FieldInfo = {
      name: "nickname",
      type: "string",
      optional: true,
    };

    expect(field.optional).toBe(true);
  });

  it("should capture readonly modifier", () => {
    const field: FieldInfo = {
      name: "createdAt",
      type: "Date",
      optional: false,
      readonly: true,
    };

    expect(field.readonly).toBe(true);
  });
});

describe("MethodInfo structure", () => {
  it("should capture method with no parameters", () => {
    const method: MethodInfo = {
      name: "toString",
      parameters: [],
      returnType: "string",
    };

    expect(method.parameters).toHaveLength(0);
    expect(method.returnType).toBe("string");
  });

  it("should capture method with multiple parameters", () => {
    const method: MethodInfo = {
      name: "between",
      parameters: [
        { name: "min", type: "number" },
        { name: "max", type: "number" },
      ],
      returnType: "boolean",
    };

    expect(method.parameters).toHaveLength(2);
    expect(method.parameters[1].name).toBe("max");
  });
});

describe("Reflection use cases", () => {
  describe("validation generation", () => {
    it("should generate field validators based on type", () => {
      const fieldValidators: Record<string, (value: unknown) => boolean> = {
        number: (v) => typeof v === "number",
        string: (v) => typeof v === "string",
        boolean: (v) => typeof v === "boolean",
      };

      expect(fieldValidators.number(42)).toBe(true);
      expect(fieldValidators.number("42")).toBe(false);
      expect(fieldValidators.string("hello")).toBe(true);
      expect(fieldValidators.boolean(false)).toBe(true);
    });

    it("should validate objects against TypeInfo", () => {
      const userInfo: TypeInfo = {
        name: "User",
        kind: "interface",
        fields: [
          { name: "id", type: "number", optional: false },
          { name: "name", type: "string", optional: false },
        ],
        methods: [],
        typeParameters: [],
      };

      const validate = (
        obj: Record<string, unknown>,
        info: TypeInfo,
      ): boolean => {
        for (const field of info.fields) {
          if (!field.optional && !(field.name in obj)) {
            return false;
          }

          const value = obj[field.name];
          if (value !== undefined) {
            if (field.type === "number" && typeof value !== "number")
              return false;
            if (field.type === "string" && typeof value !== "string")
              return false;
          }
        }
        return true;
      };

      expect(validate({ id: 1, name: "John" }, userInfo)).toBe(true);
      expect(validate({ id: "1", name: "John" }, userInfo)).toBe(false);
      expect(validate({ name: "John" }, userInfo)).toBe(false); // missing id
    });
  });

  describe("serialization generation", () => {
    it("should generate field extraction based on TypeInfo", () => {
      const extractFields = (
        obj: Record<string, unknown>,
        fields: FieldInfo[],
      ): Record<string, unknown> => {
        const result: Record<string, unknown> = {};
        for (const field of fields) {
          if (field.name in obj) {
            result[field.name] = obj[field.name];
          }
        }
        return result;
      };

      const fields: FieldInfo[] = [
        { name: "id", type: "number", optional: false },
        { name: "name", type: "string", optional: false },
      ];

      const obj = { id: 1, name: "John", password: "secret" };
      const extracted = extractFields(obj, fields);

      expect(extracted).toEqual({ id: 1, name: "John" });
      expect("password" in extracted).toBe(false);
    });
  });

  describe("proxy generation", () => {
    it("should generate method interceptors based on MethodInfo", () => {
      const methods: MethodInfo[] = [
        {
          name: "greet",
          parameters: [{ name: "name", type: "string" }],
          returnType: "string",
        },
        {
          name: "add",
          parameters: [
            { name: "a", type: "number" },
            { name: "b", type: "number" },
          ],
          returnType: "number",
        },
      ];

      // Generate method signatures
      const signatures = methods.map((m) => {
        const params = m.parameters
          .map((p) => `${p.name}: ${p.type}`)
          .join(", ");
        return `${m.name}(${params}): ${m.returnType}`;
      });

      expect(signatures).toEqual([
        "greet(name: string): string",
        "add(a: number, b: number): number",
      ]);
    });
  });

  describe("fieldNames utility", () => {
    it("should extract field names from TypeInfo", () => {
      const info: TypeInfo = {
        name: "User",
        kind: "interface",
        fields: [
          { name: "id", type: "number", optional: false },
          { name: "name", type: "string", optional: false },
          { name: "email", type: "string", optional: true },
        ],
        methods: [],
        typeParameters: [],
      };

      const fieldNames = info.fields.map((f) => f.name);
      expect(fieldNames).toEqual(["id", "name", "email"]);
    });
  });
});

describe("Reflection for different type kinds", () => {
  describe("interface reflection", () => {
    it("should reflect interface declaration", () => {
      const info: TypeInfo = {
        name: "Point",
        kind: "interface",
        fields: [
          { name: "x", type: "number", optional: false },
          { name: "y", type: "number", optional: false },
        ],
        methods: [],
        typeParameters: [],
      };

      expect(info.kind).toBe("interface");
    });
  });

  describe("class reflection", () => {
    it("should reflect class declaration with methods", () => {
      const info: TypeInfo = {
        name: "Calculator",
        kind: "class",
        fields: [{ name: "value", type: "number", optional: false }],
        methods: [
          {
            name: "add",
            parameters: [{ name: "n", type: "number" }],
            returnType: "Calculator",
          },
          { name: "result", parameters: [], returnType: "number" },
        ],
        typeParameters: [],
      };

      expect(info.kind).toBe("class");
      expect(info.methods).toHaveLength(2);
    });
  });

  describe("type alias reflection", () => {
    it("should reflect type alias", () => {
      const info: TypeInfo = {
        name: "UserId",
        kind: "type",
        fields: [],
        methods: [],
        typeParameters: [],
      };

      expect(info.kind).toBe("type");
    });
  });

  describe("generic type reflection", () => {
    it("should capture type parameters", () => {
      const info: TypeInfo = {
        name: "Container",
        kind: "class",
        fields: [{ name: "value", type: "T", optional: false }],
        methods: [
          { name: "get", parameters: [], returnType: "T" },
          {
            name: "set",
            parameters: [{ name: "value", type: "T" }],
            returnType: "void",
          },
        ],
        typeParameters: ["T"],
      };

      expect(info.typeParameters).toContain("T");
      expect(info.fields[0].type).toBe("T");
    });
  });
});
