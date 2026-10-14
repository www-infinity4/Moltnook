// Explicit regex specification preflight for source inspection jobs.
// This checks pattern syntax only; it does not try to execute untrusted regexes
// against arbitrarily large input or pretend to be a complete JS parser.
const FLAGS = /^[dgimsuvy]{0,7}$/;
export function preflightRegexSpec(spec) {
  if (!spec || typeof spec.pattern !== 'string' || typeof spec.flags !== 'string') {
    return {passed:false,rule:'regex.invalid_spec'};
  }
  if (spec.pattern.length > 512 || spec.pattern.length === 0 || !FLAGS.test(spec.flags) ||
      new Set(spec.flags).size !== spec.flags.length || (spec.flags.includes('u') && spec.flags.includes('v'))) {
    return {passed:false,rule:'regex.invalid_bounds_or_flags'};
  }
  // Conservative warning for a common nested-quantifier ReDoS shape.
  // It is not a proof of safety for patterns that pass.
  if (/\([^)]*[+*][^)]*\)[+*{]/.test(spec.pattern)) {
    return {passed:false,rule:'regex.possible_catastrophic_backtracking'};
  }
  try {
    new RegExp(spec.pattern, spec.flags);
    return {passed:true,rule:'regex.syntax_valid',assurance:'syntax_only'};
  } catch {
    return {passed:false,rule:'regex.syntax_error'};
  }
}
