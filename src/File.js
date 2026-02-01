import { useLanguage } from './lib/LanguageContext';

export default function File({ viewData }) {
  const { t } = useLanguage();

  const handleFileChange = async (evt) => {
	const reader = new FileReader();
	reader.onload = (evtRead) => { viewData(evtRead.target.result); }
	reader.readAsText(evt.target.files[0]);
  }

  return (
	<div>
	  <h1>{t('fileTitle')}</h1>

	  <input id="file"
			 type="file"
			 accept=".json,.fhir,.smart-health-card"
			 onChange={handleFileChange} />

	  <p>{t('fileDescription')}</p>

	</div>
  );
}
