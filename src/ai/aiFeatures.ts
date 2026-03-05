/**
 * AI Feature Hooks — Phase 5.3
 *
 * Provides AI integration interfaces and a local heuristic-based implementation.
 * The local provider works completely offline using rule-based classification,
 * proximity-based grouping, and descriptive label generation.
 *
 * Integration with App.tsx:
 *   const aiManager = createAIManager();
 *   aiManager.registerProvider(createLocalAIProvider());
 *   aiManager.setDefault('local-heuristic');
 *   // Pass to <AIAssistPanel aiManager={aiManager} annotations={...} ... />
 */

import type { Annotation } from '../types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ClassificationResult = {
  annotationId: string;
  category: string;
  confidence: number;
  suggestedLabels: string[];
};

export type GroupSuggestion = {
  name: string;
  annotationIds: string[];
  reason: string;
};

export type SmartLabel = {
  annotationId: string;
  suggestedLabel: string;
  basis: string;
};

export type AIProvider = {
  id: string;
  name: string;
  classify(annotations: Annotation[]): Promise<ClassificationResult[]>;
  suggestGroups(annotations: Annotation[]): Promise<GroupSuggestion[]>;
  generateLabels(annotations: Annotation[]): Promise<SmartLabel[]>;
};

// ---------------------------------------------------------------------------
// AIManager
// ---------------------------------------------------------------------------

export type AIManager = {
  registerProvider(provider: AIProvider): void;
  getProvider(id: string): AIProvider | undefined;
  setDefault(id: string): void;
  getDefault(): AIProvider | undefined;
  listProviders(): AIProvider[];
};

export function createAIManager(): AIManager {
  const providers = new Map<string, AIProvider>();
  let defaultId: string | null = null;

  return {
    registerProvider(provider: AIProvider) {
      providers.set(provider.id, provider);
      if (defaultId === null) {
        defaultId = provider.id;
      }
    },

    getProvider(id: string) {
      return providers.get(id);
    },

    setDefault(id: string) {
      if (!providers.has(id)) {
        throw new Error(`AI provider "${id}" is not registered.`);
      }
      defaultId = id;
    },

    getDefault() {
      return defaultId ? providers.get(defaultId) : undefined;
    },

    listProviders() {
      return Array.from(providers.values());
    },
  };
}

// ---------------------------------------------------------------------------
// Local heuristic AI provider
// ---------------------------------------------------------------------------

/**
 * Determines position zone based on normalized [0,1] coordinates.
 */
function getPositionZone(x: number, y: number): string {
  const vZone = y < 0.15 ? 'header' : y > 0.85 ? 'footer' : 'body';
  const hZone = x < 0.15 ? 'left-margin' : x > 0.85 ? 'right-margin' : 'center';

  if (vZone === 'header') return 'header';
  if (vZone === 'footer') return 'footer';
  if (hZone === 'left-margin' || hZone === 'right-margin') return 'margin';
  return 'body';
}

/**
 * Gets a representative x,y position for any annotation type.
 */
function getAnnotationPosition(a: Annotation): { x: number; y: number } {
  switch (a.type) {
    case 'pen':
    case 'polygon':
      if (a.points.length === 0) return { x: 0.5, y: 0.5 };
      return {
        x: a.points.reduce((s, p) => s + p.x, 0) / a.points.length,
        y: a.points.reduce((s, p) => s + p.y, 0) / a.points.length,
      };
    case 'rectangle':
    case 'highlight':
      return { x: a.x + a.width / 2, y: a.y + a.height / 2 };
    case 'text':
      return { x: a.x, y: a.y };
    case 'arrow':
    case 'measurement':
      return { x: (a.start.x + a.end.x) / 2, y: (a.start.y + a.end.y) / 2 };
    case 'callout':
      return { x: a.box.x + a.box.width / 2, y: a.box.y + a.box.height / 2 };
    case 'cloud':
      return { x: a.x + a.width / 2, y: a.y + a.height / 2 };
    case 'stamp':
    case 'ellipse':
    case 'hyperlink':
      return { x: a.x + a.width / 2, y: a.y + a.height / 2 };
    case 'area':
    case 'polyline':
      if (a.points.length === 0) return { x: 0.5, y: 0.5 };
      return {
        x: a.points.reduce((s, p) => s + p.x, 0) / a.points.length,
        y: a.points.reduce((s, p) => s + p.y, 0) / a.points.length,
      };
    case 'angle':
      return { x: a.vertex.x, y: a.vertex.y };
    case 'count':
      return { x: a.x, y: a.y };
    case 'dimension':
      return { x: (a.start.x + a.end.x) / 2, y: (a.start.y + a.end.y) / 2 };
  }
}

