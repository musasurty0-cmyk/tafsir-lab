/**
 * Edexcel A level Mathematics (9MA0), broken into the parts a lesson actually
 * covers: "Differentiation from first principles", "Chain rule". Grouped by
 * the course's chapters, the same ones the tests and the question booklets
 * use (lib/dunya/spec-points.ts), Year 1 (the AS content) and then Year 2.
 *
 * The ids are stored against the tracker (DunyaPlan.spec.topics), so never
 * rename one; add new parts with new ids, and retire old ones by removing them
 * (their stored marks are then simply ignored). Moving one to another chapter
 * is free: marks are kept by part, not by chapter.
 */

import { SPEC_AREAS } from "./spec-points";

export type Year = 1 | 2;
export interface SpecTopic { id: string; name: string }
/** One chapter: "Year 1 Pure 12, Differentiation". */
export interface SpecSection { id: string; year: Year; area: string; n: string; name: string; topics: SpecTopic[] }

const t = (id: string, name: string): SpecTopic => ({ id, name });

/** The parts of each chapter, by the chapter's id. */
const PARTS: Record<string, SpecTopic[]> = {
  // ── Year 1, Pure ──
  "y1-pure-1": [
    t("alg-indices", "Laws of indices"),
    t("alg-polynomials", "Expanding and factorising polynomials"),
    t("alg-surds", "Surds and rationalising the denominator"),
  ],
  "y1-pure-2": [
    t("alg-quadratics", "Quadratics: factorising, completing the square, the formula"),
    t("alg-quad-graphs", "Quadratic graphs and their turning points"),
    t("alg-discriminant", "The discriminant"),
  ],
  "y1-pure-3": [
    t("alg-simultaneous", "Simultaneous equations, one linear and one quadratic"),
    t("alg-inequalities", "Linear and quadratic inequalities, graphically and in set notation"),
  ],
  "y1-pure-4": [
    t("alg-curve-sketching", "Sketching cubics, quartics and reciprocal graphs"),
    t("alg-proportion", "Direct and inverse proportion"),
    t("alg-transformations", "Graph transformations: f(x) + a, f(x + a), af(x), f(ax)"),
  ],
  "y1-pure-5": [
    t("coord-lines", "Straight lines: y − y₁ = m(x − x₁) and ax + by + c = 0"),
    t("coord-parallel", "Parallel and perpendicular lines, and modelling with lines"),
  ],
  "y1-pure-6": [
    t("coord-circle-equation", "Equation of a circle, by completing the square"),
    t("coord-circle-properties", "Circle properties: tangents, chords, angle in a semicircle"),
  ],
  "y1-pure-7": [
    t("alg-factor-theorem", "Algebraic division and the factor theorem"),
    t("proof-deduction", "Proof by deduction, exhaustion and counter-example"),
  ],
  "y1-pure-8": [
    t("seq-binomial-integer", "Binomial expansion for a positive whole number n, and nCr"),
  ],
  "y1-pure-9": [
    t("trig-rules", "Sine rule, cosine rule and area = ½ab sin C"),
    t("trig-graphs", "Graphs of sin, cos and tan, exact values and symmetry"),
  ],
  "y1-pure-10": [
    t("trig-basic-identities", "tan θ = sin θ / cos θ and sin²θ + cos²θ = 1"),
    t("trig-equations", "Solving trigonometric equations in a given interval"),
  ],
  "y1-pure-11": [
    t("vec-2d", "Vectors in 2D: magnitude, direction, i and j"),
    t("vec-arithmetic", "Adding and scaling vectors, position vectors, distance between points"),
    t("vec-problems", "Vectors in geometry problems and in context"),
  ],
  "y1-pure-12": [
    t("diff-gradient", "The derivative as a gradient and a rate of change"),
    t("diff-first-principles", "Differentiation from first principles"),
    t("diff-powers", "Differentiating xⁿ"),
    t("diff-tangents", "Tangents and normals"),
    t("diff-second", "The second derivative"),
    t("diff-stationary", "Stationary points, and increasing and decreasing functions"),
  ],
  "y1-pure-13": [
    t("int-powers", "Integration as the reverse of differentiation, integrating xⁿ"),
    t("int-definite", "Definite integrals and the area under a curve"),
  ],
  "y1-pure-14": [
    t("exp-graphs", "Graphs of y = aˣ and y = eˣ"),
    t("exp-gradient", "The gradient of e^kx, and exponential growth and decay"),
    t("exp-models", "Exponential models and their limitations"),
    t("exp-logs", "Logarithms, and ln x as the inverse of eˣ"),
    t("exp-log-laws", "Laws of logarithms"),
    t("exp-solving", "Solving equations of the form aˣ = b"),
    t("exp-log-graphs", "Using log graphs to find constants in y = axⁿ and y = kbˣ"),
  ],
  // ── Year 1, Mechanics ──
  "y1-mech-1": [
    t("units-si", "SI units and derived units"),
    t("kin-terms", "Displacement, velocity, acceleration, distance and speed"),
  ],
  "y1-mech-2": [
    t("kin-graphs", "Displacement–time and velocity–time graphs"),
    t("kin-suvat", "suvat for constant acceleration, including vertical motion"),
  ],
  "y1-mech-3": [
    t("force-first-law", "Newton’s first law, force diagrams and equilibrium"),
    t("force-second-law", "Newton’s second law, F = ma, and weight"),
    t("force-connected", "Newton’s third law, connected particles and pulleys"),
  ],
  "y1-mech-4": [
    t("kin-calculus", "Variable acceleration using calculus"),
  ],
  // ── Year 1, Statistics ──
  "y1-stats-1": [
    t("samp-methods", "Populations, samples and the sampling methods"),
    t("samp-critique", "Choosing and critiquing a sampling method, and the large data set"),
  ],
  "y1-stats-2": [
    t("data-measures", "Averages and spread: standard deviation and coding"),
  ],
  "y1-stats-3": [
    t("data-outliers", "Outliers and cleaning data"),
    t("data-diagrams", "Histograms, box plots, cumulative frequency and frequency polygons"),
  ],
  "y1-stats-4": [
    t("data-scatter", "Scatter diagrams, regression lines, and correlation versus causation"),
  ],
  "y1-stats-5": [
    t("prob-events", "Mutually exclusive and independent events, Venn and tree diagrams"),
  ],
  "y1-stats-6": [
    t("dist-discrete", "Discrete random variables and their distributions"),
    t("dist-binomial", "The binomial distribution"),
  ],
  "y1-stats-7": [
    t("hyp-language", "The language: hypotheses, significance level, critical region, p-value"),
    t("hyp-binomial", "Binomial tests, one-tailed and two-tailed"),
  ],
  // ── Year 2, Pure ──
  "y2-pure-1": [
    t("proof-contradiction", "Proof by contradiction (√2 is irrational, infinitely many primes)"),
    t("alg-partial-fractions", "Partial fractions"),
  ],
  "y2-pure-2": [
    t("alg-modulus", "The modulus function and its graphs"),
    t("alg-functions", "Functions: domain, range, composite and inverse functions"),
    t("alg-combined-transformations", "Combinations of graph transformations"),
    t("alg-modelling", "Modelling with functions"),
  ],
  "y2-pure-3": [
    t("seq-arithmetic", "Arithmetic sequences and series"),
    t("seq-geometric", "Geometric sequences and series, and the sum to infinity"),
    t("seq-sigma", "Sigma notation"),
    t("seq-sequences", "Sequences: nth term, recurrence, increasing, decreasing, periodic"),
    t("seq-modelling", "Sequences and series in modelling"),
  ],
  "y2-pure-4": [
    t("seq-binomial-rational", "Binomial expansion for any rational n, and when it is valid"),
  ],
  "y2-pure-5": [
    t("trig-radians", "Radians, arc length and sector area"),
    t("trig-small-angles", "Small angle approximations"),
  ],
  "y2-pure-6": [
    t("trig-reciprocal", "sec, cosec and cot, and arcsin, arccos and arctan, with their graphs"),
    t("trig-pythagorean", "sec²θ = 1 + tan²θ and cosec²θ = 1 + cot²θ"),
  ],
  "y2-pure-7": [
    t("trig-addition", "Addition and double angle formulae"),
    t("trig-harmonic", "R cos(θ ± α) and R sin(θ ± α)"),
    t("trig-proofs", "Proving identities and solving harder equations"),
    t("trig-context", "Trigonometry in context: vectors, kinematics and forces"),
  ],
  "y2-pure-8": [
    t("coord-parametric", "Parametric equations and converting to Cartesian form"),
    t("coord-parametric-modelling", "Parametric equations in modelling"),
  ],
  "y2-pure-9": [
    t("diff-first-principles-trig", "First principles for sin x and cos x"),
    t("diff-standard", "Differentiating eˣ, aˣ, ln x, sin x, cos x and tan x"),
    t("diff-chain", "Chain rule"),
    t("diff-product", "Product rule"),
    t("diff-quotient", "Quotient rule"),
    t("diff-parametric", "Parametric differentiation"),
    t("diff-implicit", "Implicit differentiation"),
    t("diff-concavity", "Concave and convex curves, and points of inflection"),
    t("diff-inverse", "dy/dx = 1 / (dx/dy), and connected rates of change"),
    t("diff-equations", "Setting up differential equations"),
  ],
  "y2-pure-10": [
    t("num-change-sign", "Locating roots by a change of sign"),
    t("num-iteration", "Iteration, with cobweb and staircase diagrams"),
    t("num-newton", "Newton–Raphson"),
    t("num-context", "Numerical methods in context"),
  ],
  "y2-pure-11": [
    t("int-standard", "Integrating eˣ, 1/x, sin x and cos x"),
    t("int-substitution", "Integration by substitution"),
    t("int-parts", "Integration by parts"),
    t("int-partial-fractions", "Integration with partial fractions"),
    t("int-between-curves", "Area between two curves"),
    t("int-limit-sum", "Integration as the limit of a sum"),
    t("num-trapezium", "The trapezium rule"),
    t("int-separable", "Separable differential equations: general and particular solutions"),
    t("int-de-context", "Interpreting differential equation solutions in context"),
  ],
  "y2-pure-12": [
    t("vec-3d", "Vectors in 3D"),
  ],
  // ── Year 2, Mechanics ──
  "y2-mech-4": [
    t("mom-moments", "Moments, and rigid bodies in equilibrium"),
  ],
  "y2-mech-5": [
    t("force-resolving", "Resolving forces, and inclined planes"),
    t("force-friction", "Friction, F ≤ μR"),
  ],
  "y2-mech-6": [
    t("kin-projectiles", "Projectiles"),
  ],
  "y2-mech-7": [
    t("mom-ladders", "Ladders, and bodies on the point of tipping"),
  ],
  "y2-mech-8": [
    t("kin-vectors", "Motion in 2D with vectors"),
  ],
  // ── Year 2, Statistics ──
  "y2-stats-1": [
    t("data-exp-models", "Exponential models in bivariate data (changing the variable)"),
    t("hyp-correlation", "Testing for zero correlation (PMCC)"),
  ],
  "y2-stats-2": [
    t("prob-conditional", "Conditional probability, with set notation"),
    t("prob-modelling", "Modelling with probability and critiquing assumptions"),
  ],
  "y2-stats-3": [
    t("dist-normal", "The normal distribution, including the inverse normal"),
    t("dist-choosing", "Choosing a distribution, and the normal approximation to the binomial"),
    t("hyp-normal-mean", "Testing the mean of a normal distribution"),
  ],
};

