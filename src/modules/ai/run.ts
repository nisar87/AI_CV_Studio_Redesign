import 'server-only';
import { z } from 'zod';
import type { Finding } from './guard';
import { placeholderQuestions } from './placeholders';
import { AiProviderError, type AiProvider } from './provider';
import { taskInputs, taskOutputs, type TaskId, type TaskOutput } from './schemas';
import { TASKS, type TaskDef } from './tasks';

export type RunOk<T extends TaskId> = {
  ok: true;
  version: string;
  model: string;
  result: TaskOutput<T>;
  needsInput: string[];
  findings: Finding[];
  usage: { inputTokens: number; outputTokens: number };
};
export type RunError = {
  ok: false;
  code: 'INVALID_INPUT' | 'AI_UNAVAILABLE' | 'AI_INVALID_OUTPUT';
  reason: string;
  issues?: unknown;
};

export type RunDeps = {
  provider: AiProvider;
  models: { fast: string; smart: string };
  timeoutMs?: number;
  /** Injected for tests. */
  sleep?: (ms: number) => Promise<void>;
};

const jsonSchemaCache = new Map<TaskId, Record<string, unknown>>();
function jsonSchema(id: TaskId) {
  let s = jsonSchemaCache.get(id);
  if (!s) {
    s = z.toJSONSchema(taskOutputs[id], { target: 'draft-2020-12' }) as Record<string, unknown>;
    delete s.$schema;
    jsonSchemaCache.set(id, s);
  }
  return s;
}

function parseJson(text: string): unknown {
  const t = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  return JSON.parse(t);
}

const defaultSleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Run one AI task: validate input → call the model (one retry on 429/5xx) → validate output
 * (one repair attempt) → truth guard. Never throws.
 */
export async function runTask<T extends TaskId>(
  id: T,
  rawInput: unknown,
  attempt: number,
  deps: RunDeps,
): Promise<RunOk<T> | RunError> {
  const parsedInput = taskInputs[id].safeParse(rawInput);
  if (!parsedInput.success)
    return {
      ok: false,
      code: 'INVALID_INPUT',
      reason: 'input',
      issues: parsedInput.error.issues.slice(0, 10),
    };
  const input = parsedInput.data as never;
  const task = TASKS[id] as unknown as TaskDef<T>;
  const model = task.tier === 'smart' ? deps.models.smart : deps.models.fast;
  const sleep = deps.sleep ?? defaultSleep;
  const usage = { inputTokens: 0, outputTokens: 0 };

  const baseUser =
    task.user(input) +
    (attempt > 0
      ? `\n\nAttempt ${attempt}: the person asked for a different version. Offer different wording from before; the rules still apply.`
      : '');
  const temperature = Math.min(1, task.temperature + attempt * 0.15);

  async function call(user: string) {
    for (let tryNo = 0; ; tryNo++) {
      try {
        const res = await deps.provider.generate({
          model,
          system: task.system(input),
          user,
          schema: jsonSchema(id),
          maxTokens: task.maxTokens,
          temperature,
          signal: AbortSignal.timeout(deps.timeoutMs ?? 20_000),
          task: { id, input },
        });
        usage.inputTokens += res.usage.inputTokens;
        usage.outputTokens += res.usage.outputTokens;
        return res.text;
      } catch (err) {
        if (err instanceof AiProviderError && err.retryable && tryNo === 0) {
          await sleep(300 + Math.random() * 500);
          continue;
        }
        throw err;
      }
    }
  }

  let text: string;
  try {
    text = await call(baseUser);
  } catch (err) {
    return {
      ok: false,
      code: 'AI_UNAVAILABLE',
      reason: err instanceof AiProviderError ? err.kind : 'unknown',
    };
  }

  let output = validate(id, text);
  if (!output.ok) {
    // One repair attempt with the validation problem.
    try {
      text = await call(
        `${baseUser}\n\nYour previous answer was not valid (${output.problem}). Reply again with JSON only, exactly matching the schema.`,
      );
    } catch (err) {
      return {
        ok: false,
        code: 'AI_UNAVAILABLE',
        reason: err instanceof AiProviderError ? err.kind : 'unknown',
      };
    }
    output = validate(id, text);
    if (!output.ok) return { ok: false, code: 'AI_INVALID_OUTPUT', reason: output.problem };
  }

  const fin = task.finalize(input, output.value);
  const strings = JSON.stringify(fin.output);
  return {
    ok: true,
    version: task.version,
    model,
    result: fin.output,
    needsInput: placeholderQuestions(strings),
    findings: fin.findings,
    usage,
  };
}

function validate<T extends TaskId>(
  id: T,
  text: string,
): { ok: true; value: TaskOutput<T> } | { ok: false; problem: string } {
  let json: unknown;
  try {
    json = parseJson(text);
  } catch {
    return { ok: false, problem: 'not valid JSON' };
  }
  const r = taskOutputs[id].safeParse(json);
  if (!r.success)
    return {
      ok: false,
      problem: r.error.issues
        .slice(0, 3)
        .map((i) => `${i.path.join('.') || 'root'}: ${i.message}`)
        .join('; '),
    };
  return { ok: true, value: r.data as TaskOutput<T> };
}
