import type { LegalTexts } from "./types";

export const es: LegalTexts = {
  privacy: {
    title: "Política de privacidad",
    intro:
      "Esta política explica qué datos personales trata {app}, con qué fin y cuáles son tus derechos. En resumen: casi todo lo que introduces se queda en tu dispositivo. Nuestros servidores solo ven lo necesario para responder a tus preguntas, mantener la comunidad y, si lo activas, guardar una copia cifrada de tu plan que no podemos leer. No hay publicidad, ni seguimiento, ni venta de datos.",
    sections: [
      {
        h: "Responsable del tratamiento",
        p: [
          "El responsable del tratamiento según el Reglamento General de Protección de Datos (RGPD) es {operator}, {address}. Correo electrónico: {email}.",
          "Delegado de protección de datos: {dpo}.",
        ],
      },
      {
        h: "Información sobre tu salud",
        p: [
          "Datos como tu camino, un tipo de cáncer, tu fase de tratamiento o lo que escribes en la comunidad son datos de salud, una categoría especial de datos personales (art. 9 del RGPD). Nuestros servidores solo los reciben si tú lo decides: al hacer una pregunta, unirte a la comunidad o activar la sincronización. En cada caso nos basamos en tu consentimiento explícito (art. 9, apartado 2, letra a), del RGPD). Puedes retirarlo en cualquier momento con efecto para el futuro, por ejemplo borrando los datos como se explica más abajo.",
        ],
      },
      {
        h: "Lo que se queda en tu dispositivo",
        p: [
          "Tu perfil (camino, rango de edad, sexo, tipos de cáncer, fase de tratamiento, país), tu plan y tus registros semanales, tus respuestas al chequeo de hábitos, tus preguntas para las citas, los ajustes de recordatorios, las conversaciones, el recuento de pasos, las claves descargadas y los ajustes de idioma y visualización se guardan solo en tu dispositivo. No podemos verlos.",
          "Puedes borrarlos en cualquier momento con «Eliminar mis datos de este dispositivo». También se borran si desinstalas la aplicación o eliminas los datos del sitio en tu navegador.",
        ],
      },
      {
        h: "Las preguntas que haces",
        p: [
          "Cuando haces una pregunta, se envía a nuestro servidor junto con los mensajes anteriores de la misma conversación y los datos del perfil que hayas decidido compartir, para que podamos encontrar evidencia y redactar una respuesta. Esto ocurre solo en memoria: las preguntas y respuestas no se guardan.",
          "Las respuestas las redacta un modelo de lenguaje que gestionamos nosotros mismos, en los servidores indicados en «Destinatarios y encargados del tratamiento». Tu pregunta no se envía a ningún proveedor externo de IA.",
          "Base jurídica: prestar el servicio que has pedido (art. 6, apartado 1, letra b), del RGPD) y, para los datos sobre tu salud, tu consentimiento explícito (art. 9, apartado 2, letra a), del RGPD).",
        ],
      },
      {
        h: "Tus valoraciones",
        p: [
          "Si valoras una respuesta o una clave, guardamos tu valoración, los motivos que elijas y tu comentario opcional, tras eliminar automáticamente los datos personales. Los usamos para detectar y corregir errores y los conservamos 12 meses. Base jurídica: nuestro interés legítimo en ofrecer información correcta y segura (art. 6, apartado 1, letra f), del RGPD).",
        ],
      },
      {
        h: "La comunidad",
        p: [
          "Unirte a la comunidad es opcional y solo es posible a partir de los 18 años. Guardamos:",
          "• el apodo que elijas, tu idioma y, si eliges una, una insignia de tu camino;",
          "• tus publicaciones y respuestas, tus reacciones, denuncias, los miembros que bloqueas y tus posibles recursos;",
          "• una huella (hash) de la clave de acceso aleatoria que se guarda en tu dispositivo. Nunca te pedimos tu nombre, tu correo electrónico ni tu número de teléfono.",
          "Cada publicación se revisa automáticamente antes de mostrarse, y moderadores formados examinan las denuncias. Las publicaciones retiradas se eliminan a los 90 días.",
          "Base jurídica: tu consentimiento explícito al unirte (art. 9, apartado 2, letra a), del RGPD). En la aplicación puedes descargar todos tus datos de la comunidad y salir de ella en cualquier momento. Al salir se eliminan tu membresía y tus publicaciones.",
          "Si respondes a la pregunta opcional «¿Has encontrado apoyo aquí este mes?», conservamos tu respuesta 12 meses; se separa de tu membresía cuando sales. Para el informe de transparencia público conservamos cifras de moderación anónimas: solo recuentos, sin miembros ni textos.",
        ],
      },
      {
        h: "Sincronización cifrada (opcional)",
        p: [
          "Si activas la sincronización, tu plan y tu perfil se cifran en tu dispositivo con una clave derivada de tu código de sincronización. Nuestro servidor solo guarda los datos cifrados, un número de versión y una huella de una clave de escritura: no podemos leer tus datos ni sabemos quién eres. La copia se elimina cuando desactivas la sincronización, o tras 400 días sin cambios. Base jurídica: tu consentimiento explícito (art. 9, apartado 2, letra a), del RGPD).",
        ],
      },
      {
        h: "Pasos, aplicaciones de salud y recordatorios",
        p: [
          "El recuento de pasos se lee en tu teléfono: del sensor de movimiento o, si lo activas, de Apple Salud o Health Connect (solo lectura: los totales diarios de los últimos 7 días). Los recordatorios semanales los programa tu teléfono o se guardan en tu propio calendario. Nada de esto se nos envía.",
        ],
      },
      {
        h: "Datos técnicos y seguridad",
        p: [
          "Para mostrar páginas y respuestas, nuestros servidores tratan necesariamente tu dirección IP y datos técnicos de cada solicitud, como el tipo de navegador. Las direcciones IP se mantienen en memoria unos minutos para limitar abusos y no se escriben en nuestros registros. Nuestros registros guardan la hora, la función utilizada, el resultado y la duración de cada solicitud, y se conservan 30 días. Base jurídica: nuestro interés legítimo en un servicio seguro y fiable (art. 6, apartado 1, letra f), del RGPD).",
          "Todas las conexiones están cifradas (TLS).",
        ],
      },
      {
        h: "Cookies y almacenamiento en tu dispositivo",
        p: [
          "No usamos cookies publicitarias ni de seguimiento, ni herramientas de analítica. El sitio guarda tu elección de idioma en una cookie, y tus ajustes y contenidos en el almacenamiento local de tu navegador. Es estrictamente necesario para prestar el servicio que pides (§ 25, apartado 2, n.º 2 de la ley alemana TDDDG), por lo que no hace falta un aviso de consentimiento.",
        ],
      },
      {
        h: "Destinatarios y encargados del tratamiento",
        p: [
          "{hosting}",
          "Nuestros proveedores solo tratan los datos siguiendo nuestras instrucciones y con contratos de encargo del tratamiento (art. 28 del RGPD). Los datos se tratan en la Unión Europea o el Espacio Económico Europeo. No vendemos datos ni los compartimos con fines publicitarios.",
          "Las publicaciones de la comunidad pueden leerlas los demás miembros.",
        ],
      },
      {
        h: "Cuánto tiempo conservamos los datos",
        p: [
          "• Datos en tu dispositivo: hasta que los borres.",
          "• Preguntas y respuestas: no se guardan.",
          "• Valoraciones: 12 meses.",
          "• Comunidad: hasta que salgas; publicaciones retiradas, 90 días; respuestas a la encuesta, 12 meses.",
          "• Sincronización cifrada: hasta que la desactives, como máximo 400 días después del último cambio.",
          "• Registros: 30 días.",
        ],
      },
      {
        h: "Tus derechos",
        p: [
          "Tienes derecho de acceso (art. 15 del RGPD), rectificación (art. 16), supresión (art. 17), limitación del tratamiento (art. 18) y portabilidad (art. 20), así como a oponerte al tratamiento basado en nuestros intereses legítimos (art. 21). Puedes retirar tu consentimiento en cualquier momento (art. 7, apartado 3); ello no afecta a la licitud del tratamiento anterior a la retirada.",
          "Muchos de estos derechos se ejercen directamente en la aplicación: descargar o borrar tus datos de la comunidad, desactivar la sincronización o borrar los datos de tu dispositivo. Como no sabemos quién eres, podemos pedirte que demuestres que unos datos son tuyos, por ejemplo con la descarga de tus datos de la comunidad. Para cualquier otra cuestión, escribe a {email}.",
          "También tienes derecho a presentar una reclamación ante una autoridad de control de protección de datos (art. 77 del RGPD), en particular en el país donde vives o trabajas. La autoridad competente para nosotros es: {authority}.",
        ],
      },
      {
        h: "Decisiones automatizadas e inteligencia artificial",
        p: [
          "No tomamos decisiones sobre ti que produzcan efectos jurídicos o te afecten de forma similarmente significativa (art. 22 del RGPD). Las respuestas y las claves se generan con inteligencia artificial a partir de investigaciones publicadas. Son información general, no consejo médico.",
        ],
      },
      {
        h: "Cambios en esta política",
        p: [
          "Actualizamos esta política cuando cambia nuestro tratamiento de datos. La fecha de arriba indica la versión vigente. Si un cambio afecta a datos que ya nos has dado, te lo comunicaremos en la aplicación.",
        ],
      },
    ],
  },
  terms: {
    title: "Condiciones de uso",
    intro:
      "Estas condiciones se aplican cuando usas {app} en la web o en la aplicación. {app} lo ofrece {operator} («nosotros»). Léelas junto con la política de privacidad y, si te unes a la comunidad, con las normas de la comunidad.",
    sections: [
      {
        h: "Qué es {app} y qué no es",
        p: [
          "{app} ofrece información general basada en la evidencia sobre hábitos de vida, prevención del cáncer y la vida durante y después del cáncer, y un espacio moderado donde las personas se apoyan entre sí. Está dirigido a adultos.",
          "{app} no es un servicio médico. No diagnostica, trata ni vigila ninguna enfermedad y no sustituye a tu médico ni a tu equipo sanitario. No retrases ni cambies un tratamiento por algo que leas aquí. En una emergencia, llama al 112 en Europa o a tu número de emergencias local.",
        ],
      },
      {
        h: "Respuestas redactadas con inteligencia artificial",
        p: [
          "Las respuestas y las claves se generan con inteligencia artificial a partir de una biblioteca seleccionada de investigaciones y guías. Cada afirmación indica su fuente y la solidez de la evidencia. Pese a estos controles, una respuesta puede ser incompleta, estar desactualizada o ser errónea. Revisa las fuentes y habla con tu equipo sanitario antes de actuar.",
        ],
      },
      {
        h: "Gratis y sin cuenta",
        p: [
          "{app} es gratuito y no necesitas una cuenta. Algunas funciones guardan datos en nuestros servidores, pero solo si decides usarlas; consulta la política de privacidad.",
        ],
      },
      {
        h: "La comunidad",
        p: [
          "Debes tener al menos 18 años para unirte. Respeta las normas de la comunidad, en particular:",
          "• sé amable y alentador, y respeta las decisiones de los demás miembros;",
          "• no des consejos médicos, no promociones productos ni tratamientos y no compartas datos de contacto;",
          "• no publiques nada que permita identificarte a ti o a otra persona;",
          "• no publiques contenidos ilegales, de odio o dañinos.",
          "Eres responsable de lo que publicas. Conservas todos los derechos sobre tus publicaciones y nos permites, de forma gratuita, mostrarlas a otros miembros mientras estén publicadas. Revisamos las publicaciones antes de que aparezcan y podemos retirar publicaciones o suspender a miembros que incumplan las normas. Puedes pedir que revisemos esa decisión (recurso) en la aplicación.",
        ],
      },
      {
        h: "Tus datos y tu dispositivo",
        p: [
          "La mayoría de tus datos se guarda solo en tu dispositivo. Protege tu dispositivo y tu código de sincronización: no podemos recuperar datos que nunca hemos recibido y, sin el código de sincronización, nadie puede descifrar tu copia sincronizada, ni siquiera nosotros.",
        ],
      },
      {
        h: "Disponibilidad y cambios del servicio",
        p: [
          "Trabajamos para que {app} esté disponible y actualizado, pero no podemos garantizar que funcione siempre ni sin errores. Podemos cambiar, pausar o retirar funciones, en particular para proteger la seguridad de los miembros.",
        ],
      },
      {
        h: "Responsabilidad",
        p: [
          "Respondemos sin límite de los daños causados con dolo o negligencia grave, de los daños a la vida, la integridad física o la salud, y conforme a la ley alemana de responsabilidad por productos. En caso de negligencia leve, solo respondemos si incumplimos una obligación esencial, y únicamente del daño típico y previsible. En los demás casos, nuestra responsabilidad queda excluida.",
        ],
      },
      {
        h: "Enlaces a otros sitios web",
        p: ["Las fuentes enlazan a sitios web y documentos de otros editores. No somos responsables de su contenido."],
      },
      {
        h: "Cambios en estas condiciones",
        p: [
          "Si cambiamos estas condiciones, te lo comunicaremos en la aplicación antes de que entren en vigor. Si no estás de acuerdo, puedes dejar de usar {app} y borrar tus datos en cualquier momento.",
        ],
      },
      {
        h: "Ley aplicable y contacto",
        p: [
          "Se aplica la ley alemana. Si eres un consumidor que vive en otro país, se mantienen las normas imperativas de protección de los consumidores de ese país. Contacto: {email}.",
        ],
      },
    ],
  },
  imprint: {
    title: "Aviso legal",
    intro: "Información conforme al § 5 de la ley alemana de servicios digitales (Digitale-Dienste-Gesetz, DDG).",
    sections: [
      { h: "Prestador del servicio", p: ["{operator}", "{address}", "Representado por: {representative}"] },
      { h: "Contacto", p: ["Correo electrónico: {email}", "Teléfono: {phone}"] },
      { h: "Registro e IVA", p: ["Inscripción registral: {register}", "Número de identificación a efectos del IVA: {vatId}"] },
      {
        h: "Responsable del contenido",
        p: ["Responsable del contenido según el § 18, apartado 2, del Tratado Interestatal de Medios alemán (MStV): {contentResponsible}"],
      },
      {
        h: "Resolución de litigios de consumo",
        p: ["No estamos obligados ni dispuestos a participar en procedimientos de resolución de litigios ante una entidad de arbitraje de consumo."],
      },
      {
        h: "Información de salud",
        p: ["Los contenidos de {app} son información de salud general y no sustituyen el consejo de un médico. En una emergencia, llama al 112."],
      },
    ],
  },
  accessibility: {
    title: "Declaración de accesibilidad",
    intro:
      "{operator} quiere que todo el mundo pueda usar {app}, también con lector de pantalla, teclado, ampliación o control por voz. Esta declaración se aplica al sitio web y a las aplicaciones de {app}.",
    sections: [
      {
        h: "Norma y situación de cumplimiento",
        p: [
          "Nuestro objetivo es cumplir las Pautas de Accesibilidad para el Contenido Web (WCAG) 2.2 en el nivel AA, como exige la norma europea EN 301 549.",
          "{app} es parcialmente conforme. Con cada versión, todas las páginas se prueban automáticamente en los siete idiomas, en tamaños de teléfono y de escritorio. Antes del lanzamiento están previstas una auditoría independiente por especialistas y pruebas con personas con discapacidad; actualizaremos esta declaración con los resultados.",
        ],
      },
      {
        h: "Lo que hacemos",
        p: [
          "• Una estructura clara con encabezados, zonas de referencia y un enlace para saltar al contenido; todo funciona con teclado y con lectores de pantalla (VoiceOver, TalkBack).",
          "• El texto puede ampliarse al 200 % sin perder contenido; el color nunca es la única señal; el contraste es suficiente en modo claro y oscuro.",
          "• Los gráficos también están disponibles como tablas; las animaciones se reducen si tu dispositivo lo pide.",
          "• Tu dispositivo puede leer las claves en voz alta; el árabe se muestra de derecha a izquierda.",
          "• Lenguaje sencillo, con los términos técnicos explicados.",
        ],
      },
      {
        h: "Limitaciones conocidas",
        p: [
          "• Los documentos de la biblioteca de evidencia proceden de otros editores. Algunos, como archivos PDF antiguos, pueden no ser totalmente accesibles. {app} muestra como texto los fragmentos en los que se basa.",
          "• Las publicaciones de la comunidad las escriben los miembros y no siempre siguen las buenas prácticas de accesibilidad.",
          "Si encuentras una barrera que no figura aquí, dínoslo.",
        ],
      },
      {
        h: "Comentarios y contacto",
        p: [
          "Escribe a {email} indicando la página y el problema. Te responderemos en un plazo de dos semanas y, siempre que sea posible, te enviaremos el contenido en un formato accesible.",
        ],
      },
      {
        h: "Procedimiento de aplicación",
        p: ["Si nuestra respuesta no resuelve tu problema, puedes dirigirte a: {accessibilityAuthority}."],
      },
      {
        h: "Sobre esta declaración",
        p: ["Esta declaración se preparó el {date}, a partir de pruebas automatizadas y de nuestras propias comprobaciones."],
      },
    ],
  },
};
