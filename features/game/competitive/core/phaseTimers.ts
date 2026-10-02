/** Presentation waits are independent of the authoritative server deadlines. */
export class PhaseTimers {
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  schedule(name: string, delay: number, callback: () => void) {
    this.cancel(name);
    this.timers.set(
      name,
      setTimeout(() => {
        this.timers.delete(name);
        callback();
      }, delay),
    );
  }
  cancel(name: string) {
    const timer = this.timers.get(name);
    if (timer !== undefined) clearTimeout(timer);
    this.timers.delete(name);
  }
  clear() {
    for (const name of this.timers.keys()) this.cancel(name);
  }
}
