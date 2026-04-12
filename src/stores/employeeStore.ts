import { create } from "zustand";
import { select, execute } from "@/lib/database";
import type { Employee } from "@/lib/types";
import { onCodexOutput, onCodexExit, type CodexOutput } from "@/lib/codex";

interface CodexProcessState {
  output: string[];
  running: boolean;
}

interface EmployeeStore {
  employees: Employee[];
  loading: boolean;
  codexProcesses: Record<string, CodexProcessState>;
  fetchEmployees: () => Promise<void>;
  createEmployee: (data: { name: string; role: string; model?: string; specialization?: string; system_prompt?: string; project_id?: string }) => Promise<void>;
  updateEmployee: (id: string, updates: Partial<Pick<Employee, "name" | "role" | "model" | "specialization" | "system_prompt" | "project_id" | "status">>) => Promise<void>;
  deleteEmployee: (id: string) => Promise<void>;
  updateEmployeeStatus: (id: string, status: string) => Promise<void>;
  addCodexOutput: (employeeId: string, line: string) => void;
  setCodexRunning: (employeeId: string, running: boolean) => void;
  clearCodexOutput: (employeeId: string) => void;
  initCodexListeners: () => () => void;
}

let codexListenersActive = false;

export const useEmployeeStore = create<EmployeeStore>((set, get) => ({
  employees: [],
  loading: false,
  codexProcesses: {},

  fetchEmployees: async () => {
    set({ loading: true });
    try {
      const employees = await select<Employee>("SELECT * FROM employees ORDER BY created_at");
      set({ employees, loading: false });
    } catch (e) {
      console.error("Failed to fetch employees:", e);
      set({ loading: false });
    }
  },

  createEmployee: async (data) => {
    const id = crypto.randomUUID();
    await execute(
      "INSERT INTO employees (id, name, role, model, specialization, system_prompt, project_id) VALUES ($1, $2, $3, $4, $5, $6, $7)",
      [id, data.name, data.role, data.model ?? "gpt-4", data.specialization ?? null, data.system_prompt ?? null, data.project_id ?? null]
    );
    await get().fetchEmployees();
  },

  updateEmployee: async (id, updates) => {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    for (const [key, value] of Object.entries(updates)) {
      fields.push(`${key} = $${idx}`);
      values.push(value);
      idx++;
    }
    values.push(id);
    await execute(`UPDATE employees SET ${fields.join(", ")} WHERE id = $${idx}`, values);
    await get().fetchEmployees();
  },

  deleteEmployee: async (id) => {
    await execute("DELETE FROM employees WHERE id = $1", [id]);
    set((state) => {
      const { [id]: _, ...rest } = state.codexProcesses;
      return { codexProcesses: rest };
    });
    await get().fetchEmployees();
  },

  updateEmployeeStatus: async (id, status) => {
    await execute("UPDATE employees SET status = $1 WHERE id = $2", [status, id]);
    set((state) => ({
      employees: state.employees.map((e) => (e.id === id ? { ...e, status } : e)),
    }));
  },

  addCodexOutput: (employeeId, line) => {
    set((state) => ({
      codexProcesses: {
        ...state.codexProcesses,
        [employeeId]: {
          ...state.codexProcesses[employeeId],
          output: [...(state.codexProcesses[employeeId]?.output ?? []).slice(-199), line],
          running: true,
        },
      },
    }));
  },

  setCodexRunning: (employeeId, running) => {
    set((state) => ({
      codexProcesses: {
        ...state.codexProcesses,
        [employeeId]: {
          ...state.codexProcesses[employeeId],
          running,
        },
      },
    }));
  },

  clearCodexOutput: (employeeId) => {
    set((state) => ({
      codexProcesses: {
        ...state.codexProcesses,
        [employeeId]: {
          ...state.codexProcesses[employeeId],
          output: [],
        },
      },
    }));
  },

  initCodexListeners: () => {
    if (codexListenersActive) return () => {};
    codexListenersActive = true;

    const unlisteners: (() => void)[] = [];

      onCodexOutput((output: CodexOutput) => {
        get().addCodexOutput(output.employee_id, output.line);
      }).then((unlisten) => unlisteners.push(unlisten));

      onCodexExit((exit) => {
      get().setCodexRunning(exit.employee_id, false);
      get().addCodexOutput(exit.employee_id, `[EXIT] Code: ${exit.code ?? "unknown"}`);
      get().updateEmployeeStatus(exit.employee_id, "offline");
    }).then((unlisten) => unlisteners.push(unlisten));

    return () => {
      unlisteners.forEach((unlisten) => unlisten());
      codexListenersActive = false;
    };
  },
}));
