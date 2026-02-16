export type Locale = "en" | "ro";

export const supportedLocales: Locale[] = ["en", "ro"];

const defaultLocaleEnv =
  (process.env.LOCALE || "en").toLowerCase().startsWith("ro") ? "ro" : "en";

const translations: Record<Locale, Record<string, string>> = {
  en: {
    // Navigation
    "nav.home": "Home",
    "nav.projects": "Projects",
    "nav.dashboard": "Dashboard",
    "nav.profile": "Profile",
    "nav.signOut": "Sign Out",
    "nav.admin": "Admin",
    "nav.search": "Search projects & proposals...",

    // Home page
    "home.title": "Ideate",
    "home.subtitle": "Democratic Idea Prioritization",
    "home.description": "Create projects, submit proposals, vote, and discuss. Your team decides together.",
    "home.getStarted": "Get Started",
    "home.viewProjects": "View Projects",
    "home.feature.projects": "Projects",
    "home.feature.projectsDesc": "Create and manage idea projects with deadlines and status tracking.",
    "home.feature.proposals": "Proposals",
    "home.feature.proposalsDesc": "Submit proposals with AI-generated summaries and initial votes.",
    "home.feature.voting": "Voting",
    "home.feature.votingDesc": "Real-time pro/contra voting with visual bar charts.",
    "home.feature.discussion": "Discussion",
    "home.feature.discussionDesc": "Threaded comments on every proposal for team deliberation.",

    // Projects
    "projects.title": "Projects",
    "projects.new": "New Project",
    "projects.noProjects": "No projects found.",
    "projects.createFirst": "Create your first project",
    "projects.status.active": "Active",
    "projects.status.archived": "Archived",
    "projects.status.draft": "Draft",
    "projects.deadline": "Deadline",
    "projects.proposals": "proposals",
    "projects.edit": "Edit",
    "projects.delete": "Delete",
    "projects.confirmDelete": "Are you sure you want to delete this project?",
    "projects.back": "Back to Projects",

    // Project form
    "projectForm.title": "Title",
    "projectForm.description": "Description",
    "projectForm.deadline": "Deadline",
    "projectForm.status": "Status",
    "projectForm.create": "Create Project",
    "projectForm.update": "Update Project",
    "projectForm.creating": "Creating...",
    "projectForm.updating": "Updating...",

    // Proposals
    "proposals.title": "Proposals",
    "proposals.add": "Add Proposal",
    "proposals.noProposals": "No proposals yet. Be the first to add one!",
    "proposals.delete": "Delete",
    "proposals.comments": "Comments",

    // Proposal form
    "proposalForm.title": "Title",
    "proposalForm.description": "Description (Markdown supported)",
    "proposalForm.upvote": "Upvote",
    "proposalForm.downvote": "Downvote",
    "proposalForm.submit": "Add Proposal",
    "proposalForm.submitting": "Adding...",

    // Voting
    "vote.pro": "Pro",
    "vote.contra": "Contra",
    "vote.cast": "Vote",
    "vote.remove": "Remove vote",

    // Comments
    "comments.title": "Discussion",
    "comments.placeholder": "Write a comment...",
    "comments.submit": "Post",
    "comments.reply": "Reply",

    // Dashboard
    "dashboard.title": "Dashboard",
    "dashboard.stats.projects": "Projects",
    "dashboard.stats.proposals": "Proposals",
    "dashboard.stats.votes": "Votes",
    "dashboard.stats.comments": "Comments",
    "dashboard.yourProjects": "Your Projects",
    "dashboard.yourProposals": "Your Proposals",
    "dashboard.recentVotes": "Recent Votes",
    "dashboard.activity": "Activity Feed",

    // Profile
    "profile.title": "Profile",
    "profile.email": "Email",
    "profile.role": "Role",
    "profile.memberSince": "Member since",
    "profile.firstName": "First Name",
    "profile.lastName": "Last Name",
    "profile.update": "Update Profile",
    "profile.updating": "Updating...",

    // Auth
    "auth.login": "Sign In",
    "auth.email": "Email address",
    "auth.sendLink": "Send Magic Link",
    "auth.sending": "Sending...",
    "auth.checkEmail": "Check your email for a sign-in link.",
    "auth.verifying": "Verifying...",
    "auth.password": "Password",
    "auth.confirmPassword": "Confirm Password",
    "auth.register": "Create Account",
    "auth.registering": "Creating account...",
    "auth.registerTitle": "Create your account",
    "auth.registerDesc": "Enter your details to create a new account",
    "auth.haveAccount": "Already have an account?",
    "auth.noAccount": "Don't have an account?",
    "auth.signInWithPassword": "Sign In with Password",
    "auth.signingIn": "Signing in...",
    "auth.orMagicLink": "Or sign in with a magic link",
    "auth.orPassword": "Or sign in with a password",
    "auth.forgotPassword": "Forgot password?",
    "auth.forgotPasswordTitle": "Reset your password",
    "auth.forgotPasswordDesc": "Enter your email and we'll send you a reset link",
    "auth.sendResetLink": "Send Reset Link",
    "auth.sendingReset": "Sending...",
    "auth.checkEmailReset": "Check your email for a password reset link.",
    "auth.resetPassword": "Reset Password",
    "auth.resetPasswordTitle": "Set a new password",
    "auth.resetPasswordDesc": "Enter your new password below",
    "auth.newPassword": "New Password",
    "auth.resetting": "Resetting...",
    "auth.resetSuccess": "Password reset successfully. You can now sign in.",
    "auth.verifyEmail": "Verify Your Email",
    "auth.verifyEmailTitle": "Check your inbox",
    "auth.verifyEmailDesc": "We sent a verification link to {email}",
    "auth.verifyEmailSuccess": "Email verified! You can now sign in.",
    "auth.resendVerification": "Resend Verification Email",
    "auth.passwordMinLength": "Password must be at least 8 characters",
    "auth.passwordMismatch": "Passwords do not match",
    "auth.passwordRequirements": "Min 8 chars with uppercase, lowercase, and number",
    "auth.backToLogin": "Back to Sign In",

    // Common
    "common.loading": "Loading...",
    "common.error": "Something went wrong",
    "common.retry": "Try again",
    "common.save": "Save",
    "common.cancel": "Cancel",
    "common.notFound": "Page not found",
    "common.goHome": "Go to Home",
  },
  ro: {
    // Navigation
    "nav.home": "Acasa",
    "nav.projects": "Proiecte",
    "nav.dashboard": "Dashboard",
    "nav.profile": "Profil",
    "nav.signOut": "Delogare",
    "nav.admin": "Admin",
    "nav.search": "Cauta proiecte si propuneri...",

    // Home page
    "home.title": "Ideate",
    "home.subtitle": "Prioritizarea Democratica a Ideilor",
    "home.description": "Creeaza proiecte, depune propuneri, voteaza si discuta. Echipa ta decide impreuna.",
    "home.getStarted": "Incepe",
    "home.viewProjects": "Vezi Proiecte",
    "home.feature.projects": "Proiecte",
    "home.feature.projectsDesc": "Creeaza si gestioneaza proiecte de idei cu termene si urmarirea starii.",
    "home.feature.proposals": "Propuneri",
    "home.feature.proposalsDesc": "Depune propuneri cu rezumate generate de AI si voturi initiale.",
    "home.feature.voting": "Votare",
    "home.feature.votingDesc": "Votare pro/contra in timp real cu grafice vizuale.",
    "home.feature.discussion": "Discutii",
    "home.feature.discussionDesc": "Comentarii cu fire de discutie pentru deliberarea echipei.",

    // Projects
    "projects.title": "Proiecte",
    "projects.new": "Proiect Nou",
    "projects.noProjects": "Nu exista proiecte.",
    "projects.createFirst": "Creeaza primul proiect",
    "projects.status.active": "Activ",
    "projects.status.archived": "Arhivat",
    "projects.status.draft": "Ciorna",
    "projects.deadline": "Termen limita",
    "projects.proposals": "propuneri",
    "projects.edit": "Editeaza",
    "projects.delete": "Sterge",
    "projects.confirmDelete": "Esti sigur ca vrei sa stergi acest proiect?",
    "projects.back": "Inapoi la Proiecte",

    // Project form
    "projectForm.title": "Titlu",
    "projectForm.description": "Descriere",
    "projectForm.deadline": "Termen limita",
    "projectForm.status": "Stare",
    "projectForm.create": "Creeaza Proiect",
    "projectForm.update": "Actualizeaza Proiect",
    "projectForm.creating": "Se creeaza...",
    "projectForm.updating": "Se actualizeaza...",

    // Proposals
    "proposals.title": "Propuneri",
    "proposals.add": "Adauga Propunere",
    "proposals.noProposals": "Nicio propunere inca. Fii primul care adauga una!",
    "proposals.delete": "Sterge",
    "proposals.comments": "Comentarii",

    // Proposal form
    "proposalForm.title": "Titlu",
    "proposalForm.description": "Descriere (Markdown suportat)",
    "proposalForm.upvote": "Voteaza Pro",
    "proposalForm.downvote": "Voteaza Contra",
    "proposalForm.submit": "Adauga Propunere",
    "proposalForm.submitting": "Se adauga...",

    // Voting
    "vote.pro": "Pro",
    "vote.contra": "Contra",
    "vote.cast": "Voteaza",
    "vote.remove": "Sterge vot",

    // Comments
    "comments.title": "Discutie",
    "comments.placeholder": "Scrie un comentariu...",
    "comments.submit": "Posteaza",
    "comments.reply": "Raspunde",

    // Dashboard
    "dashboard.title": "Dashboard",
    "dashboard.stats.projects": "Proiecte",
    "dashboard.stats.proposals": "Propuneri",
    "dashboard.stats.votes": "Voturi",
    "dashboard.stats.comments": "Comentarii",
    "dashboard.yourProjects": "Proiectele Tale",
    "dashboard.yourProposals": "Propunerile Tale",
    "dashboard.recentVotes": "Voturi Recente",
    "dashboard.activity": "Activitate Recenta",

    // Profile
    "profile.title": "Profil",
    "profile.email": "Email",
    "profile.role": "Rol",
    "profile.memberSince": "Membru din",
    "profile.firstName": "Prenume",
    "profile.lastName": "Nume",
    "profile.update": "Actualizeaza Profil",
    "profile.updating": "Se actualizeaza...",

    // Auth
    "auth.login": "Autentificare",
    "auth.email": "Adresa de email",
    "auth.sendLink": "Trimite Link Magic",
    "auth.sending": "Se trimite...",
    "auth.checkEmail": "Verifica email-ul pentru link-ul de autentificare.",
    "auth.verifying": "Se verifica...",
    "auth.password": "Parola",
    "auth.confirmPassword": "Confirma Parola",
    "auth.register": "Creeaza Cont",
    "auth.registering": "Se creeaza contul...",
    "auth.registerTitle": "Creeaza contul tau",
    "auth.registerDesc": "Introdu datele tale pentru a crea un cont nou",
    "auth.haveAccount": "Ai deja un cont?",
    "auth.noAccount": "Nu ai un cont?",
    "auth.signInWithPassword": "Autentificare cu Parola",
    "auth.signingIn": "Se autentifica...",
    "auth.orMagicLink": "Sau autentificare cu link magic",
    "auth.orPassword": "Sau autentificare cu parola",
    "auth.forgotPassword": "Ai uitat parola?",
    "auth.forgotPasswordTitle": "Reseteaza parola",
    "auth.forgotPasswordDesc": "Introdu email-ul si iti trimitem un link de resetare",
    "auth.sendResetLink": "Trimite Link Resetare",
    "auth.sendingReset": "Se trimite...",
    "auth.checkEmailReset": "Verifica email-ul pentru link-ul de resetare a parolei.",
    "auth.resetPassword": "Reseteaza Parola",
    "auth.resetPasswordTitle": "Seteaza o parola noua",
    "auth.resetPasswordDesc": "Introdu parola noua mai jos",
    "auth.newPassword": "Parola Noua",
    "auth.resetting": "Se reseteaza...",
    "auth.resetSuccess": "Parola a fost resetata. Te poti autentifica acum.",
    "auth.verifyEmail": "Verifica Email-ul",
    "auth.verifyEmailTitle": "Verifica inbox-ul",
    "auth.verifyEmailDesc": "Am trimis un link de verificare la {email}",
    "auth.verifyEmailSuccess": "Email verificat! Te poti autentifica acum.",
    "auth.resendVerification": "Retrimite Email de Verificare",
    "auth.passwordMinLength": "Parola trebuie sa aiba minim 8 caractere",
    "auth.passwordMismatch": "Parolele nu coincid",
    "auth.passwordRequirements": "Minim 8 caractere cu majuscula, litera mica si cifra",
    "auth.backToLogin": "Inapoi la Autentificare",

    // Common
    "common.loading": "Se incarca...",
    "common.error": "Ceva nu a mers bine",
    "common.retry": "Incearca din nou",
    "common.save": "Salveaza",
    "common.cancel": "Anuleaza",
    "common.notFound": "Pagina nu a fost gasita",
    "common.goHome": "Mergi la Acasa",
  },
};

/**
 * Translate a key with optional variable interpolation
 */
export function t(
  locale: Locale,
  key: string,
  vars?: Record<string, string | number>
): string {
  const table = translations[locale] || translations.en;
  const phrase = table[key] || translations.en[key] || key;
  if (!vars) return phrase;

  let result = phrase;
  for (const [k, v] of Object.entries(vars)) {
    result = result.replace(`{${k}}`, String(v));
  }
  return result;
}

/**
 * Get a translation function bound to a locale
 */
export function getTranslations(locale?: Locale) {
  const loc = locale || defaultLocaleEnv;
  return {
    locale: loc,
    t: (key: string, vars?: Record<string, string | number>) =>
      t(loc, key, vars),
  };
}

/**
 * Get the default locale from environment
 */
export function getDefaultLocale(): Locale {
  return defaultLocaleEnv;
}
