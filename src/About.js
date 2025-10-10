import React from 'react';
import { Button } from '@mui/material';
import { useOptionalFhir } from './OptionalFhir';
import config from './lib/config.js';
import { useLanguage } from './lib/LanguageContext';

import styles from './About.module.css';

export default function About({ setTab, tabValues }) {
  const { t } = useLanguage();
  const fhir = useOptionalFhir();

  const lnk = (text, url) => {
	return(<a href={url} target="_blank" rel="noreferrer">{text}</a>);
  }

  const renderTabButton = (tab, text) => {
	return(<p><Button variant='contained' onClick={ () => setTab(tab) }>{text}</Button></p>);
  }

  const commonsLink = lnk(t('aboutContent5'), "https://www.thecommonsproject.org/");
  const smartLink = lnk(t('aboutContent7'), "https://smarthealth.cards/");

  const srcLink = lnk(t('aboutContent3'),
					  "https://github.com/the-commons-project/shc-web-reader");

  const covidLink = lnk("COVID-19 vaccine cards",
						"https://smarthealth.cards/en/find-my-issuer.html");

  const ipsLink = lnk("International Patient Summaries",
					  "https://international-patient-summary.net/");



  return (
	<div className={styles.container}>

	  <div className={styles.cardImg}>
		<img src="shc.png" alt="SMART Health Card" style={{ width: "100%" }} />
	  </div>

	  <div className={styles.content} >
		<h1>{t('aboutSubtitle')}</h1>

		{ config("showScan") && renderTabButton(tabValues.Scan, "Use a 2D barcode scanner") }
		{ config("showPhoto") && renderTabButton(tabValues.Photo, t('photoDescriptionShort')) }
		{ config("showFile") && renderTabButton(tabValues.File, t('openFileText')) }
		{ config("showScan") && renderTabButton(tabValues.Scan, "Type or paste a code") }
		{ fhir && config("showSearch") && renderTabButton(tabValues.Search, "Find a code in patient record") }
	  </div>

	  <div className={styles.deets} >
		<p>
		  {t('aboutContent4')} {commonsLink}{t('aboutContent2')} {srcLink} {t('aboutContent6')} {smartLink}.
		  Supported data types currently include {covidLink}, general immunization
		  records, {ipsLink}, and Digital Health Insurance Cards.
		</p>
		<p>
		  If you would like to host the viewer yourself, contribute features or fixes
		  to the project, or have any other questions, please contact {commonsLink}.
		  {t('aboutPrivacy')}
		</p>
	  </div>
	</div>
  );
}

