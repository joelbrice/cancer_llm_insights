import type { LegalTexts } from "./types";

export const pt: LegalTexts = {
  privacy: {
    title: "Política de privacidade",
    intro:
      "Esta política explica que dados pessoais o {app} trata, para que fins e quais são os seus direitos. Em resumo: quase tudo o que introduz fica no seu dispositivo. Os nossos servidores só veem o necessário para responder às suas perguntas, manter a comunidade e, se o ativar, guardar uma cópia cifrada do seu plano que não conseguimos ler. Não há publicidade, nem rastreamento, nem venda de dados.",
    sections: [
      {
        h: "Responsável pelo tratamento",
        p: [
          "O responsável pelo tratamento nos termos do Regulamento Geral sobre a Proteção de Dados (RGPD) é {operator}, {address}. E-mail: {email}.",
          "Encarregado da proteção de dados: {dpo}.",
        ],
      },
      {
        h: "Informações sobre a sua saúde",
        p: [
          "Dados como o seu percurso, um tipo de cancro, a sua fase de tratamento ou o que escreve na comunidade são dados de saúde, uma categoria especial de dados pessoais (art. 9.º do RGPD). Os nossos servidores só os recebem se o decidir: ao fazer uma pergunta, ao aderir à comunidade ou ao ativar a sincronização. Em cada caso, baseamo-nos no seu consentimento explícito (art. 9.º, n.º 2, alínea a), do RGPD). Pode retirá-lo em qualquer momento, com efeitos para o futuro, por exemplo apagando os dados como explicado abaixo.",
        ],
      },
      {
        h: "O que fica no seu dispositivo",
        p: [
          "O seu perfil (percurso, faixa etária, sexo, tipos de cancro, fase de tratamento, país), o seu plano e os seus registos semanais, as suas respostas à avaliação de hábitos, as perguntas para as consultas, as definições de lembretes, as conversas, a contagem de passos, os destaques transferidos e as definições de idioma e apresentação são guardados apenas no seu dispositivo. Não os conseguimos ver.",
          "Pode apagá-los em qualquer momento com «Eliminar os meus dados deste dispositivo». Também são apagados se desinstalar a aplicação ou limpar os dados do site no seu navegador.",
        ],
      },
      {
        h: "As perguntas que faz",
        p: [
          "Quando faz uma pergunta, ela é enviada para o nosso servidor juntamente com as mensagens anteriores da mesma conversa e os dados do perfil que decidiu partilhar, para que possamos encontrar evidência e redigir uma resposta. Isto acontece apenas em memória: as perguntas e respostas não são guardadas.",
          "As respostas são redigidas por um modelo de linguagem que nós próprios operamos, nos servidores indicados em «Destinatários e subcontratantes». A sua pergunta não é enviada a nenhum fornecedor externo de IA.",
          "Fundamento jurídico: a prestação do serviço que pediu (art. 6.º, n.º 1, alínea b), do RGPD) e, para os dados sobre a sua saúde, o seu consentimento explícito (art. 9.º, n.º 2, alínea a), do RGPD).",
        ],
      },
      {
        h: "As suas avaliações",
        p: [
          "Se avaliar uma resposta ou um destaque, guardamos a sua avaliação, os motivos que escolher e o seu comentário opcional, depois de removidos automaticamente os dados pessoais. Usamo-los para encontrar e corrigir erros e conservamo-los durante 12 meses. Fundamento jurídico: o nosso interesse legítimo em informação correta e segura (art. 6.º, n.º 1, alínea f), do RGPD).",
        ],
      },
      {
        h: "A comunidade",
        p: [
          "Aderir à comunidade é opcional e só é possível a partir dos 18 anos. Guardamos:",
          "• a alcunha que escolher, o seu idioma e, se escolher um, um distintivo do percurso;",
          "• as suas publicações e respostas, as suas reações, denúncias, os membros que bloqueia e eventuais recursos;",
          "• uma impressão digital (hash) da chave de acesso aleatória guardada no seu dispositivo. Nunca lhe pedimos o nome, o e-mail ou o número de telefone.",
          "Cada publicação é verificada automaticamente antes de ser mostrada, e moderadores com formação analisam as denúncias. As publicações removidas são apagadas ao fim de 90 dias.",
          "Fundamento jurídico: o seu consentimento explícito ao aderir (art. 9.º, n.º 2, alínea a), do RGPD). Na aplicação pode transferir todos os seus dados da comunidade e sair dela em qualquer momento. Ao sair, a sua adesão e as suas publicações são apagadas.",
          "Se responder à pergunta opcional «Encontrou apoio aqui este mês?», conservamos a sua resposta durante 12 meses; é separada da sua adesão quando sai. Para o relatório de transparência público conservamos números de moderação anónimos: apenas contagens, sem membros nem textos.",
        ],
      },
      {
        h: "Sincronização cifrada (opcional)",
        p: [
          "Se ativar a sincronização, o seu plano e o seu perfil são cifrados no seu dispositivo com uma chave derivada do seu código de sincronização. O nosso servidor guarda apenas os dados cifrados, um número de versão e uma impressão digital de uma chave de escrita: não conseguimos ler os seus dados nem sabemos quem é. A cópia é apagada quando desativa a sincronização, ou após 400 dias sem alterações. Fundamento jurídico: o seu consentimento explícito (art. 9.º, n.º 2, alínea a), do RGPD).",
        ],
      },
      {
        h: "Passos, aplicações de saúde e lembretes",
        p: [
          "A contagem de passos é lida no seu telemóvel: a partir do sensor de movimento ou, se o ativar, da app Saúde da Apple ou do Health Connect (apenas leitura: os totais diários dos últimos 7 dias). Os lembretes semanais são agendados pelo seu telemóvel ou guardados no seu próprio calendário. Nada disto nos é enviado.",
        ],
      },
      {
        h: "Dados técnicos e segurança",
        p: [
          "Para apresentar páginas e respostas, os nossos servidores tratam necessariamente o seu endereço IP e dados técnicos de cada pedido, como o tipo de navegador. Os endereços IP ficam em memória durante alguns minutos para limitar abusos e não são escritos nos nossos registos. Os nossos registos guardam a hora, a função utilizada, o resultado e a duração de cada pedido, e são conservados durante 30 dias. Fundamento jurídico: o nosso interesse legítimo num serviço seguro e fiável (art. 6.º, n.º 1, alínea f), do RGPD).",
          "Todas as ligações são cifradas (TLS).",
        ],
      },
      {
        h: "Cookies e armazenamento no seu dispositivo",
        p: [
          "Não usamos cookies de publicidade ou de rastreamento, nem ferramentas de análise. O site guarda a sua escolha de idioma num cookie, e as suas definições e conteúdos no armazenamento local do seu navegador. Isto é estritamente necessário para prestar o serviço que pediu (§ 25, n.º 2, ponto 2, da lei alemã TDDDG), pelo que não é necessário um aviso de consentimento.",
        ],
      },
      {
        h: "Destinatários e subcontratantes",
        p: [
          "{hosting}",
          "Os nossos prestadores de serviços só tratam os dados segundo as nossas instruções e ao abrigo de contratos de subcontratação (art. 28.º do RGPD). Os dados são tratados na União Europeia ou no Espaço Económico Europeu. Não vendemos dados nem os partilhamos para fins publicitários.",
          "As publicações da comunidade podem ser lidas pelos outros membros.",
        ],
      },
      {
        h: "Durante quanto tempo conservamos os dados",
        p: [
          "• Dados no seu dispositivo: até os apagar.",
          "• Perguntas e respostas: não são guardadas.",
          "• Avaliações: 12 meses.",
          "• Comunidade: até sair; publicações removidas, 90 dias; respostas ao inquérito, 12 meses.",
          "• Sincronização cifrada: até a desativar, no máximo 400 dias após a última alteração.",
          "• Registos: 30 dias.",
        ],
      },
      {
        h: "Os seus direitos",
        p: [
          "Tem direito de acesso (art. 15.º do RGPD), retificação (art. 16.º), apagamento (art. 17.º), limitação do tratamento (art. 18.º) e portabilidade (art. 20.º), bem como o direito de se opor ao tratamento baseado nos nossos interesses legítimos (art. 21.º). Pode retirar o seu consentimento em qualquer momento (art. 7.º, n.º 3), sem comprometer a licitude do tratamento efetuado antes da retirada.",
          "Muitos destes direitos exercem-se diretamente na aplicação: transferir ou apagar os seus dados da comunidade, desativar a sincronização ou apagar os dados do seu dispositivo. Como não sabemos quem é, podemos pedir-lhe que demonstre que determinados dados lhe pertencem, por exemplo com a transferência dos seus dados da comunidade. Para qualquer outro pedido, escreva para {email}.",
          "Tem também o direito de apresentar reclamação a uma autoridade de controlo da proteção de dados (art. 77.º do RGPD), em especial no país onde vive ou trabalha. A autoridade competente para nós é: {authority}.",
        ],
      },
      {
        h: "Decisões automatizadas e inteligência artificial",
        p: [
          "Não tomamos decisões a seu respeito que produzam efeitos jurídicos ou que o afetem significativamente de forma similar (art. 22.º do RGPD). As respostas e os destaques são gerados com inteligência artificial a partir de investigação publicada. São informação geral, não aconselhamento médico.",
        ],
      },
      {
        h: "Alterações a esta política",
        p: [
          "Atualizamos esta política quando o nosso tratamento de dados muda. A data no topo indica a versão em vigor. Se uma alteração afetar dados que já nos forneceu, informá-lo-emos na aplicação.",
        ],
      },
    ],
  },
  terms: {
    title: "Termos de utilização",
    intro:
      "Estes termos aplicam-se quando utiliza o {app} na web ou na aplicação. O {app} é disponibilizado por {operator} («nós»). Leia-os juntamente com a política de privacidade e, se aderir à comunidade, com as regras da comunidade.",
    sections: [
      {
        h: "O que o {app} é, e o que não é",
        p: [
          "O {app} oferece informação geral baseada em evidência sobre estilo de vida, prevenção do cancro e a vida durante e depois do cancro, bem como um espaço moderado onde as pessoas se apoiam umas às outras. Destina-se a adultos.",
          "O {app} não é um serviço médico. Não diagnostica, não trata nem acompanha qualquer doença e não substitui o seu médico nem a sua equipa de saúde. Não adie nem altere um tratamento por causa de algo que leu aqui. Em caso de emergência, ligue para o 112 na Europa ou para o número de emergência local.",
        ],
      },
      {
        h: "Respostas redigidas com inteligência artificial",
        p: [
          "As respostas e os destaques são gerados com inteligência artificial a partir de uma biblioteca selecionada de investigação e orientações. Cada afirmação indica a sua fonte e a solidez da evidência. Apesar destes controlos, uma resposta pode estar incompleta, desatualizada ou errada. Verifique as fontes e fale com a sua equipa de saúde antes de agir.",
        ],
      },
      {
        h: "Gratuito e sem conta",
        p: [
          "O {app} é gratuito e não precisa de conta. Algumas funcionalidades guardam dados nos nossos servidores, mas só se decidir usá-las; consulte a política de privacidade.",
        ],
      },
      {
        h: "A comunidade",
        p: [
          "Tem de ter pelo menos 18 anos para aderir. Respeite as regras da comunidade, em especial:",
          "• seja amável e encorajador e respeite as decisões dos outros membros;",
          "• não dê conselhos médicos, não promova produtos ou tratamentos e não partilhe contactos;",
          "• não publique nada que permita identificá-lo a si ou a outra pessoa;",
          "• não publique conteúdos ilegais, de ódio ou prejudiciais.",
          "É responsável pelo que publica. Mantém todos os direitos sobre as suas publicações e autoriza-nos, gratuitamente, a mostrá-las aos outros membros enquanto estiverem publicadas. Verificamos as publicações antes de aparecerem e podemos remover publicações ou suspender membros que violem as regras. Pode pedir a revisão dessa decisão (recurso) na aplicação.",
        ],
      },
      {
        h: "Os seus dados e o seu dispositivo",
        p: [
          "A maior parte dos seus dados fica guardada apenas no seu dispositivo. Proteja o seu dispositivo e o seu código de sincronização: não podemos recuperar dados que nunca recebemos e, sem o código de sincronização, ninguém consegue decifrar a sua cópia sincronizada, nem mesmo nós.",
        ],
      },
      {
        h: "Disponibilidade e alterações do serviço",
        p: [
          "Trabalhamos para manter o {app} disponível e atualizado, mas não podemos garantir que esteja sempre disponível ou sem erros. Podemos alterar, suspender ou terminar funcionalidades, em especial para proteger a segurança dos membros.",
        ],
      },
      {
        h: "Responsabilidade",
        p: [
          "Respondemos sem limitação pelos danos causados com dolo ou negligência grave, pelos danos à vida, à integridade física ou à saúde, e nos termos da lei alemã da responsabilidade pelos produtos. Em caso de negligência leve, só respondemos se violarmos uma obrigação essencial, e apenas pelo dano típico e previsível. Nos restantes casos, a nossa responsabilidade fica excluída.",
        ],
      },
      {
        h: "Ligações para outros sites",
        p: ["As fontes remetem para sites e documentos de outros editores. Não somos responsáveis pelo seu conteúdo."],
      },
      {
        h: "Alterações a estes termos",
        p: [
          "Se alterarmos estes termos, informá-lo-emos na aplicação antes de as alterações produzirem efeitos. Se não concordar, pode deixar de usar o {app} e apagar os seus dados em qualquer momento.",
        ],
      },
      {
        h: "Lei aplicável e contacto",
        p: [
          "Aplica-se a lei alemã. Se for um consumidor residente noutro país, mantêm-se as normas imperativas de proteção dos consumidores desse país. Contacto: {email}.",
        ],
      },
    ],
  },
  imprint: {
    title: "Aviso legal",
    intro: "Informações nos termos do § 5 da lei alemã dos serviços digitais (Digitale-Dienste-Gesetz, DDG).",
    sections: [
      { h: "Prestador do serviço", p: ["{operator}", "{address}", "Representado por: {representative}"] },
      { h: "Contacto", p: ["E-mail: {email}", "Telefone: {phone}"] },
      { h: "Registo e IVA", p: ["Inscrição no registo: {register}", "Número de identificação para efeitos de IVA: {vatId}"] },
      {
        h: "Responsável pelo conteúdo",
        p: ["Responsável pelo conteúdo nos termos do § 18, n.º 2, do Tratado Interestadual dos Media alemão (MStV): {contentResponsible}"],
      },
      {
        h: "Resolução de litígios de consumo",
        p: ["Não somos obrigados nem estamos dispostos a participar em procedimentos de resolução de litígios perante uma entidade de resolução alternativa de litígios de consumo."],
      },
      {
        h: "Informação de saúde",
        p: ["Os conteúdos do {app} são informação geral de saúde e não substituem o aconselhamento de um médico. Em caso de emergência, ligue para o 112."],
      },
    ],
  },
  accessibility: {
    title: "Declaração de acessibilidade",
    intro:
      "{operator} quer que todas as pessoas possam usar o {app}, incluindo com leitor de ecrã, teclado, ampliação ou controlo por voz. Esta declaração aplica-se ao site e às aplicações do {app}.",
    sections: [
      {
        h: "Norma e estado de conformidade",
        p: [
          "O nosso objetivo é cumprir as Diretrizes de Acessibilidade para o Conteúdo da Web (WCAG) 2.2, nível AA, tal como exige a norma europeia EN 301 549.",
          "O {app} está parcialmente conforme. A cada versão, todas as páginas são testadas automaticamente nos sete idiomas, em tamanhos de telemóvel e de computador. Antes do lançamento estão previstas uma auditoria independente por especialistas e testes com pessoas com deficiência; atualizaremos esta declaração com os resultados.",
        ],
      },
      {
        h: "O que fazemos",
        p: [
          "• Uma estrutura clara com títulos, áreas de referência e uma ligação para saltar para o conteúdo; tudo funciona com teclado e com leitores de ecrã (VoiceOver, TalkBack).",
          "• O texto pode ser ampliado até 200 % sem perda de conteúdo; a cor nunca é o único sinal; o contraste é suficiente nos modos claro e escuro.",
          "• Os gráficos também estão disponíveis como tabelas; as animações são reduzidas quando o seu dispositivo o pede.",
          "• O seu dispositivo pode ler os destaques em voz alta; o árabe é apresentado da direita para a esquerda.",
          "• Linguagem simples, com os termos técnicos explicados.",
        ],
      },
      {
        h: "Limitações conhecidas",
        p: [
          "• Os documentos da biblioteca de evidência provêm de outros editores. Alguns, como ficheiros PDF antigos, podem não ser totalmente acessíveis. O {app} mostra como texto os excertos em que se baseia.",
          "• As publicações da comunidade são escritas pelos membros e nem sempre seguem as boas práticas de acessibilidade.",
          "Se encontrar uma barreira que não esteja aqui indicada, diga-nos.",
        ],
      },
      {
        h: "Comentários e contacto",
        p: [
          "Escreva para {email} indicando a página e o problema. Responderemos no prazo de duas semanas e, sempre que possível, enviaremos o conteúdo num formato acessível.",
        ],
      },
      {
        h: "Procedimento de execução",
        p: ["Se a nossa resposta não resolver o seu problema, pode dirigir-se a: {accessibilityAuthority}."],
      },
      {
        h: "Sobre esta declaração",
        p: ["Esta declaração foi preparada em {date}, com base em testes automatizados e nas nossas próprias verificações."],
      },
    ],
  },
};
