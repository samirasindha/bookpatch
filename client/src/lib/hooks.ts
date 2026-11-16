import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import type { Book, Entry, Goals, GoalPeriod, LibraryStats, Loan, Notification, Profile, PublicUser, ReadingStatus, Relationship, Shelf } from "./types";

/* ---------- Queries ---------- */
export const useLibrary = () =>
  useQuery({ queryKey: ["library"], queryFn: () => api<{ entries: Entry[] }>("/library").then((r) => r.entries) });

export const useStats = () => useQuery({ queryKey: ["stats"], queryFn: () => api<LibraryStats>("/library/stats") });

export const useShelves = () =>
  useQuery({ queryKey: ["shelves"], queryFn: () => api<{ shelves: Shelf[] }>("/shelves").then((r) => r.shelves) });

export const useGoals = () => useQuery({ queryKey: ["goals"], queryFn: () => api<Goals>("/goals") });

export const useSearch = (q: string) =>
  useQuery({
    queryKey: ["search", q],
    queryFn: () => api<{ results: Book[] }>(`/books/search?q=${encodeURIComponent(q)}`).then((r) => r.results),
    enabled: q.trim().length > 1,
    staleTime: 5 * 60_000,
  });

export const lookupIsbn = (isbn: string) => api<{ book: Book }>(`/books/isbn/${encodeURIComponent(isbn)}`).then((r) => r.book);

/* ---------- Mutations ---------- */
function useInvalidateLibrary() {
  const qc = useQueryClient();
  return () => {
    for (const key of ["library", "stats", "shelves", "goals"]) qc.invalidateQueries({ queryKey: [key] });
  };
}

export function useAddBook() {
  const invalidate = useInvalidateLibrary();
  return useMutation({
    mutationFn: (v: { book: Book; status: ReadingStatus; owned: boolean }) =>
      api<{ entry: Entry; alreadyInLibrary: boolean }>("/library", { body: v }),
    onSuccess: invalidate,
  });
}

export function useBulkAdd() {
  const invalidate = useInvalidateLibrary();
  return useMutation({
    mutationFn: (items: { book: Book; status: ReadingStatus; owned: boolean }[]) =>
      api<{ added: number; skipped: number }>("/library/bulk", { body: { items } }),
    onSuccess: invalidate,
  });
}

export type EntryUpdate = Partial<Pick<Entry, "status" | "owned" | "progress" | "totalPages" | "rating" | "review" | "shelfIds">>;

export function useUpdateEntry() {
  const qc = useQueryClient();
  const invalidate = useInvalidateLibrary();
  return useMutation({
    mutationFn: ({ id, ...changes }: EntryUpdate & { id: string }) =>
      api<{ entry: Entry }>(`/library/${id}`, { method: "PATCH", body: changes }),
    // Optimistic update: the UI changes immediately, then reconciles with the server
    onMutate: async ({ id, ...changes }) => {
      await qc.cancelQueries({ queryKey: ["library"] });
      const previous = qc.getQueryData<Entry[]>(["library"]);
      qc.setQueryData<Entry[]>(["library"], (old) => old?.map((e) => (e.id === id ? { ...e, ...changes } : e)));
      return { previous };
    },
    onError: (_err, _vars, ctx) => ctx?.previous && qc.setQueryData(["library"], ctx.previous),
    onSettled: invalidate,
  });
}

export function useRemoveEntry() {
  const invalidate = useInvalidateLibrary();
  return useMutation({
    mutationFn: (id: string) => api(`/library/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });
}

export function useSaveGoal() {
  const invalidate = useInvalidateLibrary();
  return useMutation({
    mutationFn: (v: { target: number; period: GoalPeriod }) => api("/goals", { method: "PUT", body: v }),
    onSuccess: invalidate,
  });
}

export function useShelfMutations() {
  const invalidate = useInvalidateLibrary();
  return {
    create: useMutation({
      mutationFn: (v: { name: string; color?: string }) => api<{ shelf: Shelf }>("/shelves", { body: v }),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({ id, ...v }: { id: string; name?: string; color?: string }) =>
        api(`/shelves/${id}`, { method: "PATCH", body: v }),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (id: string) => api(`/shelves/${id}`, { method: "DELETE" }),
      onSuccess: invalidate,
    }),
  };
}

/* ---------- People ---------- */
export const useProfile = (handle: string) =>
  useQuery({ queryKey: ["profile", handle], queryFn: () => api<Profile>(`/users/${encodeURIComponent(handle)}`), enabled: !!handle });

export const useFriends = () =>
  useQuery({ queryKey: ["friends"], queryFn: () => api<{ people: (PublicUser & { friends: boolean })[] }>("/users/me/friends").then((r) => r.people) });

export const usePeopleSearch = (q: string) =>
  useQuery({
    queryKey: ["people", q],
    queryFn: () => api<{ users: (PublicUser & { following: boolean })[] }>(`/users/search?q=${encodeURIComponent(q)}`).then((r) => r.users),
    enabled: q.trim().length > 0,
  });

export function useFollow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ handle, follow }: { handle: string; follow: boolean }) =>
      api<{ relationship: Relationship }>(`/users/${handle}/follow`, { method: follow ? "POST" : "DELETE" }),
    onSuccess: () => {
      for (const key of ["profile", "friends", "people"]) qc.invalidateQueries({ queryKey: [key] });
    },
  });
}

/* ---------- Lending ---------- */
export const useLoans = () =>
  useQuery({ queryKey: ["loans"], queryFn: () => api<{ lent: Loan[]; borrowed: Loan[]; history: Loan[] }>("/loans") });

function useInvalidateLoans() {
  const qc = useQueryClient();
  return () => {
    for (const key of ["loans", "library", "notifications"]) qc.invalidateQueries({ queryKey: [key] });
  };
}

export function useLend() {
  const invalidate = useInvalidateLoans();
  return useMutation({
    mutationFn: (v: { userBookId: string; borrowerHandle?: string; borrowerName?: string; borrowerEmail?: string; dueDate?: string; notes?: string }) =>
      api<{ loan: Loan }>("/loans", { body: v }),
    onSuccess: invalidate,
  });
}

export function useReturnLoan() {
  const invalidate = useInvalidateLoans();
  return useMutation({ mutationFn: (id: string) => api(`/loans/${id}/return`, { method: "PATCH" }), onSuccess: invalidate });
}

export function useNudge() {
  const invalidate = useInvalidateLoans();
  return useMutation({
    mutationFn: (id: string) => api<{ channel: "in_app" | "email"; delivered: boolean }>(`/loans/${id}/nudge`, { method: "POST" }),
    onSuccess: invalidate,
  });
}

/* ---------- Notifications ---------- */
export const useNotifications = () =>
  useQuery({
    queryKey: ["notifications"],
    queryFn: () => api<{ unread: number; items: Notification[] }>("/notifications"),
    refetchInterval: 60_000,
  });

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api("/notifications/read-all", { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}
