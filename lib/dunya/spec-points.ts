/**
 * Edexcel's numbered specification points, in our own short words, for filing
 * question booklets under. A level Maths is 9MA0 (Issue 4) in full; Further
 * Maths is 9FM0 (Issue 4), only the points a booklet is filed under, and
 * after it a few headings for topics neither specification has.
 *
 * A point's id is its paper's prefix and its number, since the numbers repeat
 * between papers ("pure-4.1", "stats-4.1"). Catalogued booklets hold these
 * ids, so don't rename them.
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

export const SPEC_AREAS: SpecArea[] = [
  {
    id: "pure", name: "Pure", note: "9MA0, Papers 1 and 2",
    parts: [part("pure", "Pure", "Pure", [
      ["1", "Proof", [["1.1", "Deduction, exhaustion, counter-example and contradiction"]]],
      ["2", "Algebra and functions", [
        ["2.1", "Laws of indices"],
        ["2.2", "Surds and rationalising"],
        ["2.3", "Quadratics and the discriminant"],
        ["2.4", "Simultaneous equations"],
        ["2.5", "Inequalities"],
        ["2.6", "Polynomials, the factor theorem and algebraic fractions"],
        ["2.7", "Graphs of functions, modulus and proportion"],
        ["2.8", "Composite and inverse functions"],
        ["2.9", "Transformations of graphs"],
        ["2.10", "Partial fractions"],
        ["2.11", "Functions in modelling"],
      ]],
      ["3", "Coordinate geometry", [
        ["3.1", "Straight lines"],
        ["3.2", "Circles"],
        ["3.3", "Parametric equations"],
        ["3.4", "Parametric equations in modelling"],
      ]],
      ["4", "Sequences and series", [
        ["4.1", "Binomial expansion"],
        ["4.2", "Sequences and recurrence relations"],
        ["4.3", "Sigma notation"],
        ["4.4", "Arithmetic sequences and series"],
        ["4.5", "Geometric sequences and series"],
        ["4.6", "Sequences and series in modelling"],
      ]],
      ["5", "Trigonometry", [
        ["5.1", "Sine and cosine rules, radians, arcs and sectors"],
        ["5.2", "Small angle approximations"],
        ["5.3", "Trigonometric graphs and exact values"],
        ["5.4", "Sec, cosec, cot and the inverse functions"],
        ["5.5", "Pythagorean identities"],
        ["5.6", "Compound and double angles, and the R form"],
        ["5.7", "Trigonometric equations"],
        ["5.8", "Proving identities"],
        ["5.9", "Trigonometry in context"],
      ]],
      ["6", "Exponentials and logarithms", [
        ["6.1", "Exponential functions and their graphs"],
        ["6.2", "The gradient of an exponential"],
        ["6.3", "Logarithms as inverses, and ln x"],
        ["6.4", "Laws of logarithms"],
        ["6.5", "Solving exponential equations"],
        ["6.6", "Straight-line graphs from logarithms"],
        ["6.7", "Exponential growth and decay"],
      ]],
      ["7", "Differentiation", [
        ["7.1", "The derivative, first principles and second derivatives"],
        ["7.2", "Differentiating standard functions"],
        ["7.3", "Tangents, normals, stationary points and optimisation"],
        ["7.4", "Chain, product and quotient rules, connected rates"],
        ["7.5", "Implicit and parametric differentiation"],
        ["7.6", "Setting up differential equations"],
      ]],
      ["8", "Integration", [
        ["8.1", "The fundamental theorem of calculus"],
        ["8.2", "Integrating standard functions"],
        ["8.3", "Definite integrals and areas"],
        ["8.4", "Integration as the limit of a sum"],
        ["8.5", "Substitution and integration by parts"],
        ["8.6", "Integrating with partial fractions"],
        ["8.7", "Separable differential equations"],
        ["8.8", "Differential equations in context"],
      ]],
      ["9", "Numerical methods", [
        ["9.1", "Locating roots by a change of sign"],
        ["9.2", "Iteration, cobweb and staircase diagrams"],
        ["9.3", "Newton-Raphson"],
        ["9.4", "The trapezium rule"],
        ["9.5", "Numerical methods in context"],
      ]],
      ["10", "Vectors", [
        ["10.1", "Vectors in two and three dimensions"],
        ["10.2", "Magnitude and direction"],
        ["10.3", "Adding and scaling vectors"],
        ["10.4", "Position vectors and distance"],
        ["10.5", "Solving problems with vectors"],
      ]],
    ])],
  },
  {
    id: "stats", name: "Statistics", note: "9MA0, Paper 3",
    parts: [part("stats", "Statistics", "Statistics", [
      ["1", "Statistical sampling", [["1.1", "Populations and sampling methods"]]],
      ["2", "Presenting and interpreting data", [
        ["2.1", "Diagrams for single-variable data"],
        ["2.2", "Scatter diagrams, regression and correlation"],
        ["2.3", "Averages and spread"],
        ["2.4", "Outliers and cleaning data"],
      ]],
      ["3", "Probability", [
        ["3.1", "Mutually exclusive and independent events"],
        ["3.2", "Conditional probability"],
        ["3.3", "Modelling with probability"],
      ]],
      ["4", "Statistical distributions", [
        ["4.1", "Discrete distributions and the binomial"],
        ["4.2", "The Normal distribution"],
        ["4.3", "Choosing a distribution"],
      ]],
      ["5", "Hypothesis testing", [
        ["5.1", "The language of tests, and testing correlation"],
        ["5.2", "Testing a binomial proportion"],
        ["5.3", "Testing a Normal mean"],
      ]],
    ])],
  },
  {
    id: "mech", name: "Mechanics", note: "9MA0, Paper 3",
    parts: [part("mech", "Mechanics", "Mechanics", [
      ["6", "Quantities and units", [["6.1", "SI and derived units"]]],
      ["7", "Kinematics", [
        ["7.1", "The language of kinematics"],
        ["7.2", "Motion graphs"],
        ["7.3", "Constant acceleration, and in 2D with vectors"],
        ["7.4", "Calculus in kinematics"],
        ["7.5", "Projectiles"],
      ]],
      ["8", "Forces and Newton’s laws", [
        ["8.1", "Forces and Newton’s first law"],
        ["8.2", "Newton’s second law"],
        ["8.3", "Weight and motion under gravity"],
        ["8.4", "Newton’s third law, equilibrium and connected particles"],
        ["8.5", "Adding forces and motion in a plane"],
        ["8.6", "Friction"],
      ]],
      ["9", "Moments", [["9.1", "Moments and rigid bodies"]]],
    ])],
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

/** Where a point sits: its area, its part and itself. */
export const placeOf = (id: string) => PLACE.get(id);

/** How a point is named on a booklet: "2.3", or "Core Pure 6.1" from another part. */
export function pointName(id: string, fromPart: string): string {
  const p = PLACE.get(id);
  if (!p) return id;
  if (!p.point.n) return p.part.name.toLowerCase();
  return p.part.id === fromPart ? p.point.n : `${p.part.short} ${p.point.n}`;
}
