import React, { createContext, useContext, useMemo } from 'react';

export interface IsmConfig {
  autoScrollAccordions: boolean;
  // future library config properties can be added here
}

const defaultIsmConfig: IsmConfig = {
  autoScrollAccordions: true,
};

const IsmContext = createContext<IsmConfig>(defaultIsmConfig);

export const IsmProvider: React.FC<{
  config?: Partial<IsmConfig>;
  children: React.ReactNode;
}> = ({ config, children }) => {
  const mergedConfig = useMemo(() => ({ ...defaultIsmConfig, ...config }), [config]);
  return <IsmContext.Provider value={mergedConfig}>{children}</IsmContext.Provider>;
};

export const useIsmConfig = () => useContext(IsmContext);
