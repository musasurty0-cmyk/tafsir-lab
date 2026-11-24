/**
 * Where question booklets are filed. Years 1 and 2 of A level Maths go by the
 * chapters of the course (Pearson's Edexcel textbooks, and the same chapters
 * the tests under Papers use), so a Year 1 chapter holds only Year 1 work.
 * Further Maths goes by 9FM0's numbered points (Issue 4), only the ones a
 * booklet is filed under, and after it come topics neither course has.
 *
 * Mechanics in Year 1 counts its own chapters from 1, as the tests do.
 * Catalogued booklets hold these ids, so renaming one means running
 * scripts/dunya-booklets.mts again (marks are kept by booklet, not by point).
 */

export interface SpecPoint { id: string; n: string; label: string }
export interface PointTopic { n: string; name: string; points: SpecPoint[] }
export interface SpecPart { id: string; name: string; short: string; topics: PointTopic[] }
/** One of the buttons above the list. */
export interface SpecArea { id: string; name: string; note: string; parts: SpecPart[] }

type Row = [n: string, label: string];
const part = (id: string, name: string, short: string, topics: [n: string, name: string, rows: Row[]][]): SpecPart => ({
  id, name, short,
  topics: topics.map(([n, topic, rows]) => ({ n, name: topic, points: rows.map(([pn, label]) => ({ id: `${id}-${pn}`, n: pn, label })) })),
});
/** A part that is simply a list of chapters, with no topics between. */
const chapters = (id: string, name: string, list: string[], from = 1): SpecPart =>
  part(id, name, name, [["", "", list.map((label, i): Row => [String(i + from), label])]]);

