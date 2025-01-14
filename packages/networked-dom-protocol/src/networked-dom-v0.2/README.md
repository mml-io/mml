# Networked DOM Protocol v0.2

The `networked-dom-v0.2` protocol is a binary protocol that allows for the synchronization of DOM elements to multiple clients and the sending of events back to the server.

It is an evolution from the `networked-dom-v0.1` protocol.

## Features
* Binary format based on uvarints, varints, and UTF-8 strings. 
  * To improve performance it is a strict format that assumes that the server and client are using the same version of the protocol with no backwards or forwards compatibility allowances.
    * Fields are assumed to be in a specific order with no length prefixes apart from for strings.
      * This allows for writing data directly into a buffer without having to first calculate the length of the data.
  * This sees a significant reduction in the size of messages compared to JSON and Protobuf.
  * This is also more efficient to encode and decode compared to JSON and Protobuf.
* Allows a single WebSocket connection to represent multiple users, with each user having a unique ID.
  * The server messages include data about which elements are visible to which users.
* Allows for indicating that multiple messages should be applied atomically (applied as a batch).

## Message Types from Server to Client

### Snapshot
The initial state of the DOM tree as a root element and its children.

### DocumentTime
The current time of the document has changed.

### ChildrenAdded
Children have been added to an element.

### ChildrenRemoved
Children have been removed from an element.

### AttributesChanged
One or more attributes of an element have been updated or removed.

### TextChanged
The text content of an element has changed.

### ChangeVisibleTo
Which users should be able to see a element that is restricted to certain users has changed.

### ChangeHiddenFrom
Which users should not be able to see a element that is restricted to certain users has changed.

### BatchStart
The start of a batch of messages that should be applied atomically.

### BatchEnd
The end of a batch of messages that should be applied atomically.

### Ping
A ping message to check if the connection is still alive.

### Warning
A warning message.

### Error
An error message.


## Message Types from Client to Server

### ConnectUsers
The client is indicating that one or more users have connected.

### DisconnectUsers
The client is indicating that one or more users have disconnected.

### Event
An event on an element triggered by a user that is being sent to the server.

### Pong
A pong message in response to a ping message.
