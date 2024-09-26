import { schemaXML } from "@mml-io/mml-schema";
import { XmlDocument, XmlError, XmlValidateError, XsdValidator } from "libxml2-wasm";

export interface ValidationError extends Error {
  /**
   * The message of the error during processing.
   */
  message: string;
  /**
   * The filename
   */
  file?: string;
  /**
   * The line number of the xml file, where the error is occurred.
   */
  line: number;
  /**
   * The column number of the xml file, where the error is occurred.
   */
  col: number;
}

export function validateMMLDocument(xml: string | Buffer): null | ValidationError[] {
  const parsedXML = XmlDocument.fromString(xml.toString());
  const parsedSchema = XmlDocument.fromString(schemaXML.toString());
  const validator = XsdValidator.fromDoc(parsedSchema);

  let error: XmlValidateError | XmlError | null = null;
  try {
    validator.validate(parsedXML);
  } catch (e) {
    error = e;
  }
  parsedXML.dispose();
  parsedSchema.dispose();
  validator.dispose();

  if (error) {
    if (error instanceof XmlValidateError) {
      return error.details.map((detail) => ({
        name: "ValidationError",
        message: detail.message,
        file: detail.file,
        line: detail.line,
        col: detail.col,
      }));
    } else {
      throw error;
    }
  }
  return null;
}
