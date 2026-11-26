// FakeProvider: runs everything in CI at $0. No network. Records every request so tests can inspect prompts.
import { LLMError, type LlmProvider, type RawCompletion, type RawRequest } from "./types";

export type FakeReply =
  | string
  | Record<string, unknown>
  | LLMError
  | ((req: RawRequest, n: number) => string | Record<string, unknown> | LLMError);

export class FakeProvider implements LlmProvider {
  calls: RawRequest[] = [];
  private queue: FakeReply[] = [];
  constructor(
    readonly id = "fake",
    /** Used when the queue is empty. */
    private responder: FakeReply = () => ({}),
    readonly model = "fake-1",
  ) {}

  /** Replies consumed in order before the responder is used. */
  enqueue(...r: FakeReply[]): this {
    this.queue.push(...r);
    return this;
  }

  async complete(req: RawRequest): Promise<RawCompletion> {
    const n = this.calls.length;
    this.calls.push(req);
    let r: FakeReply = this.queue.length ? (this.queue.shift() as FakeReply) : this.responder;
    if (typeof r === "function") r = r(req, n);
    if (r instanceof LLMError) throw r;
    const text = typeof r === "string" ? r : JSON.stringify(r);
    return {
      text,
      tokens_in: Math.ceil(
        (req.system.length + req.messages.reduce((a, m) => a + m.content.length, 0)) / 4,
      ),
      tokens_out: Math.ceil(text.length / 4),
      finish_reason: "stop",
      model: this.model,
    };
  }
}
