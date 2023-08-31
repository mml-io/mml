import { schemaXML } from "@mml-io/mml-schema";
import validateAgainstSchema from "xsd-validator";

export function validateMMLDocument(document: string): Array<Error> | null {
  const result = ((validateAgainstSchema as any).default as typeof validateAgainstSchema)(
    document,
    schemaXML,
  );
  if (result === true) {
    return null;
  } else {
    return result;
  }
}
