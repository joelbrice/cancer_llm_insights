/**
 * Lifestyle check — evaluated entirely on the user's device (answers never leave it).
 *
 * Each item compares a habit with an internationally recognised cancer-prevention recommendation and links
 * to the topic whose corpus-backed insight carries the evidence and citations. It is deliberately NOT a risk
 * score: no individual risk is estimated (that would require a validated, regulated model).
 *
 * Frameworks: European Code Against Cancer (IARC/WHO), WCRF/AICR Cancer Prevention Recommendations,
 * WHO 2020 guidelines on physical activity and sedentary behaviour. Thresholds are maintained by the
 * clinical lead (docs/BUILD_SPEC.md §6.9).
 */
import type { Locale } from "./types";

type L = Record<Locale, string>;
export type CheckStatus = "aligned" | "partly" | "not_aligned" | "info";

export interface CheckOption {
  id: string;
  label: L;
  status: CheckStatus;
}

export interface CheckItem {
  id: string;
  topicId: string;
  framework: "ECAC" | "WCRF" | "WHO";
  question: L;
  advice: L;
  options: CheckOption[];
}

export const FRAMEWORKS: Record<CheckItem["framework"], string> = {
  ECAC: "European Code Against Cancer (IARC/WHO)",
  WCRF: "WCRF/AICR Cancer Prevention Recommendations",
  WHO: "WHO guidelines on physical activity and sedentary behaviour (2020)",
};

const o = (id: string, status: CheckStatus, label: L): CheckOption => ({ id, status, label });

