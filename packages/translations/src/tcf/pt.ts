import type { TcfMessages } from "./index";

const labels = {
  title: "Parceiros e finalidades",
  purposes: "Finalidades",
  specialFeatures: "Funcionalidades especiais",
  vendors: "Fornecedores",
  search: "Pesquisar fornecedores",
  consent: "Consentimento",
  legitimateInterest: "Interesse legítimo",
  acceptAll: "Aceitar tudo",
  rejectAll: "Rejeitar tudo",
  save: "Guardar escolhas",
  saved: "Escolhas guardadas",
  empty: "Nenhum fornecedor corresponde",
  details: "Detalhes",
  close: "Fechar detalhes",
  consentPurposes: "Finalidades (consentimento)",
  legIntPurposes: "Finalidades (interesse legítimo)",
  specialPurposes: "Finalidades especiais",
  features: "Funcionalidades",
  dataCategories: "Categorias de dados",
  retention: "Conservação de dados",
  retentionDays: "Dias: {days}",
  standardRetention: "Conservação padrão",
  privacyPolicy: "Política de privacidade",
  legIntClaim: "Declaração de interesse legítimo",
  storage: "Armazenamento no dispositivo",
  cookieMaxAge: "Prazo máximo dos cookies (dias): {days}",
  cookieSession: "Cookies sem prazo de validade fixo",
  cookieRefresh: "A validade do cookie é renovada com a utilização",
  noCookies: "Não utiliza cookies",
  nonCookieAccess:
    "Utiliza outros métodos de armazenamento ou acesso no dispositivo",
  storageDisclosure: "Declaração de armazenamento",
} as const satisfies TcfMessages;
export default labels;
export { labels };
