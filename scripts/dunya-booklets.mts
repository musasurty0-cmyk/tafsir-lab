/**
 * Put the MadAsMaths question booklets behind /dunya, filed by chapter.
 *
 *   npx tsx scripts/dunya-booklets.mts <booklets.zip>
 *
 * The zip holds TafsirLab_<name>.pdf files (T. Madas' worksheets from
 * madasmaths.com, answers taken out, credited on every page). Where each belongs
 * is the table below, made by reading the booklets against the course's chapters
 * (Further Maths: 9FM0's points). The first place is where it is filed, the rest
 * are ones it also covers (lib/dunya/spec-points.ts), with which pages when the
 * booklet is in sections: the page numbers are the ones printed on it.
 *
 * Files go to the private R2 bucket; the list to DunyaPlan.catalog.booklets,
 * which scripts/dunya-upload.mts leaves alone. A file already stored at the
 * same size is not sent again, so an interrupted run can simply be repeated.
 *
 *   DRY_RUN=1      print the list and stop (JSON_OUT=file writes it there too)
 *   SKIP_UPLOAD=1  write the list only
 */

import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import AdmZip from "adm-zip";
import * as mupdf from "mupdf";
import { PrismaClient } from "@prisma/client";
import { asCatalog, type Booklet } from "../lib/dunya/catalog";
import { placeOf } from "../lib/dunya/spec-points";

const BUCKET = "tafsir-lab-dunya";
const run = promisify(exec);

