# Networked DOM Protocol v0.1

The `networked-dom-v0.1` protocol is a simple JSON protocol that allows for the synchronization of DOM elements to multiple clients and the sending of events back to the server.

The protocol allows opening a WebSocket connection to a server that represents a single user's view of the document and allows that user to send events back to the server. 

## Message Types from Server to Client

### snapshot
The initial state of the DOM tree as a root element and its children.

### childrenChanged

The children of an element have removals and/or additions. Removals are applied first.

### textChanged

The text content of an element has changed.

### attributeChange

An attribute of an element has updated or removed.

### ping

A ping message to check if the connection is still alive.

### error

An error message.

### warning

A warning message.


## Message Types from Client to Server

### event

An event on an element that is being sent to the server.

### pong

A pong message in response to a ping message.
