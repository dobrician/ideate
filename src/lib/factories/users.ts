import { randomUUID } from "crypto";
import { hashSync } from "bcryptjs";

export interface DemoUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  passwordHash: string;
  emailVerified: boolean;
  role: "admin" | "manager" | "member" | "viewer";
  onboardingCompleted: boolean;
}

/** Default password for all demo users: DemoPass1 */
const DEMO_PASSWORD_HASH = hashSync("DemoPass1", 10);

const PERSONAS: Omit<DemoUser, "id" | "passwordHash" | "emailVerified" | "onboardingCompleted">[] = [
  // Admins (2)
  {
    email: "adrian.marinescu@ideate.ro",
    firstName: "Adrian",
    lastName: "Marinescu",
    avatarUrl: null,
    role: "admin",
  },
  {
    email: "elena.dragomir@ideate.ro",
    firstName: "Elena",
    lastName: "Dragomir",
    avatarUrl: null,
    role: "admin",
  },

  // Managers (4)
  {
    email: "maria.popescu@ideate.ro",
    firstName: "Maria",
    lastName: "Popescu",
    avatarUrl: null,
    role: "manager",
  },
  {
    email: "john.smith@techcorp.com",
    firstName: "John",
    lastName: "Smith",
    avatarUrl: null,
    role: "manager",
  },
  {
    email: "catalin.ionescu@ideate.ro",
    firstName: "Catalin",
    lastName: "Ionescu",
    avatarUrl: null,
    role: "manager",
  },
  {
    email: "sarah.chen@techcorp.com",
    firstName: "Sarah",
    lastName: "Chen",
    avatarUrl: null,
    role: "manager",
  },

  // Members (10)
  {
    email: "andrei.popa@ideate.ro",
    firstName: "Andrei",
    lastName: "Popa",
    avatarUrl: null,
    role: "member",
  },
  {
    email: "ioana.stanescu@ideate.ro",
    firstName: "Ioana",
    lastName: "Stanescu",
    avatarUrl: null,
    role: "member",
  },
  {
    email: "michael.o.brien@techcorp.com",
    firstName: "Michael",
    lastName: "O'Brien",
    avatarUrl: null,
    role: "member",
  },
  {
    email: "ana.dumitrescu@ideate.ro",
    firstName: "Ana",
    lastName: "Dumitrescu",
    avatarUrl: null,
    role: "member",
  },
  {
    email: "david.mueller@techcorp.com",
    firstName: "David",
    lastName: "Mueller",
    avatarUrl: null,
    role: "member",
  },
  {
    email: "raluca.gheorghe@ideate.ro",
    firstName: "Raluca",
    lastName: "Gheorghe",
    avatarUrl: null,
    role: "member",
  },
  {
    email: "priya.sharma@techcorp.com",
    firstName: "Priya",
    lastName: "Sharma",
    avatarUrl: null,
    role: "member",
  },
  {
    email: "vlad.cristea@ideate.ro",
    firstName: "Vlad",
    lastName: "Cristea",
    avatarUrl: null,
    role: "member",
  },
  {
    email: "emma.larsson@techcorp.com",
    firstName: "Emma",
    lastName: "Larsson",
    avatarUrl: null,
    role: "member",
  },
  {
    email: "bogdan.nistor@ideate.ro",
    firstName: "Bogdan",
    lastName: "Nistor",
    avatarUrl: null,
    role: "member",
  },

  // Viewers (4)
  {
    email: "mihai.tudor@ideate.ro",
    firstName: "Mihai",
    lastName: "Tudor",
    avatarUrl: null,
    role: "viewer",
  },
  {
    email: "lisa.andersson@techcorp.com",
    firstName: "Lisa",
    lastName: "Andersson",
    avatarUrl: null,
    role: "viewer",
  },
  {
    email: "dan.voicu@ideate.ro",
    firstName: "Dan",
    lastName: "Voicu",
    avatarUrl: null,
    role: "viewer",
  },
  {
    email: "kenji.tanaka@techcorp.com",
    firstName: "Kenji",
    lastName: "Tanaka",
    avatarUrl: null,
    role: "viewer",
  },
];

/**
 * Create demo user records ready for DB insertion.
 * @param count Number of users to create (max 20, default all)
 */
export function createUsers(count?: number): DemoUser[] {
  const personas = count ? PERSONAS.slice(0, count) : PERSONAS;
  return personas.map((p) => ({
    id: randomUUID(),
    ...p,
    passwordHash: DEMO_PASSWORD_HASH,
    emailVerified: true,
    onboardingCompleted: true,
  }));
}

/** Get the full list of persona definitions (without IDs) */
export function getPersonaCount(): number {
  return PERSONAS.length;
}