// file name (without TafsirLab_ and .pdf) | title | place @ which pages; other places
const TABLE = `
indices_practice_student_version | Indices | y1-pure-1
indices_exam_questions | Indices | y1-pure-1
surds_student_version | Surds | y1-pure-1
surd_exam_questions | Surds | y1-pure-1
quadratic_sketching | Sketching quadratics | y1-pure-2
quadratics_exam_questions | Quadratics | y1-pure-2
discriminant_practice | The discriminant | y1-pure-2
discriminant_exam_questions | The discriminant | y1-pure-2
inequalities_basic_practice | Inequalities, the basics | y1-pure-3
inequalities_exam_questions | Inequalities | y1-pure-3
inequalities | Inequalities, harder | y1-pure-3 @ pages 1 to 9 and 19 to 23; y2-pure-2 @ pages 10 to 18; fp1-7.1
equations_exam_questions_i | Equations | y1-pure-3; y1-pure-2
equations_advanced_skills | Equations, advanced skills | y1-pure-3; y1-pure-2
cubic_sketching | Sketching cubics | y1-pure-4
cubics_exam_questions | Cubics | y1-pure-4; y1-pure-7
reciprocal_functions | Reciprocal graphs | y1-pure-4; y2-pure-2
curve_sketching_exam_questions | Curve sketching | y1-pure-4; y2-pure-2
transformations_of_graphs_practice_student_version | Transformations of graphs | y1-pure-4; y2-pure-2
transformations_of_graphs_exam_questions | Transformations of graphs | y1-pure-4; y2-pure-2
line_coordinate_geometry_practice | Straight lines | y1-pure-5
line_coordinate_geometry_exam_questions | Straight lines | y1-pure-5
circle_coordinate_geometry_exam_questions | Circles | y1-pure-6
polynomials_practice_intro | Polynomials, introduction | y1-pure-7; y1-pure-1
polynomials_exam_questions_intro | Polynomials, introduction | y1-pure-7
polynomials | Polynomials, harder | y1-pure-7
identities | Algebraic identities | y1-pure-7
proof_general | Proof | y1-pure-7 @ everything but proof by contradiction; y2-pure-1 @ the proofs by contradiction
binomial_expansions_practice | Binomial expansions | y1-pure-8
binomial_expansions_exam_questions | Binomial expansions | y1-pure-8
trigonometric_graphs | Trigonometric graphs | y1-pure-9 @ the questions in degrees; y2-pure-6
3d_geometric_mensuration | Triangles in 3D | y1-pure-9
trigonometric_equations_introduction | Trigonometric equations, introduction | y1-pure-10 @ the questions in degrees; y2-pure-5 @ the questions in radians
trigonometry_introduction_exam_equations | Trigonometric equations, introduction | y1-pure-10 @ the questions in degrees; y2-pure-5 @ the questions in radians
vector_algebra_introduction | Vectors, introduction | y1-pure-11 @ pages 1 to 19; y2-pure-12 @ pages 20 to 42
differentiation_practice_i | Differentiation, part 1 | y1-pure-12
differentiation_from_first_principles | Differentiation from first principles | y1-pure-12 @ everything but sin and cos; y2-pure-9 @ the questions on sin and cos
calculus_introduction_exam_questions | Calculus, introduction | y1-pure-12; y1-pure-13
differentiation_optimization_problems | Optimisation problems | y1-pure-12
integration_intro | Integration, introduction | y1-pure-13
integration_areas_intro | Areas, introduction | y1-pure-13
exponentials_logarithms_practice | Exponentials and natural logarithms | y1-pure-14
exponentials_logarithms_exam_questions | Exponentials and natural logarithms | y1-pure-14; y2-pure-2
logarithms_practice | Logarithms | y1-pure-14
logarithms_exam_questions | Logarithms | y1-pure-14
linearization_of_graphs | Linearising graphs | y1-pure-14

m1_kinematic_graphs | Kinematic graphs | y1-mech-2
m1_kinematics | Kinematics | y1-mech-2
m1_connected_particles | Connected particles | y1-mech-3 @ the questions without slopes or friction; y2-mech-7 @ the ones with slopes or friction
m1_m2_kinematics_using_calculus | Kinematics with calculus | y1-mech-4 @ pages 1 to 21; y2-mech-8 @ pages 23 to 29

data_analysis | Data analysis | y1-stats-2 @ pages 1 to 23 and 34 to 38; y1-stats-3 @ pages 25 to 33
data_analysis_exam_questions | Data analysis | y1-stats-2; y1-stats-3
probability | Probability | y1-stats-5 @ pages 96 to 136, and the earlier ones without conditional probability; y2-stats-2 @ pages 1 to 94
binomial_distribution | The binomial distribution | y1-stats-6
hypothesis_testing_introduction | Hypothesis testing, introduction | y1-stats-7 @ pages 1 to 34; fs1-4.1 @ pages 35 to 50

algebraic_fractions | Algebraic fractions | y2-pure-1 @ pages 8 to 42; y1-pure-7 @ pages 1 to 7
algebraic_fractions_exam_questions | Algebraic fractions | y2-pure-1
function_practice | Functions | y2-pure-2
function_exam_questions | Functions | y2-pure-2
modulus_function_practice | The modulus function | y2-pure-2
modulus_function_exam_questions | The modulus function | y2-pure-2
rational_functions | Rational functions | y2-pure-2
curve_sketching | Curve sketching, harder | y2-pure-2; y2-pure-9
recurrence_relations | Recurrence relations | y2-pure-3
arithmetic_series_exam_questions | Arithmetic series | y2-pure-3
arithmetic_series_worded_questions | Arithmetic series, worded questions | y2-pure-3
geometric_series | Geometric series | y2-pure-3
geometric_series_worded_questions | Geometric series, worded questions | y2-pure-3
series_mixed_exam_questions | Series, mixed | y2-pure-3
binomial_series_expansions_practice | Binomial series | y2-pure-4
binomial_series_expansions_exam_questions | Binomial series | y2-pure-4
geometric_mensuration | Arcs, sectors and triangles | y2-pure-5; y1-pure-9 @ the questions on triangles
advanced_mensuration | Advanced mensuration | y2-pure-5; y2-pure-7
trigonometry_minor_trig_ratios | Sec, cosec and cot | y2-pure-6
trigonometry_pythagorean_identities | Pythagorean identities | y2-pure-6
trigonometric_equations | Trigonometric equations | y2-pure-6; y2-pure-7
trigonometric_inverse_functions | Inverse trigonometric functions | y2-pure-6; cp-5.5
trigonometry_compound_angle_identities | Compound angle identities | y2-pure-7
trigonometry_double_angle_identities | Double angle identities | y2-pure-7
trigonometry_r_transformations | R transformations | y2-pure-7
trigonometric_identities_with_solutions | Trigonometric identities | y2-pure-7; y2-pure-6
trigonometry_exam_questions | Trigonometry, the full set | y2-pure-7; y2-pure-5; y2-pure-6
parametric_equations | Parametric equations | y2-pure-8 @ pages 1 to 20; y2-pure-9 @ pages 21 to 25
parametric_equations_exam_questions | Parametric equations | y2-pure-8; y2-pure-9
differentiation_practice_ii_student_version | Differentiation, part 2 | y2-pure-9
differentiation_practice_ii_exam_questions | Differentiation, part 2 | y2-pure-9
related_rates_of_change | Related rates of change | y2-pure-9
implicit_differentiation | Implicit differentiation | y2-pure-9
implicit_equations_exam_questions | Implicit equations | y2-pure-9
numerical_solutions_of_equations | Numerical solutions of equations | y2-pure-10
integration_basics_student_version | Integration, the basics | y2-pure-11
integration_by_trigonometric_identities_student_version | Integrating with trigonometric identities | y2-pure-11
integration_by_reverse_chain_rule_student_version | The reverse chain rule | y2-pure-11
integration_by_substitution_student_version | Integration by substitution | y2-pure-11
integration_by_parts_student_version | Integration by parts | y2-pure-11
integration_by_a_special_manipulation_student_version | Integrating by dividing first | y2-pure-11
integration_partial_fractions_student_version | Integrating with partial fractions | y2-pure-11
integration_indefinite_mix_student_version | Indefinite integrals, mixed | y2-pure-11
integration_indefinite_mix_student_version_condense | Indefinite integrals, mixed, less space | y2-pure-11
integration_indefinite_megamix_student_version | Indefinite integrals, megamix | y2-pure-11
integration_indefinite_megamix_student_version_condense | Indefinite integrals, megamix, less space | y2-pure-11
integration_definite_megamix_student_version | Definite integrals, megamix | y2-pure-11
integration_structured_exam_questions_part_i | Integration, structured questions, part 1 | y2-pure-11
integration_areas | Areas | y2-pure-11
parametric_integration_exam_questions | Parametric integration | y2-pure-11; y2-pure-8; cp-5.1
integration_numerical | Numerical integration | y2-pure-11 @ pages 1 to 20; fp1-6.2 @ pages 22 to 41
series_and_integrals | Series and integrals | y2-pure-11
odes_separable_no_context | Separable differential equations | y2-pure-11
odes_context_modelling | Differential equations in context | y2-pure-11

m1_m2_moments | Moments | y2-mech-4
m1_resultants | Resultants | y2-mech-5
m1_dynamics | Dynamics | y2-mech-5; y2-mech-7
m1_m2_projectiles | Projectiles | y2-mech-6
m1_equilibrium | Equilibrium of a particle | y2-mech-7; y2-mech-5
m2_equilibrium_of_rigid_bodies | Equilibrium of rigid bodies | y2-mech-7
m1_vectors_applications | Vectors in mechanics | y2-mech-8; y1-mech-3 @ the questions with forces, and pages 53 to 55

correlation_and_regression | Correlation and regression | y2-stats-1; y1-stats-4 @ pages 24 to 52; fs2-1.2; fs2-3.2 @ pages 54 to 59; fs2-3.3
normal_distribution_calculations | The Normal distribution | y2-stats-3
hypothesis_testing_normal_distribution | Hypothesis testing with the Normal | y2-stats-3 @ pages 1 to 11 and 26 to 47; fs2-5.2 @ pages 12 to 24; fs2-5.4 @ pages 48 to 63

trigonometric_general_solutions | General solutions | beyond-pure

vector_practice_part_a | Vectors, part A | cp-6.1 @ pages 35 to 63; cp-6.3 @ pages 26 to 35; y1-pure-11 @ pages 1 to 12; y2-pure-12 @ pages 13 to 25
vector_exam_questions_part_a | Vectors, part A | cp-6.1; cp-6.3; cp-6.5

proof_by_induction | Proof by induction | cp-1.1
complex_numbers_part_1 | Complex numbers, part 1 | cp-2.2; cp-2.3; cp-2.5
complex_numbers_part_1_exam_questions | Complex numbers, part 1 | cp-2.2; cp-2.3; cp-2.5
complex_numbers_part_2 | Complex numbers, part 2 | cp-2.8; cp-2.7; cp-2.10; fp2-4.1; fp2-4.2
complex_numbers_part_2_exam_questions | Complex numbers, part 2 | cp-2.8; cp-2.7; cp-2.10; fp2-4.1; fp2-4.2
matrices_practice | Matrices | cp-3.1; cp-3.3; cp-3.5; cp-3.6; cp-3.7; fp2-3.1
matrices_exam_questions_part_a | Matrices, part A | cp-3.3; cp-3.1; cp-3.5; cp-3.6
matrices_exam_questions_part_b | Matrices, part B | fp2-3.1; fp2-3.2; cp-3.3; cp-3.5; cp-3.6
consistency_of_equations | Consistency of equations | cp-3.8; cp-3.7
roots_of_polynomial_equations | Roots of polynomial equations | cp-4.1; cp-4.2
series_summation_practice | Summing series | cp-4.3; cp-4.4
series_expansions | Series expansions | cp-4.5; fp1-2.1
integration_volume_of_revolution | Volumes of revolution | cp-5.1
improper_integrals | Improper integrals | cp-5.2
integration_structured_exam_questions_part_ii | Integration, structured questions, part 2 | cp-5.6; cp-5.4; cp-8.5
vectors_practice_part_b | Vectors, part B | fp1-5.1; fp1-5.3; cp-6.2; cp-6.5
vectors_exam_questions_part_b | Vectors, part B | fp1-5.3; fp1-5.1; cp-6.2; cp-6.5
polar_coordinates_practice | Polar coordinates | cp-7.1; cp-7.2; cp-7.3
polar_coordinates_exam_questions | Polar coordinates | cp-7.3; cp-7.1; cp-7.2
hyperbolic_functions | Hyperbolic functions | cp-8.1; cp-8.2; cp-8.3
differentiation_practice_iii | Differentiation, part 3 | cp-8.2; cp-5.5; cp-8.3
1st_order_differential_equations_practice | First order differential equations | cp-9.1
1st_order_differential_equations_exam_questions | First order differential equations | cp-9.1
2nd_order_differential_equations_practice | Second order differential equations | cp-9.5; cp-9.4
2nd_order_differential_equations_exam_questions | Second order differential equations | cp-9.5; cp-9.4
1st_order_differential_equations_substitutions | First order equations by substitution | fp1-3.2
2nd_order_differential_equations_substitutions | Second order equations by substitution | fp1-3.2
conic_sections | Conic sections | fp1-4.1; fp1-4.3; fp1-4.4
differential_equations_numerical_methods | Differential equations, numerical methods | fp1-6.1
reduction_formulas | Reduction formulae | fp2-2.1
arclength_surface_of_revolution | Arc length and surfaces of revolution | fp2-2.2
number_theory | Number theory | fp2-5.1
combinations_and_permutations | Combinations and permutations, with probability | fp2-5.7
combinatorics | Combinatorics | fp2-5.7

discrete_random_variables | Discrete random variables | fs1-1.1; y1-stats-6
poisson_distribution | The Poisson distribution | fs1-2.1
distributional_approximations | Distributional approximations | fs1-2.3; y2-stats-3
geometric_distribution | The geometric distribution | fs1-3.1
contingency_tables | Contingency tables | fs1-6.1
goodness_of_fit | Goodness of fit | fs1-6.1
probability_density_functions | Probability density functions | fs2-2.1; fs2-2.2; fs2-2.3
rectangular_distribution | The rectangular distribution | fs2-2.4
related_random_variables | Related random variables | fs2-2.2; fs2-2.4
normal_variables | Combining Normal variables | fs2-4.1
probability_sampling_distributions | Sampling distributions | fs2-5.1
t_distribution | The t-distribution | fs2-7.1; fs2-7.2
proportion_samples | Proportions of samples | beyond-stats

m1_collisions | Collisions, momentum | fm1-1.1
m2_m3_impulse | Impulse | fm1-1.2; fm1-1.1
m2_work_and_energy | Work and energy | fm1-2.1
m2_power | Power | fm1-2.1
m2_m3_elastic_strings_springs | Elastic strings and springs | fm1-3.1; fm1-3.2
m2_collisions | Collisions, restitution | fm1-4.1; fm1-4.2
m3_m4_oblique_collisions | Oblique collisions | fm1-5.1
m2_m3_circular_motion | Circular motion | fm2-1.2; fm2-1.1
m2_centre_of_mass | Centres of mass | fm2-2.2; fm2-2.1
m3_centre_of_mass | Centres of mass, solids | fm2-3.1; fm2-3.2
m3_m4_kinematics_dynamics_easier_odes | Kinematics and dynamics, easier equations | fm2-4.1; fm2-5.1
m3_gravitation_problems | Gravitation | fm2-4.1
m3_m5_s.h.m | Simple harmonic motion | fm2-4.2; cp-9.7

m2_m4_frameworks_multistructures | Frameworks and structures | beyond-statics
m4_m6_moments_in_vector_form | Moments in vector form | beyond-statics
m4_m6_equilibrium_and_potential_energy | Equilibrium and potential energy | beyond-statics
m3_m6_advanced_projectiles | Advanced projectiles | beyond-motion
m3_m6_pendulum_motion | Pendulum motion | beyond-motion
m3_m4_relative_motion | Relative motion | beyond-motion
m4_m5_moment_of_inertia_calculations | Moments of inertia | beyond-rotation
m4_m6_rotational_motion | Rotational motion | beyond-rotation
m4_m6_rotational_and_translational_motion | Rotational and translational motion | beyond-rotation
m4_m6_kinematics_dynamics_harder_odes | Kinematics and dynamics, harder equations | beyond-dynamics
m4_m6_polar_cordinates_and_central_forces | Polar coordinates and central forces | beyond-dynamics
m4_m6_variable_mass_problems | Variable mass | beyond-dynamics
m4_m6_vector_differential_equations | Vector differential equations | beyond-dynamics
m4_m6_work_in_vector_form | Work in vector form | beyond-dynamics
m6_intrinsic_coordinates | Intrinsic coordinates | beyond-dynamics
m6_motion_on_axisymmetric_surfaces | Motion on axisymmetric surfaces | beyond-dynamics
`;

