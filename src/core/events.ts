type Handler = (payload?: any) => void;

/** Tiny event bus shared by systems, scenes and UI. */
class Bus {
  private map = new Map<string, Set<Handler>>();
  on(evt: string, fn: Handler): () => void {
    if (!this.map.has(evt)) this.map.set(evt, new Set());
    this.map.get(evt)!.add(fn);
    return () => this.off(evt, fn);
  }
  off(evt: string, fn: Handler) {
    this.map.get(evt)?.delete(fn);
  }
  emit(evt: string, payload?: any) {
    this.map.get(evt)?.forEach((fn) => {
      try {
        fn(payload);
      } catch (e) {
        console.error(`[bus] handler for "${evt}" failed`, e);
      }
    });
  }
}

export const bus = new Bus();

/**
 * Event names:
 *  state            – something changed (UI refresh)
 *  xp               – {amount, source}
 *  levelup          – {level, rewards: string[]}
 *  toast            – {text, icon?, kind?}
 *  quest:progress   – {id}
 *  quest:complete   – {id, title}
 *  achievement      – {id}
 *  unlock           – {id, title, kind}
 *  game             – gameplay notifications: {type:'visit'|'interact'|'collect'|'minigame'|'talk'|'gift'|'flag', ...}
 *  travel           – {to, spawnX?}
 *  time             – time of day changed
 *  cosmetics        – equipped cosmetics changed
 *  settings         – settings changed
 */
