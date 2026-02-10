import { NIGERIA_STATES_AND_LGAS } from '@/data/nigeria-location';
import { LocalGovernment, State } from '@/types';

export const getStateByName = (name: string): State | undefined => {
  return NIGERIA_STATES_AND_LGAS.find((state) => state.name.toLowerCase() === name.toLowerCase());
};

export const getStateByCode = (code: string): State | undefined => {
  return NIGERIA_STATES_AND_LGAS.find((state) => state.code.toLowerCase() === code.toLowerCase());
};

export const getLGAsByState = (stateName: string): LocalGovernment[] => {
  const state = getStateByName(stateName);
  return state ? state.lgas : [];
};

export const getAllStates = (): string[] => {
  return NIGERIA_STATES_AND_LGAS.map((state) => state.name);
};

export const getAllLGAs = (): string[] => {
  const allLGAs: string[] = [];
  NIGERIA_STATES_AND_LGAS.forEach((state) => {
    state.lgas.forEach((lga) => {
      allLGAs.push(lga.name);
    });
  });
  return allLGAs;
};

export const getTotalStatesCount = (): number => {
  return NIGERIA_STATES_AND_LGAS.length;
};

export const getTotalLGAsCount = (): number => {
  return NIGERIA_STATES_AND_LGAS.reduce((total, state) => total + state.lgas.length, 0);
};