interface Row { file: string; title: string; points: string[]; parts: Record<string, string> }
const rows: Row[] = TABLE.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
  const [file, title, points] = l.split("|").map((x) => x.trim());
  const places = points.split(";").map((x) => x.split("@").map((y) => y.trim()));
  return { file, title, points: places.map((x) => x[0]), parts: Object.fromEntries(places.filter((x) => x[1]).map((x) => [x[0], x[1]])) };
});

// The table is checked before anything is touched: no booklet twice, no point that isn't one.
const twice = rows.map((r) => r.file).filter((f, i, all) => all.indexOf(f) !== i);
if (twice.length) throw new Error(`Listed twice: ${twice.join(", ")}`);
for (const r of rows) for (const p of r.points) if (!placeOf(p)) throw new Error(`${r.file}: no such point as ${p}`);

const zipPath = process.argv[2];
if (!zipPath) throw new Error("Give the booklets zip.");
const files = new Map<string, Buffer>();
for (const e of new AdmZip(zipPath).getEntries()) {
  if (e.isDirectory) continue;
  const m = /(?:^|\/)TafsirLab_([A-Za-z0-9_.]+)\.pdf$/.exec(e.entryName);
  if (!m) { console.warn(`  skipping ${e.entryName}`); continue; }
  const bytes = e.getData();
  if (bytes.subarray(0, 5).toString("latin1") !== "%PDF-") throw new Error(`${e.entryName} is not a PDF`);
  files.set(m[1], bytes);
}
const unlisted = [...files.keys()].filter((f) => !rows.some((r) => r.file === f));
const missing = rows.filter((r) => !files.has(r.file)).map((r) => r.file);
if (unlisted.length || missing.length) throw new Error(`Not in the table: ${unlisted.join(", ") || "none"}. In the table but not the zip: ${missing.join(", ") || "none"}.`);

