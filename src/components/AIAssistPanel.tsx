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
  onGroupAnnotations: _onGroupAnnotations,
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
      <div className="ai-assist-panel">
        <p>No AI provider configured.</p>
      </div>
    );
  }

  return (
    <div className="ai-assist-panel">
      <h3>AI Assist</h3>

      {error && (
        <div className="ai-assist-error">{error}</div>
      )}

      <div className="ai-assist-actions">
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

      {loading && (
        <div className="ai-assist-loading">
          <span className="kpdf-spinner" />Processing…
        </div>
      )}

      {classifications.length > 0 && (
        <div className="ai-assist-section">
          <h4>Classifications</h4>
          {classifications.map((c) => (
            <div key={c.annotationId} className="ai-assist-classification-card">
              <div><strong>{c.category}</strong> ({(c.confidence * 100).toFixed(0)}%)</div>
              <div className="ai-assist-card-meta">
                Labels: {c.suggestedLabels.join(', ')}
              </div>
            </div>
          ))}
        </div>
      )}

      {groups.length > 0 && (
        <div className="ai-assist-section">
          <h4>Suggested Groups</h4>
          {groups.map((g, i) => (
            <div key={i} className={`ai-assist-group-card${rejectedGroups.has(i) ? ' rejected' : ''}`}>
              <div className="ai-assist-card-row">
                <strong>{g.name}</strong>
                <span className="ai-assist-card-actions">
                  <button onClick={() => toggleGroupReject(i)}>
                    {rejectedGroups.has(i) ? 'Undo' : 'Reject'}
                  </button>
                </span>
              </div>
              <div className="ai-assist-card-meta">
                {g.reason} ({g.annotationIds.length} items)
              </div>
            </div>
          ))}
        </div>
      )}

      {labels.length > 0 && (
        <div className="ai-assist-section">
          <h4>Auto-Labels</h4>
          {labels.map((l) => (
            <div key={l.annotationId} className={`ai-assist-label-card${rejectedLabels.has(l.annotationId) ? ' rejected' : ''}`}>
              <div className="ai-assist-card-row">
                <strong>{l.suggestedLabel}</strong>
                <button onClick={() => toggleLabelReject(l.annotationId)}>
                  {rejectedLabels.has(l.annotationId) ? 'Undo' : 'Reject'}
                </button>
              </div>
              <div className="ai-assist-card-meta">{l.basis}</div>
            </div>
          ))}
          <button onClick={acceptLabels} className="ai-assist-apply-btn">
            Apply Accepted Labels
          </button>
        </div>
      )}
    </div>
  );
}
