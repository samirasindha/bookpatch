export type Me = {
  id: string;
  name: string;
  handle: string;
  avatarUrl: string | null;
  bio: string | null;
  email: string;
  libraryVisibility: "public" | "friends" | "private";
  isDemo: boolean;
};

export type AuthConfig = { googleClientId: string | null; demoLogin: boolean };