/** Pages, and how many questions are numbered in it (null for the long unnumbered lists). */
function count(bytes: Buffer): { pages: number; questions: number | null } {
  const doc = mupdf.Document.openDocument(bytes, "application/pdf");
  const pages = doc.countPages();
  // A booklet made of several sheets starts again at 1, so headings are counted,
  // not the highest number; one carried over a page is the same number again.
  let n = 0, last = "";
  for (let i = 0; i < pages; i++) {
    for (const m of doc.loadPage(i).toStructuredText("").asText().matchAll(/^\s*Question\s+(\d+)/gm)) if (m[1] !== last) { n++; last = m[1]; }
  }
  return { pages, questions: n || null };
}

const booklets: Booklet[] = rows.map((r) => {
  const bytes = files.get(r.file)!;
  const slug = r.file.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const kind = /exam_(questions|equations)|worded_questions/.test(r.file) ? "Exam questions" : /practice|student_version|_mix|basics/.test(r.file) ? "Practice" : "Questions";
  const c = count(bytes);
  // A student version numbers its exercises, each a list of questions, so only its pages say how long it is.
  const questions = /student_version/.test(r.file) ? null : c.questions;
  return { id: `b-${slug}`, title: r.title, kind, points: r.points, ...(Object.keys(r.parts).length ? { parts: r.parts } : {}), questions, pages: c.pages, key: `maths/booklets/${slug}.pdf` };
});
const bytesOf = new Map(rows.map((r, i) => [booklets[i].key, files.get(r.file)!]));
if (bytesOf.size !== booklets.length) throw new Error("Two booklets have the same key.");

