import type { LegalTexts } from "./types";

export const de: LegalTexts = {
  privacy: {
    title: "Datenschutzerklärung",
    intro:
      "Diese Erklärung beschreibt, welche personenbezogenen Daten {app} verarbeitet, zu welchem Zweck und welche Rechte Sie haben. Kurz gesagt: Das meiste, was Sie eingeben, bleibt auf Ihrem Gerät. Unsere Server sehen nur, was nötig ist, um Ihre Fragen zu beantworten, die Gemeinschaft zu betreiben und – wenn Sie es einschalten – eine verschlüsselte Kopie Ihres Plans aufzubewahren, die wir nicht lesen können. Es gibt keine Werbung, kein Tracking und keinen Verkauf von Daten.",
    sections: [
      {
        h: "Verantwortliche Stelle",
        p: [
          "Verantwortlich im Sinne der Datenschutz-Grundverordnung (DSGVO) ist {operator}, {address}. E-Mail: {email}.",
          "Datenschutzbeauftragte(r): {dpo}.",
        ],
      },
      {
        h: "Angaben zu Ihrer Gesundheit",
        p: [
          "Angaben wie Ihr Weg, eine Krebsart, Ihre Behandlungsphase oder das, was Sie in der Gemeinschaft schreiben, sind Gesundheitsdaten und damit besondere Kategorien personenbezogener Daten (Art. 9 DSGVO). Unsere Server erhalten sie nur, wenn Sie das selbst wählen: indem Sie eine Frage stellen, der Gemeinschaft beitreten oder die Synchronisierung einschalten. Rechtsgrundlage ist jeweils Ihre ausdrückliche Einwilligung (Art. 9 Abs. 2 lit. a DSGVO). Sie können sie jederzeit mit Wirkung für die Zukunft widerrufen, zum Beispiel indem Sie die Daten wie unten beschrieben löschen.",
        ],
      },
      {
        h: "Was auf Ihrem Gerät bleibt",
        p: [
          "Ihr Profil (Ihr Weg, Altersgruppe, Geschlecht, Krebsarten, Behandlungsphase, Land), Ihr Plan und Ihre Häkchen, Ihre Antworten im Lebensstil-Check, Fragen für Arzttermine, Erinnerungseinstellungen, Unterhaltungen, Schrittzahlen, heruntergeladene Erkenntnisse sowie Sprach- und Anzeigeeinstellungen werden nur auf Ihrem Gerät gespeichert. Wir können sie nicht sehen.",
          "Sie können sie jederzeit mit „Meine Daten von diesem Gerät löschen“ entfernen. Auch wenn Sie die App deinstallieren oder die Websitedaten in Ihrem Browser löschen, werden sie gelöscht.",
        ],
      },
      {
        h: "Ihre Fragen",
        p: [
          "Wenn Sie eine Frage stellen, wird sie zusammen mit den vorherigen Nachrichten derselben Unterhaltung und den Profilangaben, die Sie teilen möchten, an unseren Server gesendet, damit wir Belege finden und eine Antwort schreiben können. Das geschieht nur im Arbeitsspeicher: Fragen und Antworten werden nicht gespeichert.",
          "Die Antworten schreibt ein Sprachmodell, das wir selbst betreiben, auf den unter „Empfänger und Auftragsverarbeiter“ genannten Servern. Ihre Frage wird nicht an einen externen KI-Anbieter weitergegeben.",
          "Rechtsgrundlage: die Erbringung des von Ihnen gewünschten Dienstes (Art. 6 Abs. 1 lit. b DSGVO) und, für Angaben zu Ihrer Gesundheit, Ihre ausdrückliche Einwilligung (Art. 9 Abs. 2 lit. a DSGVO).",
        ],
      },
      {
        h: "Rückmeldungen",
        p: [
          "Wenn Sie eine Antwort oder eine Erkenntnis bewerten, speichern wir Ihre Bewertung, die gewählten Gründe und Ihren freiwilligen Kommentar; persönliche Angaben werden automatisch entfernt. Wir nutzen das, um Fehler zu finden und zu korrigieren, und bewahren es 12 Monate auf. Rechtsgrundlage: unser berechtigtes Interesse an richtigen und sicheren Informationen (Art. 6 Abs. 1 lit. f DSGVO).",
        ],
      },
      {
        h: "Die Gemeinschaft",
        p: [
          "Der Beitritt zur Gemeinschaft ist freiwillig und erst ab 18 Jahren möglich. Wir speichern:",
          "• den von Ihnen gewählten Spitznamen, Ihre Sprache und, falls Sie eines wählen, ein Weg-Abzeichen;",
          "• Ihre Beiträge und Antworten, Ihre Reaktionen, Meldungen, die von Ihnen blockierten Mitglieder und etwaige Einsprüche;",
          "• einen Fingerabdruck (Hash) des zufälligen Zugangsschlüssels, der auf Ihrem Gerät liegt. Wir fragen nie nach Ihrem Namen, Ihrer E-Mail-Adresse oder Telefonnummer.",
          "Jeder Beitrag wird vor der Veröffentlichung automatisch geprüft, und geschulte Moderatorinnen und Moderatoren bearbeiten Meldungen. Entfernte Beiträge werden nach 90 Tagen gelöscht.",
          "Rechtsgrundlage: Ihre ausdrückliche Einwilligung beim Beitritt (Art. 9 Abs. 2 lit. a DSGVO). In der App können Sie alle Ihre Gemeinschaftsdaten herunterladen und die Gemeinschaft jederzeit verlassen. Dabei werden Ihre Mitgliedschaft und Ihre Beiträge gelöscht.",
          "Wenn Sie die freiwillige Frage „Haben Sie sich hier diesen Monat unterstützt gefühlt?“ beantworten, bewahren wir Ihre Antwort 12 Monate auf; beim Verlassen der Gemeinschaft wird sie von Ihrer Mitgliedschaft getrennt. Für den öffentlichen Transparenzbericht bewahren wir anonyme Moderationszahlen auf: nur Anzahlen, ohne Mitglieder oder Texte.",
        ],
      },
      {
        h: "Verschlüsselte Synchronisierung (freiwillig)",
        p: [
          "Wenn Sie die Synchronisierung einschalten, werden Ihr Plan und Ihr Profil auf Ihrem Gerät mit einem Schlüssel verschlüsselt, der aus Ihrem Synchronisierungscode abgeleitet wird. Unser Server speichert nur die verschlüsselten Daten, eine Versionsnummer und einen Fingerabdruck eines Schreibschlüssels: Wir können Ihre Daten nicht lesen und wissen nicht, wer Sie sind. Die Kopie wird gelöscht, wenn Sie die Synchronisierung ausschalten, oder nach 400 Tagen ohne Änderung. Rechtsgrundlage: Ihre ausdrückliche Einwilligung (Art. 9 Abs. 2 lit. a DSGVO).",
        ],
      },
      {
        h: "Schrittzahlen, Gesundheits-Apps und Erinnerungen",
        p: [
          "Schrittzahlen werden auf Ihrem Telefon gelesen: vom Bewegungssensor oder, wenn Sie es einschalten, aus Apple Health oder Health Connect (nur lesend, die täglichen Schrittsummen der letzten 7 Tage). Wöchentliche Erinnerungen plant Ihr Telefon oder sie werden in Ihrem eigenen Kalender gespeichert. Nichts davon wird an uns gesendet.",
        ],
      },
      {
        h: "Technische Daten und Sicherheit",
        p: [
          "Um Seiten und Antworten auszuliefern, verarbeiten unsere Server zwangsläufig Ihre IP-Adresse und technische Angaben zu jeder Anfrage, etwa den Browsertyp. IP-Adressen werden zur Abwehr von Missbrauch einige Minuten im Arbeitsspeicher gehalten und nicht in unsere Protokolle geschrieben. Unsere Protokolle erfassen Zeitpunkt, verwendete Funktion, Ergebnis und Dauer jeder Anfrage und werden 30 Tage aufbewahrt. Rechtsgrundlage: unser berechtigtes Interesse an einem sicheren und zuverlässigen Dienst (Art. 6 Abs. 1 lit. f DSGVO).",
          "Alle Verbindungen sind verschlüsselt (TLS).",
        ],
      },
      {
        h: "Cookies und Speicherung auf Ihrem Gerät",
        p: [
          "Wir verwenden keine Werbe- oder Tracking-Cookies und keine Analysewerkzeuge. Die Website speichert Ihre Sprachwahl in einem Cookie sowie Ihre Einstellungen und Inhalte im lokalen Speicher Ihres Browsers. Das ist unbedingt erforderlich, um den von Ihnen gewünschten Dienst bereitzustellen (§ 25 Abs. 2 Nr. 2 TDDDG); ein Einwilligungsbanner ist daher nicht nötig.",
        ],
      },
      {
        h: "Empfänger und Auftragsverarbeiter",
        p: [
          "{hosting}",
          "Unsere Dienstleister verarbeiten Daten nur nach unserer Weisung und auf Grundlage von Verträgen zur Auftragsverarbeitung (Art. 28 DSGVO). Die Verarbeitung erfolgt in der Europäischen Union oder im Europäischen Wirtschaftsraum. Wir verkaufen keine Daten und geben sie nicht für Werbezwecke weiter.",
          "Beiträge in der Gemeinschaft können von anderen Mitgliedern gelesen werden.",
        ],
      },
      {
        h: "Speicherdauer",
        p: [
          "• Daten auf Ihrem Gerät: bis Sie sie löschen.",
          "• Fragen und Antworten: werden nicht gespeichert.",
          "• Rückmeldungen: 12 Monate.",
          "• Gemeinschaft: bis Sie sie verlassen; entfernte Beiträge 90 Tage; Antworten auf die Umfrage 12 Monate.",
          "• Verschlüsselte Synchronisierung: bis Sie sie ausschalten, höchstens 400 Tage nach der letzten Änderung.",
          "• Protokolle: 30 Tage.",
        ],
      },
      {
        h: "Ihre Rechte",
        p: [
          "Sie haben das Recht auf Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18) und Datenübertragbarkeit (Art. 20) sowie das Recht, einer Verarbeitung auf Grundlage unserer berechtigten Interessen zu widersprechen (Art. 21). Eine Einwilligung können Sie jederzeit widerrufen (Art. 7 Abs. 3); die Rechtmäßigkeit der Verarbeitung bis zum Widerruf bleibt davon unberührt.",
          "Viele dieser Rechte können Sie direkt in der App ausüben: Gemeinschaftsdaten herunterladen oder löschen, die Synchronisierung ausschalten oder die Daten auf Ihrem Gerät löschen. Da wir nicht wissen, wer Sie sind, bitten wir Sie gegebenenfalls nachzuweisen, dass Daten zu Ihnen gehören, zum Beispiel mit dem Download Ihrer Gemeinschaftsdaten. Für alles Weitere schreiben Sie an {email}.",
          "Sie haben außerdem das Recht, sich bei einer Datenschutz-Aufsichtsbehörde zu beschweren (Art. 77 DSGVO), insbesondere in dem Land, in dem Sie leben oder arbeiten. Für uns zuständig ist: {authority}.",
        ],
      },
      {
        h: "Automatisierte Entscheidungen und künstliche Intelligenz",
        p: [
          "Wir treffen keine Entscheidungen über Sie, die rechtliche Wirkung entfalten oder Sie in ähnlicher Weise erheblich beeinträchtigen (Art. 22 DSGVO). Antworten und Erkenntnisse werden mit künstlicher Intelligenz aus veröffentlichter Forschung erstellt. Sie sind allgemeine Informationen und keine ärztliche Beratung.",
        ],
      },
      {
        h: "Änderungen dieser Erklärung",
        p: [
          "Wir passen diese Erklärung an, wenn sich unsere Verarbeitung ändert. Das Datum oben zeigt die aktuelle Fassung. Betrifft eine Änderung Daten, die Sie uns bereits gegeben haben, informieren wir Sie in der App.",
        ],
      },
    ],
  },
  terms: {
    title: "Nutzungsbedingungen",
    intro:
      "Diese Bedingungen gelten, wenn Sie {app} im Web oder in der App nutzen. {app} wird von {operator} („wir“) angeboten. Bitte lesen Sie sie zusammen mit der Datenschutzerklärung und, wenn Sie der Gemeinschaft beitreten, den Gemeinschaftsregeln.",
    sections: [
      {
        h: "Was {app} ist – und was nicht",
        p: [
          "{app} bietet allgemeine, evidenzbasierte Informationen zu Lebensstil, Krebsvorbeugung und dem Leben mit und nach Krebs sowie einen moderierten Raum, in dem sich Menschen gegenseitig unterstützen. Das Angebot richtet sich an Erwachsene.",
          "{app} ist kein medizinischer Dienst. Es stellt keine Diagnosen, behandelt oder überwacht keine Erkrankungen und ersetzt nicht Ihre Ärztin, Ihren Arzt oder Ihr Behandlungsteam. Verschieben oder ändern Sie keine Behandlung aufgrund von etwas, das Sie hier lesen. Im Notfall rufen Sie in Europa die 112 oder Ihre örtliche Notrufnummer an.",
        ],
      },
      {
        h: "Antworten mit künstlicher Intelligenz",
        p: [
          "Antworten und Erkenntnisse werden mit künstlicher Intelligenz aus einer kuratierten Bibliothek von Studien und Leitlinien erstellt. Jede Aussage zeigt ihre Quelle und wie belastbar die Evidenz ist. Trotz dieser Prüfungen können Antworten unvollständig, veraltet oder falsch sein. Prüfen Sie die Quellen und sprechen Sie mit Ihrem Behandlungsteam, bevor Sie danach handeln.",
        ],
      },
      {
        h: "Kostenlos und ohne Konto",
        p: [
          "{app} ist kostenlos, und Sie brauchen kein Konto. Einige Funktionen speichern Daten auf unseren Servern, aber nur, wenn Sie sie nutzen möchten; siehe Datenschutzerklärung.",
        ],
      },
      {
        h: "Die Gemeinschaft",
        p: [
          "Der Beitritt ist ab 18 Jahren möglich. Halten Sie sich an die Gemeinschaftsregeln, insbesondere:",
          "• seien Sie freundlich und ermutigend und respektieren Sie die Entscheidungen anderer Mitglieder;",
          "• geben Sie keine medizinischen Ratschläge, werben Sie nicht für Produkte oder Behandlungen und teilen Sie keine Kontaktdaten;",
          "• veröffentlichen Sie nichts, woran Sie oder andere Personen erkannt werden können;",
          "• veröffentlichen Sie keine rechtswidrigen, hasserfüllten oder schädlichen Inhalte.",
          "Sie sind für Ihre Beiträge verantwortlich. Alle Rechte an Ihren Beiträgen bleiben bei Ihnen; Sie erlauben uns unentgeltlich, sie anderen Mitgliedern zu zeigen, solange sie veröffentlicht sind. Wir prüfen Beiträge vor der Veröffentlichung und können Beiträge entfernen oder Mitglieder sperren, die gegen die Regeln verstoßen. Eine solche Entscheidung können Sie in der App überprüfen lassen (Einspruch).",
        ],
      },
      {
        h: "Ihre Daten und Ihr Gerät",
        p: [
          "Die meisten Ihrer Daten werden nur auf Ihrem Gerät gespeichert. Bewahren Sie Ihr Gerät und Ihren Synchronisierungscode sicher auf: Daten, die wir nie erhalten haben, können wir nicht wiederherstellen, und ohne den Synchronisierungscode kann niemand Ihre synchronisierte Kopie entschlüsseln, auch wir nicht.",
        ],
      },
      {
        h: "Verfügbarkeit und Änderungen des Dienstes",
        p: [
          "Wir bemühen uns, {app} verfügbar und aktuell zu halten, können aber nicht garantieren, dass der Dienst immer verfügbar oder fehlerfrei ist. Wir können Funktionen ändern, unterbrechen oder einstellen, insbesondere zum Schutz der Mitglieder.",
        ],
      },
      {
        h: "Haftung",
        p: [
          "Wir haften unbeschränkt für Schäden, die vorsätzlich oder grob fahrlässig verursacht wurden, für Schäden aus der Verletzung des Lebens, des Körpers oder der Gesundheit sowie nach dem Produkthaftungsgesetz. Bei leichter Fahrlässigkeit haften wir nur bei Verletzung einer wesentlichen Pflicht und nur für den typischen, vorhersehbaren Schaden. Im Übrigen ist unsere Haftung ausgeschlossen.",
        ],
      },
      {
        h: "Links auf andere Websites",
        p: ["Quellen verweisen auf Websites und Dokumente anderer Herausgeber. Für deren Inhalte sind wir nicht verantwortlich."],
      },
      {
        h: "Änderungen dieser Bedingungen",
        p: [
          "Wenn wir diese Bedingungen ändern, informieren wir Sie in der App, bevor die Änderungen wirksam werden. Wenn Sie nicht einverstanden sind, können Sie {app} jederzeit nicht mehr nutzen und Ihre Daten löschen.",
        ],
      },
      {
        h: "Anwendbares Recht und Kontakt",
        p: [
          "Es gilt deutsches Recht. Wenn Sie als Verbraucherin oder Verbraucher in einem anderen Land leben, bleiben die zwingenden Verbraucherschutzvorschriften dieses Landes unberührt. Kontakt: {email}.",
        ],
      },
    ],
  },
  imprint: {
    title: "Impressum",
    intro: "Angaben gemäß § 5 Digitale-Dienste-Gesetz (DDG).",
    sections: [
      { h: "Anbieter", p: ["{operator}", "{address}", "Vertreten durch: {representative}"] },
      { h: "Kontakt", p: ["E-Mail: {email}", "Telefon: {phone}"] },
      { h: "Register und Umsatzsteuer", p: ["Registereintrag: {register}", "Umsatzsteuer-Identifikationsnummer: {vatId}"] },
      {
        h: "Inhaltlich verantwortlich",
        p: ["Verantwortlich für den Inhalt nach § 18 Abs. 2 Medienstaatsvertrag (MStV): {contentResponsible}"],
      },
      {
        h: "Verbraucherstreitbeilegung",
        p: ["Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen."],
      },
      {
        h: "Gesundheitsinformationen",
        p: ["Die Inhalte von {app} sind allgemeine Gesundheitsinformationen und ersetzen keine ärztliche Beratung. Im Notfall rufen Sie die 112 an."],
      },
    ],
  },
  accessibility: {
    title: "Erklärung zur Barrierefreiheit",
    intro:
      "{operator} möchte, dass alle Menschen {app} nutzen können, auch mit Screenreader, Tastatur, Vergrößerung oder Sprachsteuerung. Diese Erklärung gilt für die Website und die Apps von {app}.",
    sections: [
      {
        h: "Standard und Stand der Vereinbarkeit",
        p: [
          "Unser Ziel ist die Konformität mit den Web Content Accessibility Guidelines (WCAG) 2.2 auf Stufe AA, wie sie die europäische Norm EN 301 549 verlangt.",
          "{app} ist teilweise barrierefrei. Mit jeder Veröffentlichung wird jede Seite in allen sieben Sprachen auf Telefon- und Desktopgröße automatisch geprüft. Eine unabhängige Prüfung durch Fachleute und Tests mit Menschen mit Behinderungen sind vor dem Start geplant; wir ergänzen diese Erklärung um die Ergebnisse.",
        ],
      },
      {
        h: "Was wir tun",
        p: [
          "• Eine klare Struktur mit Überschriften, Orientierungsbereichen und einem Link zum Inhalt; alles ist mit Tastatur und Screenreadern (VoiceOver, TalkBack) bedienbar.",
          "• Text lässt sich ohne Inhaltsverlust auf 200 % vergrößern; Farbe ist nie das einzige Unterscheidungsmerkmal; der Kontrast reicht im hellen und im dunklen Modus aus.",
          "• Diagramme gibt es auch als Tabellen; Animationen werden reduziert, wenn Ihr Gerät das wünscht.",
          "• Erkenntnisse kann Ihr Gerät vorlesen; Arabisch wird von rechts nach links dargestellt.",
          "• Einfache Sprache, Fachbegriffe werden erklärt.",
        ],
      },
      {
        h: "Bekannte Einschränkungen",
        p: [
          "• Dokumente in der Evidenzbibliothek stammen von anderen Herausgebern. Manche, etwa ältere PDF-Dateien, sind möglicherweise nicht vollständig barrierefrei. {app} zeigt die Textstellen, auf die es sich stützt, als Text an.",
          "• Beiträge in der Gemeinschaft schreiben Mitglieder; sie folgen nicht immer den Regeln guter Barrierefreiheit.",
          "Wenn Sie auf eine Barriere stoßen, die hier nicht aufgeführt ist, sagen Sie es uns bitte.",
        ],
      },
      {
        h: "Rückmeldung und Kontakt",
        p: [
          "Schreiben Sie an {email} und nennen Sie die Seite und das Problem. Wir antworten innerhalb von zwei Wochen und senden Ihnen die Inhalte nach Möglichkeit in barrierefreier Form.",
        ],
      },
      {
        h: "Durchsetzungsverfahren",
        p: ["Wenn unsere Antwort Ihr Problem nicht löst, können Sie sich wenden an: {accessibilityAuthority}."],
      },
      {
        h: "Erstellung dieser Erklärung",
        p: ["Diese Erklärung wurde am {date} auf Grundlage automatisierter Tests und eigener Prüfungen erstellt."],
      },
    ],
  },
};
