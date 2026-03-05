/**
 * StorageBrowser — Phase 5.2
 *
 * File browser UI for the storage abstraction layer.
 *
 * Integration with App.tsx:
 *   Props:
 *     - storageManager: StorageManager — created via createStorageManager()
 *     - onFileSelect: (file: StorageFile, data: Uint8Array) => void — called when user picks a file
 *     - onClose: () => void — closes the browser panel
 *
 *   Example:
 *     <StorageBrowser
 *       storageManager={storageManager}
 *       onFileSelect={(file, data) => loadPdfFromData(data, file.name)}
 *       onClose={() => setShowBrowser(false)}
 *     />
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { StorageFile, StorageManager } from '../storage/storageProvider';

type StorageBrowserProps = {
  storageManager: StorageManager;
  onFileSelect: (file: StorageFile, data: Uint8Array) => void;
  onClose: () => void;
};

export default function StorageBrowser({ storageManager, onFileSelect, onClose }: StorageBrowserProps) {
  const [currentPath, setCurrentPath] = useState('/');
  const [files, setFiles] = useState<StorageFile[]>([]);
  const [providerId, setProviderId] = useState(() => storageManager.getDefault()?.id ?? '');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const providers = storageManager.listProviders();

  const loadFiles = useCallback(async (path: string) => {
    const provider = storageManager.getProvider(providerId);
    if (!provider) return;

    setLoading(true);
    setError(null);
    try {
      if (!provider.connected) {
        await provider.connect();
      }
      const listed = await provider.list(path);
      setFiles(listed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load files');
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [providerId, storageManager]);

  useEffect(() => {
    void loadFiles(currentPath);
  }, [currentPath, loadFiles]);

  const handleFileClick = useCallback(async (file: StorageFile) => {
    const provider = storageManager.getProvider(providerId);
    if (!provider) return;
    try {
      const data = await provider.read(file.path);
      onFileSelect(file, data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to read file');
    }
  }, [providerId, storageManager, onFileSelect]);

  const handleDelete = useCallback(async (path: string) => {
    const provider = storageManager.getProvider(providerId);
    if (!provider) return;
    try {
      await provider.delete(path);
      setDeleteConfirm(null);
      void loadFiles(currentPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete file');
    }
  }, [providerId, storageManager, currentPath, loadFiles]);

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const provider = storageManager.getProvider(providerId);
    if (!provider) return;

    try {
      const buffer = await file.arrayBuffer();
      const data = new Uint8Array(buffer);
      const path = currentPath === '/' ? `/${file.name}` : `${currentPath}/${file.name}`;
      await provider.write(path, data, file.type || 'application/octet-stream');
      void loadFiles(currentPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload file');
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [providerId, storageManager, currentPath, loadFiles]);

  const breadcrumbs = currentPath === '/'
    ? ['/']
    : ['/', ...currentPath.split('/').filter(Boolean)];

  const handleBreadcrumb = (index: number) => {
    if (index === 0) {
      setCurrentPath('/');
    } else {
      const path = '/' + breadcrumbs.slice(1, index + 1).join('/');
      setCurrentPath(path);
    }
  };

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div className="storage-browser" style={{
      position: 'fixed', top: 0, right: 0, width: 400, height: '100vh',
      background: '#fff', borderLeft: '1px solid #ddd', zIndex: 1000,
      display: 'flex', flexDirection: 'column', fontFamily: 'sans-serif',
    }}>
      {/* Header */}
      <div style={{ padding: 12, borderBottom: '1px solid #ddd', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong>Storage Browser</strong>
        <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 18 }} aria-label="Close">X</button>
      </div>

      {/* Provider selector */}
      {providers.length > 1 && (
        <div style={{ padding: '8px 12px', borderBottom: '1px solid #eee' }}>
          <label htmlFor="provider-select">Provider: </label>
          <select
            id="provider-select"
            value={providerId}
            onChange={(e) => {
              setProviderId(e.target.value);
              setCurrentPath('/');
            }}
          >
            {providers.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Breadcrumbs */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid #eee', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {breadcrumbs.map((crumb, i) => (
          <span key={i}>
            {i > 0 && <span style={{ margin: '0 2px' }}>/</span>}
            <button
              onClick={() => handleBreadcrumb(i)}
              style={{
                border: 'none', background: 'none', cursor: 'pointer',
                color: i === breadcrumbs.length - 1 ? '#333' : '#0066cc',
                fontWeight: i === breadcrumbs.length - 1 ? 'bold' : 'normal',
                padding: '2px 4px',
              }}
            >
              {crumb === '/' ? 'Root' : crumb}
            </button>
          </span>
        ))}
      </div>

      {/* Upload */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid #eee' }}>
        <input
          ref={fileInputRef}
          type="file"
          onChange={(e) => void handleUpload(e)}
          style={{ display: 'none' }}
          aria-label="Upload file"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          style={{ padding: '6px 12px', cursor: 'pointer' }}
        >
          Upload File
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: '8px 12px', color: '#cc0000', background: '#fff0f0', borderBottom: '1px solid #eee' }}>
          {error}
        </div>
      )}

      {/* File list */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {loading && <div style={{ padding: 12, color: '#999' }}>Loading...</div>}
        {!loading && files.length === 0 && (
          <div style={{ padding: 12, color: '#999' }}>No files found.</div>
        )}
        {files.map((file) => (
          <div
            key={file.path}
            style={{
              padding: '8px 12px', borderBottom: '1px solid #f0f0f0',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}
          >
            <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => void handleFileClick(file)}>
              <div style={{ fontWeight: 500 }}>{file.name}</div>
              <div style={{ fontSize: 12, color: '#888' }}>
                {formatSize(file.size)} | {new Date(file.lastModified).toLocaleDateString()}
              </div>
            </div>
            <div>
              {deleteConfirm === file.path ? (
                <span>
                  <button
                    onClick={() => void handleDelete(file.path)}
                    style={{ color: '#cc0000', border: 'none', background: 'none', cursor: 'pointer', marginRight: 4 }}
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(null)}
                    style={{ border: 'none', background: 'none', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                </span>
              ) : (
                <button
                  onClick={() => setDeleteConfirm(file.path)}
                  style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#cc0000' }}
                  aria-label={`Delete ${file.name}`}
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
