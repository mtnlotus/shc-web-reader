import React, { useState } from 'react';
import DocumentList from './DocumentList.js';
import DocumentModal from './DocumentModal.js';
import { extractDocumentsFromBundle } from './lib/documentUtils.js';

/**
 * Standalone documents section that can be used for any bundle type.
 * Extracts and displays DocumentReference and DiagnosticReport resources with embedded data.
 */
export default function DocumentsSection({ organized }) {
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Extract embedded documents from the bundle
  const documents = extractDocumentsFromBundle(organized);

  // Don't render if no documents
  if (!documents || documents.length === 0) {
    return null;
  }

  const handleNavigate = (direction) => {
    const idx = documents.findIndex(d => d.id === selectedDocument?.id);
    const newIdx = direction === 'next' ? idx + 1 : idx - 1;
    if (newIdx >= 0 && newIdx < documents.length) {
      setSelectedDocument(documents[newIdx]);
    }
  };

  return (
    <div style={{ marginTop: '24px' }}>
      <h3 style={{ marginBottom: '16px' }}>Documents ({documents.length})</h3>
      <DocumentList
        documents={documents}
        onViewDocument={(doc) => {
          setSelectedDocument(doc);
          setModalOpen(true);
        }}
      />
      <DocumentModal
        document={selectedDocument}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        documents={documents}
        onNavigate={handleNavigate}
      />
    </div>
  );
}
