import type { LegalTexts } from "./types";

// French typography: a narrow no-break space (U+202F) before ? ! ; and a no-break space (U+00A0) before : and
// inside « », as in the interface dictionary.
export const fr: LegalTexts = {
  privacy: {
    title: "Politique de confidentialité",
    intro:
      "Cette politique explique quelles données personnelles {app} traite, dans quel but et quels sont vos droits. En bref : l'essentiel de ce que vous saisissez reste sur votre appareil. Nos serveurs ne voient que ce qui est nécessaire pour répondre à vos questions, faire vivre la communauté et, si vous l'activez, conserver une copie chiffrée de votre plan que nous ne pouvons pas lire. Il n'y a ni publicité, ni pistage, ni vente de données.",
    sections: [
      {
        h: "Responsable du traitement",
        p: [
          "Le responsable du traitement au sens du règlement général sur la protection des données (RGPD) est {operator}, {address}. E-mail : {email}.",
          "Délégué à la protection des données : {dpo}.",
        ],
      },
      {
        h: "Informations sur votre santé",
        p: [
          "Des informations comme votre parcours, un type de cancer, votre phase de traitement ou ce que vous écrivez dans la communauté sont des données de santé, une catégorie particulière de données personnelles (art. 9 du RGPD). Nos serveurs ne les reçoivent que si vous le choisissez : en posant une question, en rejoignant la communauté ou en activant la synchronisation. Dans chaque cas, nous nous fondons sur votre consentement explicite (art. 9, paragraphe 2, point a), du RGPD). Vous pouvez le retirer à tout moment pour l'avenir, par exemple en supprimant les données comme indiqué ci-dessous.",
        ],
      },
      {
        h: "Ce qui reste sur votre appareil",
        p: [
          "Votre profil (parcours, tranche d'âge, sexe, types de cancer, phase de traitement, pays), votre plan et vos coches, vos réponses au bilan d'hygiène de vie, vos questions pour vos rendez-vous, vos réglages de rappel, vos conversations, vos nombres de pas, les repères téléchargés ainsi que vos réglages de langue et d'affichage sont enregistrés uniquement sur votre appareil. Nous ne pouvons pas les voir.",
          "Vous pouvez les effacer à tout moment avec « Supprimer mes données de cet appareil ». Désinstaller l'application ou effacer les données du site dans votre navigateur les supprime également.",
        ],
      },
      {
        h: "Les questions que vous posez",
        p: [
          "Lorsque vous posez une question, elle est envoyée à notre serveur avec les messages précédents de la même conversation et les informations de profil que vous avez choisi de partager, afin que nous puissions trouver des preuves et rédiger une réponse. Ce traitement a lieu uniquement en mémoire : les questions et les réponses ne sont pas enregistrées.",
          "Les réponses sont rédigées par un modèle de langage que nous exploitons nous-mêmes, sur les serveurs indiqués sous « Destinataires et sous-traitants ». Votre question n'est transmise à aucun fournisseur d'IA externe.",
          "Base juridique : la fourniture du service que vous avez demandé (art. 6, paragraphe 1, point b), du RGPD) et, pour les informations sur votre santé, votre consentement explicite (art. 9, paragraphe 2, point a), du RGPD).",
        ],
      },
      {
        h: "Vos avis",
        p: [
          "Si vous évaluez une réponse ou un repère, nous enregistrons votre note, les motifs choisis et votre commentaire facultatif, après suppression automatique des informations personnelles. Nous les utilisons pour repérer et corriger les erreurs et les conservons 12 mois. Base juridique : notre intérêt légitime à fournir des informations exactes et sûres (art. 6, paragraphe 1, point f), du RGPD).",
        ],
      },
      {
        h: "La communauté",
        p: [
          "Rejoindre la communauté est facultatif et n'est possible qu'à partir de 18 ans. Nous enregistrons :",
          "• le pseudonyme que vous choisissez, votre langue et, si vous en choisissez un, un badge de parcours ;",
          "• vos messages et réponses, vos réactions, vos signalements, les membres que vous bloquez et vos éventuels recours ;",
          "• une empreinte (hash) de la clé d'accès aléatoire conservée sur votre appareil. Nous ne demandons jamais votre nom, votre adresse e-mail ni votre numéro de téléphone.",
          "Chaque message est vérifié automatiquement avant d'être affiché, et des modératrices et modérateurs formés examinent les signalements. Les messages retirés sont supprimés au bout de 90 jours.",
          "Base juridique : votre consentement explicite lors de l'inscription (art. 9, paragraphe 2, point a), du RGPD). Dans l'application, vous pouvez télécharger toutes vos données de communauté et quitter la communauté à tout moment. Quitter la communauté supprime votre adhésion et vos messages.",
          "Si vous répondez à la question facultative « Avez-vous trouvé du soutien ici ce mois-ci ? », nous conservons votre réponse 12 mois ; elle est dissociée de votre adhésion lorsque vous partez. Pour le rapport de transparence public, nous conservons des chiffres de modération anonymes : uniquement des nombres, sans membres ni textes.",
        ],
      },
      {
        h: "Synchronisation chiffrée (facultative)",
        p: [
          "Si vous activez la synchronisation, votre plan et votre profil sont chiffrés sur votre appareil avec une clé dérivée de votre code de synchronisation. Notre serveur n'enregistre que les données chiffrées, un numéro de version et l'empreinte d'une clé d'écriture : nous ne pouvons pas lire vos données et ne savons pas qui vous êtes. La copie est supprimée lorsque vous désactivez la synchronisation, ou après 400 jours sans modification. Base juridique : votre consentement explicite (art. 9, paragraphe 2, point a), du RGPD).",
        ],
      },
      {
        h: "Nombre de pas, applications de santé et rappels",
        p: [
          "Le nombre de pas est lu sur votre téléphone : par le capteur de mouvement ou, si vous l'activez, dans Apple Santé ou Health Connect (en lecture seule, les totaux quotidiens des 7 derniers jours). Les rappels hebdomadaires sont programmés par votre téléphone ou enregistrés dans votre propre agenda. Rien de tout cela ne nous est envoyé.",
        ],
      },
      {
        h: "Données techniques et sécurité",
        p: [
          "Pour afficher les pages et les réponses, nos serveurs traitent nécessairement votre adresse IP et des informations techniques sur chaque requête, comme le type de navigateur. Les adresses IP sont gardées en mémoire quelques minutes pour limiter les abus et ne sont pas inscrites dans nos journaux. Nos journaux enregistrent l'heure, la fonction utilisée, le résultat et la durée de chaque requête et sont conservés 30 jours. Base juridique : notre intérêt légitime à un service sûr et fiable (art. 6, paragraphe 1, point f), du RGPD).",
          "Toutes les connexions sont chiffrées (TLS).",
        ],
      },
      {
        h: "Cookies et stockage sur votre appareil",
        p: [
          "Nous n'utilisons ni cookies publicitaires ou de pistage, ni outils de mesure d'audience. Le site enregistre votre choix de langue dans un cookie, ainsi que vos réglages et vos contenus dans le stockage local de votre navigateur. C'est strictement nécessaire pour fournir le service que vous demandez (§ 25, al. 2, n° 2 de la loi allemande TDDDG) ; aucun bandeau de consentement n'est donc nécessaire.",
        ],
      },
      {
        h: "Destinataires et sous-traitants",
        p: [
          "{hosting}",
          "Nos prestataires ne traitent les données que sur nos instructions et dans le cadre de contrats de sous-traitance (art. 28 du RGPD). Les données sont traitées dans l'Union européenne ou l'Espace économique européen. Nous ne vendons pas de données et ne les partageons pas à des fins publicitaires.",
          "Les messages de la communauté peuvent être lus par les autres membres.",
        ],
      },
      {
        h: "Durée de conservation",
        p: [
          "• Données sur votre appareil : jusqu'à ce que vous les supprimiez.",
          "• Questions et réponses : non enregistrées.",
          "• Avis : 12 mois.",
          "• Communauté : jusqu'à ce que vous la quittiez ; messages retirés 90 jours ; réponses à l'enquête 12 mois.",
          "• Synchronisation chiffrée : jusqu'à sa désactivation, au plus 400 jours après la dernière modification.",
          "• Journaux : 30 jours.",
        ],
      },
      {
        h: "Vos droits",
        p: [
          "Vous disposez d'un droit d'accès (art. 15 du RGPD), de rectification (art. 16), d'effacement (art. 17), de limitation du traitement (art. 18) et de portabilité (art. 20), ainsi que du droit de vous opposer à un traitement fondé sur nos intérêts légitimes (art. 21). Vous pouvez retirer votre consentement à tout moment (art. 7, paragraphe 3) ; cela ne remet pas en cause la licéité du traitement effectué avant le retrait.",
          "Beaucoup de ces droits s'exercent directement dans l'application : télécharger ou supprimer vos données de communauté, désactiver la synchronisation ou effacer les données de votre appareil. Comme nous ne savons pas qui vous êtes, nous pouvons vous demander de montrer que des données vous appartiennent, par exemple avec le téléchargement de vos données de communauté. Pour toute autre demande, écrivez à {email}.",
          "Vous avez également le droit d'introduire une réclamation auprès d'une autorité de contrôle de la protection des données (art. 77 du RGPD), notamment dans le pays où vous vivez ou travaillez. L'autorité compétente pour nous est : {authority}.",
        ],
      },
      {
        h: "Décisions automatisées et intelligence artificielle",
        p: [
          "Nous ne prenons à votre sujet aucune décision produisant des effets juridiques ou vous affectant de manière significative de façon similaire (art. 22 du RGPD). Les réponses et les repères sont générés par intelligence artificielle à partir de recherches publiées. Ce sont des informations générales, pas un avis médical.",
        ],
      },
      {
        h: "Modifications de cette politique",
        p: [
          "Nous mettons cette politique à jour lorsque nos traitements changent. La date en haut de la page indique la version en vigueur. Si une modification concerne des données que vous nous avez déjà confiées, nous vous en informerons dans l'application.",
        ],
      },
    ],
  },
  terms: {
    title: "Conditions d'utilisation",
    intro:
      "Ces conditions s'appliquent lorsque vous utilisez {app} sur le Web ou dans l'application. {app} est proposé par {operator} (« nous »). Merci de les lire avec la politique de confidentialité et, si vous rejoignez la communauté, la charte de la communauté.",
    sections: [
      {
        h: "Ce qu'est {app}, et ce qu'il n'est pas",
        p: [
          "{app} propose des informations générales, fondées sur les preuves, sur le mode de vie, la prévention des cancers et la vie pendant et après un cancer, ainsi qu'un espace modéré où chacun peut soutenir les autres. Il s'adresse aux adultes.",
          "{app} n'est pas un service médical. Il ne pose pas de diagnostic, ne traite ni ne surveille aucune maladie et ne remplace pas votre médecin ni votre équipe soignante. Ne retardez ni ne modifiez un traitement à cause de ce que vous lisez ici. En cas d'urgence, appelez le 112 en Europe ou votre numéro d'urgence local.",
        ],
      },
      {
        h: "Des réponses rédigées par intelligence artificielle",
        p: [
          "Les réponses et les repères sont générés par intelligence artificielle à partir d'une bibliothèque sélectionnée de recherches et de recommandations. Chaque affirmation indique sa source et le niveau de preuve. Malgré ces contrôles, une réponse peut être incomplète, dépassée ou erronée. Vérifiez les sources et parlez-en à votre équipe soignante avant d'agir.",
        ],
      },
      {
        h: "Gratuit et sans compte",
        p: [
          "{app} est gratuit et ne nécessite pas de compte. Certaines fonctions enregistrent des données sur nos serveurs, mais seulement si vous choisissez de les utiliser ; voir la politique de confidentialité.",
        ],
      },
      {
        h: "La communauté",
        p: [
          "Vous devez avoir au moins 18 ans pour la rejoindre. Respectez la charte de la communauté, en particulier :",
          "• soyez bienveillant et encourageant, et respectez les choix des autres membres ;",
          "• ne donnez pas de conseils médicaux, ne faites pas la promotion de produits ou de traitements et ne partagez pas de coordonnées ;",
          "• ne publiez rien qui permette de vous identifier ou d'identifier une autre personne ;",
          "• ne publiez pas de contenus illégaux, haineux ou dangereux.",
          "Vous êtes responsable de ce que vous publiez. Vous conservez tous les droits sur vos messages et nous autorisez gratuitement à les montrer aux autres membres tant qu'ils sont publiés. Nous vérifions les messages avant leur publication et pouvons retirer des messages ou suspendre des membres qui ne respectent pas la charte. Vous pouvez demander le réexamen d'une telle décision (recours) dans l'application.",
        ],
      },
      {
        h: "Vos données et votre appareil",
        p: [
          "La plupart de vos données sont enregistrées uniquement sur votre appareil. Protégez votre appareil et votre code de synchronisation : nous ne pouvons pas restaurer des données que nous n'avons jamais reçues, et sans le code de synchronisation personne ne peut déchiffrer votre copie synchronisée, pas même nous.",
        ],
      },
      {
        h: "Disponibilité et évolution du service",
        p: [
          "Nous faisons en sorte que {app} reste disponible et à jour, mais nous ne pouvons pas garantir qu'il soit toujours accessible ou exempt d'erreurs. Nous pouvons modifier, suspendre ou arrêter des fonctions, notamment pour protéger la sécurité des membres.",
        ],
      },
      {
        h: "Responsabilité",
        p: [
          "Nous sommes responsables sans limitation des dommages causés intentionnellement ou par négligence grave, des atteintes à la vie, à l'intégrité physique ou à la santé, ainsi qu'au titre de la loi allemande sur la responsabilité du fait des produits. En cas de négligence légère, nous ne sommes responsables qu'en cas de manquement à une obligation essentielle, et seulement pour le dommage typique et prévisible. Pour le reste, notre responsabilité est exclue.",
        ],
      },
      {
        h: "Liens vers d'autres sites",
        p: ["Les sources renvoient à des sites et documents d'autres éditeurs. Nous ne sommes pas responsables de leur contenu."],
      },
      {
        h: "Modification de ces conditions",
        p: [
          "Si nous modifions ces conditions, nous vous en informerons dans l'application avant leur entrée en vigueur. Si vous n'êtes pas d'accord, vous pouvez cesser d'utiliser {app} et supprimer vos données à tout moment.",
        ],
      },
      {
        h: "Droit applicable et contact",
        p: [
          "Le droit allemand s'applique. Si vous êtes un consommateur résidant dans un autre pays, les règles impératives de protection des consommateurs de ce pays continuent de s'appliquer. Contact : {email}.",
        ],
      },
    ],
  },
  imprint: {
    title: "Mentions légales",
    intro: "Informations prévues au § 5 de la loi allemande sur les services numériques (Digitale-Dienste-Gesetz, DDG).",
    sections: [
      { h: "Éditeur", p: ["{operator}", "{address}", "Représenté par : {representative}"] },
      { h: "Contact", p: ["E-mail : {email}", "Téléphone : {phone}"] },
      { h: "Registre et TVA", p: ["Inscription au registre : {register}", "Numéro de TVA intracommunautaire : {vatId}"] },
      {
        h: "Responsable du contenu",
        p: ["Responsable du contenu au sens du § 18, al. 2 du traité inter-länder allemand sur les médias (MStV) : {contentResponsible}"],
      },
      {
        h: "Règlement des litiges de consommation",
        p: ["Nous ne sommes ni disposés ni tenus à participer à une procédure de règlement des litiges devant un organisme de médiation de la consommation."],
      },
      {
        h: "Informations de santé",
        p: ["Les contenus de {app} sont des informations de santé générales et ne remplacent pas l'avis d'un médecin. En cas d'urgence, appelez le 112."],
      },
    ],
  },
  accessibility: {
    title: "Déclaration d'accessibilité",
    intro:
      "{operator} souhaite que {app} soit utilisable par tous, y compris avec un lecteur d'écran, un clavier, un agrandisseur ou la commande vocale. Cette déclaration s'applique au site et aux applications {app}.",
    sections: [
      {
        h: "Référentiel et état de conformité",
        p: [
          "Notre objectif est de respecter les règles pour l'accessibilité des contenus Web (WCAG) 2.2 au niveau AA, comme l'exige la norme européenne EN 301 549.",
          "{app} est partiellement conforme. À chaque version, chaque page est testée automatiquement dans les sept langues, sur des formats téléphone et ordinateur. Un audit indépendant par des spécialistes et des tests avec des personnes en situation de handicap sont prévus avant le lancement ; nous compléterons cette déclaration avec les résultats.",
        ],
      },
      {
        h: "Ce que nous faisons",
        p: [
          "• Une structure claire avec titres, zones de repère et lien d'évitement ; tout fonctionne au clavier et avec les lecteurs d'écran (VoiceOver, TalkBack).",
          "• Le texte peut être agrandi à 200 % sans perte de contenu ; la couleur n'est jamais le seul repère ; le contraste est suffisant en mode clair comme en mode sombre.",
          "• Les graphiques existent aussi sous forme de tableaux ; les animations sont réduites si votre appareil le demande.",
          "• Votre appareil peut lire les repères à voix haute ; l'arabe s'affiche de droite à gauche.",
          "• Un langage simple, avec les termes techniques expliqués.",
        ],
      },
      {
        h: "Limites connues",
        p: [
          "• Les documents de la bibliothèque de preuves proviennent d'autres éditeurs. Certains, comme d'anciens fichiers PDF, peuvent ne pas être entièrement accessibles. {app} affiche sous forme de texte les passages sur lesquels il s'appuie.",
          "• Les messages de la communauté sont écrits par des membres et ne suivent pas toujours les bonnes pratiques d'accessibilité.",
          "Si vous rencontrez un obstacle qui ne figure pas ici, dites-le-nous.",
        ],
      },
      {
        h: "Retour et contact",
        p: [
          "Écrivez à {email} en indiquant la page et le problème. Nous vous répondrons sous deux semaines et, si possible, vous enverrons le contenu sous une forme accessible.",
        ],
      },
      {
        h: "Voies de recours",
        p: ["Si notre réponse ne résout pas votre problème, vous pouvez vous adresser à : {accessibilityAuthority}."],
      },
      {
        h: "Établissement de cette déclaration",
        p: ["Cette déclaration a été établie le {date}, sur la base de tests automatisés et de nos propres vérifications."],
      },
    ],
  },
};
