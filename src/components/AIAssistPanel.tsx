/**
 * AIAssistPanel — Phase 5.3
 *
 * Panel providing AI-assisted annotation features: classification, group
 * suggestions, and auto-labeling.
 *
 * Integration with App.tsx:
 *   Props:
 *     - annotations: Annotation[] — annotations for the current page
 *     - aiManager: AIManager — created via createAIManager() with provider registered
 *     - onApplyLabels: (labels: SmartLabel[]) => void — apply accepted labels to annotations
 *     - onGroupAnnotations: (group: GroupSuggestion) => void — apply a grouping action
 *
 *   Example:
 *     <AIAssistPanel
 *       annotations={currentPageAnnotations}
 *       aiManager={aiManager}
 *       onApplyLabels={(labels) => { ... dispatch label updates ... }}
 *       onGroupAnnotations={(group) => { ... handle group ... }}
 *     />
 */

import { useCallback, useState } from 'react';
import type { Annotation } from '../types';
import type { AIManager, ClassificationResult, GroupSuggestion, SmartLabel } from '../ai/aiFeatures';

type AIAssistPanelProps = {
  annotations: Annotation[];
  aiManager: AIManager;
  onApplyLabels: (labels: SmartLabel[]) => void;
  onGroupAnnotations: (group: GroupSuggestion) => void;
};

export default function AIAssistPanel({
  annotations,
  aiManager,
  onApplyLabels,
  onGroupAnnotations,
}: AIAssistPanelProps) {
  const [classifications, setClassifications] = useState<ClassificationResult[]>([]);
  const [groups, setGroups] = useState<GroupSuggestion[]>([]);
  const [labels, setLabels] = useState<SmartLabel[]>([]);
  const [rejectedLabels, setRejectedLabels] = useState<Set<string>>(new Set());
  const [rejectedGroups, setRejectedGroups] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const provider = aiManager.getDefault();

  const handleClassify = useCallback(async () => {
    if (!provider) return;
    setLoading(true);
    setError(null);
    try {
      const results = await provider.classify(annotations);
      setClassifications(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Classification failed');
    } finally {
      setLoading(false);
    }
  }, [provider, annotations]);

  const handleSuggestGroups = useCallback(async () => {
    if (!provider) return;
    setLoading(true);
    setError(null);
    try {
      const results = await provider.suggestGroups(annotations);
      setGroups(results);
      setRejectedGroups(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Group suggestion failed');
    } finally {
      setLoading(false);
    }
  }, [provider, annotations]);

  const handleAutoLabel = useCallback(async () => {
    if (!provider) return;
    setLoading(true);
    setError(null);
    try {
      const results = await provider.generateLabels(annotations);
      setLabels(results);
      setRejectedLabels(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Label generation failed');
    } finally {
      setLoading(false);
    }
  }, [provider, annotations]);

  const acceptLabels = useCallback(() => {
    const accepted = labels.filter((l) => !rejectedLabels.has(l.annotationId));
    onApplyLabels(accepted);
  }, [labels, rejectedLabels, onApplyLabels]);

  const toggleLabelReject = useCallback((annotationId: string) => {
    setRejectedLabels((prev) => {
      const next = new Set(prev);
      if (next.has(annotationId)) {
        next.delete(annotationId);
      } else {
        next.add(annotationId);
      }
      return next;
    });
  }, []);

  const toggleGroupReject = useCallback((index: number) => {
    setRejectedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  if (!provider) {
    return (
      <div className="ai-assist-panel" style={{ padding: 12 }}>
        <p>No AI provider configured.</p>
      </div>
    );
  }

  return (
    <div className="ai-assist-panel" style={{
      padding: 12, fontFamily: 'sans-serif', maxHeight: '100vh', overflow: 'auto',
    }}>
      <h3 style={{ margin: '0 0 12px' }}>AI Assist</h3>

      {error && (
        <div style={{ color: '#cc0000', marginBottom: 8, padding: 8, background: '#fff0f0', borderRadius: 4 }}>
          {error}
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <button onClick={() => void handleClassify()} disabled={loading || annotations.length === 0}>
          Classify
        </button>
        <button onClick={() => void handleSuggestGroups()} disabled={loading || annotations.length === 0}>
          Suggest Groups
        </button>
        <button onClick={() => void handleAutoLabel()} disabled={loading || annotations.length === 0}>
          Auto-Label
        </button>
      </div>

      {loading && <div style={{ color: '#999', marginBottom: 12 }}>Processing...</div>}

      {/* Classifications */}
      {classifications.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <h4 style={{ margin: '0 0 8px' }}>Classifications</h4>
          {classifications.map((c) => (
            <div key={c.annotationId} style={{
              padding: 8, marginBottom: 4, background: '#f8f8f8', borderRadius: 4,
            }}>
              <div><strong>{c.category}</strong> ({(c.confidence * 100).toFixed(0)}%)</div>
              <div style={{ fontSize: 12, color: '#666' }}>
                ID: {c.annotationId.slice(0, 8)}... | Labels: {c.suggestedLabels.join(', ')}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Group suggestions */}
      {groups.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <h4 style={{ margin: '0 0 8px' }}>Suggested Groups</h4>
          {groups.map((g, i) => (
            <div key={i} style={{
              padding: 8, marginBottom: 4, background: rejectedGroups.has(i) ? '#f0f0f0' : '#f0f8ff', borderRadius: 4,
              opacity: rejectedGroups.has(i) ? 0.5 : 1,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong>{g.name}</strong>
                <span style={{ display: 'flex', gap: 4 }}>
                  {!rejectedGroups.has(i) && (
                    <button onClick={() => onGroupAnnotations(g)} style={{ fontSize: 12 }}>
                      Accept
                    </button>
                  )}
                  <button onClick={() => toggleGroupReject(i)} style={{ fontSize: 12 }}>
                    {rejectedGroups.has(i) ? 'Undo' : 'Reject'}
                  </button>
                </span>
              </div>
              <div style={{ fontSize: 12, color: '#666' }}>
                {g.reason} ({g.annotationIds.length} items)
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Smart labels */}
      {labels.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <h4 style={{ margin: '0 0 8px' }}>Auto-Labels</h4>
          {labels.map((l) => (
            <div key={l.annotationId} style={{
              padding: 8, marginBottom: 4, background: rejectedLabels.has(l.annotationId) ? '#f0f0f0' : '#f0fff0', borderRadius: 4,
              opacity: rejectedLabels.has(l.annotationId) ? 0.5 : 1,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong>{l.suggestedLabel}</strong>
                <button onClick={() => toggleLabelReject(l.annotationId)} style={{ fontSize: 12 }}>
                  {rejectedLabels.has(l.annotationId) ? 'Undo' : 'Reject'}
                </button>
              </div>
              <div style={{ fontSize: 12, color: '#666' }}>
                {l.basis} (ID: {l.annotationId.slice(0, 8)}...)
              </div>
            </div>
          ))}
          <button onClick={acceptLabels} style={{ marginTop: 8 }}>
            Apply Accepted Labels
          </button>
        </div>
      )}
    </div>
  );
}
