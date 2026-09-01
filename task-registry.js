/**
 * TaskRegistry — maps task type → { handler, description, payloadSchema }.
 * Changes fire onChanged, which triggers a hello resend.
 */

export class TaskRegistry {
  /** @type {Map<string, { handler: Function, description?: string, payloadSchema?: string }>} */
  _tasks = new Map();
  onChanged = null;  // () => void

  register(type, handler, description = null, payloadSchema = null) {
    if (!type) throw new TypeError('task type required');
    if (typeof handler !== 'function') throw new TypeError('handler must be a function');
    this._tasks.set(type, { handler, description, payloadSchema });
    this.onChanged?.();
  }

  unregister(type) {
    if (this._tasks.delete(type)) this.onChanged?.();
  }

  async run(requestId, type, payload) {
    const entry = this._tasks.get(type);
    if (!entry) {
      return { ok: false, error: { code: 'UNKNOWN_TASK', message: `no handler for "${type}"` } };
    }
    try {
      const result = await entry.handler(payload);
      return { ok: true, result: result ?? null };
    } catch (e) {
      return { ok: false, error: { code: 'TASK_FAILED', message: e.message } };
    }
  }

  snapshot() {
    const tasks = [];
    for (const [type, entry] of this._tasks) {
      const spec = { type };
      if (entry.description) spec.description = entry.description;
      if (entry.payloadSchema) spec.payloadSchema = entry.payloadSchema;
      tasks.push(spec);
    }
    return tasks;
  }
}