export const SPEC_AREAS: SpecArea[] = [
  {
    id: "y1", name: "Year 1", note: "",
    parts: [
      chapters("y1-pure", "Pure", [
        "Algebraic expressions",
        "Quadratics",
        "Equations and inequalities",
        "Graphs and transformations",
        "Straight line graphs",
        "Circles",
        "Algebraic methods",
        "The binomial expansion",
        "Trigonometric ratios",
        "Trigonometric identities and equations",
        "Vectors",
        "Differentiation",
        "Integration",
        "Exponentials and logarithms",
      ]),
      chapters("y1-mech", "Mechanics", [
        "Modelling in mechanics",
        "Constant acceleration",
        "Forces and motion",
        "Variable acceleration",
      ]),
      chapters("y1-stats", "Statistics", [
        "Data collection",
        "Measures of location and spread",
        "Representations of data",
        "Correlation",
        "Probability",
        "Statistical distributions",
        "Hypothesis testing",
      ]),
    ],
  },
  {
    id: "y2", name: "Year 2", note: "",
    parts: [
      chapters("y2-pure", "Pure", [
        "Algebraic methods",
        "Functions and graphs",
        "Sequences and series",
        "Binomial expansion",
        "Radians",
        "Trigonometric functions",
        "Trigonometry and modelling",
        "Parametric equations",
        "Differentiation",
        "Numerical methods",
        "Integration",
        "Vectors",
      ]),
      chapters("y2-mech", "Mechanics", [
        "Moments",
        "Forces and friction",
        "Projectiles",
        "Applications of forces",
        "Further kinematics",
      ], 4),
      chapters("y2-stats", "Statistics", [
        "Regression, correlation and hypothesis testing",
        "Conditional probability",
        "The normal distribution",
      ]),
    ],
  },
  {
    id: "further", name: "Further Maths", note: "9FM0, and topics beyond it",
    parts: [
      part("cp", "Core Pure", "Core Pure", [
        ["1", "Proof", [["1.1", "Proof by induction"]]],
        ["2", "Complex numbers", [
          ["2.2", "Arithmetic with complex numbers"],
          ["2.3", "Conjugates and roots of polynomials"],
          ["2.5", "Modulus-argument form"],
          ["2.7", "Loci in the Argand diagram"],
          ["2.8", "De Moivre’s theorem"],
          ["2.10", "nth roots"],
        ]],
        ["3", "Matrices", [
          ["3.1", "Adding and multiplying matrices"],
          ["3.3", "Linear transformations"],
          ["3.5", "Determinants"],
          ["3.6", "Inverse matrices"],
          ["3.7", "Solving three equations with an inverse"],
          ["3.8", "When three equations fail to solve"],
        ]],
        ["4", "Further algebra and functions", [
          ["4.1", "Roots and coefficients"],
          ["4.2", "Transforming the roots"],
          ["4.3", "Sums of integers, squares and cubes"],
          ["4.4", "Method of differences"],
          ["4.5", "Maclaurin series"],
        ]],
        ["5", "Further calculus", [
          ["5.1", "Volumes of revolution"],
          ["5.2", "Improper integrals"],
          ["5.4", "Partial fractions with quadratic factors"],
          ["5.5", "Differentiating inverse trigonometric functions"],
          ["5.6", "Trigonometric substitutions"],
        ]],
        ["6", "Further vectors", [
          ["6.1", "Lines in three dimensions"],
          ["6.2", "Planes"],
          ["6.3", "The scalar product and angles"],
          ["6.5", "Intersections and shortest distances"],
        ]],
        ["7", "Polar coordinates", [
          ["7.1", "Polar and Cartesian coordinates"],
          ["7.2", "Polar curves"],
          ["7.3", "Area of a polar curve"],
        ]],
        ["8", "Hyperbolic functions", [
          ["8.1", "Sinh, cosh and tanh"],
          ["8.2", "Their calculus"],
          ["8.3", "Inverse hyperbolic functions"],
          ["8.5", "Hyperbolic substitutions"],
        ]],
        ["9", "Differential equations", [
          ["9.1", "Integrating factors"],
          ["9.4", "Second order, homogeneous"],
          ["9.5", "Second order, non-homogeneous"],
          ["9.7", "Simple harmonic motion"],
        ]],
      ]),
      part("fp1", "Further Pure 1", "FP1", [
        ["2", "Further calculus", [["2.1", "Taylor series"]]],
        ["3", "Further differential equations", [["3.2", "Equations reducible by a substitution"]]],
        ["4", "Coordinate systems", [
          ["4.1", "Parabola, ellipse and hyperbola"],
          ["4.3", "Tangents and normals to conics"],
          ["4.4", "Loci"],
        ]],
        ["5", "Further vectors", [
          ["5.1", "The vector product"],
          ["5.3", "Lines and planes with the vector product"],
        ]],
        ["6", "Further numerical methods", [
          ["6.1", "Numerical solution of differential equations"],
          ["6.2", "Simpson’s rule"],
        ]],
        ["7", "Inequalities", [["7.1", "Algebraic and modulus inequalities"]]],
      ]),
      part("fp2", "Further Pure 2", "FP2", [
        ["2", "Further calculus", [
          ["2.1", "Reduction formulae"],
          ["2.2", "Arc length and surface area"],
        ]],
        ["3", "Further matrix algebra", [
          ["3.1", "Eigenvalues and eigenvectors"],
          ["3.2", "Diagonal form"],
        ]],
        ["4", "Further complex numbers", [
          ["4.1", "Further loci and regions"],
          ["4.2", "Transformations of the z-plane"],
        ]],
        ["5", "Number theory", [
          ["5.1", "Division and the Euclidean algorithm"],
          ["5.7", "Permutations and combinations"],
        ]],
      ]),
      part("fs1", "Further Statistics 1", "FS1", [
        ["1", "Discrete distributions", [["1.1", "Mean and variance of a discrete distribution"]]],
        ["2", "Poisson and binomial", [
          ["2.1", "The Poisson distribution"],
          ["2.3", "Poisson as an approximation"],
        ]],
        ["3", "Geometric and negative binomial", [["3.1", "Geometric and negative binomial"]]],
        ["4", "Hypothesis testing", [["4.1", "Testing a Poisson mean"]]],
        ["6", "Chi squared tests", [["6.1", "Goodness of fit and contingency tables"]]],
      ]),
      part("fs2", "Further Statistics 2", "FS2", [
        ["1", "Linear regression", [["1.2", "Residuals"]]],
        ["2", "Continuous distributions", [
          ["2.1", "Continuous random variables"],
          ["2.2", "Density and cumulative functions"],
          ["2.3", "Mean and variance"],
          ["2.4", "The rectangular distribution"],
        ]],
        ["3", "Correlation", [
          ["3.2", "Spearman’s rank"],
          ["3.3", "Testing for zero correlation"],
        ]],
        ["4", "Combinations of random variables", [["4.1", "Combining Normal variables"]]],
        ["5", "Estimation and intervals", [
          ["5.1", "Estimators and sampling"],
          ["5.2", "Confidence intervals"],
          ["5.4", "Difference between two Normal means"],
        ]],
        ["7", "The t-distribution", [
          ["7.1", "Mean of a Normal with unknown variance"],
          ["7.2", "Paired t-test"],
        ]],
      ]),
      part("fm1", "Further Mechanics 1", "FM1", [
        ["1", "Momentum and impulse", [
          ["1.1", "Momentum and impulse"],
          ["1.2", "Momentum as a vector"],
        ]],
        ["2", "Work, energy and power", [["2.1", "Work, energy and power"]]],
        ["3", "Elastic strings and springs", [
          ["3.1", "Hooke’s law"],
          ["3.2", "Elastic energy"],
        ]],
        ["4", "Collisions in one dimension", [
          ["4.1", "Direct impact and restitution"],
          ["4.2", "Successive impacts"],
        ]],
        ["5", "Collisions in two dimensions", [["5.1", "Oblique impact"]]],
      ]),
      part("fm2", "Further Mechanics 2", "FM2", [
        ["1", "Motion in a circle", [
          ["1.1", "Horizontal circles"],
          ["1.2", "Vertical circles"],
        ]],
        ["2", "Centres of mass of plane figures", [
          ["2.1", "Discrete masses"],
          ["2.2", "Laminas and frameworks"],
        ]],
        ["3", "Further centres of mass", [
          ["3.1", "Rigid and composite bodies"],
          ["3.2", "Equilibrium of rigid bodies"],
        ]],
        ["4", "Further dynamics", [
          ["4.1", "Variable forces"],
          ["4.2", "Simple harmonic motion"],
        ]],
        ["5", "Further kinematics", [["5.1", "Variable acceleration"]]],
      ]),
      // Not numbered by Edexcel: n is empty, so no number is shown.
      {
        id: "beyond", name: "Beyond the specification", short: "Beyond the specification",
        topics: [{
          n: "", name: "Not in Edexcel Maths or Further Maths",
          points: [
            { id: "beyond-pure", n: "", label: "Pure" },
            { id: "beyond-stats", n: "", label: "Statistics" },
            { id: "beyond-statics", n: "", label: "Statics and frameworks" },
            { id: "beyond-motion", n: "", label: "Projectiles, pendulums and relative motion" },
            { id: "beyond-rotation", n: "", label: "Rotation and moments of inertia" },
            { id: "beyond-dynamics", n: "", label: "Advanced dynamics" },
          ],
        }],
      },
    ],
  },
];

const PLACE = new Map(SPEC_AREAS.flatMap((area) => area.parts.flatMap((p) =>
  p.topics.flatMap((t) => t.points.map((point) => [point.id, { area, part: p, point }] as const)))));

const PART_AREA = new Map(SPEC_AREAS.flatMap((a) => a.parts.map((x) => [x.id, a.id] as const)));

/** Where a point sits: its area, its part and itself. */
export const placeOf = (id: string) => PLACE.get(id);

/** How a point is named on a booklet: "chapter 4", "Year 2 Pure chapter 12", "Core Pure 6.1". */
export function pointName(id: string, fromPart: string): string {
  const p = PLACE.get(id);
  if (!p) return id;
  if (!p.point.n) return p.part.name.toLowerCase();
  if (p.area.id === "further") return p.part.id === fromPart ? p.point.n : `${p.part.short} ${p.point.n}`;
  if (p.part.id === fromPart) return `chapter ${p.point.n}`;
  const sameYear = PART_AREA.get(fromPart) === p.area.id;
  return `${sameYear ? "" : `${p.area.name} `}${p.part.name} chapter ${p.point.n}`;
}
