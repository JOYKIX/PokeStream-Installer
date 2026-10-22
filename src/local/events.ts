import "server-only";
type Kind="workspace"|"engine"|"themes"|"sprites";
type Listener = () => void;
type Hub = { listeners: Map<Listener,Kind[]>; revision: number; engines: Set<symbol> };
const shared = globalThis as typeof globalThis & { pokeStreamEvents?: Hub };
const hub = () => shared.pokeStreamEvents ??= { listeners: new Map<Listener,Kind[]>(), revision: 0, engines: new Set() };
export function publishLocalChange(kind:Kind="workspace") {
  const state = hub(); state.revision++;
  for (const [listener,kinds] of [...state.listeners]) { if(!kinds.includes(kind))continue;try { listener(); } catch { /* A closed client cannot invalidate a committed write. */ } }
}
export function subscribeLocalChange(listener: Listener,kinds:Kind[]=["workspace","engine"]) { hub().listeners.set(listener,kinds); return () => { hub().listeners.delete(listener); }; }
export function engineConnected() { return hub().engines.size > 0; }
export function registerEngineConnection() {
  const id = Symbol(); hub().engines.add(id); publishLocalChange("engine");
  return () => { if (hub().engines.delete(id)) publishLocalChange("engine"); };
}
export function eventStream(request: Request, read: () => unknown | Promise<unknown>, dispose?: () => void,kinds:Kind[]=["workspace","engine"]) {
  const encoder = new TextEncoder(); let stop = () => {};
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false, reading = false, pending = false, previous: string | undefined;
      const close = () => { if (closed) return; closed = true; clearInterval(keepAlive); unsubscribe(); dispose?.(); request.signal.removeEventListener("abort", close); try { controller.close(); } catch {} };
      const send = (text: string) => { if (closed) return; if ((controller.desiredSize ?? 0) < -4) { close(); return; } try { controller.enqueue(encoder.encode(text)); } catch { close(); } };
      const refresh = async () => {
        pending = true; if (reading || closed) return; reading = true;
        try { while (pending && !closed) { pending = false; const json = JSON.stringify(await read()); if (closed) break; if (json !== previous) { previous = json; send("id: " + hub().revision + "\nevent: update\ndata: " + json + "\n\n"); } } }
        catch { close(); } finally { reading = false; }
      };
      const unsubscribe = subscribeLocalChange(() => void refresh(),kinds);
      // Transport keep-alive only: no database read, game frame or UI update.
      const keepAlive = setInterval(() => send(": keep-alive\n\n"), 20000); keepAlive.unref?.();
      stop = close; request.signal.addEventListener("abort", close, { once: true });
      if (request.signal.aborted) close(); else void refresh();
    }, cancel() { stop(); },
  });
  return new Response(body, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "private, no-cache, no-store, no-transform", "X-Accel-Buffering": "no" } });
}
