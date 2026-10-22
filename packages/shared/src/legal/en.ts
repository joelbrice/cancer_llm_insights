import type { LegalTexts } from "./types";

// Drafts for review by counsel (docs/LAUNCH.md). They describe what the software actually does; keep them in step
// with docs/BUILD_SPEC.md §10.1 when processing changes. Every language has the same sections and placeholders.
export const en: LegalTexts = {
  privacy: {
    title: "Privacy policy",
    intro:
      "This policy explains which personal data {app} processes, why, and what your rights are. In short: most of what you enter stays on your device. Our servers only see what is needed to answer your questions, to run the community and, if you turn it on, to keep an encrypted copy of your plan that we cannot read. There is no advertising, no tracking and no sale of data.",
    sections: [
      {
        h: "Who is responsible",
        p: [
          "The controller under the General Data Protection Regulation (GDPR) is {operator}, {address}. Email: {email}.",
          "Data protection officer: {dpo}.",
        ],
      },
      {
        h: "Information about your health",
        p: [
          "Details such as your journey, a type of cancer, your treatment phase or what you write in the community are health data, a special category of personal data (Art. 9 GDPR). Our servers only receive them when you choose to: by asking a question, joining the community or turning on sync. In each case we rely on your explicit consent (Art. 9(2)(a) GDPR). You can withdraw it at any time with effect for the future, for example by deleting the data as described below.",
        ],
      },
      {
        h: "What stays on your device",
        p: [
          "Your profile (journey, age range, sex, types of cancer, treatment phase, country), your plan and check-ins, your lifestyle check answers, appointment questions, reminder settings, conversations, step counts, downloaded insights, language and display settings are stored only on your device. We cannot see them.",
          "You can delete them at any time with “Delete my data from this device”. Uninstalling the app or clearing the website's data in your browser also deletes them.",
        ],
      },
      {
        h: "Questions you ask",
        p: [
          "When you ask a question, it is sent to our server together with the earlier messages of the same conversation and the profile details you have chosen to share, so that we can find evidence and write an answer. This happens in memory only: questions and answers are not stored.",
          "Answers are written by a language model that we operate ourselves, on the servers named under “Recipients and processors”. Your question is not passed to an outside AI provider.",
          "Legal basis: providing the service you asked for (Art. 6(1)(b) GDPR) and, for details about your health, your explicit consent (Art. 9(2)(a) GDPR).",
        ],
      },
      {
        h: "Feedback",
        p: [
          "If you rate an answer or an insight, we store your rating, the reasons you select and your optional comment, with personal details removed automatically. We use this to find and correct mistakes and keep it for 12 months. Legal basis: our legitimate interest in accurate and safe information (Art. 6(1)(f) GDPR).",
        ],
      },
      {
        h: "The community",
        p: [
          "Joining the community is optional and only possible from the age of 18. We store:",
          "• the nickname you choose, your language and, if you pick one, a journey badge;",
          "• your posts and replies, your reactions, reports, the members you block and any appeals;",
          "• a fingerprint (hash) of the random access key that is kept on your device. We never ask for your name, email address or phone number.",
          "Every post is checked automatically before it is shown, and trained moderators review reports. Removed posts are deleted after 90 days.",
          "Legal basis: your explicit consent when you join (Art. 9(2)(a) GDPR). In the app you can download all your community data and leave the community at any time. Leaving deletes your membership and your posts.",
          "If you answer the optional question “Did you feel supported here this month?”, we keep your answer for 12 months; it is separated from your membership when you leave. For the public transparency report we keep anonymous moderation figures: counts only, without members or texts.",
        ],
      },
      {
        h: "Encrypted sync (optional)",
        p: [
          "If you turn on sync, your plan and profile are encrypted on your device with a key derived from your sync code. Our server only stores the encrypted data, a version number and a fingerprint of a write key: we cannot read your data and do not know who you are. The copy is deleted when you turn sync off, or after 400 days without any change. Legal basis: your explicit consent (Art. 9(2)(a) GDPR).",
        ],
      },
      {
        h: "Step counts, health apps and reminders",
        p: [
          "Step counts are read on your phone: from the motion sensor or, if you turn it on, from Apple Health or Health Connect (read only, the daily step totals of the last 7 days). Weekly reminders are scheduled by your phone or saved to your own calendar. None of this is sent to us.",
        ],
      },
      {
        h: "Technical data and security",
        p: [
          "To deliver pages and answers, our servers necessarily process your IP address and technical details of each request, such as the browser type. IP addresses are held in memory for a few minutes to limit abuse and are not written to our logs. Our logs record the time, the function used, the result and the duration of each request and are kept for 30 days. Legal basis: our legitimate interest in a secure and reliable service (Art. 6(1)(f) GDPR).",
          "All connections are encrypted (TLS).",
        ],
      },
      {
        h: "Cookies and storage on your device",
        p: [
          "We use no advertising or tracking cookies and no analytics. The website saves your language choice in a cookie, and your settings and content in your browser's local storage. This is strictly necessary to provide what you asked for (§ 25(2) no. 2 TDDDG), so no consent banner is needed.",
        ],
      },
      {
        h: "Recipients and processors",
        p: [
          "{hosting}",
          "Our service providers process data only on our instructions and under data processing agreements (Art. 28 GDPR). Data is processed in the European Union or the European Economic Area. We do not sell data and do not share it for advertising.",
          "Posts in the community can be read by other members.",
        ],
      },
      {
        h: "How long we keep data",
        p: [
          "• Data on your device: until you delete it.",
          "• Questions and answers: not stored.",
          "• Feedback: 12 months.",
          "• Community: until you leave; removed posts for 90 days; survey answers for 12 months.",
          "• Encrypted sync: until you turn it off, at most 400 days after the last change.",
          "• Logs: 30 days.",
        ],
      },
      {
        h: "Your rights",
        p: [
          "You have the right to access your data (Art. 15 GDPR), to have it corrected (Art. 16) or deleted (Art. 17), to restrict its processing (Art. 18), to receive it in a portable format (Art. 20) and to object to processing based on our legitimate interests (Art. 21). You can withdraw your consent at any time (Art. 7(3)); this does not affect the lawfulness of processing before the withdrawal.",
          "Many of these rights work directly in the app: download or delete your community data, turn off sync, or delete the data on your device. Because we do not know who you are, we may ask you to show that data belongs to you, for example with the community download. For anything else, write to {email}.",
          "You also have the right to lodge a complaint with a data protection supervisory authority (Art. 77 GDPR), in particular in the country where you live or work. The authority responsible for us is: {authority}.",
        ],
      },
      {
        h: "Automated decisions and artificial intelligence",
        p: [
          "We do not make decisions about you that have legal or similarly significant effects (Art. 22 GDPR). Answers and insights are generated with artificial intelligence from published research. They are general information, not medical advice.",
        ],
      },
      {
        h: "Changes to this policy",
        p: [
          "We update this policy when our processing changes. The date at the top shows the current version. If a change affects data you have already given us, we will tell you in the app.",
        ],
      },
    ],
  },
  terms: {
    title: "Terms of use",
    intro:
      "These terms apply when you use {app} on the web or in the app. {app} is provided by {operator} (“we”). Please read them together with the privacy policy and, if you join the community, the community guidelines.",
    sections: [
      {
        h: "What {app} is, and what it is not",
        p: [
          "{app} offers general, evidence-based information about lifestyle, cancer prevention and living with and after cancer, and a moderated space where people support each other. It is intended for adults.",
          "{app} is not a medical service. It does not diagnose, treat or monitor any condition and does not replace your doctor or care team. Do not delay or change a treatment because of something you read here. In an emergency, call 112 in Europe or your local emergency number.",
        ],
      },
      {
        h: "Answers written with artificial intelligence",
        p: [
          "Answers and insights are generated with artificial intelligence from a curated library of research and guidelines. Every statement shows its source and how strong the evidence is. Despite these checks, answers can be incomplete, out of date or wrong. Check the sources and talk to your care team before you act on them.",
        ],
      },
      {
        h: "Free of charge and without an account",
        p: [
          "{app} is free of charge and you do not need an account. Some features store data on our servers, but only when you choose to use them; see the privacy policy.",
        ],
      },
      {
        h: "The community",
        p: [
          "You must be 18 or older to join. Follow the community guidelines; in particular:",
          "• be kind and encouraging, and respect other members' decisions;",
          "• do not give medical advice, promote products or treatments, or share contact details;",
          "• do not post anything that identifies you or another person;",
          "• do not post illegal, hateful or harmful content.",
          "You are responsible for what you post. You keep all rights to your posts and allow us, free of charge, to show them to other members for as long as they are published. We check posts before they appear and may remove posts or suspend members who break the guidelines. You can ask us to review such a decision (appeal) in the app.",
        ],
      },
      {
        h: "Your data and your device",
        p: [
          "Most of your data is stored only on your device. Keep your device and your sync code safe: we cannot restore data we never received, and without the sync code nobody can decrypt your synced copy, not even us.",
        ],
      },
      {
        h: "Availability and changes to the service",
        p: [
          "We work to keep {app} available and up to date, but we cannot guarantee that it is always available or free of errors. We may change, pause or end features, in particular to protect the safety of members.",
        ],
      },
      {
        h: "Liability",
        p: [
          "We are liable without limitation for damage caused intentionally or through gross negligence, for injury to life, body or health, and under the German Product Liability Act. For slight negligence we are liable only if we breach an essential obligation, and then only for the typical, foreseeable damage. Otherwise our liability is excluded.",
        ],
      },
      {
        h: "Links to other websites",
        p: ["Sources link to websites and documents of other publishers. We are not responsible for their content."],
      },
      {
        h: "Changes to these terms",
        p: [
          "If we change these terms, we will tell you in the app before the changes take effect. If you do not agree, you can stop using {app} and delete your data at any time.",
        ],
      },
      {
        h: "Applicable law and contact",
        p: [
          "German law applies. If you are a consumer living in another country, the mandatory consumer protection rules of that country remain unaffected. Contact: {email}.",
        ],
      },
    ],
  },
  imprint: {
    title: "Legal notice",
    intro: "Information under § 5 of the German Digital Services Act (DDG).",
    sections: [
      { h: "Provider", p: ["{operator}", "{address}", "Represented by: {representative}"] },
      { h: "Contact", p: ["Email: {email}", "Phone: {phone}"] },
      { h: "Register and VAT", p: ["Register entry: {register}", "VAT identification number: {vatId}"] },
      {
        h: "Responsible for content",
        p: ["Responsible for content under § 18(2) of the German Interstate Media Treaty (MStV): {contentResponsible}"],
      },
      {
        h: "Consumer dispute resolution",
        p: ["We are not obliged and not willing to take part in dispute resolution proceedings before a consumer arbitration board."],
      },
      {
        h: "Health information",
        p: ["The content of {app} is general health information and does not replace advice from a doctor. In an emergency, call 112."],
      },
    ],
  },
  accessibility: {
    title: "Accessibility statement",
    intro:
      "{operator} wants {app} to be usable by everyone, including people who use a screen reader, a keyboard, magnification or voice control. This statement applies to the {app} website and apps.",
    sections: [
      {
        h: "Standard and status",
        p: [
          "Our goal is to meet the Web Content Accessibility Guidelines (WCAG) 2.2 at level AA, as required by the European standard EN 301 549.",
          "{app} is partially compliant. With every release, every page is tested automatically in all seven languages, at phone and desktop sizes. An independent expert audit and tests with people with disabilities are planned before launch; we will update this statement with the results.",
        ],
      },
      {
        h: "What we do",
        p: [
          "• A clear structure with headings, landmarks and a skip link; everything works with a keyboard and with screen readers (VoiceOver, TalkBack).",
          "• Text can be enlarged to 200 % without losing content; colour is never the only signal; contrast is sufficient in light and dark mode.",
          "• Charts are also available as tables; animations are reduced when your device asks for it.",
          "• Insights can be read aloud by your device; Arabic is laid out from right to left.",
          "• Plain language, with technical terms explained.",
        ],
      },
      {
        h: "Known limitations",
        p: [
          "• Documents in the evidence library come from other publishers. Some, such as older PDF files, may not be fully accessible. {app} shows the passages it relies on as text.",
          "• Community posts are written by members and may not always follow good accessibility practice.",
          "If you find a barrier that is not listed here, please tell us.",
        ],
      },
      {
        h: "Feedback and contact",
        p: [
          "Write to {email} and tell us the page and the problem. We will reply within two weeks and, where possible, send you the content in an accessible form.",
        ],
      },
      {
        h: "Enforcement",
        p: ["If our answer does not solve your problem, you can turn to: {accessibilityAuthority}."],
      },
      {
        h: "About this statement",
        p: ["This statement was prepared on {date}, based on automated tests and our own checks."],
      },
    ],
  },
};
