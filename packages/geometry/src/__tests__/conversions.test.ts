import { describe, expect, it } from "vitest";
import {
  point2d,
  point3d,
  vec2,
  cartesianToPolar,
  polarToCartesian,
  cartesianToSpherical,
  sphericalToCartesian,
  cartesianToCylindrical,
  cylindricalToCartesian,
  vecCartesianToPolar,
  vecPolarToCartesian,
} from "../index.js";

const EPSILON = 5;

describe("cartesian <-> polar", () => {
  it("converts (1, 0) to (1, 0)", () => {
    const p = cartesianToPolar(point2d(1, 0));
    expect(p[0]).toBeCloseTo(1, EPSILON);
    expect(p[1]).toBeCloseTo(0, EPSILON);
  });

  it("converts (0, 1) to (1, pi/2)", () => {
    const p = cartesianToPolar(point2d(0, 1));
    expect(p[0]).toBeCloseTo(1, EPSILON);
    expect(p[1]).toBeCloseTo(Math.PI / 2, EPSILON);
  });

  it("converts (-1, 0) to (1, pi)", () => {
    const p = cartesianToPolar(point2d(-1, 0));
    expect(p[0]).toBeCloseTo(1, EPSILON);
    expect(p[1]).toBeCloseTo(Math.PI, EPSILON);
  });

  it("round-trips cartesian -> polar -> cartesian", () => {
    const original = point2d(3, 4);
    const result = polarToCartesian(cartesianToPolar(original));
    expect(result[0]).toBeCloseTo(original[0], EPSILON);
    expect(result[1]).toBeCloseTo(original[1], EPSILON);
  });

  it("round-trips polar -> cartesian -> polar", () => {
    const original = cartesianToPolar(point2d(5, 12));
    const result = cartesianToPolar(polarToCartesian(original));
    expect(result[0]).toBeCloseTo(original[0], EPSILON);
    expect(result[1]).toBeCloseTo(original[1], EPSILON);
  });

  it("handles origin", () => {
    const p = cartesianToPolar(point2d(0, 0));
    expect(p[0]).toBeCloseTo(0, EPSILON);
  });
});

describe("cartesian <-> spherical", () => {
  it("converts point on +z axis", () => {
    const s = cartesianToSpherical(point3d(0, 0, 5));
    expect(s[0]).toBeCloseTo(5, EPSILON);
    expect(s[1]).toBeCloseTo(0, EPSILON);
  });

  it("converts point on +x axis", () => {
    const s = cartesianToSpherical(point3d(3, 0, 0));
    expect(s[0]).toBeCloseTo(3, EPSILON);
    expect(s[1]).toBeCloseTo(Math.PI / 2, EPSILON);
    expect(s[2]).toBeCloseTo(0, EPSILON);
  });

  it("converts point on +y axis", () => {
    const s = cartesianToSpherical(point3d(0, 4, 0));
    expect(s[0]).toBeCloseTo(4, EPSILON);
    expect(s[1]).toBeCloseTo(Math.PI / 2, EPSILON);
    expect(s[2]).toBeCloseTo(Math.PI / 2, EPSILON);
  });

  it("round-trips cartesian -> spherical -> cartesian", () => {
    const original = point3d(1, 2, 3);
    const result = sphericalToCartesian(cartesianToSpherical(original));
    expect(result[0]).toBeCloseTo(original[0], EPSILON);
    expect(result[1]).toBeCloseTo(original[1], EPSILON);
    expect(result[2]).toBeCloseTo(original[2], EPSILON);
  });

  it("handles origin", () => {
    const s = cartesianToSpherical(point3d(0, 0, 0));
    expect(s[0]).toBeCloseTo(0, EPSILON);
  });
});

describe("cartesian <-> cylindrical", () => {
  it("converts point on +x axis", () => {
    const c = cartesianToCylindrical(point3d(5, 0, 7));
    expect(c[0]).toBeCloseTo(5, EPSILON);
    expect(c[1]).toBeCloseTo(0, EPSILON);
    expect(c[2]).toBeCloseTo(7, EPSILON);
  });

  it("converts point on +y axis", () => {
    const c = cartesianToCylindrical(point3d(0, 3, 2));
    expect(c[0]).toBeCloseTo(3, EPSILON);
    expect(c[1]).toBeCloseTo(Math.PI / 2, EPSILON);
    expect(c[2]).toBeCloseTo(2, EPSILON);
  });

  it("round-trips cartesian -> cylindrical -> cartesian", () => {
    const original = point3d(2, 3, 4);
    const result = cylindricalToCartesian(cartesianToCylindrical(original));
    expect(result[0]).toBeCloseTo(original[0], EPSILON);
    expect(result[1]).toBeCloseTo(original[1], EPSILON);
    expect(result[2]).toBeCloseTo(original[2], EPSILON);
  });

  it("preserves z component", () => {
    const c = cartesianToCylindrical(point3d(1, 1, 42));
    expect(c[2]).toBeCloseTo(42, EPSILON);
    const back = cylindricalToCartesian(c);
    expect(back[2]).toBeCloseTo(42, EPSILON);
  });
});

describe("vector conversions", () => {
  it("round-trips vec cartesian -> polar -> cartesian", () => {
    const original = vec2(3, 4);
    const result = vecPolarToCartesian(vecCartesianToPolar(original));
    expect(result[0]).toBeCloseTo(original[0], EPSILON);
    expect(result[1]).toBeCloseTo(original[1], EPSILON);
  });
});
