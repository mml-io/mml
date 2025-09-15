export const networkedDOMProtocolSubProtocol_v0_2 = "networked-dom-v0.2";
export const networkedDOMProtocolSubProtocol_v0_2_1 = "networked-dom-v0.2.1";

// In priority order, from most preferred to least preferred
export const networkedDOMProtocolSubProtocol_v0_2_SubVersionsList = [
  networkedDOMProtocolSubProtocol_v0_2_1,
  networkedDOMProtocolSubProtocol_v0_2,
] as const;

export type networkedDOMProtocolSubProtocol_v0_2_Subversion =
  (typeof networkedDOMProtocolSubProtocol_v0_2_SubVersionsList)[number];

export type networkedDOMProtocolSubProtocol_v0_2_SubversionNumber = 0 | 1;

const protocolSubVersionMap: Record<
  networkedDOMProtocolSubProtocol_v0_2_Subversion,
  networkedDOMProtocolSubProtocol_v0_2_SubversionNumber
> = {
  [networkedDOMProtocolSubProtocol_v0_2]: 0,
  [networkedDOMProtocolSubProtocol_v0_2_1]: 1,
};

export function getNetworkedDOMProtocolSubProtocol_v0_2Subversion(
  protocol: networkedDOMProtocolSubProtocol_v0_2_Subversion,
): networkedDOMProtocolSubProtocol_v0_2_SubversionNumber | null {
  return protocolSubVersionMap[protocol] ?? null;
}

export function getNetworkedDOMProtocolSubProtocol_v0_2SubversionOrThrow(
  protocol: networkedDOMProtocolSubProtocol_v0_2_Subversion,
): networkedDOMProtocolSubProtocol_v0_2_SubversionNumber {
  const subversion = getNetworkedDOMProtocolSubProtocol_v0_2Subversion(protocol);
  if (subversion === null) {
    throw new Error(`Unrecognized networked-dom-v0.2 protocol subversion: ${protocol}`);
  }
  return subversion;
}

export function isNetworkedDOMProtocolSubProtocol_v0_2(
  protocol: string,
): protocol is (typeof networkedDOMProtocolSubProtocol_v0_2_SubVersionsList)[number] {
  return networkedDOMProtocolSubProtocol_v0_2_SubVersionsList.includes(protocol as any);
}
