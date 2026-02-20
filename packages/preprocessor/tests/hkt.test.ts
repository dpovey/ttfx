import { describe, it, expect } from "vitest";
import { preprocess } from "../src/preprocess.js";

describe("HKT extension", () => {
  describe("F<_> declaration removal", () => {
    it("should remove <_> from type parameter", () => {
      const source = `interface Functor<F<_>> {}`;
      const { code, changed } = preprocess(source, { extensions: ["hkt"] });
      expect(changed).toBe(true);
      expect(code).toBe(`interface Functor<F> {}`);
    });

    it("should handle multiple HKT parameters", () => {
      const source = `interface BiFunctor<F<_>, G<_>> {}`;
      const { code, changed } = preprocess(source, { extensions: ["hkt"] });
      expect(changed).toBe(true);
      expect(code).toContain("BiFunctor<F, G>");
    });

    it("should handle mixed HKT and regular parameters", () => {
      const source = `interface MapLike<F<_>, K> {}`;
      const { code, changed } = preprocess(source, { extensions: ["hkt"] });
      expect(changed).toBe(true);
      expect(code).toBe(`interface MapLike<F, K> {}`);
    });
  });

  describe("F<A> usage rewriting to $<F, A>", () => {
    it("should rewrite F<A> to $<F, A> in method signatures", () => {
      const source = `
interface Functor<F<_>> {
  map: <A, B>(fa: F<A>, f: (a: A) => B) => F<B>;
}`;
      const { code, changed } = preprocess(source, { extensions: ["hkt"] });
      expect(changed).toBe(true);
      expect(code).toContain("$<F, A>");
      expect(code).toContain("$<F, B>");
      expect(code).not.toContain("F<A>");
      expect(code).not.toContain("F<B>");
    });

    it("should not rewrite non-HKT generics", () => {
      const source = `
interface Container<F<_>> {
  get: <A>(fa: F<A>) => Array<A>;
}`;
      const { code } = preprocess(source, { extensions: ["hkt"] });
      expect(code).toContain("Array<A>");
      expect(code).toContain("$<F, A>");
    });

    it("should handle nested generics", () => {
      const source = `
interface Nested<F<_>> {
  wrap: <A>(a: A) => F<Array<A>>;
}`;
      const { code } = preprocess(source, { extensions: ["hkt"] });
      expect(code).toContain("$<F, Array<A>>");
    });
  });

  describe("scope handling", () => {
    it("should only rewrite within HKT declaration scope", () => {
      const source = `
interface Functor<F<_>> {
  map: <A, B>(fa: F<A>, f: (a: A) => B) => F<B>;
}

interface Other<G> {
  get: <A>(ga: G<A>) => A;
}`;
      const { code } = preprocess(source, { extensions: ["hkt"] });
      expect(code).toMatch(/interface Functor<F>/);
      expect(code).toMatch(/\$<F, A>/);
      expect(code).toMatch(/\$<F, B>/);
      expect(code).toMatch(/interface Other<G>/);
      expect(code).toMatch(/G<A>/);
    });

    it("should handle real-world Functor example", () => {
      const source = `
export interface Functor<F<_>> {
  readonly map: <A, B>(fa: F<A>, f: (a: A) => B) => F<B>;
}`;
      const { code } = preprocess(source, { extensions: ["hkt"] });
      expect(code).toContain("Functor<F>");
      expect(code).toContain("$<F, A>");
      expect(code).toContain("$<F, B>");
    });
  });

  describe("edge cases", () => {
    it("should handle type aliases", () => {
      const source = `type Apply<F<_>> = <A, B>(fa: F<A>, fab: F<(a: A) => B>) => F<B>;`;
      const { code } = preprocess(source, { extensions: ["hkt"] });
      expect(code).toContain("Apply<F>");
      expect(code).toContain("$<F, A>");
    });

    it("should not affect source without HKT syntax", () => {
      const source = `interface Regular<T> { value: T; }`;
      const { code, changed } = preprocess(source, { extensions: ["hkt"] });
      expect(changed).toBe(false);
      expect(code).toBe(source);
    });

    it("should preserve formatting as much as possible", () => {
      const source = `interface Functor<F<_>> {\n  map: <A>(fa: F<A>) => void;\n}`;
      const { code } = preprocess(source, { extensions: ["hkt"] });
      expect(code).toContain("\n");
    });
  });

  describe("whitespace handling", () => {
    it("should handle whitespace in HKT usage F < A >", () => {
      const source = `interface Functor<F<_>> { map: (fa: F < A >) => void; }`;
      const { code, changed } = preprocess(source, { extensions: ["hkt"] });
      expect(changed).toBe(true);
      // Whitespace is preserved in the output since we use token-based slicing
      expect(code).toContain("$<F,");
      expect(code).toContain("A >");
    });

    it("should handle newlines in HKT usage", () => {
      const source = `interface Functor<F<_>> {
  map: (fa: F<
    A
  >) => void;
}`;
      const { code, changed } = preprocess(source, { extensions: ["hkt"] });
      expect(changed).toBe(true);
      expect(code).toContain("$<F,");
    });

    it("should handle whitespace around declaration F < _ >", () => {
      const source = `interface Functor< F < _ > > {}`;
      const { code, changed } = preprocess(source, { extensions: ["hkt"] });
      expect(changed).toBe(true);
      expect(code).toContain("Functor<");
      expect(code).toContain("F");
      expect(code).not.toContain("<_>");
    });
  });

  describe("braceless arrow functions", () => {
    it("should handle HKT in braceless arrow function return type", () => {
      const source = `type Lift<F<_>> = <A, B>(f: (a: A) => B) => (fa: F<A>) => F<B>;`;
      const { code, changed } = preprocess(source, { extensions: ["hkt"] });
      expect(changed).toBe(true);
      expect(code).toContain("Lift<F>");
      expect(code).toContain("$<F, A>");
      expect(code).toContain("$<F, B>");
    });

    it("should not leak HKT params outside braceless scope", () => {
      const source = `type Foo<F<_>> = (fa: F<A>) => F<B>;
type Bar<G> = G<A>;`;
      const { code } = preprocess(source, { extensions: ["hkt"] });
      // F should be rewritten in Foo's scope
      expect(code).toContain("$<F, A>");
      expect(code).toContain("$<F, B>");
      // G should NOT be rewritten (no <_> declaration)
      expect(code).toContain("G<A>");
    });

    it("should handle semicolon-terminated type aliases", () => {
      const source = `type Map<F<_>> = <A, B>(fa: F<A>, f: (a: A) => B) => F<B>; const x = 1;`;
      const { code } = preprocess(source, { extensions: ["hkt"] });
      expect(code).toContain("$<F, A>");
      expect(code).toContain("$<F, B>");
      expect(code).toContain("const x = 1");
    });
  });
});
