// Server -> Client
export const SnapshotMessageType = 1;
export const BatchStartMessageType = 2;
export const DocumentTimeMessageType = 3;
export const ChildrenAddedMessageType = 4;
export const ChildrenRemovedMessageType = 5;
export const AttributesChangedMessageType = 6;
export const ChangeVisibleToMessageType = 7;
export const ChangeHiddenFromMessageType = 8;
export const TextChangedMessageType = 9;
export const BatchEndMessageType = 10;
export const PingMessageType = 11;
export const WarningMessageType = 12;
export const ErrorMessageType = 13;

// Client -> Server
export const ConnectUsersMessageType = 14;
export const DisconnectUsersMessageType = 15;
export const EventMessageType = 16;
export const PongMessageType = 17;
