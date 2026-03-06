/**
 * Re-export brand symbols from networked-dom-web (the canonical source of truth).
 * This allows mml-web code to import from the local virtual-dom barrel without
 * needing to depend on the lower-level package directly.
 */
export {
  VIRTUAL_DOCUMENT_BRAND,
  VIRTUAL_ELEMENT_BRAND,
  VIRTUAL_FRAGMENT_BRAND,
  VIRTUAL_TEXT_BRAND,
} from "@mml-io/networked-dom-web";
