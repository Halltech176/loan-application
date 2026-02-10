export interface LocalGovernment {
  name: string;
  code?: string;
}

export interface State {
  name: string;
  capital: string;
  code: string;
  lgas: LocalGovernment[];
}

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
