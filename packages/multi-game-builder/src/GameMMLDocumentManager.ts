import { EditableNetworkedDOM, LocalObservableDOMFactory } from "@mml-io/networked-dom-server";
import * as fs from "fs";
import * as path from "path";
import * as url from "url";

import { GameDirectory } from "./GameDirectoryScanner";

export interface MMLDocument {
  document: EditableNetworkedDOM;
  contents: string;
  loaded: boolean;
  gameName: string;
  fullPath: string;
}

export class GameMMLDocumentManager {
  private documents: Map<string, MMLDocument> = new Map();

  addGameDocument(gameDir: GameDirectory): void {
    const indexHtmlPath = path.join(gameDir.buildPath, "index.html");
    const documentKey = gameDir.name; // Just use the game name as the key

    // Check if build/index.html exists
    if (!fs.existsSync(indexHtmlPath)) {
      console.log(`No build/index.html found for game: ${gameDir.name}`);
      return;
    }

    try {
      const contents = fs.readFileSync(indexHtmlPath, { encoding: "utf8", flag: "r" });

      // Check if document already exists
      const existingDoc = this.documents.get(documentKey);
      if (existingDoc) {
        // Update existing document
        existingDoc.contents = contents;
        existingDoc.fullPath = indexHtmlPath;

        // Only reload if document was already loaded
        if (existingDoc.loaded) {
          console.log(`Reloading MML document: ${documentKey}`);
          existingDoc.document.load(contents);
        }
      } else {
        // Create new document
        console.log(`Adding MML document: ${documentKey}`);
        const document = new EditableNetworkedDOM(
          url.pathToFileURL(documentKey).toString(),
          LocalObservableDOMFactory,
          false,
        );

        this.documents.set(documentKey, {
          document,
          contents,
          loaded: false,
          gameName: gameDir.name,
          fullPath: indexHtmlPath,
        });
      }
    } catch (error) {
      console.error(`Failed to read build/index.html for ${gameDir.name}:`, error);
    }
  }

  /**
   * Removes MML document for a game
   */
  removeGameDocument(gameName: string): void {
    const doc = this.documents.get(gameName);
    if (doc) {
      console.log(`Removing MML document: ${gameName}`);
      doc.document.dispose();
      this.documents.delete(gameName);
    }
  }

  /**
   * Updates the build/index.html file for a game
   */
  updateGameDocument(gameName: string): void {
    const doc = this.documents.get(gameName);

    if (doc) {
      try {
        const contents = fs.readFileSync(doc.fullPath, { encoding: "utf8", flag: "r" });
        doc.contents = contents;

        // Only reload if document was already loaded
        if (doc.loaded) {
          console.log(`Reloading MML document: ${gameName}`);
          doc.document.load(contents);
        }
      } catch (error) {
        console.error(`Failed to update build/index.html for ${gameName}:`, error);
      }
    }
  }

  /**
   * Lazy loads a document on first access
   */
  ensureDocumentLoaded(documentKey: string): EditableNetworkedDOM | null {
    const docData = this.documents.get(documentKey);
    if (!docData) {
      return null;
    }

    if (!docData.loaded) {
      console.log(`Loading MML document ${documentKey} on first access`);
      docData.document.load(docData.contents);
      docData.loaded = true;
    }

    return docData.document;
  }

  /**
   * Checks if a game has an MML document
   */
  hasGameDocument(gameName: string): boolean {
    return this.documents.has(gameName);
  }

  /**
   * Gets all document keys
   */
  getAllDocumentKeys(): string[] {
    return Array.from(this.documents.keys());
  }

  /**
   * Checks if a document exists
   */
  hasDocument(documentKey: string): boolean {
    return this.documents.has(documentKey);
  }

  /**
   * Disposes all documents
   */
  dispose(): void {
    console.log("Disposing all MML documents...");

    for (const [documentKey, docData] of this.documents) {
      console.log(`Disposing MML document: ${documentKey}`);
      docData.document.dispose();
    }

    this.documents.clear();
    console.log("All MML documents disposed");
  }
}