function categorizeByTypeAndPosition(a: Annotation): { category: string; labels: string[] } {
  const pos = getAnnotationPosition(a);
  const zone = getPositionZone(pos.x, pos.y);

  switch (a.type) {
    case 'text':
    case 'callout':
      if (zone === 'header') return { category: 'Title / Header Note', labels: ['title', 'header', 'label'] };
      if (zone === 'margin') return { category: 'Margin Note', labels: ['margin-note', 'comment', 'review'] };
      return { category: 'Body Note', labels: ['note', 'comment', 'annotation'] };
    case 'highlight':
      return { category: 'Highlight', labels: ['highlight', 'emphasis', 'review'] };
    case 'pen':
      return { category: 'Freehand Drawing', labels: ['sketch', 'markup', 'drawing'] };
    case 'arrow':
      return { category: 'Pointer', labels: ['pointer', 'callout', 'reference'] };
    case 'measurement':
      return { category: 'Measurement', labels: ['dimension', 'measurement', 'scale'] };
    case 'rectangle':
    case 'cloud':
      return { category: 'Area Markup', labels: ['area', 'region', 'markup'] };
    case 'polygon':
      return { category: 'Shape Markup', labels: ['shape', 'region', 'boundary'] };
    case 'stamp':
      return { category: 'Stamp', labels: ['stamp', 'status', 'approval'] };
    case 'ellipse':
      return { category: 'Area Markup', labels: ['ellipse', 'area', 'markup'] };
    case 'area':
      return { category: 'Area Measurement', labels: ['area', 'measurement', 'calculation'] };
    case 'angle':
      return { category: 'Angle Measurement', labels: ['angle', 'measurement', 'geometry'] };
    case 'count':
      return { category: 'Count Marker', labels: ['count', 'tally', 'quantity'] };
    case 'dimension':
      return { category: 'Dimension Line', labels: ['dimension', 'measurement', 'scale'] };
    case 'polyline':
      return { category: 'Polyline Markup', labels: ['polyline', 'path', 'markup'] };
    case 'hyperlink':
      return { category: 'Hyperlink', labels: ['link', 'navigation', 'reference'] };
  }
}

function euclideanDist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

export function createLocalAIProvider(): AIProvider {
  return {
    id: 'local-heuristic',
    name: 'Local Heuristic AI',

    async classify(annotations: Annotation[]): Promise<ClassificationResult[]> {
      return annotations.map((a) => {
        const { category, labels } = categorizeByTypeAndPosition(a);
        return {
          annotationId: a.id,
          category,
          confidence: 0.75,
          suggestedLabels: labels,
        };
      });
    },

    async suggestGroups(annotations: Annotation[]): Promise<GroupSuggestion[]> {
      const groups: GroupSuggestion[] = [];

      // Group by type
      const byType = new Map<string, Annotation[]>();
      for (const a of annotations) {
        const arr = byType.get(a.type) ?? [];
        arr.push(a);
        byType.set(a.type, arr);
      }
      for (const [type, items] of byType) {
        if (items.length >= 2) {
          groups.push({
            name: `${type} annotations`,
            annotationIds: items.map((a) => a.id),
            reason: `Grouped by type: ${type}`,
          });
        }
      }

      // Group by color
      const byColor = new Map<string, Annotation[]>();
      for (const a of annotations) {
        const arr = byColor.get(a.color) ?? [];
        arr.push(a);
        byColor.set(a.color, arr);
      }
      for (const [color, items] of byColor) {
        if (items.length >= 2) {
          groups.push({
            name: `Color group (${color})`,
            annotationIds: items.map((a) => a.id),
            reason: `Grouped by color: ${color}`,
          });
        }
      }

      // Group by proximity (simple clustering: within 0.1 normalized distance)
      const PROXIMITY_THRESHOLD = 0.1;
      const positions = annotations.map((a) => ({
        id: a.id,
        pos: getAnnotationPosition(a),
      }));

      const visited = new Set<string>();
      for (let i = 0; i < positions.length; i++) {
        if (visited.has(positions[i].id)) continue;
        const cluster = [positions[i].id];
        visited.add(positions[i].id);

        for (let j = i + 1; j < positions.length; j++) {
          if (visited.has(positions[j].id)) continue;
          if (euclideanDist(positions[i].pos, positions[j].pos) < PROXIMITY_THRESHOLD) {
            cluster.push(positions[j].id);
            visited.add(positions[j].id);
          }
        }

        if (cluster.length >= 2) {
          groups.push({
            name: `Nearby cluster`,
            annotationIds: cluster,
            reason: 'Grouped by proximity on the page',
          });
        }
      }

      return groups;
    },

    async generateLabels(annotations: Annotation[]): Promise<SmartLabel[]> {
      return annotations.map((a) => {
        const pos = getAnnotationPosition(a);
        const zone = getPositionZone(pos.x, pos.y);

        let label: string;
        let basis: string;

        switch (a.type) {
          case 'text':
            label = a.text.length > 20 ? a.text.slice(0, 20) + '...' : a.text;
            basis = `Text content in ${zone} area`;
            break;
          case 'callout':
            label = a.text.length > 20 ? a.text.slice(0, 20) + '...' : a.text;
            basis = `Callout in ${zone} area`;
            break;
          case 'highlight':
            label = `Highlight (${zone})`;
            basis = `Highlight region in ${zone}`;
            break;
          case 'measurement':
            label = `Measurement (${a.unit})`;
            basis = `${a.unit} measurement in ${zone}`;
            break;
          case 'stamp':
            label = a.label || 'Stamp';
            basis = `Stamp: ${a.stampId}`;
            break;
          case 'arrow':
            label = `Arrow (${zone})`;
            basis = `Arrow pointer in ${zone}`;
            break;
          default:
            label = `${a.type} (${zone})`;
            basis = `${a.type} annotation in ${zone} area`;
        }

        return {
          annotationId: a.id,
          suggestedLabel: label,
          basis,
        };
      });
    },
  };
}