export const MATHS_SPEC: SpecSection[] = SPEC_AREAS
  .filter((a) => a.id === "y1" || a.id === "y2")
  .flatMap((a) => a.parts.flatMap((p) => p.topics.flatMap((x) => x.points.map((c): SpecSection => ({
    id: c.id, year: a.id === "y1" ? 1 : 2, area: p.name, n: c.n, name: c.label, topics: PARTS[c.id] ?? [],
  })))));

export const SPEC_IDS = new Set(MATHS_SPEC.flatMap((s) => s.topics.map((x) => x.id)));

// ── What is marked against each part ──────────────────────────────────────────

export type Light = "red" | "amber" | "green";
/** Lesson: red not yet, amber in lessons now, green covered. Questions: red or green. */
export interface TopicMark { lesson?: Light; questions?: "red" | "green"; confidence?: Light | null }
/** A question booklet: done or not, and how confident it felt. */
export interface BookletMark { done?: boolean; confidence?: Light | null }
export interface SpecState { tutor: string; topics: Record<string, TopicMark>; booklets: Record<string, BookletMark> }

export const SPEC_FIELDS = {
  lesson:     ["red", "amber", "green"],
  questions:  ["red", "green"],
  confidence: ["red", "amber", "green"],
} as const;
export type SpecField = keyof typeof SPEC_FIELDS;

export function asSpec(raw: unknown): SpecState {
  const s = raw as Partial<SpecState> | null;
  return {
    tutor: typeof s?.tutor === "string" && s.tutor.trim() ? s.tutor.trim() : "Tutor",
    topics: s?.topics && typeof s.topics === "object" ? s.topics : {},
    booklets: s?.booklets && typeof s.booklets === "object" ? s.booklets : {},
  };
}
