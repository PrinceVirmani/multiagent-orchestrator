export type OrchestratorEvent =
  | { type: "run_started"; runId: string; task: string }
  | { type: "plan_step"; runId: string; action: unknown }
  | { type: "step_started"; runId: string; stepId: string; agent: string; instruction: string }
  | { type: "token"; runId: string; stepId: string; text: string }
  | { type: "tool_call"; runId: string; stepId: string; tool: string; args: unknown; result: string }
  | { type: "step_finished"; runId: string; stepId: string; output: string }
  | { type: "run_finished"; runId: string; output: string }
  | { type: "error"; runId: string; message: string };


  type Listener = ( event: OrchestratorEvent) => void;

  class EventBus {
    private listeners = new Map<string, Set<Listener>>();
    private buffers = new Map<string, OrchestratorEvent[]>();

    publish(runId: string, event: OrchestratorEvent): void{
        const buf = this.buffers.get(runId) ?? [];
        buf.push(event);
        this.buffers.set(runId, buf);

        for (const l of [...(this.listeners.get(runId) ?? [])]) l(event);

        if(event.type === "run_finished" || event.type === "error"){
            setTimeout(() => {
                this.buffers.delete(runId)
            }, 60_000);
        }
    }

    subscribe(runId: string, listeners: Listener): () => void{
        for (const e of this.buffers.get(runId) ?? []) listeners(e);
        let set = this.listeners.get(runId);
        if(!set){
            set = new Set();
            this.listeners.set(runId, set);
        }

        set.add(listeners);
        return()=>{
            set!.delete(listeners);
            if(set!.size === 0) this.listeners.delete(runId);
        };
    }
  }


  export const bus = new EventBus();