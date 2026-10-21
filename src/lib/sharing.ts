export type SharedCreation = {
  id: string; kind: "theme" | "overlay" | "profile"; name: string; sender_name: string;
  result_id: string; delivered_at: string; read_at: string | null;
};
export const nicknameKey = (name: string) => name.trim().normalize("NFKC").toLowerCase();