export const CHECK_ITEMS: CheckItem[] = [
  {
    id: "tobacco",
    topicId: "quitting-smoking",
    framework: "ECAC",
    question: {
      en: "Do you smoke or use any form of tobacco?",
      fr: "Fumez-vous ou consommez-vous du tabac sous une forme quelconque ?",
      es: "¿Fumas o consumes tabaco en alguna forma?",
      pt: "Fuma ou consome tabaco de alguma forma?",
      de: "Rauchen Sie oder konsumieren Sie Tabak in irgendeiner Form?",
      it: "Fumi o usi tabacco in qualsiasi forma?",
      ar: "هل تدخّن أو تستخدم التبغ بأي شكل من الأشكال؟",
    },
    advice: {
      en: "Not using tobacco is the most effective single step to lower cancer risk. Stopping helps at any age, and counselling and medication make quitting more likely to succeed.",
      fr: "Ne pas consommer de tabac est la mesure la plus efficace pour réduire le risque de cancer. Arrêter est bénéfique à tout âge ; un accompagnement et des traitements augmentent les chances de réussite.",
      es: "No consumir tabaco es la medida más eficaz para reducir el riesgo de cáncer. Dejarlo ayuda a cualquier edad, y el apoyo profesional y los medicamentos aumentan las probabilidades de éxito.",
      pt: "Não consumir tabaco é a medida mais eficaz para reduzir o risco de cancro. Deixar ajuda em qualquer idade, e o aconselhamento e a medicação aumentam a probabilidade de sucesso.",
      de: "Auf Tabak zu verzichten ist der wirksamste einzelne Schritt gegen Krebs. Aufhören hilft in jedem Alter; Beratung und Medikamente erhöhen die Erfolgschancen.",
      it: "Non usare tabacco è il passo singolo più efficace per ridurre il rischio di cancro. Smettere aiuta a qualsiasi età, e il supporto di un professionista e i farmaci aumentano le probabilità di riuscita.",
      ar: "الامتناع عن التبغ هو أكثر خطوة منفردة فعالية لتقليل خطر الإصابة بالسرطان. الإقلاع مفيد في أي عمر، والاستشارة والأدوية تزيد فرص النجاح.",
    },
    options: [
      o("never", "aligned", { en: "Never", fr: "Jamais", es: "Nunca", pt: "Nunca", de: "Nie", it: "Mai", ar: "أبدًا" }),
      o("former", "aligned", { en: "I have stopped", fr: "J'ai arrêté", es: "Lo he dejado", pt: "Já deixei", de: "Ich habe aufgehört", it: "Ho smesso", ar: "أقلعت عنه" }),
      o("occasional", "not_aligned", { en: "Occasionally", fr: "Occasionnellement", es: "De vez en cuando", pt: "Ocasionalmente", de: "Gelegentlich", it: "Ogni tanto", ar: "أحيانًا" }),
      o("daily", "not_aligned", { en: "Every day", fr: "Tous les jours", es: "A diario", pt: "Todos os dias", de: "Täglich", it: "Ogni giorno", ar: "يوميًا" }),
    ],
  },
  {
    id: "secondhand",
    topicId: "secondhand-smoke",
    framework: "ECAC",
    question: {
      en: "Are you regularly around other people's tobacco smoke (home, car, work)?",
      fr: "Êtes-vous régulièrement exposé·e à la fumée de tabac des autres (domicile, voiture, travail) ?",
      es: "¿Estás a menudo expuesto/a al humo de tabaco de otras personas (casa, coche, trabajo)?",
      pt: "Está regularmente exposto/a ao fumo de tabaco de outras pessoas (casa, carro, trabalho)?",
      de: "Sind Sie regelmäßig dem Tabakrauch anderer ausgesetzt (Zuhause, Auto, Arbeit)?",
      it: "Sei spesso esposto al fumo di tabacco degli altri (casa, auto, lavoro)?",
      ar: "هل تتعرض بانتظام لدخان تبغ الآخرين (في المنزل أو السيارة أو العمل)؟",
    },
    advice: {
      en: "Keep your home, car and workplace smoke-free; second-hand smoke also causes cancer.",
      fr: "Gardez votre domicile, votre voiture et votre lieu de travail sans tabac : la fumée passive cause aussi des cancers.",
      es: "Mantén tu casa, tu coche y tu trabajo libres de humo: el humo ajeno también causa cáncer.",
      pt: "Mantenha a casa, o carro e o local de trabalho sem fumo: o fumo passivo também causa cancro.",
      de: "Halten Sie Wohnung, Auto und Arbeitsplatz rauchfrei – auch Passivrauch verursacht Krebs.",
      it: "Mantieni casa, auto e luogo di lavoro liberi dal fumo: anche il fumo passivo causa il cancro.",
      ar: "حافظ على منزلك وسيارتك ومكان عملك خالية من الدخان، فالتدخين السلبي يسبب السرطان أيضًا.",
    },
    options: [
      o("no", "aligned", { en: "No", fr: "Non", es: "No", pt: "Não", de: "Nein", it: "No", ar: "لا" }),
      o("sometimes", "partly", { en: "Sometimes", fr: "Parfois", es: "A veces", pt: "Às vezes", de: "Manchmal", it: "A volte", ar: "أحيانًا" }),
      o("often", "not_aligned", { en: "Often", fr: "Souvent", es: "A menudo", pt: "Muitas vezes", de: "Oft", it: "Spesso", ar: "كثيرًا" }),
    ],
  },
  {
    id: "alcohol",
    topicId: "alcohol-risk",
    framework: "WCRF",
    question: {
      en: "How many alcoholic drinks do you have in a typical week?",
      fr: "Combien de verres d'alcool buvez-vous au cours d'une semaine habituelle ?",
      es: "¿Cuántas bebidas alcohólicas tomas en una semana normal?",
      pt: "Quantas bebidas alcoólicas toma numa semana habitual?",
      de: "Wie viele alkoholische Getränke trinken Sie in einer typischen Woche?",
      it: "Quante bevande alcoliche bevi in una settimana tipica?",
      ar: "كم مشروبًا كحوليًا تتناول في أسبوع عادي؟",
    },
    advice: {
      en: "For cancer prevention, it is best not to drink alcohol. If you drink, less is better — every type of alcoholic drink counts.",
      fr: "Pour prévenir le cancer, mieux vaut ne pas boire d'alcool. Si vous en buvez, moins c'est mieux — tous les types d'alcool comptent.",
      es: "Para prevenir el cáncer, lo mejor es no beber alcohol. Si bebes, cuanto menos mejor; todos los tipos de bebida alcohólica cuentan.",
      pt: "Para prevenir o cancro, o melhor é não beber álcool. Se beber, quanto menos melhor — todos os tipos de bebida alcoólica contam.",
      de: "Zur Krebsvorbeugung ist es am besten, keinen Alkohol zu trinken. Wenn doch: je weniger, desto besser – jede Art von Alkohol zählt.",
      it: "Per prevenire il cancro è meglio non bere alcol. Se bevi, meno è meglio: conta ogni tipo di bevanda alcolica.",
      ar: "للوقاية من السرطان، الأفضل عدم شرب الكحول. وإن كنت تشربه، فالأقل أفضل — وكل أنواع المشروبات الكحولية تُحتسب.",
    },
    options: [
      o("none", "aligned", { en: "None", fr: "Aucun", es: "Ninguna", pt: "Nenhuma", de: "Keine", it: "Nessuna", ar: "لا شيء" }),
      o("1-3", "partly", { en: "1 to 3", fr: "1 à 3", es: "1 a 3", pt: "1 a 3", de: "1 bis 3", it: "Da 1 a 3", ar: "من 1 إلى 3" }),
      o("4-7", "partly", { en: "4 to 7", fr: "4 à 7", es: "4 a 7", pt: "4 a 7", de: "4 bis 7", it: "Da 4 a 7", ar: "من 4 إلى 7" }),
      o("8+", "not_aligned", { en: "8 or more", fr: "8 ou plus", es: "8 o más", pt: "8 ou mais", de: "8 oder mehr", it: "8 o più", ar: "8 أو أكثر" }),
    ],
  },
  {
    id: "activity",
    topicId: "physical-activity-prevention",
    framework: "WHO",
    question: {
      en: "How many minutes of moderate activity (e.g. brisk walking, cycling) do you do in a typical week?",
      fr: "Combien de minutes d'activité modérée (marche rapide, vélo…) pratiquez-vous au cours d'une semaine habituelle ?",
      es: "¿Cuántos minutos de actividad moderada (caminar rápido, bicicleta…) haces en una semana normal?",
      pt: "Quantos minutos de atividade moderada (caminhada rápida, bicicleta…) faz numa semana habitual?",
      de: "Wie viele Minuten bewegen Sie sich in einer typischen Woche mäßig intensiv (z. B. zügiges Gehen, Radfahren)?",
      it: "Quanti minuti di attività moderata (per esempio camminata veloce, bicicletta) fai in una settimana tipica?",
      ar: "كم دقيقة من النشاط المعتدل (مثل المشي السريع أو ركوب الدراجة) تمارس في أسبوع عادي؟",
    },
    advice: {
      en: "Adults are advised to do at least 150–300 minutes of moderate activity (or 75–150 minutes of vigorous activity) a week. Some activity is better than none.",
      fr: "Il est recommandé aux adultes de pratiquer au moins 150 à 300 minutes d'activité modérée (ou 75 à 150 minutes d'activité intense) par semaine. Un peu vaut mieux que rien.",
      es: "Se recomienda a los adultos al menos 150–300 minutos de actividad moderada (o 75–150 de actividad intensa) a la semana. Algo es mejor que nada.",
      pt: "Recomenda-se aos adultos pelo menos 150–300 minutos de atividade moderada (ou 75–150 de atividade vigorosa) por semana. Alguma atividade é melhor do que nenhuma.",
      de: "Erwachsenen werden mindestens 150–300 Minuten mäßige (oder 75–150 Minuten intensive) Bewegung pro Woche empfohlen. Etwas ist besser als nichts.",
      it: "Agli adulti si consiglia di fare almeno 150–300 minuti di attività moderata (o 75–150 minuti di attività intensa) a settimana. Un po' di attività è meglio di niente.",
      ar: "يُنصح البالغون بممارسة 150 إلى 300 دقيقة على الأقل من النشاط المعتدل (أو 75 إلى 150 دقيقة من النشاط الشديد) أسبوعيًا. القليل من النشاط أفضل من لا شيء.",
    },
    options: [
      o("<60", "not_aligned", { en: "Less than 60", fr: "Moins de 60", es: "Menos de 60", pt: "Menos de 60", de: "Weniger als 60", it: "Meno di 60", ar: "أقل من 60" }),
      o("60-149", "partly", { en: "60 to 149", fr: "60 à 149", es: "60 a 149", pt: "60 a 149", de: "60 bis 149", it: "Da 60 a 149", ar: "من 60 إلى 149" }),
      o("150-299", "aligned", { en: "150 to 299", fr: "150 à 299", es: "150 a 299", pt: "150 a 299", de: "150 bis 299", it: "Da 150 a 299", ar: "من 150 إلى 299" }),
      o("300+", "aligned", { en: "300 or more", fr: "300 ou plus", es: "300 o más", pt: "300 ou mais", de: "300 oder mehr", it: "300 o più", ar: "300 أو أكثر" }),
    ],
  },
  {
    id: "sitting",
    topicId: "sedentary-time",
    framework: "WHO",
    question: {
      en: "On a typical day, how many hours do you spend sitting (outside of sleep)?",
      fr: "Un jour habituel, combien d'heures passez-vous assis·e (hors sommeil) ?",
      es: "En un día normal, ¿cuántas horas pasas sentado/a (sin contar el sueño)?",
      pt: "Num dia habitual, quantas horas passa sentado/a (sem contar o sono)?",
      de: "Wie viele Stunden sitzen Sie an einem typischen Tag (ohne Schlaf)?",
      it: "In una giornata tipica, quante ore passi seduto (escluso il sonno)?",
      ar: "في يوم عادي، كم ساعة تقضيها في الجلوس (باستثناء النوم)؟",
    },
    advice: {
      en: "Limit time spent sitting and break up long periods with light movement.",
      fr: "Limitez le temps passé assis et interrompez les longues périodes par un peu de mouvement.",
      es: "Limita el tiempo sentado y rompe los periodos largos con algo de movimiento.",
      pt: "Limite o tempo sentado e interrompa os períodos longos com algum movimento.",
      de: "Begrenzen Sie Sitzzeiten und unterbrechen Sie lange Phasen mit leichter Bewegung.",
      it: "Limita il tempo trascorso seduto e interrompi i periodi lunghi con un po' di movimento leggero.",
      ar: "قلّل وقت الجلوس، وقسّم فترات الجلوس الطويلة بحركة خفيفة.",
    },
    options: [
      o("<6", "aligned", { en: "Less than 6", fr: "Moins de 6", es: "Menos de 6", pt: "Menos de 6", de: "Weniger als 6", it: "Meno di 6", ar: "أقل من 6" }),
      o("6-8", "partly", { en: "6 to 8", fr: "6 à 8", es: "6 a 8", pt: "6 a 8", de: "6 bis 8", it: "Da 6 a 8", ar: "من 6 إلى 8" }),
      o(">8", "not_aligned", { en: "More than 8", fr: "Plus de 8", es: "Más de 8", pt: "Mais de 8", de: "Mehr als 8", it: "Più di 8", ar: "أكثر من 8" }),
    ],
  },
  {
    id: "weight",
    topicId: "body-weight",
    framework: "WCRF",
    question: {
      en: "Which best describes your weight (body mass index)?",
      fr: "Qu'est-ce qui décrit le mieux votre poids (indice de masse corporelle) ?",
      es: "¿Qué describe mejor tu peso (índice de masa corporal)?",
      pt: "O que descreve melhor o seu peso (índice de massa corporal)?",
      de: "Was beschreibt Ihr Gewicht (Body-Mass-Index) am besten?",
      it: "Cosa descrive meglio il tuo peso (indice di massa corporea)?",
      ar: "ما الذي يصف وزنك بشكل أفضل (مؤشر كتلة الجسم)؟",
    },
    advice: {
      en: "Keeping a healthy weight lowers the risk of several cancers. Sustainable changes in eating and activity help; a professional can give personalised support.",
      fr: "Garder un poids de forme réduit le risque de plusieurs cancers. Des changements durables d'alimentation et d'activité aident ; un professionnel peut vous accompagner.",
      es: "Mantener un peso saludable reduce el riesgo de varios cánceres. Ayudan los cambios sostenibles en alimentación y actividad; un profesional puede darte apoyo personalizado.",
      pt: "Manter um peso saudável reduz o risco de vários cancros. Mudanças sustentáveis na alimentação e atividade ajudam; um profissional pode dar apoio personalizado.",
      de: "Ein gesundes Gewicht senkt das Risiko mehrerer Krebsarten. Nachhaltige Veränderungen bei Ernährung und Bewegung helfen; Fachleute können Sie individuell begleiten.",
      it: "Mantenere un peso sano riduce il rischio di diversi tumori. Aiutano cambiamenti sostenibili nell'alimentazione e nell'attività; un professionista può offrirti un sostegno personalizzato.",
      ar: "الحفاظ على وزن صحي يقلل خطر الإصابة بعدة أنواع من السرطان. تساعد التغييرات المستدامة في الغذاء والنشاط، ويمكن لأخصائي تقديم دعم مخصص.",
    },
    options: [
      o("healthy", "aligned", { en: "Healthy range (BMI 18.5–24.9)", fr: "Poids normal (IMC 18,5–24,9)", es: "Rango saludable (IMC 18,5–24,9)", pt: "Intervalo saudável (IMC 18,5–24,9)", de: "Normalgewicht (BMI 18,5–24,9)", it: "Intervallo sano (IMC 18,5–24,9)", ar: "النطاق الصحي (مؤشر كتلة الجسم 18.5–24.9)" }),
      o("overweight", "partly", { en: "Overweight (BMI 25–29.9)", fr: "Surpoids (IMC 25–29,9)", es: "Sobrepeso (IMC 25–29,9)", pt: "Excesso de peso (IMC 25–29,9)", de: "Übergewicht (BMI 25–29,9)", it: "Sovrappeso (IMC 25–29,9)", ar: "زيادة الوزن (مؤشر كتلة الجسم 25–29.9)" }),
      o("obesity", "not_aligned", { en: "Obesity (BMI 30 or more)", fr: "Obésité (IMC 30 ou plus)", es: "Obesidad (IMC 30 o más)", pt: "Obesidade (IMC 30 ou mais)", de: "Adipositas (BMI 30 oder mehr)", it: "Obesità (IMC 30 o più)", ar: "السمنة (مؤشر كتلة الجسم 30 أو أكثر)" }),
      o("underweight", "info", { en: "Underweight (BMI under 18.5)", fr: "Maigreur (IMC inférieur à 18,5)", es: "Bajo peso (IMC menor de 18,5)", pt: "Baixo peso (IMC inferior a 18,5)", de: "Untergewicht (BMI unter 18,5)", it: "Sottopeso (IMC sotto 18,5)", ar: "نقص الوزن (مؤشر كتلة الجسم أقل من 18.5)" }),
      o("unknown", "info", { en: "I don't know", fr: "Je ne sais pas", es: "No lo sé", pt: "Não sei", de: "Weiß ich nicht", it: "Non lo so", ar: "لا أعرف" }),
    ],
  },
  {
    id: "plants",
    topicId: "plant-foods-fibre",
    framework: "WCRF",
    question: {
      en: "How many portions of vegetables and fruit do you eat on a typical day?",
      fr: "Combien de portions de légumes et de fruits mangez-vous un jour habituel ?",
      es: "¿Cuántas raciones de verduras y frutas comes en un día normal?",
      pt: "Quantas porções de legumes e fruta come num dia habitual?",
      de: "Wie viele Portionen Gemüse und Obst essen Sie an einem typischen Tag?",
      it: "Quante porzioni di verdura e frutta mangi in una giornata tipica?",
      ar: "كم حصة من الخضار والفاكهة تتناول في يوم عادي؟",
    },
    advice: {
      en: "Aim for at least five portions (about 400 g) of vegetables and fruit a day, plus whole grains and pulses.",
      fr: "Visez au moins cinq portions (environ 400 g) de légumes et de fruits par jour, ainsi que des céréales complètes et des légumineuses.",
      es: "Intenta comer al menos cinco raciones (unos 400 g) de verduras y frutas al día, además de cereales integrales y legumbres.",
      pt: "Procure comer pelo menos cinco porções (cerca de 400 g) de legumes e fruta por dia, além de cereais integrais e leguminosas.",
      de: "Ziel: mindestens fünf Portionen (etwa 400 g) Gemüse und Obst pro Tag, dazu Vollkorn und Hülsenfrüchte.",
      it: "Punta ad almeno cinque porzioni (circa 400 g) di verdura e frutta al giorno, oltre a cereali integrali e legumi.",
      ar: "احرص على تناول خمس حصص على الأقل (نحو 400 غرام) من الخضار والفاكهة يوميًا، إضافة إلى الحبوب الكاملة والبقوليات.",
    },
    options: [
      o("5+", "aligned", { en: "5 or more", fr: "5 ou plus", es: "5 o más", pt: "5 ou mais", de: "5 oder mehr", it: "5 o più", ar: "5 أو أكثر" }),
      o("3-4", "partly", { en: "3 to 4", fr: "3 à 4", es: "3 a 4", pt: "3 a 4", de: "3 bis 4", it: "Da 3 a 4", ar: "من 3 إلى 4" }),
      o("0-2", "not_aligned", { en: "0 to 2", fr: "0 à 2", es: "0 a 2", pt: "0 a 2", de: "0 bis 2", it: "Da 0 a 2", ar: "من 0 إلى 2" }),
    ],
  },
  {
    id: "fibre",
    topicId: "plant-foods-fibre",
    framework: "WCRF",
    question: {
      en: "How often do you eat whole grains, beans, lentils or other high-fibre foods?",
      fr: "À quelle fréquence mangez-vous des céréales complètes, haricots, lentilles ou autres aliments riches en fibres ?",
      es: "¿Con qué frecuencia comes cereales integrales, alubias, lentejas u otros alimentos ricos en fibra?",
      pt: "Com que frequência come cereais integrais, feijão, lentilhas ou outros alimentos ricos em fibra?",
      de: "Wie oft essen Sie Vollkorn, Bohnen, Linsen oder andere ballaststoffreiche Lebensmittel?",
      it: "Quanto spesso mangi cereali integrali, fagioli, lenticchie o altri alimenti ricchi di fibre?",
      ar: "كم مرة تتناول الحبوب الكاملة أو الفاصوليا أو العدس أو غيرها من الأطعمة الغنية بالألياف؟",
    },
    advice: {
      en: "Include whole grains and pulses in most meals; dietary fibre is linked to a lower risk of colorectal cancer.",
      fr: "Intégrez céréales complètes et légumineuses à la plupart des repas ; les fibres sont associées à un risque plus faible de cancer colorectal.",
      es: "Incluye cereales integrales y legumbres en la mayoría de las comidas; la fibra se asocia a un menor riesgo de cáncer colorrectal.",
      pt: "Inclua cereais integrais e leguminosas na maioria das refeições; a fibra está associada a menor risco de cancro colorretal.",
      de: "Bauen Sie Vollkorn und Hülsenfrüchte in die meisten Mahlzeiten ein; Ballaststoffe gehen mit einem geringeren Darmkrebsrisiko einher.",
      it: "Includi cereali integrali e legumi nella maggior parte dei pasti: le fibre alimentari sono associate a un rischio più basso di tumore del colon-retto.",
      ar: "أضف الحبوب الكاملة والبقوليات إلى معظم وجباتك، فالألياف الغذائية مرتبطة بانخفاض خطر الإصابة بسرطان القولون والمستقيم.",
    },
    options: [
      o("most_days", "aligned", { en: "Most days", fr: "La plupart des jours", es: "Casi todos los días", pt: "Na maioria dos dias", de: "An den meisten Tagen", it: "Quasi tutti i giorni", ar: "معظم الأيام" }),
      o("some_days", "partly", { en: "Some days", fr: "Certains jours", es: "Algunos días", pt: "Alguns dias", de: "An manchen Tagen", it: "Alcuni giorni", ar: "بعض الأيام" }),
      o("rarely", "not_aligned", { en: "Rarely", fr: "Rarement", es: "Rara vez", pt: "Raramente", de: "Selten", it: "Raramente", ar: "نادرًا" }),
    ],
  },
  {
    id: "processed_meat",
    topicId: "processed-red-meat",
    framework: "WCRF",
    question: {
      en: "How often do you eat processed meat (ham, bacon, sausages, salami)?",
      fr: "À quelle fréquence mangez-vous de la viande transformée (jambon, bacon, saucisses, salami) ?",
      es: "¿Con qué frecuencia comes carne procesada (jamón, beicon, salchichas, salami)?",
      pt: "Com que frequência come carne processada (fiambre, bacon, salsichas, salame)?",
      de: "Wie oft essen Sie verarbeitetes Fleisch (Schinken, Speck, Würstchen, Salami)?",
      it: "Quanto spesso mangi carne lavorata (prosciutto, pancetta, salsicce, salame)?",
      ar: "كم مرة تتناول اللحوم المصنعة (مثل النقانق والسلامي والبسطرمة واللحوم الباردة)؟",
    },
    advice: {
      en: "Eat little, if any, processed meat.",
      fr: "Consommez peu de viande transformée, voire pas du tout.",
      es: "Come poca carne procesada, o ninguna.",
      pt: "Coma pouca carne processada, ou nenhuma.",
      de: "Essen Sie wenig oder gar kein verarbeitetes Fleisch.",
      it: "Mangia poca carne lavorata, o meglio nessuna.",
      ar: "تناول القليل من اللحوم المصنعة، أو لا تتناولها أصلًا.",
    },
    options: [
      o("rarely", "aligned", { en: "Rarely or never", fr: "Rarement ou jamais", es: "Rara vez o nunca", pt: "Raramente ou nunca", de: "Selten oder nie", it: "Raramente o mai", ar: "نادرًا أو أبدًا" }),
      o("1-2_week", "partly", { en: "1–2 times a week", fr: "1 à 2 fois par semaine", es: "1–2 veces por semana", pt: "1–2 vezes por semana", de: "1–2 Mal pro Woche", it: "1–2 volte a settimana", ar: "مرة أو مرتين أسبوعيًا" }),
      o("3+_week", "not_aligned", { en: "3 or more times a week", fr: "3 fois par semaine ou plus", es: "3 o más veces por semana", pt: "3 ou mais vezes por semana", de: "3 Mal pro Woche oder öfter", it: "3 o più volte a settimana", ar: "3 مرات أو أكثر أسبوعيًا" }),
    ],
  },
  {
    id: "red_meat",
    topicId: "processed-red-meat",
    framework: "WCRF",
    question: {
      en: "How many portions of red meat (beef, pork, lamb) do you eat per week?",
      fr: "Combien de portions de viande rouge (bœuf, porc, agneau) mangez-vous par semaine ?",
      es: "¿Cuántas raciones de carne roja (ternera, cerdo, cordero) comes a la semana?",
      pt: "Quantas porções de carne vermelha (vaca, porco, borrego) come por semana?",
      de: "Wie viele Portionen rotes Fleisch (Rind, Schwein, Lamm) essen Sie pro Woche?",
      it: "Quante porzioni di carne rossa (manzo, maiale, agnello) mangi a settimana?",
      ar: "كم حصة من اللحوم الحمراء (البقر أو الضأن أو غيرها) تتناول أسبوعيًا؟",
    },
    advice: {
      en: "Limit red meat to no more than about three portions a week (roughly 350–500 g cooked).",
      fr: "Limitez la viande rouge à environ trois portions par semaine au maximum (soit 350 à 500 g cuits).",
      es: "Limita la carne roja a unas tres raciones por semana como máximo (unos 350–500 g cocinada).",
      pt: "Limite a carne vermelha a cerca de três porções por semana no máximo (cerca de 350–500 g cozinhada).",
      de: "Begrenzen Sie rotes Fleisch auf höchstens etwa drei Portionen pro Woche (ca. 350–500 g gegart).",
      it: "Limita la carne rossa a non più di circa tre porzioni a settimana (circa 350–500 g cotta).",
      ar: "اقتصر على ثلاث حصص تقريبًا من اللحوم الحمراء أسبوعيًا كحد أقصى (نحو 350–500 غرام مطبوخة).",
    },
    options: [
      o("0-3", "aligned", { en: "0 to 3", fr: "0 à 3", es: "0 a 3", pt: "0 a 3", de: "0 bis 3", it: "Da 0 a 3", ar: "من 0 إلى 3" }),
      o("4-6", "partly", { en: "4 to 6", fr: "4 à 6", es: "4 a 6", pt: "4 a 6", de: "4 bis 6", it: "Da 4 a 6", ar: "من 4 إلى 6" }),
      o("7+", "not_aligned", { en: "7 or more", fr: "7 ou plus", es: "7 o más", pt: "7 ou mais", de: "7 oder mehr", it: "7 o più", ar: "7 أو أكثر" }),
    ],
  },
  {
    id: "sugary_drinks",
    topicId: "sugary-drinks-ultra-processed",
    framework: "WCRF",
    question: {
      en: "How often do you have sugar-sweetened drinks (sodas, sweetened juices, energy drinks)?",
      fr: "À quelle fréquence buvez-vous des boissons sucrées (sodas, jus sucrés, boissons énergisantes) ?",
      es: "¿Con qué frecuencia tomas bebidas azucaradas (refrescos, zumos azucarados, bebidas energéticas)?",
      pt: "Com que frequência bebe bebidas açucaradas (refrigerantes, sumos açucarados, bebidas energéticas)?",
      de: "Wie oft trinken Sie zuckergesüßte Getränke (Limonaden, gesüßte Säfte, Energydrinks)?",
      it: "Quanto spesso bevi bevande zuccherate (bibite gassate, succhi zuccherati, energy drink)?",
      ar: "كم مرة تتناول المشروبات المحلاة بالسكر (المشروبات الغازية، العصائر المحلاة، مشروبات الطاقة)؟",
    },
    advice: {
      en: "Limit sugar-sweetened drinks; water and unsweetened drinks are better everyday choices.",
      fr: "Limitez les boissons sucrées ; l'eau et les boissons non sucrées sont de meilleurs choix au quotidien.",
      es: "Limita las bebidas azucaradas; el agua y las bebidas sin azúcar son mejores opciones diarias.",
      pt: "Limite as bebidas açucaradas; a água e as bebidas sem açúcar são melhores escolhas no dia a dia.",
      de: "Begrenzen Sie zuckergesüßte Getränke; Wasser und ungesüßte Getränke sind die bessere Alltagswahl.",
      it: "Limita le bevande zuccherate: acqua e bevande non zuccherate sono scelte migliori per tutti i giorni.",
      ar: "قلّل المشروبات المحلاة بالسكر، فالماء والمشروبات غير المحلاة خيارات يومية أفضل.",
    },
    options: [
      o("rarely", "aligned", { en: "Rarely or never", fr: "Rarement ou jamais", es: "Rara vez o nunca", pt: "Raramente ou nunca", de: "Selten oder nie", it: "Raramente o mai", ar: "نادرًا أو أبدًا" }),
      o("weekly", "partly", { en: "A few times a week", fr: "Quelques fois par semaine", es: "Unas veces por semana", pt: "Algumas vezes por semana", de: "Ein paar Mal pro Woche", it: "Qualche volta a settimana", ar: "بضع مرات أسبوعيًا" }),
      o("daily", "not_aligned", { en: "Every day", fr: "Tous les jours", es: "A diario", pt: "Todos os dias", de: "Täglich", it: "Ogni giorno", ar: "يوميًا" }),
    ],
  },
  {
    id: "sun",
    topicId: "sun-uv-sunbeds",
    framework: "ECAC",
    question: {
      en: "How do you protect your skin from the sun, and do you use sunbeds?",
      fr: "Comment protégez-vous votre peau du soleil, et utilisez-vous des cabines de bronzage ?",
      es: "¿Cómo proteges tu piel del sol? ¿Usas camas solares?",
      pt: "Como protege a pele do sol? Usa solários?",
      de: "Wie schützen Sie Ihre Haut vor der Sonne, und nutzen Sie Solarien?",
      it: "Come proteggi la pelle dal sole, e usi i lettini abbronzanti?",
      ar: "كيف تحمي بشرتك من الشمس، وهل تستخدم أسرّة التسمير؟",
    },
    advice: {
      en: "Avoid sunburn: seek shade, wear protective clothing and sunscreen, and do not use sunbeds.",
      fr: "Évitez les coups de soleil : recherchez l'ombre, portez des vêtements couvrants et de la crème solaire, et n'utilisez pas de cabines de bronzage.",
      es: "Evita las quemaduras solares: busca la sombra, usa ropa protectora y protector solar, y no uses camas solares.",
      pt: "Evite queimaduras solares: procure a sombra, use roupa protetora e protetor solar, e não use solários.",
      de: "Vermeiden Sie Sonnenbrand: Schatten suchen, schützende Kleidung und Sonnenschutz tragen, keine Solarien nutzen.",
      it: "Evita le scottature: cerca l'ombra, indossa indumenti protettivi e crema solare, e non usare lettini abbronzanti.",
      ar: "تجنّب حروق الشمس: ابحث عن الظل، وارتدِ ملابس واقية، واستخدم واقي الشمس، ولا تستخدم أسرّة التسمير.",
    },
    options: [
      o("protected", "aligned", { en: "I usually protect my skin and never use sunbeds", fr: "Je me protège généralement et n'utilise jamais de cabine", es: "Suelo protegerme y nunca uso camas solares", pt: "Costumo proteger-me e nunca uso solários", de: "Ich schütze mich meist und nutze nie Solarien", it: "Di solito proteggo la pelle e non uso mai lettini abbronzanti", ar: "أحمي بشرتي عادةً ولا أستخدم أسرّة التسمير أبدًا" }),
      o("sometimes", "partly", { en: "I sometimes protect my skin", fr: "Je me protège parfois", es: "A veces me protejo", pt: "Às vezes protejo-me", de: "Ich schütze mich manchmal", it: "A volte proteggo la pelle", ar: "أحمي بشرتي أحيانًا" }),
      o("rarely_or_sunbeds", "not_aligned", { en: "Rarely, or I use sunbeds", fr: "Rarement, ou j'utilise des cabines", es: "Rara vez, o uso camas solares", pt: "Raramente, ou uso solários", de: "Selten, oder ich nutze Solarien", it: "Raramente, oppure uso lettini abbronzanti", ar: "نادرًا، أو أستخدم أسرّة التسمير" }),
    ],
  },
  {
    id: "supplements",
    topicId: "supplements-prevention",
    framework: "WCRF",
    question: {
      en: "Do you take dietary supplements to prevent cancer?",
      fr: "Prenez-vous des compléments alimentaires pour prévenir le cancer ?",
      es: "¿Tomas suplementos dietéticos para prevenir el cáncer?",
      pt: "Toma suplementos alimentares para prevenir o cancro?",
      de: "Nehmen Sie Nahrungsergänzungsmittel zur Krebsvorbeugung?",
      it: "Prendi integratori alimentari per prevenire il cancro?",
      ar: "هل تتناول مكملات غذائية للوقاية من السرطان؟",
    },
    advice: {
      en: "Supplements are not recommended for cancer prevention; aim to meet your needs through food unless a clinician prescribes them for a medical reason.",
      fr: "Les compléments ne sont pas recommandés pour prévenir le cancer ; privilégiez l'alimentation, sauf prescription médicale.",
      es: "No se recomiendan suplementos para prevenir el cáncer; cubre tus necesidades con la alimentación salvo prescripción médica.",
      pt: "Os suplementos não são recomendados para prevenir o cancro; procure satisfazer as necessidades pela alimentação, salvo prescrição médica.",
      de: "Nahrungsergänzungsmittel werden zur Krebsvorbeugung nicht empfohlen; decken Sie Ihren Bedarf über die Ernährung, außer bei ärztlicher Verordnung.",
      it: "Gli integratori non sono raccomandati per prevenire il cancro: cerca di soddisfare i tuoi bisogni con l'alimentazione, a meno che un medico non li prescriva per un motivo clinico.",
      ar: "لا يُنصح بالمكملات للوقاية من السرطان؛ احرص على تلبية احتياجاتك من الغذاء، ما لم يصفها لك طبيب لسبب طبي.",
    },
    options: [
      o("no", "aligned", { en: "No", fr: "Non", es: "No", pt: "Não", de: "Nein", it: "No", ar: "لا" }),
      o("prescribed", "aligned", { en: "Only as prescribed by a clinician", fr: "Uniquement sur prescription", es: "Solo con prescripción médica", pt: "Apenas por prescrição médica", de: "Nur ärztlich verordnet", it: "Solo se prescritti da un medico", ar: "فقط بوصفة من الطبيب" }),
      o("yes", "partly", { en: "Yes, on my own initiative", fr: "Oui, de ma propre initiative", es: "Sí, por mi cuenta", pt: "Sim, por iniciativa própria", de: "Ja, aus eigenem Antrieb", it: "Sì, di mia iniziativa", ar: "نعم، بمبادرة مني" }),
    ],
  },
  {
    id: "vaccination",
    topicId: "hpv-vaccination",
    framework: "ECAC",
    question: {
      en: "Are you (or your children) vaccinated against hepatitis B and, if eligible, HPV?",
      fr: "Vous (ou vos enfants) êtes-vous vacciné·es contre l'hépatite B et, le cas échéant, contre le HPV ?",
      es: "¿Estás vacunado/a (tú o tus hijos) contra la hepatitis B y, si corresponde, contra el VPH?",
      pt: "Está (ou os seus filhos estão) vacinado/a contra a hepatite B e, se elegível, contra o HPV?",
      de: "Sind Sie (oder Ihre Kinder) gegen Hepatitis B und, falls empfohlen, gegen HPV geimpft?",
      it: "Tu (o i tuoi figli) siete vaccinati contro l'epatite B e, se previsto, contro l'HPV?",
      ar: "هل تلقيت أنت (أو أطفالك) لقاح التهاب الكبد B، ولقاح فيروس الورم الحليمي البشري إن كنتم مؤهلين له؟",
    },
    advice: {
      en: "Vaccination against hepatitis B and HPV prevents infections that cause cancer. Ask your doctor what is recommended for you and your children.",
      fr: "La vaccination contre l'hépatite B et le HPV prévient des infections qui causent des cancers. Demandez à votre médecin ce qui est recommandé pour vous et vos enfants.",
      es: "La vacunación contra la hepatitis B y el VPH previene infecciones que causan cáncer. Pregunta a tu médico qué se recomienda para ti y tus hijos.",
      pt: "A vacinação contra a hepatite B e o HPV previne infeções que causam cancro. Pergunte ao seu médico o que é recomendado para si e para os seus filhos.",
      de: "Impfungen gegen Hepatitis B und HPV verhindern Infektionen, die Krebs verursachen. Fragen Sie Ihre Ärztin oder Ihren Arzt, was für Sie und Ihre Kinder empfohlen ist.",
      it: "La vaccinazione contro l'epatite B e l'HPV previene infezioni che causano il cancro. Chiedi al tuo medico cosa è raccomandato per te e per i tuoi figli.",
      ar: "يقي التطعيم ضد التهاب الكبد B وفيروس الورم الحليمي البشري من أنواع عدوى تسبب السرطان. اسأل طبيبك عمّا يُوصى به لك ولأطفالك.",
    },
    options: [
      o("yes", "aligned", { en: "Yes", fr: "Oui", es: "Sí", pt: "Sim", de: "Ja", it: "Sì", ar: "نعم" }),
      o("unsure", "info", { en: "Not sure", fr: "Je ne sais pas", es: "No estoy seguro/a", pt: "Não tenho a certeza", de: "Nicht sicher", it: "Non sono sicuro", ar: "لا أعرف" }),
      o("no", "info", { en: "No", fr: "Non", es: "No", pt: "Não", de: "Nein", it: "No", ar: "لا" }),
    ],
  },
  {
    id: "screening",
    topicId: "screening-programmes",
    framework: "ECAC",
    question: {
      en: "Are you up to date with the cancer screening offered for your age in your country (breast, cervical, colorectal)?",
      fr: "Êtes-vous à jour des dépistages proposés pour votre âge dans votre pays (sein, col de l'utérus, côlon-rectum) ?",
      es: "¿Estás al día con el cribado de cáncer ofrecido para tu edad en tu país (mama, cuello uterino, colorrectal)?",
      pt: "Tem em dia os rastreios de cancro oferecidos para a sua idade no seu país (mama, colo do útero, colorretal)?",
      de: "Nehmen Sie die für Ihr Alter angebotenen Krebsfrüherkennungen wahr (Brust, Gebärmutterhals, Darm)?",
      it: "Sei in regola con gli screening oncologici offerti per la tua età nel tuo Paese (seno, collo dell'utero, colon-retto)?",
      ar: "هل أجريت فحوصات الكشف المبكر عن السرطان المتاحة لفئتك العمرية في بلدك (الثدي، عنق الرحم، القولون والمستقيم)؟",
    },
    advice: {
      en: "Take part in organised screening programmes for your age; ask your doctor which ones apply to you. See a doctor for any new symptom, whatever your screening status.",
      fr: "Participez aux programmes de dépistage organisés pour votre âge ; demandez à votre médecin lesquels vous concernent. Consultez pour tout nouveau symptôme, quel que soit votre dépistage.",
      es: "Participa en los programas de cribado para tu edad; pregunta a tu médico cuáles te corresponden. Consulta por cualquier síntoma nuevo, aunque estés al día.",
      pt: "Participe nos programas de rastreio para a sua idade; pergunte ao seu médico quais se aplicam a si. Consulte o médico perante qualquer sintoma novo, mesmo com os rastreios em dia.",
      de: "Nehmen Sie an den Früherkennungsprogrammen für Ihr Alter teil und fragen Sie Ihre Ärztin oder Ihren Arzt, welche für Sie gelten. Lassen Sie neue Beschwerden immer ärztlich abklären – unabhängig von der Früherkennung.",
      it: "Partecipa ai programmi di screening organizzati per la tua età e chiedi al tuo medico quali ti riguardano. Per qualsiasi sintomo nuovo rivolgiti a un medico, indipendentemente dagli screening fatti.",
      ar: "شارك في برامج الكشف المبكر المنظمة المناسبة لعمرك، واسأل طبيبك عن البرامج التي تنطبق عليك. راجع الطبيب عند ظهور أي عرض جديد، بغض النظر عن نتائج فحوصاتك.",
    },
    options: [
      o("yes", "aligned", { en: "Yes", fr: "Oui", es: "Sí", pt: "Sim", de: "Ja", it: "Sì", ar: "نعم" }),
      o("unsure", "info", { en: "Not sure / not yet eligible", fr: "Je ne sais pas / pas encore concerné·e", es: "No lo sé / aún no me corresponde", pt: "Não sei / ainda não elegível", de: "Weiß nicht / noch nicht an der Reihe", it: "Non lo so / non ancora previsto per me", ar: "لا أعرف / لم يحن موعدها بعد" }),
      o("no", "partly", { en: "No", fr: "Non", es: "No", pt: "Não", de: "Nein", it: "No", ar: "لا" }),
    ],
  },
];

