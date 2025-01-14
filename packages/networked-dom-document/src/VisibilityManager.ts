export class VisibilityManager {
  private connectionIdToSpecificallyVisibleNodes = new Map<number, Set<number>>();

  public addSpecificallyVisibleNode(internalConnectionId: number, nodeId: number) {
    let connectionIdNodes = this.connectionIdToSpecificallyVisibleNodes.get(internalConnectionId);
    if (!connectionIdNodes) {
      connectionIdNodes = new Set<number>();
      this.connectionIdToSpecificallyVisibleNodes.set(internalConnectionId, connectionIdNodes);
    }
    connectionIdNodes.add(nodeId);
  }

  public removeSpecificallyVisibleNode(internalConnectionId: number, nodeId: number) {
    const connectionIdNodes = this.connectionIdToSpecificallyVisibleNodes.get(internalConnectionId);
    if (connectionIdNodes) {
      connectionIdNodes.delete(nodeId);
      if (connectionIdNodes.size === 0) {
        this.connectionIdToSpecificallyVisibleNodes.delete(internalConnectionId);
      }
    }
  }

  public getSpecificallyVisibleNodes(internalConnectionId: number): Set<number> | undefined {
    return this.connectionIdToSpecificallyVisibleNodes.get(internalConnectionId);
  }
}
