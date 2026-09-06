import type { AssembleContext } from '@deepseek-ai/dsh-system-prompt';

export interface ProjectionServices {
  sessionProjections: {
    stateOf(session: unknown, key: string): unknown;
  };
  jobs: {
    list(agent: unknown): unknown[];
  };
  agents: {
    list(): unknown[];
    isOwnedBy(id: string, owner: unknown): boolean;
  };
}

export declare function truncateUtf8(value: unknown, maxBytes?: number): string | undefined;
export declare function renderWorkStateContext(
  context: AssembleContext | undefined,
  services: ProjectionServices,
): string;



