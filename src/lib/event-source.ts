"use client";
export function subscribeJSON<T>(url: string, receive: (data: T) => void, onError?: () => void) {
 const source = new EventSource(url);
 source.addEventListener("update", event => { try { receive(JSON.parse((event as MessageEvent<string>).data) as T); } catch { onError?.(); } });
 source.onerror = () => onError?.();
 return () => source.close();
}
