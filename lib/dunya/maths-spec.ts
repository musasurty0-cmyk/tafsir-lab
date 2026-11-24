/**
 * Edexcel A level Mathematics (9MA0), broken into the parts a lesson actually
 * covers: "Differentiation from first principles", "Chain rule". Grouped by
 * the specification's own sections, each part marked Year 1 (the AS content)
 * or Year 2 (A level only).
 *
 * The ids are stored against the tracker (DunyaPlan.spec.topics), so never
 * rename one; add new parts with new ids, and retire old ones by removing them
 * (their stored marks are then simply ignored).
 */

export type Year = 1 | 2;
export interface SpecTopic { id: string; name: string; year: Year }
export interface SpecSection { id: string; area: "Pure" | "Statistics" | "Mechanics"; name: string; topics: SpecTopic[] }

const t = (id: string, name: string, year: Year): SpecTopic => ({ id, name, year });

export const MATHS_SPEC: SpecSection[] = [
  // ── Pure ──────────────────────────────────────────────────────────────────
  { id: "proof", area: "Pure", name: "Proof", topics: [
    t("proof-deduction", "Proof by deduction, exhaustion and counter-example", 1),
    t("proof-contradiction", "Proof by contradiction (√2 is irrational, infinitely many primes)", 2),
  ] },
  { id: "algebra", area: "Pure", name: "Algebra and functions", topics: [
    t("alg-indices", "Laws of indices", 1),
    t("alg-surds", "Surds and rationalising the denominator", 1),
    t("alg-quadratics", "Quadratics: factorising, completing the square, the formula", 1),
    t("alg-discriminant", "The discriminant", 1),
    t("alg-quad-graphs", "Quadratic graphs and their turning points", 1),
    t("alg-simultaneous", "Simultaneous equations, one linear and one quadratic", 1),
    t("alg-inequalities", "Linear and quadratic inequalities, graphically and in set notation", 1),
    t("alg-polynomials", "Expanding and factorising polynomials", 1),
    t("alg-factor-theorem", "Algebraic division and the factor theorem", 1),
    t("alg-curve-sketching", "Sketching cubics, quartics and reciprocal graphs", 1),
    t("alg-proportion", "Direct and inverse proportion", 1),
    t("alg-transformations", "Graph transformations: f(x) + a, f(x + a), af(x), f(ax)", 1),
    t("alg-partial-fractions", "Partial fractions", 2),
    t("alg-modulus", "The modulus function and its graphs", 2),
    t("alg-functions", "Functions: domain, range, composite and inverse functions", 2),
    t("alg-combined-transformations", "Combinations of graph transformations", 2),
    t("alg-modelling", "Modelling with functions", 2),
  ] },
  { id: "coordinate", area: "Pure", name: "Coordinate geometry", topics: [
    t("coord-lines", "Straight lines: y − y₁ = m(x − x₁) and ax + by + c = 0", 1),
    t("coord-parallel", "Parallel and perpendicular lines, and modelling with lines", 1),
    t("coord-circle-equation", "Equation of a circle, by completing the square", 1),
    t("coord-circle-properties", "Circle properties: tangents, chords, angle in a semicircle", 1),
    t("coord-parametric", "Parametric equations and converting to Cartesian form", 2),
    t("coord-parametric-modelling", "Parametric equations in modelling", 2),
  ] },
  { id: "sequences", area: "Pure", name: "Sequences and series", topics: [
    t("seq-binomial-integer", "Binomial expansion for a positive whole number n, and nCr", 1),
    t("seq-binomial-rational", "Binomial expansion for any rational n, and when it is valid", 2),
    t("seq-sequences", "Sequences: nth term, recurrence, increasing, decreasing, periodic", 2),
    t("seq-sigma", "Sigma notation", 2),
    t("seq-arithmetic", "Arithmetic sequences and series", 2),
    t("seq-geometric", "Geometric sequences and series, and the sum to infinity", 2),
    t("seq-modelling", "Sequences and series in modelling", 2),
  ] },
  { id: "trig", area: "Pure", name: "Trigonometry", topics: [
    t("trig-rules", "Sine rule, cosine rule and area = ½ab sin C", 1),
    t("trig-graphs", "Graphs of sin, cos and tan, exact values and symmetry", 1),
    t("trig-basic-identities", "tan θ = sin θ / cos θ and sin²θ + cos²θ = 1", 1),
    t("trig-equations", "Solving trigonometric equations in a given interval", 1),
    t("trig-radians", "Radians, arc length and sector area", 2),
    t("trig-small-angles", "Small angle approximations", 2),
    t("trig-reciprocal", "sec, cosec and cot, and arcsin, arccos and arctan, with their graphs", 2),
    t("trig-pythagorean", "sec²θ = 1 + tan²θ and cosec²θ = 1 + cot²θ", 2),
    t("trig-addition", "Addition and double angle formulae", 2),
    t("trig-harmonic", "R cos(θ ± α) and R sin(θ ± α)", 2),
    t("trig-proofs", "Proving identities and solving harder equations", 2),
    t("trig-context", "Trigonometry in context: vectors, kinematics and forces", 2),
  ] },
  { id: "exponentials", area: "Pure", name: "Exponentials and logarithms", topics: [
    t("exp-graphs", "Graphs of y = aˣ and y = eˣ", 1),
    t("exp-gradient", "The gradient of e^kx, and exponential growth and decay", 1),
    t("exp-logs", "Logarithms, and ln x as the inverse of eˣ", 1),
    t("exp-log-laws", "Laws of logarithms", 1),
    t("exp-solving", "Solving equations of the form aˣ = b", 1),
    t("exp-log-graphs", "Using log graphs to find constants in y = axⁿ and y = kbˣ", 1),
    t("exp-models", "Exponential models and their limitations", 1),
  ] },
  { id: "differentiation", area: "Pure", name: "Differentiation", topics: [
    t("diff-gradient", "The derivative as a gradient and a rate of change", 1),
    t("diff-first-principles", "Differentiation from first principles", 1),
    t("diff-powers", "Differentiating xⁿ", 1),
    t("diff-second", "The second derivative", 1),
    t("diff-stationary", "Stationary points, and increasing and decreasing functions", 1),
    t("diff-tangents", "Tangents and normals", 1),
    t("diff-first-principles-trig", "First principles for sin x and cos x", 2),
    t("diff-standard", "Differentiating eˣ, aˣ, ln x, sin x, cos x and tan x", 2),
    t("diff-concavity", "Concave and convex curves, and points of inflection", 2),
    t("diff-chain", "Chain rule", 2),
    t("diff-product", "Product rule", 2),
    t("diff-quotient", "Quotient rule", 2),
    t("diff-inverse", "dy/dx = 1 / (dx/dy), and connected rates of change", 2),
    t("diff-parametric", "Parametric differentiation", 2),
    t("diff-implicit", "Implicit differentiation", 2),
    t("diff-equations", "Setting up differential equations", 2),
  ] },
  { id: "integration", area: "Pure", name: "Integration", topics: [
    t("int-powers", "Integration as the reverse of differentiation, integrating xⁿ", 1),
    t("int-definite", "Definite integrals and the area under a curve", 1),
    t("int-standard", "Integrating eˣ, 1/x, sin x and cos x", 2),
    t("int-between-curves", "Area between two curves", 2),
    t("int-limit-sum", "Integration as the limit of a sum", 2),
    t("int-substitution", "Integration by substitution", 2),
    t("int-parts", "Integration by parts", 2),
    t("int-partial-fractions", "Integration with partial fractions", 2),
    t("int-separable", "Separable differential equations: general and particular solutions", 2),
    t("int-de-context", "Interpreting differential equation solutions in context", 2),
  ] },
  { id: "numerical", area: "Pure", name: "Numerical methods", topics: [
    t("num-change-sign", "Locating roots by a change of sign", 2),
    t("num-iteration", "Iteration, with cobweb and staircase diagrams", 2),
    t("num-newton", "Newton–Raphson", 2),
    t("num-trapezium", "The trapezium rule", 2),
    t("num-context", "Numerical methods in context", 2),
  ] },
  { id: "vectors", area: "Pure", name: "Vectors", topics: [
    t("vec-2d", "Vectors in 2D: magnitude, direction, i and j", 1),
    t("vec-arithmetic", "Adding and scaling vectors, position vectors, distance between points", 1),
    t("vec-problems", "Vectors in geometry problems and in context", 1),
    t("vec-3d", "Vectors in 3D", 2),
  ] },

  // ── Statistics ────────────────────────────────────────────────────────────
  { id: "sampling", area: "Statistics", name: "Statistical sampling", topics: [
    t("samp-methods", "Populations, samples and the sampling methods", 1),
    t("samp-critique", "Choosing and critiquing a sampling method, and the large data set", 1),
  ] },
  { id: "data", area: "Statistics", name: "Data presentation and interpretation", topics: [
    t("data-diagrams", "Histograms, box plots, cumulative frequency and frequency polygons", 1),
    t("data-scatter", "Scatter diagrams, regression lines, and correlation versus causation", 1),
    t("data-measures", "Averages and spread: standard deviation and coding", 1),
    t("data-outliers", "Outliers and cleaning data", 1),
    t("data-exp-models", "Exponential models in bivariate data (changing the variable)", 2),
  ] },
  { id: "probability", area: "Statistics", name: "Probability", topics: [
    t("prob-events", "Mutually exclusive and independent events, Venn and tree diagrams", 1),
    t("prob-conditional", "Conditional probability, with set notation", 2),
    t("prob-modelling", "Modelling with probability and critiquing assumptions", 2),
  ] },
  { id: "distributions", area: "Statistics", name: "Statistical distributions", topics: [
    t("dist-discrete", "Discrete random variables and their distributions", 1),
    t("dist-binomial", "The binomial distribution", 1),
    t("dist-normal", "The normal distribution, including the inverse normal", 2),
    t("dist-choosing", "Choosing a distribution, and the normal approximation to the binomial", 2),
  ] },
  { id: "hypothesis", area: "Statistics", name: "Hypothesis testing", topics: [
    t("hyp-language", "The language: hypotheses, significance level, critical region, p-value", 1),
    t("hyp-binomial", "Binomial tests, one-tailed and two-tailed", 1),
    t("hyp-correlation", "Testing for zero correlation (PMCC)", 2),
    t("hyp-normal-mean", "Testing the mean of a normal distribution", 2),
  ] },

  // ── Mechanics ─────────────────────────────────────────────────────────────
  { id: "units", area: "Mechanics", name: "Quantities and units", topics: [
    t("units-si", "SI units and derived units", 1),
  ] },
  { id: "kinematics", area: "Mechanics", name: "Kinematics", topics: [
    t("kin-terms", "Displacement, velocity, acceleration, distance and speed", 1),
    t("kin-graphs", "Displacement–time and velocity–time graphs", 1),
    t("kin-suvat", "suvat for constant acceleration, including vertical motion", 1),
    t("kin-calculus", "Variable acceleration using calculus", 1),
    t("kin-vectors", "Motion in 2D with vectors", 2),
    t("kin-projectiles", "Projectiles", 2),
  ] },
  { id: "forces", area: "Mechanics", name: "Forces and Newton’s laws", topics: [
    t("force-first-law", "Newton’s first law, force diagrams and equilibrium", 1),
    t("force-second-law", "Newton’s second law, F = ma, and weight", 1),
    t("force-connected", "Newton’s third law, connected particles and pulleys", 1),
    t("force-resolving", "Resolving forces, and inclined planes", 2),
    t("force-friction", "Friction, F ≤ μR", 2),
  ] },
  { id: "moments", area: "Mechanics", name: "Moments", topics: [
    t("mom-moments", "Moments, and rigid bodies in equilibrium", 2),
    t("mom-ladders", "Ladders, and bodies on the point of tipping", 2),
  ] },
];

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
