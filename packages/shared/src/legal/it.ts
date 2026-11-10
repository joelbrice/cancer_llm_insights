import type { LegalTexts } from "./types";

export const it: LegalTexts = {
  privacy: {
    title: "Informativa sulla privacy",
    intro:
      "Questa informativa spiega quali dati personali tratta {app}, per quali scopi e quali sono i tuoi diritti. In breve: quasi tutto ciò che inserisci resta sul tuo dispositivo. I nostri server vedono solo ciò che serve per rispondere alle tue domande, gestire la comunità e, se la attivi, conservare una copia cifrata del tuo piano che non possiamo leggere. Niente pubblicità, niente tracciamento e nessuna vendita di dati.",
    sections: [
      {
        h: "Titolare del trattamento",
        p: [
          "Il titolare del trattamento ai sensi del Regolamento generale sulla protezione dei dati (GDPR) è {operator}, {address}. E-mail: {email}.",
          "Responsabile della protezione dei dati: {dpo}.",
        ],
      },
      {
        h: "Informazioni sulla tua salute",
        p: [
          "Informazioni come il tuo percorso, un tipo di tumore, la fase del trattamento o ciò che scrivi nella comunità sono dati sanitari, una categoria particolare di dati personali (art. 9 GDPR). I nostri server li ricevono solo se lo scegli tu: quando fai una domanda, entri nella comunità o attivi la sincronizzazione. In ogni caso ci basiamo sul tuo consenso esplicito (art. 9, paragrafo 2, lettera a), GDPR). Puoi revocarlo in qualsiasi momento con effetto per il futuro, per esempio cancellando i dati come descritto sotto.",
        ],
      },
      {
        h: "Cosa resta sul tuo dispositivo",
        p: [
          "Il tuo profilo (percorso, fascia d'età, sesso, tipi di tumore, fase del trattamento, paese), il tuo piano e le tue spunte, le risposte alla verifica dello stile di vita, le domande per le visite, le impostazioni dei promemoria, le conversazioni, il conteggio dei passi, le sintesi scaricate e le impostazioni di lingua e visualizzazione sono salvati solo sul tuo dispositivo. Non possiamo vederli.",
          "Puoi cancellarli in qualsiasi momento con «Elimina i miei dati da questo dispositivo». Vengono cancellati anche se disinstalli l'app o cancelli i dati del sito nel tuo browser.",
        ],
      },
      {
        h: "Le domande che fai",
        p: [
          "Quando fai una domanda, questa viene inviata al nostro server insieme ai messaggi precedenti della stessa conversazione e ai dati del profilo che hai scelto di condividere, così che possiamo trovare le prove e scrivere una risposta. Avviene solo in memoria: domande e risposte non vengono salvate.",
          "Le risposte sono scritte da un modello linguistico che gestiamo noi stessi, sui server indicati in «Destinatari e responsabili del trattamento». La tua domanda non viene inviata a nessun fornitore esterno di IA.",
          "Base giuridica: la fornitura del servizio che hai richiesto (art. 6, paragrafo 1, lettera b), GDPR) e, per le informazioni sulla tua salute, il tuo consenso esplicito (art. 9, paragrafo 2, lettera a), GDPR).",
        ],
      },
      {
        h: "Le tue valutazioni",
        p: [
          "Se valuti una risposta o una sintesi, salviamo la tua valutazione, i motivi che scegli e il tuo commento facoltativo, dopo aver rimosso automaticamente i dati personali. Li usiamo per trovare e correggere errori e li conserviamo per 12 mesi. Base giuridica: il nostro legittimo interesse a fornire informazioni corrette e sicure (art. 6, paragrafo 1, lettera f), GDPR).",
        ],
      },
      {
        h: "La comunità",
        p: [
          "Entrare nella comunità è facoltativo ed è possibile solo dai 18 anni in su. Salviamo:",
          "• il soprannome che scegli, la tua lingua e, se ne scegli uno, un badge del percorso;",
          "• i tuoi post e le tue risposte, le tue reazioni, le segnalazioni, i membri che blocchi e gli eventuali ricorsi;",
          "• un'impronta (hash) della chiave di accesso casuale conservata sul tuo dispositivo. Non chiediamo mai il tuo nome, il tuo indirizzo e-mail o il tuo numero di telefono.",
          "Ogni post viene controllato automaticamente prima di essere mostrato, e moderatori formati esaminano le segnalazioni. I post rimossi vengono cancellati dopo 90 giorni.",
          "Base giuridica: il tuo consenso esplicito al momento dell'iscrizione (art. 9, paragrafo 2, lettera a), GDPR). Nell'app puoi scaricare tutti i tuoi dati della comunità e uscirne in qualsiasi momento. Uscendo, la tua iscrizione e i tuoi post vengono cancellati.",
          "Se rispondi alla domanda facoltativa «Hai trovato sostegno qui questo mese?», conserviamo la tua risposta per 12 mesi; viene separata dalla tua iscrizione quando esci. Per il rapporto pubblico sulla trasparenza conserviamo dati di moderazione anonimi: solo conteggi, senza membri né testi.",
        ],
      },
      {
        h: "Sincronizzazione cifrata (facoltativa)",
        p: [
          "Se attivi la sincronizzazione, il tuo piano e il tuo profilo vengono cifrati sul tuo dispositivo con una chiave derivata dal tuo codice di sincronizzazione. Il nostro server conserva solo i dati cifrati, un numero di versione e l'impronta di una chiave di scrittura: non possiamo leggere i tuoi dati e non sappiamo chi sei. La copia viene cancellata quando disattivi la sincronizzazione, oppure dopo 400 giorni senza modifiche. Base giuridica: il tuo consenso esplicito (art. 9, paragrafo 2, lettera a), GDPR).",
        ],
      },
      {
        h: "Passi, app per la salute e promemoria",
        p: [
          "Il conteggio dei passi viene letto sul tuo telefono: dal sensore di movimento oppure, se lo attivi, dall'app Salute di Apple o da Health Connect (sola lettura: i totali giornalieri degli ultimi 7 giorni). I promemoria settimanali li programma il tuo telefono oppure vengono salvati nel tuo calendario. Niente di tutto questo ci viene inviato.",
        ],
      },
      {
        h: "Dati tecnici e sicurezza",
        p: [
          "Per mostrare pagine e risposte, i nostri server trattano necessariamente il tuo indirizzo IP e i dati tecnici di ogni richiesta, come il tipo di browser. Gli indirizzi IP restano in memoria per pochi minuti per limitare gli abusi e non vengono scritti nei nostri log. I nostri log registrano l'ora, la funzione usata, l'esito e la durata di ogni richiesta e sono conservati per 30 giorni. Base giuridica: il nostro legittimo interesse a un servizio sicuro e affidabile (art. 6, paragrafo 1, lettera f), GDPR).",
          "Tutte le connessioni sono cifrate (TLS).",
        ],
      },
      {
        h: "Cookie e archiviazione sul tuo dispositivo",
        p: [
          "Non usiamo cookie pubblicitari o di tracciamento né strumenti di analisi. Il sito salva la tua scelta della lingua in un cookie, e le tue impostazioni e i tuoi contenuti nella memoria locale del browser. È strettamente necessario per fornire il servizio che hai richiesto (§ 25, comma 2, n. 2 della legge tedesca TDDDG), quindi non serve un banner per il consenso.",
        ],
      },
      {
        h: "Destinatari e responsabili del trattamento",
        p: [
          "{hosting}",
          "I nostri fornitori trattano i dati solo su nostra istruzione e sulla base di accordi sul trattamento dei dati (art. 28 GDPR). I dati sono trattati nell'Unione europea o nello Spazio economico europeo. Non vendiamo dati e non li condividiamo per scopi pubblicitari.",
          "I post nella comunità possono essere letti dagli altri membri.",
        ],
      },
      {
        h: "Per quanto tempo conserviamo i dati",
        p: [
          "• Dati sul tuo dispositivo: finché non li cancelli.",
          "• Domande e risposte: non vengono salvate.",
          "• Valutazioni: 12 mesi.",
          "• Comunità: finché non esci; post rimossi per 90 giorni; risposte al sondaggio per 12 mesi.",
          "• Sincronizzazione cifrata: finché non la disattivi, al massimo 400 giorni dall'ultima modifica.",
          "• Log: 30 giorni.",
        ],
      },
      {
        h: "I tuoi diritti",
        p: [
          "Hai diritto di accesso (art. 15 GDPR), rettifica (art. 16), cancellazione (art. 17), limitazione del trattamento (art. 18) e portabilità (art. 20), oltre al diritto di opporti al trattamento basato sui nostri legittimi interessi (art. 21). Puoi revocare il consenso in qualsiasi momento (art. 7, paragrafo 3); la revoca non pregiudica la liceità del trattamento effettuato prima.",
          "Molti di questi diritti si esercitano direttamente nell'app: scaricare o cancellare i tuoi dati della comunità, disattivare la sincronizzazione o cancellare i dati dal tuo dispositivo. Poiché non sappiamo chi sei, potremmo chiederti di dimostrare che certi dati sono tuoi, per esempio con il download dei tuoi dati della comunità. Per qualsiasi altra richiesta scrivi a {email}.",
          "Hai anche il diritto di proporre reclamo a un'autorità di controllo per la protezione dei dati (art. 77 GDPR), in particolare nel paese in cui vivi o lavori. L'autorità competente per noi è: {authority}.",
        ],
      },
      {
        h: "Decisioni automatizzate e intelligenza artificiale",
        p: [
          "Non prendiamo decisioni che ti riguardano e che producono effetti giuridici o incidono in modo analogo significativamente su di te (art. 22 GDPR). Risposte e sintesi sono generate con l'intelligenza artificiale a partire da ricerche pubblicate. Sono informazioni generali, non consigli medici.",
        ],
      },
      {
        h: "Modifiche a questa informativa",
        p: [
          "Aggiorniamo questa informativa quando il nostro trattamento dei dati cambia. La data in alto indica la versione in vigore. Se una modifica riguarda dati che ci hai già fornito, te lo comunicheremo nell'app.",
        ],
      },
    ],
  },
  terms: {
    title: "Condizioni d'uso",
    intro:
      "Queste condizioni si applicano quando usi {app} sul web o nell'app. {app} è offerto da {operator} («noi»). Leggile insieme all'informativa sulla privacy e, se entri nella comunità, alle regole della comunità.",
    sections: [
      {
        h: "Che cos'è {app}, e che cosa non è",
        p: [
          "{app} offre informazioni generali basate sulle prove su stile di vita, prevenzione dei tumori e vita durante e dopo un tumore, oltre a uno spazio moderato in cui le persone si sostengono a vicenda. È destinato agli adulti.",
          "{app} non è un servizio medico. Non fa diagnosi, non cura né monitora alcuna malattia e non sostituisce il tuo medico o la tua équipe di cura. Non rimandare né cambiare un trattamento per qualcosa che leggi qui. In caso di emergenza chiama il 112 in Europa o il numero di emergenza locale.",
        ],
      },
      {
        h: "Risposte scritte con l'intelligenza artificiale",
        p: [
          "Risposte e sintesi sono generate con l'intelligenza artificiale a partire da una biblioteca selezionata di ricerche e linee guida. Ogni affermazione indica la sua fonte e la solidità delle prove. Nonostante questi controlli, una risposta può essere incompleta, superata o sbagliata. Controlla le fonti e parlane con la tua équipe di cura prima di agire.",
        ],
      },
      {
        h: "Gratuito e senza account",
        p: [
          "{app} è gratuito e non serve un account. Alcune funzioni salvano dati sui nostri server, ma solo se scegli di usarle; vedi l'informativa sulla privacy.",
        ],
      },
      {
        h: "La comunità",
        p: [
          "Per entrare devi avere almeno 18 anni. Rispetta le regole della comunità, in particolare:",
          "• sii gentile e incoraggiante e rispetta le scelte degli altri membri;",
          "• non dare consigli medici, non promuovere prodotti o trattamenti e non condividere recapiti;",
          "• non pubblicare nulla che permetta di identificare te o un'altra persona;",
          "• non pubblicare contenuti illegali, d'odio o dannosi.",
          "Sei responsabile di ciò che pubblichi. Mantieni tutti i diritti sui tuoi post e ci autorizzi, gratuitamente, a mostrarli agli altri membri finché sono pubblicati. Controlliamo i post prima che compaiano e possiamo rimuovere post o sospendere membri che violano le regole. Puoi chiedere il riesame di tale decisione (ricorso) nell'app.",
        ],
      },
      {
        h: "I tuoi dati e il tuo dispositivo",
        p: [
          "La maggior parte dei tuoi dati è salvata solo sul tuo dispositivo. Proteggi il tuo dispositivo e il tuo codice di sincronizzazione: non possiamo ripristinare dati che non abbiamo mai ricevuto e, senza il codice di sincronizzazione, nessuno può decifrare la tua copia sincronizzata, nemmeno noi.",
        ],
      },
      {
        h: "Disponibilità e modifiche del servizio",
        p: [
          "Ci impegniamo a mantenere {app} disponibile e aggiornato, ma non possiamo garantire che sia sempre disponibile o privo di errori. Possiamo modificare, sospendere o interrompere funzioni, in particolare per proteggere la sicurezza dei membri.",
        ],
      },
      {
        h: "Responsabilità",
        p: [
          "Rispondiamo senza limiti dei danni causati con dolo o colpa grave, dei danni alla vita, all'integrità fisica o alla salute e ai sensi della legge tedesca sulla responsabilità per danno da prodotti. In caso di colpa lieve rispondiamo solo se violiamo un obbligo essenziale, e soltanto per il danno tipico e prevedibile. Per il resto la nostra responsabilità è esclusa.",
        ],
      },
      {
        h: "Link ad altri siti",
        p: ["Le fonti rimandano a siti e documenti di altri editori. Non siamo responsabili del loro contenuto."],
      },
      {
        h: "Modifiche a queste condizioni",
        p: [
          "Se modifichiamo queste condizioni, te lo comunicheremo nell'app prima che le modifiche entrino in vigore. Se non sei d'accordo, puoi smettere di usare {app} e cancellare i tuoi dati in qualsiasi momento.",
        ],
      },
      {
        h: "Legge applicabile e contatti",
        p: [
          "Si applica la legge tedesca. Se sei un consumatore residente in un altro paese, restano valide le norme imperative a tutela dei consumatori di quel paese. Contatti: {email}.",
        ],
      },
    ],
  },
  imprint: {
    title: "Note legali",
    intro: "Informazioni ai sensi del § 5 della legge tedesca sui servizi digitali (Digitale-Dienste-Gesetz, DDG).",
    sections: [
      { h: "Fornitore del servizio", p: ["{operator}", "{address}", "Rappresentato da: {representative}"] },
      { h: "Contatti", p: ["E-mail: {email}", "Telefono: {phone}"] },
      { h: "Registro e IVA", p: ["Iscrizione al registro: {register}", "Partita IVA: {vatId}"] },
      {
        h: "Responsabile dei contenuti",
        p: ["Responsabile dei contenuti ai sensi del § 18, comma 2, del Trattato interstatale tedesco sui media (MStV): {contentResponsible}"],
      },
      {
        h: "Risoluzione delle controversie dei consumatori",
        p: ["Non siamo obbligati né disposti a partecipare a procedure di risoluzione delle controversie davanti a un organismo di conciliazione per i consumatori."],
      },
      {
        h: "Informazioni sulla salute",
        p: ["I contenuti di {app} sono informazioni generali sulla salute e non sostituiscono il parere di un medico. In caso di emergenza chiama il 112."],
      },
    ],
  },
  accessibility: {
    title: "Dichiarazione di accessibilità",
    intro:
      "{operator} vuole che {app} sia utilizzabile da tutti, anche con lettore di schermo, tastiera, ingrandimento o comandi vocali. Questa dichiarazione si applica al sito e alle app di {app}.",
    sections: [
      {
        h: "Standard e stato di conformità",
        p: [
          "Il nostro obiettivo è rispettare le Linee guida per l'accessibilità dei contenuti Web (WCAG) 2.2 al livello AA, come richiesto dalla norma europea EN 301 549.",
          "{app} è parzialmente conforme. A ogni rilascio, ogni pagina viene verificata automaticamente in tutte e sette le lingue, in formato telefono e desktop. Prima del lancio sono previsti un audit indipendente da parte di esperti e test con persone con disabilità; aggiorneremo questa dichiarazione con i risultati.",
        ],
      },
      {
        h: "Cosa facciamo",
        p: [
          "• Una struttura chiara con titoli, aree di riferimento e un link per saltare al contenuto; tutto funziona con la tastiera e con i lettori di schermo (VoiceOver, TalkBack).",
          "• Il testo può essere ingrandito fino al 200% senza perdere contenuti; il colore non è mai l'unico segnale; il contrasto è sufficiente in modalità chiara e scura.",
          "• I grafici sono disponibili anche come tabelle; le animazioni vengono ridotte se il tuo dispositivo lo richiede.",
          "• Il tuo dispositivo può leggere le sintesi ad alta voce; l'arabo è mostrato da destra a sinistra.",
          "• Linguaggio semplice, con i termini tecnici spiegati.",
        ],
      },
      {
        h: "Limiti noti",
        p: [
          "• I documenti della biblioteca delle prove provengono da altri editori. Alcuni, come vecchi file PDF, potrebbero non essere del tutto accessibili. {app} mostra come testo i passaggi su cui si basa.",
          "• I post della comunità sono scritti dai membri e non sempre seguono le buone pratiche di accessibilità.",
          "Se trovi un ostacolo che non è indicato qui, faccelo sapere.",
        ],
      },
      {
        h: "Segnalazioni e contatti",
        p: [
          "Scrivi a {email} indicando la pagina e il problema. Ti risponderemo entro due settimane e, quando possibile, ti invieremo i contenuti in un formato accessibile.",
        ],
      },
      {
        h: "Procedura di attuazione",
        p: ["Se la nostra risposta non risolve il tuo problema, puoi rivolgerti a: {accessibilityAuthority}."],
      },
      {
        h: "Informazioni su questa dichiarazione",
        p: ["Questa dichiarazione è stata redatta il {date}, sulla base di test automatici e delle nostre verifiche."],
      },
    ],
  },
};
