import { networkedDOMProtocolSubProtocol_v0_2_SubversionNumber } from "./constants";

// Whether the given protocol subversion supports the `connectionTokens` field in the `connectUsers` message
export function protocolSubversionHasConnectionTokens(
  protocolSubversion: networkedDOMProtocolSubProtocol_v0_2_SubversionNumber,
) {
  return protocolSubversion >= 1;
}