if (process.env.DRY_RUN) {
  if (process.env.JSON_OUT) writeFileSync(process.env.JSON_OUT, JSON.stringify(booklets));
  for (const b of booklets) console.log(`${b.points[0].padEnd(16)} ${b.title} · ${b.kind} · ${b.questions ?? "-"} q · ${b.pages} pp${b.points.length > 1 ? ` · also ${b.points.slice(1).join(" ")}` : ""}`);
  console.log(`\n${booklets.length} booklets, ${(files.size && [...files.values()].reduce((n, x) => n + x.length, 0) / 1024 ** 2).toFixed(1)} MB`);
  process.exit(0);
}

const db = new PrismaClient();
const before = asCatalog((await db.dunyaPlan.findUniqueOrThrow({ where: { id: "main" }, select: { catalog: true } })).catalog);
const stored: Record<string, number> = { ...before.stored };

/* The same free-tier guard as scripts/dunya-upload.mts, on this script's
   record of everything in the bucket and on Cloudflare's own figure. */
const MAX_BUCKET_BYTES = 2 * 1024 ** 3;
const MAX_FILE_BYTES = 50 * 1024 ** 2;
const mb = (n: number) => `${(n / 1024 ** 2).toFixed(1)} MB`;
const todo = [...bytesOf].filter(([k, b]) => stored[k] !== b.length);

