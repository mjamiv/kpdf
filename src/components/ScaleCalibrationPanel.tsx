import { useState } from 'react';
import type { PageScale } from '../types';

type Props = {
  visible: boolean;
  currentScale: PageScale | null;
  onCalibrate: (scale: PageScale) => void;
  onClear: () => void;
  onClose: () => void;
};

const UNITS = ['ft', 'in', 'm', 'cm', 'mm', 'yd'];

export default function ScaleCalibrationPanel({ visible, currentScale, onCalibrate, onClear, onClose }: Props) {
  const [pixelDistance, setPixelDistance] = useState('');
  const [realDistance, setRealDistance] = useState('');
  const [unit, setUnit] = useState('ft');

  if (!visible) return null;

  const handleApply = () => {
    const pd = parseFloat(pixelDistance);
    const rd = parseFloat(realDistance);
    if (pd > 0 && rd > 0) {
      onCalibrate({ pixelDistance: pd, realDistance: rd, unit });
      setPixelDistance('');
      setRealDistance('');
    }
  };

  return (
    <div className="scale-calibration-panel" role="dialog" aria-label="Scale calibration">
      <div className="panel-header">
        <h3>Scale Calibration</h3>
        <button className="close-btn" onClick={onClose} aria-label="Close">&times;</button>
      </div>
      <div className="panel-body">
        {currentScale ? (
          <div className="current-scale">
            <p>Current scale: {currentScale.pixelDistance.toFixed(4)} normalized = {currentScale.realDistance} {currentScale.unit}</p>
            <button onClick={onClear}>Clear Scale</button>
          </div>
        ) : (
          <p className="hint">Use the Measurement tool (M) to draw a known distance on the PDF, then enter the real-world value below.</p>
        )}
        <div className="calibration-form">
          <label>
            Measured distance (normalized):
            <input
              type="number"
              step="any"
              min="0"
              value={pixelDistance}
              onChange={(e) => setPixelDistance(e.target.value)}
              placeholder="e.g. 0.25"
            />
          </label>
          <label>
            Real-world distance:
            <input
              type="number"
              step="any"
              min="0"
              value={realDistance}
              onChange={(e) => setRealDistance(e.target.value)}
              placeholder="e.g. 10"
            />
          </label>
          <label>
            Unit:
            <select value={unit} onChange={(e) => setUnit(e.target.value)}>
              {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </label>
          <button className="btn-primary" onClick={handleApply}>Set Scale</button>
        </div>
      </div>
    </div>
  );
}
