// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
// eslint-disable-next-line import/no-unresolved
import eventsSchemaContentsJSON from "mml-events-json";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
// eslint-disable-next-line import/no-unresolved
import schemaContentsJSON from "mml-xsd-json";
import { DeclarationReflection, ProjectReflection } from "typedoc";
import { SomeType } from "typedoc/dist/lib/models/types";
import { ModelToObject } from "typedoc/dist/lib/serialization/schema";

import { XSD } from "./xsd";

export const schemaJSON: XSD = schemaContentsJSON as XSD;

export type EventsSchemaType = ModelToObject<ProjectReflection>;
export type EventsClassSchemaType = ModelToObject<DeclarationReflection>;
export type EventType = SomeType;
export const eventsSchemaJSON = eventsSchemaContentsJSON as EventsSchemaType;
