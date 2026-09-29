import type de from "./de";

const en: typeof de = {
  app: {
    name: "Sjodur",
    status: "Pre-alpha",
    tagline: "Budget book, forecast and investments in one app.",
    footer: "Sjodur – from the Icelandic sjóður, “the fund”.",
  },
  locale: {
    label: "Language",
  },
  home: {
    kicker: "Welcome",
    title: "See where your money goes – and where it is heading.",
    lead: "Sjodur brings budget book, cash-flow forecast and investment overview into one picture.",
    pillars: {
      ledger: {
        title: "Budget book",
        text: "Accounts, categories, recurring entries and imports – the view of today.",
      },
      forecast: {
        title: "Forecast",
        text: "Balances months ahead, play through scenarios, get warned before an account runs dry.",
      },
      invest: {
        title: "Investments",
        text: "Savings plans, ETFs and stocks next to everyday finances – your wealth as a whole.",
      },
    },
    sample: {
      label: "Amounts and colour codes",
      income: "Income",
      expense: "Expense",
    },
  },
  auth: {
    login: "Sign in",
    logout: "Sign out",
  },
  dashboard: {
    kicker: "Overview",
    greeting: "Hello {name}",
    lead: "Your budget book will live here. Until then this page shows that login and API work together.",
    session: "Your session",
    email: "Email",
    roles: "Roles",
    api: "Backend",
    apiOk: "reachable, token accepted",
    apiUnreachable: "not reachable",
  },
  error: {
    notFound: "This page does not exist.",
    generic: "Something went wrong.",
    back: "Back to start",
  },
};

export default en;