if (!process.env.SKIP_UPLOAD && todo.length) {
  const adding = todo.reduce((n, [, b]) => n + b.length, 0);
  const big = todo.filter(([, b]) => b.length > MAX_FILE_BYTES).map(([k]) => k);
  if (big.length) throw new Error(`Over 50 MB, not uploaded: ${big.join(", ")}`);
  const { stdout: info } = await run(`npx wrangler r2 bucket info ${BUCKET} --config party/wrangler.jsonc`);
  const m = /bucket_size:\s*([\d.]+)\s*(B|KB|KiB|MB|MiB|GB|GiB|TB|TiB)\b/i.exec(info);
  if (!m) throw new Error(`Couldn’t read the bucket's size, so nothing was uploaded:\n${info}`);
  const live = Number(m[1]) * 1024 ** "BKMGT".indexOf(m[2].toUpperCase()[0]);
  const present = Math.max(live, Object.values(stored).reduce((n, b) => n + b, 0));
  if (present + adding > MAX_BUCKET_BYTES) throw new Error(`The bucket holds ${mb(present)}; adding ${mb(adding)} would pass ${mb(MAX_BUCKET_BYTES)}. Nothing uploaded.`);
  console.log(`Bucket ${mb(present)} + ${mb(adding)}, inside the ${mb(MAX_BUCKET_BYTES)} limit. Uploading ${todo.length} files…`);

  const work = mkdtempSync(join(tmpdir(), "dunya-b-"));
  const queue = todo.map(([key, bytes], i) => ({ key, bytes, path: join(work, `f${i}.pdf`) }));
  const failed: string[] = [];
  let done = 0;
  const put = async ({ key, bytes, path }: (typeof queue)[number]) => {
    writeFileSync(path, bytes);
    const cmd = `npx wrangler r2 object put ${BUCKET}/${key} --file "${path}" --content-type application/pdf --remote --config party/wrangler.jsonc`;
    for (let tries = 0; tries < 3; tries++) {
      try { await run(cmd); stored[key] = bytes.length; console.log(`  ${++done}/${todo.length} ${key}`); return; } catch { /* again */ }
    }
    failed.push(key);
  };
  const next = async () => { for (let j = queue.shift(); j; j = queue.shift()) await put(j); };
  await Promise.all([next(), next(), next(), next()]);
  rmSync(work, { recursive: true, force: true });
  if (failed.length) {
    // What did arrive is recorded, so the next run only sends the rest.
    await save((c) => ({ ...c, stored: { ...c.stored, ...stored } }));
    throw new Error(`Didn’t upload, run again: ${failed.join(", ")}`);
  }
}

/** Reads the catalogue again and writes it in one go, so nothing changed meanwhile is lost. */
async function save(change: (c: ReturnType<typeof asCatalog>) => ReturnType<typeof asCatalog>) {
  const row = await db.dunyaPlan.findUniqueOrThrow({ where: { id: "main" }, select: { catalog: true } });
  await db.dunyaPlan.update({ where: { id: "main" }, data: { catalog: change(asCatalog(row.catalog)) as object } });
}
await save((c) => ({ ...c, booklets, stored: { ...c.stored, ...stored } }));
await db.$disconnect();
console.log(`${booklets.length} booklets listed.`);
