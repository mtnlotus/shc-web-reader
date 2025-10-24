import * as futil from './lib/fhirUtil.js';
import PatientSummarySection from './PatientSummarySection.js';
import styles from './PatientSummary.module.css';
import IFrameSandbox from './IFrameSandbox.js';
import DOMPurify from 'dompurify';
import { useLanguage } from './lib/LanguageContext';

export default function PatientSummary({ organized, dcr }) {
  const { t } = useLanguage();

  // +----------------+
  // | renderSections |
  // +----------------+
  const renderSections = () => {
    return comp.section.flatMap((s) => {
      return [
        <div key={`${s.title}-title`} className={styles.sectionTitle}>
          {s.title}
        </div>,
        <div key={`${s.title}-content`} className={styles.sectionContent}>
          <PatientSummarySection s={s} rmap={rmap} dcr={dcr} />
        </div>
      ];
    });
  };

  // +-------------+
  // | Main Render |
  // +-------------+
  const comp = organized.byType.Composition[0];
  const rmap = organized.byId;

  const authors = comp.author.map((a) => futil.renderOrgOrPerson(a, rmap));
  const compositionDivTextContent = comp.text && comp.text.div ? comp.text.div : '';

  // Conditionally render Composition row
  const compositionRow = compositionDivTextContent ? (
    <>
      <div className={styles.sectionTitle}>{t('composition')}</div>
      <div>
        <IFrameSandbox html={DOMPurify.sanitize(compositionDivTextContent)} />
      </div>
    </>
  ) : null;

  return (
    <div className={styles.container}>
      <h2>{comp.title}</h2>
      <div className={styles.dataTable}>
        <div className={styles.sectionTitle}>{t('patient')}</div>
        <div className={styles.patCell}>{futil.renderPerson(comp.subject, rmap)}</div>

        {renderSections()}

        {compositionRow}
        <div className={styles.sectionTitle}>{t('summaryPreparedBy')}</div>
        <div>{authors}</div>
      </div>
    </div>
  );
}