export type CheckAnswers = Record<string, string>;

export interface CheckResultItem {
  item: CheckItem;
  option: CheckOption;
  status: CheckStatus;
}

export interface CheckResult {
  items: CheckResultItem[];
  counts: Record<CheckStatus, number>;
  answered: number;
}

const STATUS_ORDER: CheckStatus[] = ["not_aligned", "partly", "info", "aligned"];

/** Evaluate answers locally. Results are ordered so the areas with most room to improve come first. */
export function evaluateCheck(answers: CheckAnswers): CheckResult {
  const items: CheckResultItem[] = [];
  for (const item of CHECK_ITEMS) {
    const option = item.options.find((opt) => opt.id === answers[item.id]);
    if (option) items.push({ item, option, status: option.status });
  }
  items.sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status));
  const counts: Record<CheckStatus, number> = { aligned: 0, partly: 0, not_aligned: 0, info: 0 };
  for (const r of items) counts[r.status] += 1;
  return { items, counts, answered: items.length };
}

/** BMI category from height (cm) and weight (kg), computed locally to pre-fill the weight question. */
export function bmiOption(heightCm: number, weightKg: number): "healthy" | "overweight" | "obesity" | "underweight" | null {
  if (!(heightCm > 80 && heightCm < 250 && weightKg > 20 && weightKg < 400)) return null;
  const bmi = weightKg / (heightCm / 100) ** 2;
  if (bmi < 18.5) return "underweight";
  if (bmi < 25) return "healthy";
  if (bmi < 30) return "overweight";
  return "obesity";
}
