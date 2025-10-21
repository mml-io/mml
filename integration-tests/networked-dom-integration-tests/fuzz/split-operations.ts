import type { DeepReadonly, FuzzOperation, OperationSequence, ReloadOperation } from "./fuzz-types";

/**
 * Splits operations at reload boundaries and returns sequences with their starting HTML.
 * Each sequence represents a document load with operations to run before the next reload.
 */
export function splitOperationsAtReloads(
  operations: DeepReadonly<FuzzOperation[]>,
): OperationSequence[] {
  const sequences: OperationSequence[] = [];
  let currentOps: DeepReadonly<FuzzOperation>[] = [];
  let currentHTML = '<div id="app" data-root="true"></div>';

  for (const op of operations) {
    if (op.type === "reload") {
      // Save the current sequence
      sequences.push({
        html: currentHTML,
        operations: currentOps as DeepReadonly<FuzzOperation[]>,
      });
      // Start a new sequence with the reload's HTML
      currentHTML = (op as DeepReadonly<ReloadOperation>).html;
      currentOps = [];
    } else {
      currentOps.push(op);
    }
  }

  sequences.push({
    html: currentHTML,
    operations: currentOps as DeepReadonly<FuzzOperation[]>,
  });

  return sequences;
}
