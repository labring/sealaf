import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

import { TDB } from "@/apis/typing";

type State = {
  currentDB?: TDB | undefined;
  currentPolicy?: any;
  setCurrentDB: (currentDB: TDB | undefined) => void;
};

const useDBMStore = create<State>()(
  devtools(
    immer((set) => ({
      currentShow: "DB",
      currentDB: undefined,
      currentPolicy: undefined,
      setCurrentDB: async (currentDB: any) => {
        set((state) => {
          state.currentDB = currentDB;
        });
      },
    })),
  ),
);

export default useDBMStore;
