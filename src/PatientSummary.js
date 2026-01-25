import React, { useState } from 'react';
import * as futil from './lib/fhirUtil.js';
import PatientSummarySection from './PatientSummarySection.js';
import DocumentList from './DocumentList.js';
import DocumentModal from './DocumentModal.js';
import { extractDocumentsFromBundle } from './lib/documentUtils.js';
import styles from './PatientSummary.module.css';
import IFrameSandbox from './IFrameSandbox.js';
import DOMPurify from 'dompurify';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';

export default function PatientSummary({ organized, dcr }) {
  // +----------------+
  // | Document State |
  // +----------------+
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState({});

  // Extract embedded documents from the bundle
  const documents = extractDocumentsFromBundle(organized);

  // Toggle section collapse state
  const toggleSection = (sectionKey) => {
    setCollapsedSections(prev => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }));
  };

  // +-------------+
  // | Main Render |
  // +-------------+
  const comp = organized.byType.Composition[0];
  const rmap = organized.byId;

  const authors = comp.author.map((a, idx) => (
    <React.Fragment key={`author-${idx}`}>
      {futil.renderOrgOrPerson(a, rmap)}
    </React.Fragment>
  ));
  const compositionDivTextContent = comp.text && comp.text.div ? comp.text.div : '';

  const handleNavigate = (direction) => {
    const idx = documents.findIndex(d => d.id === selectedDocument?.id);
    const newIdx = direction === 'next' ? idx + 1 : idx - 1;
    if (newIdx >= 0 && newIdx < documents.length) {
      setSelectedDocument(documents[newIdx]);
    }
  };

  // +------------------+
  // | Section Renderer |
  // +------------------+
  const renderSection = (sectionKey, title, content, keyPrefix) => {
    const isCollapsed = collapsedSections[sectionKey];

    return (
      <React.Fragment key={keyPrefix}>
        <div
          className={isCollapsed ? styles.sectionTitleCollapsed : styles.sectionTitle}
          onClick={() => toggleSection(sectionKey)}
        >
          <span className={styles.sectionTitleText}>{title}</span>
          <span className={styles.collapseIcon}>
            {isCollapsed ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
          </span>
        </div>
        <div className={isCollapsed ? styles.collapsedContent : styles.sectionContent}>
          {!isCollapsed && content}
        </div>
      </React.Fragment>
    );
  };

  return (
    <div className={styles.container}>
      <h2>{comp.title}</h2>
      <div className={styles.dataTable}>
        {/* Patient Section */}
        {renderSection(
          'Patient',
          'Patient',
          <span className={styles.patCell}>{futil.renderPerson(comp.subject, rmap)}</span>,
          'row-patient'
        )}

        {/* Dynamic Composition Sections */}
        {comp.section.map((s, index) => (
          renderSection(
            s.title,
            s.title,
            <PatientSummarySection s={s} rmap={rmap} dcr={dcr} />,
            `row-section-${index}`
          )
        ))}

        {/* Documents Section */}
        {documents && documents.length > 0 && renderSection(
          'Documents',
          `Documents (${documents.length})`,
          <DocumentList
            documents={documents}
            onViewDocument={(doc) => {
              setSelectedDocument(doc);
              setModalOpen(true);
            }}
          />,
          'row-documents'
        )}

        {/* Composition Section */}
        {compositionDivTextContent && renderSection(
          'Composition',
          'Composition',
          <IFrameSandbox html={DOMPurify.sanitize(compositionDivTextContent)} />,
          'row-composition'
        )}

        {/* Summary By Section */}
        {renderSection(
          'SummaryBy',
          'Summary prepared by',
          authors,
          'row-summaryby'
        )}
      </div>

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
