import type { TcfMessages } from "./index";

const labels = {
  title: "Parceiros e finalidades",
  purposes: "Finalidades",
  specialFeatures: "Recursos especiais",
  vendors: "Fornecedores",
  search: "Pesquisar fornecedores",
  consent: "Consentimento",
  legitimateInterest: "Interesse legítimo",
  acceptAll: "Aceitar tudo",
  rejectAll: "Rejeitar tudo",
  save: "Salvar escolhas",
  saved: "Escolhas salvas",
  empty: "Nenhum fornecedor encontrado",
  details: "Detalhes",
  close: "Fechar detalhes",
  consentPurposes: "Finalidades (consentimento)",
  legIntPurposes: "Finalidades (interesse legítimo)",
  specialPurposes: "Finalidades especiais",
  features: "Recursos",
  dataCategories: "Categorias de dados",
  retention: "Retenção de dados",
  retentionDays: "Dias: {days}",
  standardRetention: "Retenção padrão",
  privacyPolicy: "Política de privacidade",
  legIntClaim: "Declaração de interesse legítimo",
  storage: "Armazenamento no dispositivo",
  cookieMaxAge: "Duração máxima dos cookies (dias): {days}",
  cookieSession: "Cookies sem validade fixa",
  cookieRefresh: "A validade do cookie é renovada com o uso",
  noCookies: "Não usa cookies",
  nonCookieAccess:
    "Usa outros métodos de armazenamento ou acesso no dispositivo",
  storageDisclosure: "Divulgação de armazenamento",
} as const satisfies TcfMessages;
export default labels;
export { labels };
