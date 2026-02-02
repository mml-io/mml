import {
  elementSchemas,
  generateBriefDocs,
  generateElementMarkdown,
  generateJSON,
  schemaRegistry,
} from "@mml-io/mml-schema";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerDocsTools(mcpServer: McpServer): void {
  // Search MML docs
  mcpServer.registerTool(
    "search_docs",
    {
      description: "Search MML element docs by tag, description, attributes, or attribute groups.",
      inputSchema: {
        query: z.string().describe("Search query (e.g., 'animation', 'pointer lock')"),
        limit: z
          .number()
          .optional()
          .describe("Maximum number of results to return (default: 20, max: 100)"),
        includeAttributes: z
          .boolean()
          .optional()
          .describe("Include attribute and group lists in results (default: true)"),
      },
    },
    ({ query, limit = 20, includeAttributes = true }) => {
      const normalizedQuery = query.trim().toLowerCase();
      if (!normalizedQuery) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                { query, total: 0, results: [], error: "Query must not be empty." },
                null,
                2,
              ),
            },
          ],
          isError: true,
        };
      }

      const cappedLimit = Math.min(Math.max(limit, 1), 100);
      const results = Object.values(elementSchemas)
        .map((schema) => {
          const matches: Array<{ field: string; name?: string }> = [];
          let score = 0;

          const tagMatch = schema.tagName.toLowerCase().includes(normalizedQuery);
          if (tagMatch) {
            matches.push({ field: "tag" });
            score += 5;
          }
          if (schema.description.toLowerCase().includes(normalizedQuery)) {
            matches.push({ field: "description" });
            score += 3;
          }

          for (const [name, attr] of Object.entries(schema.attributes)) {
            const nameMatch = name.toLowerCase().includes(normalizedQuery);
            const descMatch = attr.description.toLowerCase().includes(normalizedQuery);
            if (nameMatch || descMatch) {
              matches.push({ field: "attribute", name });
              score += nameMatch ? 2 : 1;
            }
          }

          for (const groupName of schema.attributeGroups) {
            const group = schemaRegistry.attributeGroups[groupName];
            if (!group) continue;
            const groupNameMatch = group.name.toLowerCase().includes(normalizedQuery);
            const groupDescMatch = group.description.toLowerCase().includes(normalizedQuery);
            if (groupNameMatch || groupDescMatch) {
              matches.push({ field: "attributeGroup", name: group.name });
              score += groupNameMatch ? 2 : 1;
            }
          }

          if (matches.length === 0) {
            return null;
          }

          return {
            tagName: schema.tagName,
            description: schema.description,
            attributeGroups: includeAttributes ? schema.attributeGroups : undefined,
            attributes: includeAttributes ? Object.keys(schema.attributes) : undefined,
            matches,
            score,
          };
        })
        .filter(Boolean)
        .sort((a, b) => (b?.score ?? 0) - (a?.score ?? 0));

      const trimmedResults = results.slice(0, cappedLimit).map((result) => {
        if (!result) return result;
        const { score: _score, ...rest } = result;
        return rest;
      });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                query,
                total: results.length,
                limit: cappedLimit,
                results: trimmedResults,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  // Get docs for a specific element
  mcpServer.registerTool(
    "get_docs",
    {
      description: "Get MML documentation for a specific element.",
      inputSchema: {
        element: z.string().describe("Element tag name (e.g., 'm-animation')"),
        format: z
          .enum(["brief", "markdown", "json"])
          .optional()
          .describe("Output format (default: brief)"),
      },
    },
    ({ element, format = "brief" }) => {
      const schema = elementSchemas[element];
      if (!schema) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ error: `Unknown element: ${element}` }, null, 2),
            },
          ],
          isError: true,
        };
      }

      let text: string;
      switch (format) {
        case "markdown":
          text = generateElementMarkdown(schema);
          break;
        case "json":
          text = generateJSON(element);
          break;
        case "brief":
        default:
          text = generateBriefDocs(element);
          break;
      }

      return {
        content: [
          {
            type: "text" as const,
            text,
          },
        ],
      };
    },
  );
}
