# MML Schema Definition

This directory contains the schema definition for the MML format. The schema for element definitions is written in [XML Schema Definition Language (XSD)](https://www.w3.org/TR/xmlschema11-1/) as this enables validation of the source XHTML format of MML Documents.

**This is a work-in-progress even for v0.1 of the MML format.**

The schema definition is potentially difficult to visually parse as it makes use of attribute groups that allow attribute definition re-use across elements.

This package contains:
* [`mml.xsd`](./src/schema-src/mml.xsd) - The MML Schema in XSD format
* [`events.d.ts`](./src/schema-src/events.d.ts) - The event types used by elements in the MML Schema


